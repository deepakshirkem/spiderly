﻿using Microsoft.EntityFrameworkCore;
using Spiderly.Security.DTO;
using System.Security.Claims;
using Spiderly.Shared.Excel;
using Spiderly.Shared.Interfaces;
using Spiderly.Shared.Exceptions;
using Google.Apis.Auth;
using Spiderly.Security.Interfaces;
using Spiderly.Shared.Extensions;
using FluentValidation;
using Spiderly.Shared.Emailing;
using Spiderly.Security.Enums;
using Spiderly.Security.Entities;
using Spiderly.Shared.DTO;
using Microsoft.IdentityModel.Tokens;
using Spiderly.Shared.Resources;
using Spiderly.Security.ValidationRules;

namespace Spiderly.Security.Services
{
    /// <summary>
    /// Provides business logic for security-related operations, including authentication, registration,
    /// token management, and user and role management. It leverages various services like JWT authentication,
    /// email sending, and data access through Entity Framework Core.
    /// </summary>
    /// <typeparam name="TUser">The type of the user entity, which must implement the <see cref="IUser"/> interface.</typeparam>
    public class SecurityBusinessService<TUser> : BusinessServiceGenerated<TUser> where TUser : class, IUser, new()
    {
        private readonly IApplicationDbContext _context;
        private readonly IJwtAuthManager _jwtAuthManagerService;
        private readonly AuthenticationService _authenticationService;
        private readonly AuthorizationBusinessService<TUser> _authorizationService;
        private readonly EmailingService _emailingService;

        public SecurityBusinessService(
            IApplicationDbContext context, 
            IJwtAuthManager jwtAuthManagerService, 
            EmailingService emailingService, 
            AuthenticationService authenticationService, 
            AuthorizationBusinessService<TUser> authorizationService,
            ExcelService excelService, 
            IFileManager fileManager
        )
            : base(context, excelService, authorizationService, fileManager)
        {
            _context = context;
            _jwtAuthManagerService = jwtAuthManagerService;
            _emailingService = emailingService;
            _authenticationService = authenticationService;
            _authorizationService = authorizationService;
        }

        #region Authentication

        #region Login

        public async Task SendLoginVerificationEmail(LoginDTO loginDTO)
        {
            new LoginDTOValidationRules().ValidateAndThrow(loginDTO);

            string userEmail = null;
            long userId = 0;

            await _context.WithTransactionAsync(async () =>
            {
                TUser user = await Authenticate(loginDTO);
                userEmail = user.Email;
                userId = user.Id;
            });

            string verificationCode = _jwtAuthManagerService.GenerateAndSaveLoginVerificationCode(userEmail, userId, loginDTO.BrowserId);

            try
            {
                await _emailingService.SendVerificationEmailAsync(userEmail, verificationCode);
            }
            catch (Exception)
            {
                _jwtAuthManagerService.RemoveLoginVerificationTokensByEmail(userEmail); // We didn't send email, set all verification tokens invalid then
                throw;
            }
        }

        public AuthResultDTO Login(VerificationTokenRequestDTO verificationRequestDTO)
        {
            new VerificationTokenRequestDTOValidationRules().ValidateAndThrow(verificationRequestDTO);

            // FT: Can not be null, if its null it already has thrown
            LoginVerificationTokenDTO loginVerificationTokenDTO = _jwtAuthManagerService.ValidateAndGetLoginVerificationTokenDTO(
                verificationRequestDTO.VerificationCode, verificationRequestDTO.BrowserId, verificationRequestDTO.Email);

            JwtAuthResultDTO jwtAuthResultDTO = GetJwtAuthResultWithRefreshDTO(loginVerificationTokenDTO.UserId, loginVerificationTokenDTO.Email, loginVerificationTokenDTO.BrowserId);

            return GetAuthResultDTO(loginVerificationTokenDTO.UserId, loginVerificationTokenDTO.Email, jwtAuthResultDTO);
        }

