$sqliteDll = ".\bin\Debug\net9.0\Microsoft.Data.Sqlite.dll"
Add-Type -Path $sqliteDll
$connectionString = "Data Source=omnipos.db"
$connection = New-Object Microsoft.Data.Sqlite.SqliteConnection($connectionString)
$connection.Open()
$command = $connection.CreateCommand()
$command.CommandText = "SELECT StaffId, TenantId, FullName, Role, Username FROM StaffMembers"
$reader = $command.ExecuteReader()
while ($reader.Read()) {
    Write-Host "User: $($reader.GetString(4)), Role: $($reader.GetString(3)), Tenant: $($reader.GetString(1))"
}
$connection.Close()
