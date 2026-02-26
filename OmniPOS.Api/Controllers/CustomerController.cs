using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OmniPOS.Api.Data;
using OmniPOS.Api.Middleware;

namespace OmniPOS.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class CustomerController : ControllerBase
{
    private readonly OmniDbContext _context;
    private readonly ITenantProvider _tenantProvider;

    public CustomerController(OmniDbContext context, ITenantProvider tenantProvider)
    {
        _context = context;
        _tenantProvider = tenantProvider;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<Customer>>> GetCustomers()
    {
        var tenantId = _tenantProvider.TenantId;
        if (tenantId == null) return BadRequest("Tenant not identified");

        var customers = await _context.Customers
            .Where(c => c.TenantId == tenantId.Value)
            .OrderBy(c => c.Name)
            .ToListAsync();

        return Ok(customers);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<Customer>> GetCustomer(Guid id)
    {
        var customer = await _context.Customers.FindAsync(id);
        if (customer == null) return NotFound();

        return Ok(customer);
    }

    [HttpPost]
    public async Task<ActionResult<Customer>> CreateCustomer([FromBody] CustomerCreateDto dto)
    {
        var tenantId = _tenantProvider.TenantId;
        if (tenantId == null) return BadRequest("Tenant not identified");

        var customer = new Customer
        {
            CustomerId = Guid.NewGuid(),
            TenantId = tenantId.Value,
            Name = dto.Name,
            Email = dto.Email ?? string.Empty,
            Phone = dto.Phone ?? string.Empty,
            CreatedAt = DateTime.UtcNow,
            LastVisit = DateTime.UtcNow
        };

        _context.Customers.Add(customer);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetCustomer), new { id = customer.CustomerId }, customer);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateCustomer(Guid id, [FromBody] CustomerUpdateDto dto)
    {
        var customer = await _context.Customers.FindAsync(id);
        if (customer == null) return NotFound();

        if (!string.IsNullOrEmpty(dto.Name)) customer.Name = dto.Name;
        if (!string.IsNullOrEmpty(dto.Email)) customer.Email = dto.Email;
        if (!string.IsNullOrEmpty(dto.Phone)) customer.Phone = dto.Phone;

        await _context.SaveChangesAsync();

        return Ok(customer);
    }

    [HttpDelete("{id}")]
    [Authorize(Policy = "RequireAdmin")]
    public async Task<IActionResult> DeleteCustomer(Guid id)
    {
        var customer = await _context.Customers.FindAsync(id);
        if (customer == null) return NotFound();

        // GDPR: Anonymize instead of hard delete
        customer.Name = $"Deleted User {customer.CustomerId.ToString().Substring(0, 8)}";
        customer.Email = "";
        customer.Phone = "";

        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpGet("{id}/order-history")]
    public async Task<ActionResult<object>> GetOrderHistory(Guid id)
    {
        var orders = await _context.Orders
            .Where(o => o.CustomerId == id && o.Status == "Paid")
            .OrderByDescending(o => o.PaidAt)
            .Take(10)
            .Select(o => new
            {
                o.OrderId,
                Amount = o.TotalAmount,
                o.FinalTotal,
                o.PaidAt,
                o.PaymentMethod
            })
            .ToListAsync();

        return Ok(orders);
    }

    [HttpGet("export-data/{id}")]
    public async Task<ActionResult<object>> ExportCustomerData(Guid id)
    {
        var customer = await _context.Customers.FindAsync(id);
        if (customer == null) return NotFound();

        var orders = await _context.Orders
            .Where(o => o.CustomerId == id)
            .ToListAsync();

        return Ok(new
        {
            Customer = customer,
            Orders = orders,
            ExportedAt = DateTime.UtcNow
        });
    }
}

public class CustomerCreateDto
{
    public string Name { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? Phone { get; set; }
}

public class CustomerUpdateDto
{
    public string? Name { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
}