        public async Task<AuthResultDTO> LoginExternal(ExternalProviderDTO externalProviderDTO, string googleClientId)
        {
            GoogleJsonWebSignature.Payload payload = await ValidateGoogleToken(externalProviderDTO.IdToken, googleClientId);

            return await _context.WithTransactionAsync(async () =>
            {
                TUser user = await GetUserByEmailAsync(payload.Email); // FT: Check if user already exist in the database
                DbSet<TUser> userDbSet = _context.DbSet<TUser>();

                if (user == null)
                {
                    user = new TUser
                    {
                        Email = payload.Email,
                        HasLoggedInWithExternalProvider = true,
                    };

                    await userDbSet.AddAsync(user);
                    await _context.SaveChangesAsync(); // Adding the new user which is logged in first time
                }
                else
                {
                    if (user.IsDisabled == true)
                        throw new BusinessException(SharedTerms.DisabledAccountException);

                    if (user.HasLoggedInWithExternalProvider != true)
                        await userDbSet.ExecuteUpdateAsync(x => x.SetProperty(x => x.HasLoggedInWithExternalProvider, true)); // There is no need for SaveChangesAsync because we don't need to update the version of the user
                }

                JwtAuthResultDTO jwtAuthResultDTO = GetJwtAuthResultWithRefreshDTO(user.Id, user.Email, externalProviderDTO.BrowserId);

                return GetAuthResultDTO(user.Id, user.Email, jwtAuthResultDTO);
            });
        }

        #endregion

        #region Registration

        public async Task<RegistrationVerificationResultDTO> SendRegistrationVerificationEmail(RegistrationDTO registrationDTO)
        {
            RegistrationVerificationResultDTO registrationResultDTO = new();

            new RegistrationDTOValidationRules().ValidateAndThrow(registrationDTO);

            await _context.WithTransactionAsync(async () =>
            {
                TUser user = await GetUserByEmailAsync(registrationDTO.Email);

                if (user == null)
                {
                    string verificationCode = _jwtAuthManagerService.GenerateAndSaveRegistrationVerificationCode(registrationDTO.Email, registrationDTO.BrowserId);

                    try
                    {
                        await _emailingService.SendVerificationEmailAsync(registrationDTO.Email, verificationCode);
                    }
                    catch (Exception)
                    {
                        _jwtAuthManagerService.RemoveRegistrationVerificationTokensByEmail(registrationDTO.Email); // We didn't send email, set all verification tokens invalid then
                        throw;
                    }
                }
                else
                {
                    throw new BusinessException(SharedTerms.SameEmailAlreadyExistsException);
                }
            });

            return registrationResultDTO;
        }

        public async Task<AuthResultDTO> Register(VerificationTokenRequestDTO verificationRequestDTO)
        {
            new VerificationTokenRequestDTOValidationRules().ValidateAndThrow(verificationRequestDTO);

            RegistrationVerificationTokenDTO registrationVerificationTokenDTO = _jwtAuthManagerService.ValidateAndGetRegistrationVerificationTokenDTO(
                verificationRequestDTO.VerificationCode, verificationRequestDTO.BrowserId, verificationRequestDTO.Email); // FT: Can not be null, if its null it already has thrown

            TUser user = null;

            await _context.WithTransactionAsync(async () =>
            {
                user = new TUser
                {
                    Email = registrationVerificationTokenDTO.Email,
                };

                await _context.DbSet<TUser>().AddAsync(user);
                await _context.SaveChangesAsync();
            });

            JwtAuthResultDTO jwtAuthResultDTO = GetJwtAuthResultWithRefreshDTO(user.Id, user.Email, verificationRequestDTO.BrowserId); // FT: User can't be null, it would throw earlier if he is
            //await SaveLogin(loginDTO); // FT: Is ipAddress == null is checked here // TODO FT: Log it

            return GetAuthResultDTO(user.Id, user.Email, jwtAuthResultDTO);
        }

        #endregion

