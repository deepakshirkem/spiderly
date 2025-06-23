dotnet tool uninstall --global Spiderly.CLI
dotnet pack

$latest = Get-ChildItem ./nupkg -Filter "*.nupkg" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
$version = [regex]::Match($latest.Name, "(?<=Spiderly\.CLI\.)\d+\.\d+\.\d+(-[a-z0-9\.]+)?(?=\.nupkg)").Value

dotnet tool install --global --add-source ./nupkg Spiderly.CLI --version $version

Read-Host -Prompt "Press Enter to exit"