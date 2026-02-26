using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.SignalR;

namespace OmniPOS.Api.Hubs;

public class NotificationHub : Hub
{
    public async Task JoinRoleGroup(string role)
    {
        var tenantId = Context.User.FindFirst("TenantId")?.Value;
        if (!string.IsNullOrEmpty(tenantId))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"Tenant_{tenantId}_{role}");
            Console.WriteLine($"[SignalR] Connection {Context.ConnectionId} joined role group: Tenant_{tenantId}_{role}");
        }
    }

    public async Task JoinTenantGroup()
    {
        var tenantId = Context.User.FindFirst("TenantId")?.Value;
        if (!string.IsNullOrEmpty(tenantId))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"Tenant_{tenantId}");
            Console.WriteLine($"[SignalR] Connection {Context.ConnectionId} joined global tenant group: Tenant_{tenantId}");
        }
    }

    public async Task LeaveRoleGroup(string role)
    {
        var tenantId = Context.User.FindFirst("TenantId")?.Value;
        if (!string.IsNullOrEmpty(tenantId))
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"Tenant_{tenantId}_{role}");
        }
    }
}