        public async Task<AuthResultDTO> RefreshToken(RefreshTokenRequestDTO refreshTokenRequestDTO)
        {
            if (string.IsNullOrWhiteSpace(refreshTokenRequestDTO.RefreshToken))
                throw new SecurityTokenException(SharedTerms.ExpiredRefreshTokenException); // FT: It's not realy this reason, but it's easier then realy explaining the user what has happened, this could happen if he deleted the cache from the browser

            string accessToken = await _authenticationService.GetAccessTokenAsync();
            List<Claim> claims = _jwtAuthManagerService.GetClaimsForTheAccessToken(refreshTokenRequestDTO, accessToken);

            long accesTokenUserId = long.Parse(claims.FirstOrDefault(x => x.Type == ClaimTypes.PrimarySid)?.Value);
            string accessTokenUserEmail = claims.FirstOrDefault(x => x.Type == ClaimTypes.Email)?.Value;

            string emailFromTheDb = await GetCurrentUserEmailByIdAsync(accesTokenUserId);
            if (emailFromTheDb != accessTokenUserEmail) // The email from db changed, and the user is using the old one in access token
                _jwtAuthManagerService.RemoveRefreshTokenByEmail(accessTokenUserEmail);

            JwtAuthResultDTO jwtResult = _jwtAuthManagerService.Refresh(refreshTokenRequestDTO, accesTokenUserId, emailFromTheDb);

            return new AuthResultDTO
            {
                UserId = (long)jwtResult.UserId, // Here it will always be user, if there is not, it will break earlier
                Email = jwtResult.UserEmail,
                AccessToken = jwtResult.AccessToken,
                RefreshToken = jwtResult.Token.TokenString
            };
        }

        public async Task<string> GetCurrentUserEmailByIdAsync(long id)
        {
            return await _context.WithTransactionAsync(async () =>
            {
                return await _context.DbSet<TUser>().AsNoTracking().Where(x => x.Id == id).Select(x => x.Email).SingleOrDefaultAsync();
            });
        }

        public async Task<TUser> GetUserByEmailAsync(string email)
        {
            return await _context.WithTransactionAsync(async () =>
            {
                return await _context.DbSet<TUser>().AsNoTracking().Where(x => x.Email == email).SingleOrDefaultAsync();
            });
        }

        #endregion

        #region Helpers

        private JwtAuthResultDTO GetJwtAuthResultWithRefreshDTO(long userId, string userEmail, string browserId)
        {
            string ipAddress = _authenticationService.GetIPAddress();

            JwtAuthResultDTO jwtAuthResult = _jwtAuthManagerService.GenerateAccessAndRefreshTokens(userId, userEmail, ipAddress, browserId);

            return jwtAuthResult;
        }

        private AuthResultDTO GetAuthResultDTO(long userId, string userEmail, JwtAuthResultDTO jwtAuthResultDTO)
        {
            return new AuthResultDTO
            {
                UserId = userId,
                Email = userEmail,
                AccessToken = jwtAuthResultDTO.AccessToken,
                RefreshToken = jwtAuthResultDTO.Token.TokenString,
            };
        }

        private async Task<TUser> Authenticate(LoginDTO loginDTO)
        {
            return await _context.WithTransactionAsync(async () =>
            {
                TUser currentUser = await _context.DbSet<TUser>()
                    .Where(x => x.Email == loginDTO.Email)
                    .SingleOrDefaultAsync();

                if (currentUser == null)
                    throw new BusinessException(SharedTerms.AuthenticationEmailDoesNotExistException);

                if (currentUser.IsDisabled == true)
                    throw new BusinessException(SharedTerms.DisabledAccountException);

                return currentUser;
            });
        }

        private async Task<GoogleJsonWebSignature.Payload> ValidateGoogleToken(string idToken, string clientId)
        {
            GoogleJsonWebSignature.ValidationSettings settings = new GoogleJsonWebSignature.ValidationSettings()
            {
                Audience = new List<string>() { clientId }
            };

            GoogleJsonWebSignature.Payload payload = await GoogleJsonWebSignature.ValidateAsync(idToken, settings); // TODO FT: Try to pass the wrong token
            return payload;
        }

        #endregion

        #region User

        public async Task<UserBaseDTO> GetCurrentUserBaseDTO()
        {
            return await _context.WithTransactionAsync(async () =>
            {
                return await _context.DbSet<TUser>()
                    .Where(x => x.Id == _authenticationService.GetCurrentUserId())
                    .Select(x => new UserBaseDTO
                    {
                        Id = x.Id,
                        Email = x.Email
                    })
                    .SingleOrDefaultAsync();
            });
        }

        public async Task<List<NamebookDTO<int>>> GetRolesNamebookListForUser(long userId, bool authorize = true)
        {
            return await _context.WithTransactionAsync(async () =>
            {
                if (authorize)
                {
                    await _authorizationService.AuthorizeAndThrowAsync<TUser>(SecurityPermissionCodes.ReadUser);
                }

                return await _context.DbSet<TUser>()
                    .AsNoTracking()
                    .Where(x => x.Id == userId)
                    .SelectMany(x => x.Roles)
                    .Select(role => new NamebookDTO<int>
                    {
                        Id = role.Id,
                        DisplayName = role.Name,
                    })
                    .ToListAsync();
            });
        }

