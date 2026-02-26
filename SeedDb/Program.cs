using OmniPOS.Api.Data;
using OmniPOS.Api.Models;
using OmniPOS.Api.Services;
using Microsoft.EntityFrameworkCore;

Console.WriteLine("=== OmniPOS Database Manual Seed ===\n");

var optionsBuilder = new DbContextOptionsBuilder<OmniDbContext>();
optionsBuilder.UseSqlite("Data Source=../OmniPOS.Api/omnipos.db");

using var context = new OmniDbContext(optionsBuilder.Options);

// Check existing data
var staffCount = await context.StaffMembers.IgnoreQueryFilters().CountAsync();
var tenantCount = await context.Tenants.IgnoreQueryFilters().CountAsync();

Console.WriteLine($"Current Database State:");
Console.WriteLine($"  Tenants: {tenantCount}");
Console.WriteLine($"  Staff: {staffCount}\n");

if (staffCount > 0)
{
    Console.WriteLine("⚠️  Database already has staff accounts. Skipping seed.");
    return;
}

// Create Tenant
var tenantId = Guid.NewGuid();
var tenant = new Tenant
{
    TenantId = tenantId,
    Name = "OmniPOS Main",
    AppName = "OmniPOS",
    PrimaryColor = "#38bdf8",
    ThemeMode = "dark"
};

context.Tenants.Add(tenant);
await context.SaveChangesAsync();
Console.WriteLine("✅ Tenant created");

// Create Staff with BCrypt hashed passwords
var adminHash = PasswordHasher.HashPassword("admin123");
var kitchenHash = PasswordHasher.HashPassword("kitchen123");
var waiterHash = PasswordHasher.HashPassword("waiter123");

var staff = new List<Staff>
{
    new Staff
    {
        StaffId = Guid.NewGuid(),
        TenantId = tenantId,
        FullName = "System Admin",
        Role = "Admin",
        Username = "admin",
        PasswordHash = adminHash,
        Email = "admin@omnipos.com",
        IsActive = true
    },
    new Staff
    {
        StaffId = Guid.NewGuid(),
        TenantId = tenantId,
        FullName = "Head Chef",
        Role = "Kitchen",
        Username = "kitchen",
        PasswordHash = kitchenHash,
        Email = "kitchen@omnipos.com",
        IsActive = true
    },
    new Staff
    {
        StaffId = Guid.NewGuid(),
        TenantId = tenantId,
        FullName = "Senior Waiter",
        Role = "Waiter",
        Username = "waiter",
        PasswordHash = waiterHash,
        Email = "waiter@omnipos.com",
        IsActive = true
    }
};

context.StaffMembers.AddRange(staff);
await context.SaveChangesAsync();

Console.WriteLine($"✅ Created {staff.Count} staff accounts:");
foreach (var s in staff)
{
    Console.WriteLine($"   - {s.Username} / {s.Role}");
}

Console.WriteLine("\n🎉 Database seeding complete!");
Console.WriteLine("\nDefault Credentials:");
Console.WriteLine("  Username: admin    | Password: admin123");
Console.WriteLine("  Username: kitchen  | Password: kitchen123");
Console.WriteLine("  Username: waiter   | Password: waiter123");
