using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Spiderly.Security.Enums
{
    public static partial class SecurityPermissionCodes
    {
        public static string ReadUser { get; } = "ReadUser";
        public static string EditUser { get; } = "EditUser";
        public static string InsertUser { get; } = "InsertUser";
        public static string DeleteUser { get; } = "DeleteUser";
    }
}
