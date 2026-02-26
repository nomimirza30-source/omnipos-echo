using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OmniPOS.Api.Data;
using OmniPOS.Api.Services;

namespace OmniPOS.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin,Owner")]
public class TenantController : ControllerBase
{
    private readonly OmniDbContext _context;

    public TenantController(OmniDbContext context)
    {
        _context = context;
    }

    // GET: api/tenant
    [HttpGet]
    [AllowAnonymous] // Needed so the frontend can retrieve tenants before logging in (or debug-tenants handles this)
    public async Task<IActionResult> GetAllTenants()
    {
        var tenants = await _context.Tenants.ToListAsync();
        return Ok(tenants.Select(t => new {
            t.TenantId,
            t.Name,
            t.AppName,
            t.PrimaryColor
        }));
    }

    // POST: api/tenant
    [HttpPost]
    public async Task<IActionResult> CreateTenant([FromBody] CreateTenantRequest request)
    {
        try
        {
            var newTenantId = Guid.NewGuid();

            var newTenant = new Tenant
            {
                TenantId = newTenantId,
                Name = request.Name,
                // Default settings
                AppName = request.Name,
                PrimaryColor = "#38bdf8",
                SecondaryColor = "#818cf8",
                ThemeMode = "dark"
            };

            // Notice we do NOT use ITenantProvider to EnforceTenantId here because Tenant is a global root entity
            // We just add it directly. 
            _context.Tenants.Add(newTenant);
            await _context.SaveChangesAsync(); // Save tenant first

            // Auto-create a default Admin user for the NEW tenant.
            // IMPORTANT: We use raw SQL to bypass EnforceTenantId() in OmniDbContext,
            // which would otherwise overwrite the new tenant's ID with the calling user's
            // tenant ID.
            var adminPassword = "admin123";
            var adminStaffId = Guid.NewGuid();
            var adminPasswordHash = PasswordHasher.HashPassword(adminPassword);
            await _context.Database.ExecuteSqlRawAsync(
                @"INSERT INTO StaffMembers (StaffId, TenantId, FullName, Role, Username, PasswordHash, Email, NINumber, BankDetails, PayRate, WorkingDays, Status)
                  VALUES ({0}, {1}, {2}, {3}, {4}, {5}, {6}, {7}, {8}, {9}, {10}, {11})",
                adminStaffId, newTenantId, "Admin", "Admin", "admin", adminPasswordHash,
                "", "", "", 0.00m, "[]", "Active"
            );

            return Ok(new
            {
                id = newTenant.TenantId,
                name = newTenant.Name,
                createdAt = DateTime.UtcNow.ToString("o"),
                address = request.Address,
                owner = request.Owner,
                contact = request.Contact,
                status = request.Status,
                adminUsername = "admin",
                adminPassword = adminPassword
            });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[TenantController] Error creating tenant: {ex}");
            return StatusCode(500, new { message = "Server error creating new branch location." });
        }
    }

    // POST: api/tenant/seed-admin/{tenantId}
    // One-time helper to seed an admin for an existing tenant that has no admin
    [HttpPost("seed-admin/{tenantId}")]
    [AllowAnonymous]
    public async Task<IActionResult> SeedAdminForTenant(Guid tenantId)
    {
        try
        {
            var tenant = await _context.Tenants.FindAsync(tenantId);
            if (tenant == null)
                return NotFound(new { message = "Tenant not found." });

            // Check if an admin already exists for this tenant
            var existingAdmin = await _context.StaffMembers
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(s => s.TenantId == tenantId && s.Role == "Admin");

            if (existingAdmin != null)
                return Ok(new { message = $"Admin already exists: {existingAdmin.Username}", username = existingAdmin.Username });

            // Use raw SQL to bypass EnforceTenantId() which would overwrite TenantId
            var newAdminId = Guid.NewGuid();
            var newAdminHash = PasswordHasher.HashPassword("admin123");
            await _context.Database.ExecuteSqlRawAsync(
                @"INSERT INTO StaffMembers (StaffId, TenantId, FullName, Role, Username, PasswordHash, Email, NINumber, BankDetails, PayRate, WorkingDays, Status)
                  VALUES ({0}, {1}, {2}, {3}, {4}, {5}, {6}, {7}, {8}, {9}, {10}, {11})",
                newAdminId, tenantId, "Admin", "Admin", "admin", newAdminHash,
                "", "", "", 0.00m, "[]", "Active"
            );

            return Ok(new
            {
                message = $"Admin created for tenant '{tenant.Name}'",
                username = "admin",
                password = "admin123",
                tenantId = tenantId
            });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[TenantController] Error seeding admin: {ex}");
            return StatusCode(500, new { message = "Server error seeding admin user." });
        }
    }
}

public class CreateTenantRequest
{
    public string Name { get; set; } = string.Empty;
    public string Owner { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string Contact { get; set; } = string.Empty;
    public string Status { get; set; } = "Active";
}
