using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OmniPOS.Api.Data;

namespace OmniPOS.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class InventoryController : ControllerBase
{
    private readonly OmniDbContext _context;

    public InventoryController(OmniDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<InventoryItem>>> GetStock()
    {
        return await _context.InventoryItems.ToListAsync();
    }

    [HttpPost]
    public async Task<ActionResult<InventoryItem>> AddStockItem(InventoryItem item)
    {
        _context.InventoryItems.Add(item);
        await _context.SaveChangesAsync();
        return Ok(item);
    }

    [HttpPost("deduct/{menuItemId}")]
    public async Task<IActionResult> DeductStock(Guid menuItemId, [FromQuery] int quantity = 1)
    {
        var recipes = await _context.MenuRecipes
            .Where(r => r.ProductId == menuItemId)
            .ToListAsync();

        foreach (var recipe in recipes)
        {
            var item = await _context.InventoryItems.FindAsync(recipe.InventoryItemId);
            if (item != null)
            {
                item.CurrentStock -= (recipe.Quantity * quantity);
            }
        }

        await _context.SaveChangesAsync();
        return Ok(new { message = "Stock deducted successfully" });
    }
}
