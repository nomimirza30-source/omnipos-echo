using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OmniPOS.Api.Data;

namespace OmniPOS.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class StaffRotaController : ControllerBase
{
    private readonly OmniDbContext _context;

    public StaffRotaController(OmniDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<StaffShift>>> GetShifts()
    {
        return await _context.StaffShifts.ToListAsync();
    }

    [HttpPost]
    public async Task<ActionResult<StaffShift>> ScheduleShift(StaffShift shift)
    {
        _context.StaffShifts.Add(shift);
        await _context.SaveChangesAsync();
        return Ok(shift);
    }

    [HttpPost("clock-in/{shiftId}")]
    public async Task<IActionResult> ClockIn(Guid shiftId)
    {
        var shift = await _context.StaffShifts.FindAsync(shiftId);
        if (shift == null) return NotFound();

        shift.ActualStartTime = DateTimeOffset.UtcNow;
        await _context.SaveChangesAsync();
        return Ok(shift);
    }

    [HttpPost("clock-out/{shiftId}")]
    public async Task<IActionResult> ClockOut(Guid shiftId)
    {
        var shift = await _context.StaffShifts.FindAsync(shiftId);
        if (shift == null) return NotFound();

        shift.ActualEndTime = DateTimeOffset.UtcNow;
        await _context.SaveChangesAsync();
        return Ok(shift);
    }
}
