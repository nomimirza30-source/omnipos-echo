namespace OmniPOS.Api.Middleware;

public class TenantMiddleware
{
    private readonly RequestDelegate _next;

    public TenantMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context, ITenantProvider tenantProvider)
    {
        Console.WriteLine($"[TenantMiddleware] Request: {context.Request.Method} {context.Request.Path}");

        if (context.Request.Headers.TryGetValue("X-Tenant-ID", out var tenantIdStr))
        {
            Console.WriteLine($"[TenantMiddleware] Found X-Tenant-ID header: '{tenantIdStr}'");
            if (Guid.TryParse(tenantIdStr, out var tenantId))
            {
                tenantProvider.TenantId = tenantId;
                Console.WriteLine($"[TenantMiddleware] Set TenantId to: {tenantId}");
            }
            else
            {
                Console.WriteLine($"[TenantMiddleware] Failed to parse TenantId: '{tenantIdStr}'");
            }
        }
        else
        {
            // FALLBACK: Extract from JWT Claims (Critical for SignalR connections)
            var tenantClaim = context.User.FindFirst("TenantId")?.Value;
            if (!string.IsNullOrEmpty(tenantClaim) && Guid.TryParse(tenantClaim, out var tenantId))
            {
                tenantProvider.TenantId = tenantId;
                Console.WriteLine($"[TenantMiddleware] Set TenantId from JWT: {tenantId}");
            }
            else
            {
                Console.WriteLine("[TenantMiddleware] X-Tenant-ID header not found and no TenantId claim in JWT.");
            }
        }

        await _next(context);
    }
}
