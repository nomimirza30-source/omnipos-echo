using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using OmniPOS.Api.Data;
using System.Security.Claims;

namespace OmniPOS.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class CashLogController : ControllerBase
{
    private readonly OmniDbContext _db;

    public CashLogController(OmniDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> GetLogs()
    {
        var tenantId = User.Claims.FirstOrDefault(c => c.Type == "TenantId")?.Value;
        if (string.IsNullOrEmpty(tenantId))
            return Unauthorized(new { Message = "TenantId claim missing." });

        var connection = _db.Database.GetDbConnection();
        await _db.Database.OpenConnectionAsync();

        var logs = new List<object>();
        using (var cmd = connection.CreateCommand())
        {
            cmd.CommandText = @"
                SELECT CashLogId, TenantId, StaffId, StaffName, TransactionType, Amount, Reason, CreatedAt
                FROM CashLogs
                WHERE TenantId = @tenantId
                  AND CreatedAt >= @today
                ORDER BY CreatedAt DESC";
            cmd.Parameters.Add(new SqliteParameter("@tenantId", tenantId));
            cmd.Parameters.Add(new SqliteParameter("@today", DateTime.UtcNow.Date.ToString("yyyy-MM-dd")));

            using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                logs.Add(new
                {
                    cashLogId = reader["CashLogId"].ToString(),
                    tenantId = reader["TenantId"].ToString(),
                    staffId = reader["StaffId"].ToString(),
                    staffName = reader["StaffName"].ToString(),
                    transactionType = reader["TransactionType"].ToString(),
                    amount = Convert.ToDecimal(reader["Amount"]),
                    reason = reader["Reason"].ToString(),
                    createdAt = reader["CreatedAt"].ToString()
                });
            }
        }

        return Ok(logs);
    }

    [HttpPost]
    public async Task<IActionResult> CreateLog([FromBody] CashLogDto newLog)
    {
        if (newLog.Amount <= 0)
            return BadRequest(new { Message = "Amount must be greater than zero." });

        if (string.IsNullOrWhiteSpace(newLog.Reason))
            return BadRequest(new { Message = "Reason is required." });

        // Get staff ID from JWT sub claim
        var staffIdStr = User.Claims.FirstOrDefault(c => c.Type == "sub")?.Value
                      ?? User.Claims.FirstOrDefault(c => c.Type == ClaimTypes.NameIdentifier)?.Value;
        var tenantIdStr = User.Claims.FirstOrDefault(c => c.Type == "TenantId")?.Value;

        Console.WriteLine($"[CashLog] staffId claim: {staffIdStr}, tenantId claim: {tenantIdStr}");
        Console.WriteLine($"[CashLog] All claims: {string.Join(", ", User.Claims.Select(c => $"{c.Type}={c.Value}"))}");

        if (!Guid.TryParse(staffIdStr, out Guid staffId))
            return Unauthorized(new { Message = $"Invalid or missing staff ID in token. Got: '{staffIdStr}'" });

        if (!Guid.TryParse(tenantIdStr, out Guid tenantId))
            return Unauthorized(new { Message = "Invalid or missing TenantId in token." });

        // Lookup staff name
        var staff = await _db.StaffMembers.IgnoreQueryFilters().FirstOrDefaultAsync(s => s.StaffId == staffId);
        var staffName = staff?.FullName ?? "Unknown";

        var logId = Guid.NewGuid();
        var now = DateTime.UtcNow;

        var connection = _db.Database.GetDbConnection();
        await _db.Database.OpenConnectionAsync();

        using (var cmd = connection.CreateCommand())
        {
            cmd.CommandText = @"
                INSERT INTO CashLogs (CashLogId, TenantId, StaffId, StaffName, TransactionType, Amount, Reason, CreatedAt)
                VALUES (@id, @tenantId, @staffId, @staffName, @type, @amount, @reason, @createdAt)";
            cmd.Parameters.Add(new SqliteParameter("@id", logId.ToString()));
            cmd.Parameters.Add(new SqliteParameter("@tenantId", tenantId.ToString()));
            cmd.Parameters.Add(new SqliteParameter("@staffId", staffId.ToString()));
            cmd.Parameters.Add(new SqliteParameter("@staffName", staffName));
            cmd.Parameters.Add(new SqliteParameter("@type", "Withdrawal"));
            cmd.Parameters.Add(new SqliteParameter("@amount", newLog.Amount));
            cmd.Parameters.Add(new SqliteParameter("@reason", newLog.Reason));
            cmd.Parameters.Add(new SqliteParameter("@createdAt", now.ToString("o")));

            await cmd.ExecuteNonQueryAsync();
        }

        return Ok(new
        {
            cashLogId = logId,
            tenantId = tenantId,
            staffId = staffId,
            staffName = staffName,
            transactionType = "Withdrawal",
            amount = newLog.Amount,
            reason = newLog.Reason,
            createdAt = now
        });
    }
}

public class CashLogDto
{
    public decimal Amount { get; set; }
    public string Reason { get; set; } = string.Empty;
}
