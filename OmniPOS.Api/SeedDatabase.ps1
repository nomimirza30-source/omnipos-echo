# ============================================
# OmniPOS Manual Database Seed Script
# ============================================
# This script manually inserts the admin account into the SQLite database

Write-Host "=== OmniPOS Manual Database Seed ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check if database exists
$dbPath = ".\omnipos.db"
if (-not (Test-Path $dbPath)) {
    Write-Host "❌ Database file not found at: $dbPath" -ForegroundColor Red
    Write-Host "Please make sure the backend has run at least once to create the database." -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Found database at: $dbPath" -ForegroundColor Green

# Step 2: Load BCrypt library and generate password hash
Write-Host ""
Write-Host "Generating BCrypt password hash..." -ForegroundColor Yellow

try {
    # Load the BCrypt DLL from the build output
    $bcryptDll = ".\bin\Debug\net9.0\BCrypt.Net-Next.dll"
    if (-not (Test-Path $bcryptDll)) {
        throw "BCrypt.Net-Next.dll not found. Please build the project first."
    }
    
    Add-Type -Path $bcryptDll
    
    # Generate hash for "admin123"
    $passwordHash = [BCrypt.Net.BCrypt]::HashPassword("admin123")
    Write-Host "✅ Password hash generated" -ForegroundColor Green
    
}
catch {
    Write-Host "❌ Error generating password hash: $_" -ForegroundColor Red
    exit 1
}

# Step 3: Create SQL commands
$tenantId = [Guid]::NewGuid().ToString()
$staffId = [Guid]::NewGuid().ToString()
$now = (Get-Date).ToUniversalTime().ToString("yyyy-MM-dd HH:mm:ss")

$sql = @"
-- Insert Tenant
INSERT OR IGNORE INTO Tenants (TenantId, Name, AppName, PrimaryColor, ThemeMode, CreatedAt, UpdatedAt)
VALUES ('$tenantId', 'OmniPOS Main', 'OmniPOS', '#38bdf8', 'dark', '$now', '$now');

-- Insert Admin Staff
INSERT OR IGNORE INTO StaffMembers (StaffId, TenantId, FullName, Role, Username, PasswordHash, Email, IsActive, CreatedAt, UpdatedAt)
VALUES ('$staffId', '$tenantId', 'System Admin', 'Admin', 'admin', '$passwordHash', 'admin@omnipos.com', 1, '$now', '$now');
"@

# Step 4: Execute SQL using System.Data.SQLite
Write-Host ""
Write-Host "Inserting data into database..." -ForegroundColor Yellow

try {
    # Download and use System.Data.SQLite
    $sqliteDll = ".\bin\Debug\net9.0\System.Data.SQLite.dll"
    
    if (-not (Test-Path $sqliteDll)) {
        Write-Host "Downloading System.Data.SQLite..." -ForegroundColor Yellow
        # Use the Microsoft.Data.Sqlite from the project instead
        $sqliteDll = ".\bin\Debug\net9.0\Microsoft.Data.Sqlite.dll"
    }
    
    if (Test-Path $sqliteDll) {
        Add-Type -Path $sqliteDll
        
        $connectionString = "Data Source=$dbPath"
        $connection = New-Object Microsoft.Data.Sqlite.SqliteConnection($connectionString)
        $connection.Open()
        
        $command = $connection.CreateCommand()
        $command.CommandText = $sql
        $rowsAffected = $command.ExecuteNonQuery()
        
        $connection.Close()
        
        Write-Host "✅ Database seeded successfully!" -ForegroundColor Green
    }
    else {
        throw "SQLite library not found. Using fallback method..."
    }
    
}
catch {
    Write-Host "⚠️  Using fallback method (raw SQL file)..." -ForegroundColor Yellow
    
    # Fallback: Create SQL file for manual execution
    $sqlFile = ".\manual_seed.sql"
    $sql | Out-File -FilePath $sqlFile -Encoding UTF8
    
    Write-Host ""
    Write-Host "✅ SQL file created at: $sqlFile" -ForegroundColor Green
    Write-Host ""
    Write-Host "To complete the setup, run this command:" -ForegroundColor Yellow
    Write-Host "  sqlite3 omnipos.db < manual_seed.sql" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Or install DB Browser for SQLite and run the SQL manually." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Setup Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Default Login Credentials:" -ForegroundColor Green
Write-Host "  Username: admin" -ForegroundColor White
Write-Host "  Password: admin123" -ForegroundColor White
Write-Host ""
Write-Host "You can now start the backend and login!" -ForegroundColor Green
