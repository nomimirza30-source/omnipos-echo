using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OmniPOS.Api.Data;

namespace OmniPOS.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class MenuController : ControllerBase
{
    private readonly OmniDbContext _context;

    public MenuController(OmniDbContext context)
    {
        _context = context;
    }

    [HttpGet("categories")]
    public async Task<ActionResult<IEnumerable<Category>>> GetCategories()
    {
        return await _context.Categories.ToListAsync();
    }

    [HttpPost("categories")]
    public async Task<ActionResult<Category>> CreateCategory(Category category)
    {
        _context.Categories.Add(category);
        await _context.SaveChangesAsync();
        return Ok(category);
    }

    [HttpDelete("categories/{name}")]
    public async Task<IActionResult> DeleteCategory(string name)
    {
        var encodedName = Uri.UnescapeDataString(name).Trim();
        var categories = await _context.Categories
            .Where(c => c.Name.ToLower() == encodedName.ToLower())
            .ToListAsync();
            
        if (categories.Any())
        {
            _context.Categories.RemoveRange(categories);
            await _context.SaveChangesAsync();
        }

        return NoContent();
    }

    [HttpGet("items")]
    public async Task<ActionResult<IEnumerable<Product>>> GetMenuItems()
    {
        return await _context.Products.ToListAsync();
    }

    [HttpPost("items")]
    public async Task<ActionResult<Product>> CreateMenuItem(Product item)
    {
        _context.Products.Add(item);
        await _context.SaveChangesAsync();
        return Ok(item);
    }

    [HttpPut("items/{id}")]
    public async Task<IActionResult> UpdateMenuItem(Guid id, Product item)
    {
        if (id != item.ProductId)
        {
            return BadRequest();
        }

        _context.Entry(item).State = EntityState.Modified;

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            if (!_context.Products.Any(e => e.ProductId == id))
            {
                return NotFound();
            }
            else
            {
                throw;
            }
        }

        return NoContent();
    }

    [HttpDelete("items/{id}")]
    public async Task<IActionResult> DeleteMenuItem(Guid id)
    {
        var product = await _context.Products.FindAsync(id);
        if (product == null)
        {
            return NotFound();
        }

        _context.Products.Remove(product);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    [HttpPost("recipes")]
    public async Task<IActionResult> AddRecipeItem(MenuRecipe recipe)
    {
        _context.MenuRecipes.Add(recipe);
        await _context.SaveChangesAsync();
        return Ok();
    }
}