        public async Task UpdateRoleListForUser(long userId, List<int> selectedRoleIds)
        {
            await _context.WithTransactionAsync(async () =>
            {
                TUser user = await GetInstanceAsync<TUser, long>(userId, null);

                foreach (Role role in user.Roles.ToList())
                {
                    if (selectedRoleIds.Contains(role.Id))
                        selectedRoleIds.Remove(role.Id);
                    else
                        user.Roles.Remove(role);
                }

                List<Role> roleListToInsert = await _context.DbSet<Role>().Where(x => selectedRoleIds.Contains(x.Id)).ToListAsync();

                user.Roles.AddRange(roleListToInsert);
                await _context.SaveChangesAsync();
            });
        }

        #endregion

        #region Role

        public async override Task<RoleMainUIFormDTO> GetRoleMainUIFormDTO(int id, bool authorize)
        {
            return await _context.WithTransactionAsync(async () =>
            {
                if (authorize)
                {
                    await _authorizationService.AuthorizeRoleReadAndThrow(id);
                }

                return new RoleMainUIFormDTO
                {
                    RoleDTO = await GetRoleDTO(id, false),
                    PermissionsNamebookDTOList = await GetPermissionsNamebookListForRole(id, false),
                    UsersNamebookDTOList = await GetUsersNamebookListForRole(id, false),
                };
            });
        }

        protected override async Task OnAfterSaveRoleAndReturnSaveBodyDTO(RoleDTO savedDTO, RoleSaveBodyDTO saveBodyDTO) 
        {
            await _context.WithTransactionAsync(async () =>
            {
                await UpdateUsersForRole(savedDTO.Id, saveBodyDTO.SelectedUsersIds);
            });
        }

        public async Task UpdateUsersForRole(int roleId, List<long> selectedUserIds)
        {
            if (selectedUserIds == null)
                return;

            await _context.WithTransactionAsync(async () =>
            {
                List<UserRole> roleUserList = await _context.DbSet<UserRole>().Where(x => x.RoleId == roleId).ToListAsync();

                foreach (UserRole roleUser in roleUserList)
                {
                    if (selectedUserIds.Contains(roleUser.UserId))
                        selectedUserIds.Remove(roleUser.UserId);
                    else
                        _context.DbSet<UserRole>().Remove(roleUser);
                }

                foreach (long selectedUserId in selectedUserIds)
                {
                    UserRole roleUser = new UserRole
                    {
                        RoleId = roleId,
                        UserId = selectedUserId
                    };

                    await _context.DbSet<UserRole>().AddAsync(roleUser);
                }


                await _context.SaveChangesAsync();
            });
        }

        public async Task<List<NamebookDTO<long>>> GetUsersNamebookListForRole(long roleId, bool authorize = true)
        {
            return await _context.WithTransactionAsync(async () =>
            {
                if (authorize)
                {
                    await _authorizationService.AuthorizeAndThrowAsync<TUser>(SecurityPermissionCodes.ReadRole);
                }

                return await _context.DbSet<TUser>()
                    .AsNoTracking()
                    .Where(x => x.Roles.Any(x => x.Id == roleId))
                    .Select(x => new NamebookDTO<long>
                    {
                        Id = x.Id,
                        DisplayName = x.Email,
                    })
                    .ToListAsync();
            });
        }

        public async Task<List<NamebookDTO<long>>> GetUsersAutocompleteListForRole(int limit, string filter, bool authorize)
        {
            IQueryable<TUser> query = _context.DbSet<TUser>();

            return await _context.WithTransactionAsync(async () =>
            {
                if (authorize)
                {
                    await _authorizationService.AuthorizeAndThrowAsync<TUser>(SecurityPermissionCodes.ReadRole);
                }

                if (!string.IsNullOrEmpty(filter))
                    query = query.Where(x => x.Email.Contains(filter));

                return await query
                    .AsNoTracking()
                    .Take(limit)
                    .Select(x => new NamebookDTO<long>
                    {
                        Id = x.Id,
                        DisplayName = x.Email,
                    })
                    .ToListAsync();
            });
        }

        #endregion
    }
}
