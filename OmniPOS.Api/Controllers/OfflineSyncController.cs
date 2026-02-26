using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OmniPOS.Api.Data;
using System.Text.Json;
using System.Text.Json.Serialization;

using Microsoft.AspNetCore.SignalR;
using OmniPOS.Api.Hubs;

namespace OmniPOS.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class OfflineSyncController : ControllerBase
{
    private readonly OmniDbContext _dbContext;
    private readonly IHubContext<NotificationHub> _hubContext;

    public OfflineSyncController(OmniDbContext dbContext, IHubContext<NotificationHub> hubContext)
    {
        _dbContext = dbContext;
        _hubContext = hubContext;
    }

    [HttpPost("sync-orders")]
    public async Task<IActionResult> SyncOrders([FromBody] List<OrderSyncDto> localOrders)
    {
        var syncResults = new List<SyncResultDto>();
        Console.WriteLine($"[SyncOrders] Processing {localOrders.Count} orders...");
        foreach (var localOrder in localOrders)
        {
            Console.WriteLine($"[SyncOrders] Order ID: {localOrder.OrderId}, Amount: {localOrder.TotalAmount}, Status: {localOrder.Status}");
            var existingOrder = await _dbContext.Orders
                .IgnoreQueryFilters() // Need to check if it exists even if filtered initially (security logic handles TenantId later)
                .FirstOrDefaultAsync(o => o.OrderId == localOrder.OrderId);

            if (existingOrder == null)
            {
                // New order from local device
                var newOrder = new Order
                {
                    OrderId = localOrder.OrderId,
                    StaffId = localOrder.StaffId,
                    CustomerName = localOrder.CustomerName,
                    TableId = localOrder.TableId,
                    TotalAmount = localOrder.TotalAmount,
                    Status = localOrder.Status,
                    WorkflowStatus = localOrder.Status, // Keep consistent
                    MetadataJson = localOrder.MetadataJson,
                    PendingAmendmentsJson = localOrder.PendingAmendmentsJson,
                    Notes = localOrder.Notes,
                    GuestCount = localOrder.GuestCount,
                    PaymentMethod = localOrder.PaymentMethod,
                    VectorClock = localOrder.VectorClock,
                    CreatedAt = localOrder.CreatedAt,
                    PaidAt = localOrder.PaidAt,
                    DiscountReason = localOrder.DiscountReason,
                    ServiceCharge = localOrder.ServiceCharge,
                    Discount = localOrder.Discount,
                    DiscountType = localOrder.DiscountType,
                    FinalTotal = localOrder.FinalTotal,
                    IsAmended = localOrder.IsAmended
                };

                _dbContext.Orders.Add(newOrder);
                
                // Notify Kitchen/Admin/Manager
                var tableInfo = !string.IsNullOrEmpty(localOrder.TableId) ? $"Table {localOrder.TableId}" : "Walk-in";
                var message = $"New Order placed by {localOrder.CustomerName} ({tableInfo})";
                
                var rolesToNotify = new[] { "Kitchen", "Chef", "Assistant Chef", "Admin", "Manager", "Owner" };
                foreach (var role in rolesToNotify)
                {
                    var notification = new Notification
                    {
                        NotificationId = Guid.NewGuid(),
                        OrderId = localOrder.OrderId,
                        TargetRole = role,
                        Message = message,
                        Type = "info",
                        CreatedAt = DateTime.UtcNow,
                        IsRead = false
                    };
                    _dbContext.Notifications.Add(notification);

                    var targetGroup = role == "Chef" || role == "Assistant Chef" ? "Kitchen" : role;
                    await _hubContext.Clients.Group($"Tenant_{newOrder.TenantId}_{targetGroup}").SendAsync("ReceiveNotification", new 
                    {
                        id = notification.NotificationId,
                        title = "New Order Placed",
                        message = message,
                        type = "info",
                        orderId = localOrder.OrderId,
                        timestamp = notification.CreatedAt
                    });
                }

                // Global tenant-wide broadcast for UI refresh (New Order)
                await _hubContext.Clients.Group($"Tenant_{newOrder.TenantId}").SendAsync("ReceiveOrderUpdate", new { id = newOrder.OrderId, status = newOrder.WorkflowStatus });

                Console.WriteLine($"[SyncOrders] Success: Order {localOrder.OrderId} added to context.");
                
                // Update Table Status to 'Occupied'
                if (!string.IsNullOrEmpty(localOrder.TableId))
                {
                    var tableIds = localOrder.TableId.Split(',', StringSplitOptions.RemoveEmptyEntries);
                    var tablesToUpdate = await _dbContext.RestaurantTables
                        .Where(t => tableIds.Contains(t.RestaurantTableId.ToString()))
                        .ToListAsync();

                    foreach (var table in tablesToUpdate)
                    {
                        table.Status = "Occupied";
                        Console.WriteLine($"[SyncOrders] Table {table.TableNumber} marked as Occupied.");
                    }
                }

                // Auto-decrement StockQuantity
                var stockUpdates = new List<object>();
                if (!string.IsNullOrEmpty(localOrder.MetadataJson))
                {
                    try
                    {
                        var incomingItems = JsonSerializer.Deserialize<List<OrderItemSyncDto>>(localOrder.MetadataJson);
                        if (incomingItems != null)
                        {
                            foreach(var item in incomingItems)
                            {
                                if (Guid.TryParse(item.ProductId, out Guid pid))
                                {
                                    var product = await _dbContext.Products.FindAsync(pid);
                                    if (product != null && product.StockQuantity.HasValue)
                                    {
                                        product.StockQuantity -= item.Quantity;
                                        if (product.StockQuantity <= 0)
                                        {
                                            product.StockQuantity = 0;
                                            product.StockLevel = "Not Available";
                                        }
                                        _dbContext.Entry(product).State = EntityState.Modified;
                                        stockUpdates.Add(new { id = product.ProductId, newStock = product.StockQuantity });
                                        Console.WriteLine($"[SyncOrders] Deducted {item.Quantity} from {product.Name}. New Stock: {product.StockQuantity}");
                                    }
                                }
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"[SyncOrders] Error deducting stock: {ex.Message}");
                    }
                }

                if (stockUpdates.Any())
                {
                    await _hubContext.Clients.Group($"Tenant_{newOrder.TenantId}").SendAsync("ReceiveStockUpdate", stockUpdates);
                }

                syncResults.Add(new SyncResultDto { OrderId = localOrder.OrderId, Status = "Synchronized" });
            }
            else
            {
                // Conflict resolution using Vector Clocks
                if (IsChangeSuperior(localOrder.VectorClock, existingOrder.VectorClock))
                {
                    bool isAmendment = existingOrder.MetadataJson != localOrder.MetadataJson || 
                                     existingOrder.Notes != localOrder.Notes ||
                                     existingOrder.PendingAmendmentsJson != localOrder.PendingAmendmentsJson;

                    bool isPaidStatus = existingOrder.Status != "Paid" && localOrder.Status == "Paid";


                    // --- AMENDMENT TRACKING LOGIC ---
                    // If this is an amendment (IsAmended=true) and we have previous data, check for deleted items.
                    // This logic ensures that if a waiter deletes an item on the frontend, it comes back as "Cancelled".
                    if (localOrder.IsAmended && !string.IsNullOrEmpty(existingOrder.MetadataJson))
                    {
                        try
                        {
                            var incomingItems = JsonSerializer.Deserialize<List<OrderItemSyncDto>>(localOrder.MetadataJson);
                            var existingItems = JsonSerializer.Deserialize<List<OrderItemSyncDto>>(existingOrder.MetadataJson);

                            if (incomingItems != null && existingItems != null)
                            {
                                var finalItems = new List<OrderItemSyncDto>(incomingItems);
                                bool anyCancelled = false;

                                foreach (var existingItem in existingItems)
                                {
                                    // Check if this existing item is missing from incoming items
                                    // Match by ID primarily, fallback to Name/Price if ID is missing/changed
                                    // Also checking AmendmentVersion to differentiate same item added at different times
                                    var stillExists = incomingItems.Any(i => i.ProductId == existingItem.ProductId && 
                                                                            i.UnitPrice == existingItem.UnitPrice &&
                                                                            (!string.IsNullOrEmpty(i.Spice) ? i.Spice : i.SpiceLevel) == (!string.IsNullOrEmpty(existingItem.Spice) ? existingItem.Spice : existingItem.SpiceLevel) &&
                                                                            i.AmendmentVersion == existingItem.AmendmentVersion);

                                    if (!stillExists && existingItem.ItemStatus != "Cancelled")
                                    {
                                        // Item was removed. Mark as cancelled.
                                        existingItem.ItemStatus = "Cancelled";
                                        
                                        // DO NOT Update version. Keep it in its original amendment group.
                                        // This ensures it stays visible where it was originally ordered.
                                        
                                        finalItems.Add(existingItem);
                                        anyCancelled = true;
                                        Console.WriteLine($"[SyncOrders] Item marked as Cancelled: {existingItem.Name} (Stays in V{existingItem.AmendmentVersion})");
                                    }
                                    else if (!stillExists && existingItem.ItemStatus == "Cancelled")
                                    {
                                        // Keep already cancelled items
                                        finalItems.Add(existingItem);
                                    }
                                }

                                if (anyCancelled || finalItems.Count > incomingItems.Count)
                                {
                                    localOrder.MetadataJson = JsonSerializer.Serialize(finalItems);
                                }
                            }
                        }
                        catch (Exception ex)
                        {
                            Console.WriteLine($"[SyncOrders] Error processing cancellation: {ex.Message}");
                        }
                    }

                    existingOrder.Status = localOrder.Status;
                    existingOrder.TotalAmount = localOrder.TotalAmount;
                    existingOrder.CustomerName = localOrder.CustomerName;
                    existingOrder.TableId = localOrder.TableId;
                    existingOrder.MetadataJson = localOrder.MetadataJson;
                    existingOrder.PendingAmendmentsJson = localOrder.PendingAmendmentsJson;
                    existingOrder.Notes = localOrder.Notes;
                    existingOrder.GuestCount = localOrder.GuestCount;
                    existingOrder.PaymentMethod = localOrder.PaymentMethod;
                    existingOrder.VectorClock = localOrder.VectorClock;
                    existingOrder.PaidAt = localOrder.PaidAt;
                    existingOrder.DiscountReason = localOrder.DiscountReason;
                    existingOrder.ServiceCharge = localOrder.ServiceCharge;
                    existingOrder.Discount = localOrder.Discount;
                    existingOrder.DiscountType = localOrder.DiscountType;
                    existingOrder.FinalTotal = localOrder.FinalTotal;
                    existingOrder.IsAmended = localOrder.IsAmended;
                    
                    // IMPORTANT: Prevent overwriting AmendmentCount with lower value (stale sync)
                    // If backend is ahead (e.g. 2) and frontend sends stale (1), keep 2.
                    if (localOrder.AmendmentCount > existingOrder.AmendmentCount)
                    {
                        existingOrder.AmendmentCount = localOrder.AmendmentCount;
                    }
                    
                    if (isPaidStatus)
                    {
                        var tableInfo = !string.IsNullOrEmpty(localOrder.TableId) ? $"Table {localOrder.TableId}" : "Walk-in";
                        var payMsg = $"Payment received for {tableInfo}";
                        var payRoles = new[] { "Till", "Admin", "Manager", "Kitchen", "Chef", "Assistant Chef", "Waiter", "Owner" };
                        
                        foreach (var role in payRoles)
                        {
                            var notification = new Notification
                            {
                                NotificationId = Guid.NewGuid(),
                                OrderId = existingOrder.OrderId,
                                TargetRole = role,
                                Message = payMsg,
                                Type = "success",
                                CreatedAt = DateTime.UtcNow,
                                IsRead = false
                            };
                            _dbContext.Notifications.Add(notification);

                             var targetGroup = role == "Chef" || role == "Assistant Chef" || role == "Kitchen" ? "Kitchen" : role;
                             await _hubContext.Clients.Group($"Tenant_{existingOrder.TenantId}_{targetGroup}").SendAsync("ReceiveNotification", new 
                            {
                                id = notification.NotificationId,
                                title = "Payment Received",
                                message = payMsg,
                                type = "success",
                                orderId = existingOrder.OrderId,
                                timestamp = notification.CreatedAt
                            });
                        }
                    }

                    if (isAmendment && !isPaidStatus) // Don't double-notify if it's just a payment
                    {
                        var tableInfoUpdate = !string.IsNullOrEmpty(localOrder.TableNumber) ? $"Table {localOrder.TableNumber}" : (!string.IsNullOrEmpty(localOrder.TableId) ? $"Table {localOrder.TableId}" : "Walk-in");
                        var amendMsg = $"Order for {tableInfoUpdate} has been amended.";
                        var amendRoles = new[] { "Kitchen", "Chef", "Assistant Chef", "Admin", "Manager", "Owner" };
                        
                        foreach (var role in amendRoles)
                        {
                            var notification = new Notification
                            {
                                NotificationId = Guid.NewGuid(),
                                OrderId = existingOrder.OrderId,
                                TargetRole = role,
                                Message = amendMsg,
                                Type = "info",
                                CreatedAt = DateTime.UtcNow,
                                IsRead = false
                            };
                            _dbContext.Notifications.Add(notification);

                             var targetGroup = role == "Chef" || role == "Assistant Chef" ? "Kitchen" : role;
                             await _hubContext.Clients.Group($"Tenant_{existingOrder.TenantId}_{targetGroup}").SendAsync("ReceiveNotification", new 
                            {
                                id = notification.NotificationId,
                                title = "Order Amended",
                                message = amendMsg,
                                type = "info",
                                orderId = existingOrder.OrderId,
                                timestamp = notification.CreatedAt
                            });
                        }
                    }

                    // Global tenant-wide broadcast for UI refresh (Update)
                    await _hubContext.Clients.Group($"Tenant_{existingOrder.TenantId}").SendAsync("ReceiveOrderUpdate", new { id = existingOrder.OrderId, status = existingOrder.WorkflowStatus });

                    syncResults.Add(new SyncResultDto { OrderId = localOrder.OrderId, Status = "Updated" });
                }
                else
                {
                    syncResults.Add(new SyncResultDto { OrderId = localOrder.OrderId, Status = "Conflict - Server Wins" });
                }
            }
        }

        await _dbContext.SaveChangesAsync();
        Console.WriteLine($"[SyncOrders] SaveChangesAsync completed for {localOrders.Count} items.");

        return Ok(syncResults);
    }

    [HttpGet("orders")]
    public async Task<IActionResult> GetOrders()
    {
        var orders = await _dbContext.Orders
            .OrderByDescending(o => o.CreatedAt)
            .Take(100)
            .Select(o => new OrderSyncDto
            {
                OrderId = o.OrderId,
                StaffId = o.StaffId,
                CustomerName = o.CustomerName,
                TableId = o.TableId,
                TotalAmount = o.TotalAmount,
                Status = o.Status,
                MetadataJson = o.MetadataJson,
                PendingAmendmentsJson = o.PendingAmendmentsJson,
                Notes = o.Notes,
                GuestCount = o.GuestCount,
                PaymentMethod = o.PaymentMethod,
                VectorClock = o.VectorClock,
                CreatedAt = o.CreatedAt,
                PaidAt = o.PaidAt,
                DiscountReason = o.DiscountReason,
                ServiceCharge = o.ServiceCharge,
                Discount = o.Discount,
                DiscountType = o.DiscountType,
                FinalTotal = o.FinalTotal,
                IsAmended = o.IsAmended,
                AmendmentCount = o.AmendmentCount,
                StatusHistory = o.StatusHistory
            })
            .ToListAsync();

        return Ok(orders);
    }

    [HttpPost("order/{orderId}/respond-amendment")]
    public async Task<IActionResult> RespondToAmendment(Guid orderId, [FromBody] AmendmentResponseDto request)
    {
        var order = await _dbContext.Orders
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(o => o.OrderId == orderId);

        if (order == null) return NotFound();
        
        // Lookup Table Number for better UX
        string tableNum = order.TableId; // Fallback
        if (!string.IsNullOrEmpty(order.TableId))
        {
            var tableIds = order.TableId.Split(',', StringSplitOptions.RemoveEmptyEntries);
            var tableObj = await _dbContext.RestaurantTables
                .Where(t => tableIds.Contains(t.RestaurantTableId.ToString()))
                .FirstOrDefaultAsync();
            if (tableObj != null) tableNum = tableObj.TableNumber;
        }

        string action = request.Approve ? "ACCEPTED" : "DECLINED";
        string msg = $"Kitchen has {action} changes for order on Table {tableNum}";
        
        if (!request.Approve)
        {
            order.PendingAmendmentsJson = "[]"; // Clear if declined
        }
        else 
        if (request.Approve)
        {
            // Increment amendment count
            order.AmendmentCount++;
            
            if (!string.IsNullOrEmpty(request.UpdatedMetadataJson))
            {
                var newItems = JsonSerializer.Deserialize<List<OrderItemSyncDto>>(request.UpdatedMetadataJson);
                var existingItems = string.IsNullOrEmpty(order.MetadataJson) 
                    ? new List<OrderItemSyncDto>() 
                    : JsonSerializer.Deserialize<List<OrderItemSyncDto>>(order.MetadataJson);

                if (newItems != null)
                {
                    // Create a pool of existing items to match against
                    // We match by ProductId and SpiceLevel to ensure we identify "same" items
                    // We use a list to handle duplicates (e.g. 2x Burgers) independently
                    var existingPool = existingItems.ToList();


                    var finalItemsList = new List<OrderItemSyncDto>();

                    foreach (var item in newItems)
                    {
                        // Unify spice level (check both properties)
                        string itemSpice = !string.IsNullOrEmpty(item.Spice) ? item.Spice : item.SpiceLevel;

                        // Try to find a matching item in the existing pool
                        // Skip matching entirely if the frontend explicitly flagged this as a newly added UI row `IsNew`
                        var match = existingPool.FirstOrDefault(e => 
                            !item.IsNew &&
                            e.ProductId == item.ProductId && 
                            (!string.IsNullOrEmpty(e.Spice) ? e.Spice : e.SpiceLevel) == itemSpice &&
                            e.UnitPrice == item.UnitPrice);

                        if (match != null)
                        {
                            // FOUND EXISTING ITEM
                            // We preserve the *Oldest* version found (Oldest First in existingItems usually)
                            // Even if quantity changed, we keep it in its original group (Simple behavior)
                            item.AmendmentVersion = match.AmendmentVersion;
                            
                            // Adjust Stock for Quantity Changes
                            int qtyDifference = item.Quantity - match.Quantity;
                            if (qtyDifference != 0 && Guid.TryParse(item.ProductId, out Guid pId))
                            {
                                var product = await _dbContext.Products.FirstOrDefaultAsync(p => p.ProductId == pId);
                                if (product != null && product.StockQuantity.HasValue)
                                {
                                    product.StockQuantity -= qtyDifference;
                                    Console.WriteLine($"[RespondToAmendment] Adjusted Stock for {product.Name} by {-qtyDifference}. New: {product.StockQuantity}");
                                }
                            }
                            
                            // Remove from pool so we don't match it again (greedy match)
                            existingPool.Remove(match);
                        }
                        else
                        {
                            // NEW ITEM
                            // If version is 0, assign current amendment count
                            if (item.AmendmentVersion == 0)
                            {
                                item.AmendmentVersion = order.AmendmentCount;
                                item.Created = DateTime.UtcNow; // Set creation time for new item
                            }

                            // Deduct Stock for newly added item
                            if (Guid.TryParse(item.ProductId, out Guid pId2))
                            {
                                var product = await _dbContext.Products.FirstOrDefaultAsync(p => p.ProductId == pId2);
                                if (product != null && product.StockQuantity.HasValue)
                                {
                                    product.StockQuantity -= item.Quantity;
                                    Console.WriteLine($"[RespondToAmendment] Deducted Stock for NEW ITEM {product.Name} by {item.Quantity}. New: {product.StockQuantity}");
                                }
                            }
                        }
                        
                        // Clear IsNew flag so it doesn't persist to the DB and mess up future amendments
                        item.IsNew = false;
                        
                        finalItemsList.Add(item);
                    }
                    
                    order.MetadataJson = JsonSerializer.Serialize(finalItemsList);

                    // --- DETECT & ADD CANCELLED ITEMS ---
                    // Any item left in 'existingPool' was not found in 'newItems', meaning it was deleted.
                    if (existingPool.Count > 0)
                    {
                        foreach (var removedItem in existingPool)
                        {
                            Console.WriteLine($"[RespondToAmendment] Item Cancelled: {removedItem.Name} (V{removedItem.AmendmentVersion})");
                            
                            // Refund Stock for cancelled items
                            if (removedItem.ItemStatus != "Cancelled" && Guid.TryParse(removedItem.ProductId, out Guid pId3))
                            {
                                var product = await _dbContext.Products.FirstOrDefaultAsync(p => p.ProductId == pId3);
                                if (product != null && product.StockQuantity.HasValue)
                                {
                                    product.StockQuantity += removedItem.Quantity;
                                    Console.WriteLine($"[RespondToAmendment] Refunded Stock for DELETED ITEM {product.Name} by {removedItem.Quantity}. New: {product.StockQuantity}");
                                }
                            }
                            
                            // Re-add it to the list, but mark as Cancelled
                            // DO NOT Update version. Keep it in its original amendment group.
                            // This ensures it stays visible where it was originally ordered.
                            
                            var cancelledItem = new OrderItemSyncDto
                            {
                                ProductId = removedItem.ProductId,
                                Name = removedItem.Name,
                                Quantity = removedItem.Quantity,
                                UnitPrice = removedItem.UnitPrice,
                                SpiceLevel = removedItem.SpiceLevel,
                                Spice = removedItem.Spice,
                                AmendmentVersion = removedItem.AmendmentVersion, // KEEP ORIGINAL VERSION
                                ItemStatus = "Cancelled",
                                Created = removedItem.Created // Keep original creation time
                            };
                            
                            finalItemsList.Add(cancelledItem);
                        }
                        // Re-serialize with cancelled items included
                        order.MetadataJson = JsonSerializer.Serialize(finalItemsList);
                    }
                }
                order.TotalAmount = request.UpdatedTotalAmount;
            }
            
            order.PendingAmendmentsJson = "[]"; // Clear pending
            order.IsAmended = true; // Keep for legacy compatibility
            
            // Versioned Status
            string statusPrefix = $"Amended-{order.AmendmentCount}-";
            order.WorkflowStatus = statusPrefix + "Preparing";
            order.Status = statusPrefix + "Preparing";
            
            if (!order.CustomerName.StartsWith("[AMENDED]"))
            {
                order.CustomerName = "[AMENDED] " + order.CustomerName;
            }

            Console.WriteLine($"[RespondToAmendment] Order {orderId} amendment #{order.AmendmentCount} APPROVED. New Status: {order.Status}");
        }
        else
        {
             order.PendingAmendmentsJson = "[]"; // Clear pending if declined
             // Do not change status or increment count on decline
             Console.WriteLine($"[RespondToAmendment] Order {orderId} amendment DECLINED.");
        }

        // --- STATUS HISTORY LOGGING ---
        try 
        {
            var history = string.IsNullOrEmpty(order.StatusHistory) || order.StatusHistory == "[]"
                ? new List<object>() 
                : JsonSerializer.Deserialize<List<object>>(order.StatusHistory) ?? new List<object>();

            // If declined, use Next Version number (current + 1) because current count wasn't incremented
            // If approved, use Current Version number (already incremented)
            int logVersion = request.Approve ? order.AmendmentCount : (order.AmendmentCount + 1);

            history.Add(new 
            {
                Status = request.Approve ? "ACCEPTED" : "DECLINED",
                Timestamp = DateTime.UtcNow,
                AmendmentVersion = logVersion,
                User = "Kitchen"
            });
            
            order.StatusHistory = JsonSerializer.Serialize(history);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[RespondToAmendment] Failed to log status history: {ex.Message}");
        }

        order.VectorClock = "{}"; // Reset clock to force sync
        await _dbContext.SaveChangesAsync();

        var rolesToNotify = new[] { "Waiter", "Chef", "Assistant Chef", "Kitchen", "Admin", "Manager", "Owner" };
        foreach (var role in rolesToNotify)
        {
             var notification = new Notification
            {
                NotificationId = Guid.NewGuid(),
                OrderId = order.OrderId,
                TargetRole = role,
                Message = msg,
                Type = request.Approve ? "success" : "warning",
                CreatedAt = DateTime.UtcNow,
                IsRead = false
            };
            _dbContext.Notifications.Add(notification);

            var targetGroup = role == "Chef" || role == "Assistant Chef" || role == "Kitchen" ? "Kitchen" : role;
            await _hubContext.Clients.Group($"Tenant_{order.TenantId}_{targetGroup}").SendAsync("ReceiveNotification", new 
            {
                Type = "OrderUpdate",
                Message = msg,
                OrderId = order.OrderId
            });
        }

        await _dbContext.SaveChangesAsync();

        // Broadcast Order Update to all clients (IMPORTANT for sync)
        await _hubContext.Clients.Group($"Tenant_{order.TenantId}").SendAsync("ReceiveOrderUpdate", new { id = order.OrderId, status = order.WorkflowStatus });

        return Ok(new { status = "Updated" });
    }

    [HttpDelete("order/{orderId}")]
    public async Task<IActionResult> DeleteOrder(Guid orderId)
    {
        var order = await _dbContext.Orders
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(o => o.OrderId == orderId);

        if (order == null)
        {
            return NotFound();
        }

        _dbContext.Orders.Remove(order);
        await _dbContext.SaveChangesAsync();

        Console.WriteLine($"[DeleteOrder] Order {orderId} deleted successfully.");
        return Ok(new { status = order.Status, amendmentCount = order.AmendmentCount, items = string.IsNullOrEmpty(order.MetadataJson) ? new List<OrderItemSyncDto>() : JsonSerializer.Deserialize<List<OrderItemSyncDto>>(order.MetadataJson) });
    }

    [HttpDelete("customer/{customerId}")]
    public async Task<IActionResult> DeleteCustomer(Guid customerId)
    {
        var customer = await _dbContext.Customers
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.CustomerId == customerId);

        if (customer == null)
        {
            return NotFound();
        }

        _dbContext.Customers.Remove(customer);
        await _dbContext.SaveChangesAsync();

        Console.WriteLine($"[DeleteCustomer] Customer {customerId} deleted successfully.");
        return Ok(new { status = "Deleted", customerId = customerId });
    }

    private bool IsChangeSuperior(string localClockJson, string serverClockJson)
    {
        // Primitive Vector Clock comparison logic
        // In a production app, we would parse JSON and compare logical counters per device ID.
        // For this MVP, we compare string lengths or timestamps as a placeholder for the logic.
        try 
        {
            var localClock = JsonSerializer.Deserialize<Dictionary<string, int>>(localClockJson);
            var serverClock = JsonSerializer.Deserialize<Dictionary<string, int>>(serverClockJson);

            if (localClock == null || serverClock == null) return true;

            bool localGreaterAtLeastOnce = false;
            foreach (var kvp in localClock)
            {
                if (serverClock.TryGetValue(kvp.Key, out int serverVal))
                {
                    if (kvp.Value < serverVal) return false; // Server is ahead in one dimension
                    if (kvp.Value > serverVal) localGreaterAtLeastOnce = true;
                }
                else
                {
                    localGreaterAtLeastOnce = true;
                }
            }

            return localGreaterAtLeastOnce;
        }
        catch
        {
            return false;
        }
    }
}

public class OrderSyncDto
{
    [JsonPropertyName("orderId")]
    public Guid OrderId { get; set; }

    [JsonPropertyName("staffId")]
    public Guid? StaffId { get; set; }

    [JsonPropertyName("customerName")]
    public string CustomerName { get; set; } = string.Empty;

    [JsonPropertyName("tableId")]
    public string TableId { get; set; } = string.Empty;

    [JsonPropertyName("totalAmount")]
    public decimal TotalAmount { get; set; }

    [JsonPropertyName("status")]
    public string Status { get; set; } = string.Empty;

    [JsonPropertyName("metadataJson")]
    public string MetadataJson { get; set; } = "[]"; // Serialized items

    [JsonPropertyName("pendingAmendmentsJson")]
    public string PendingAmendmentsJson { get; set; } = "[]";

    [JsonPropertyName("notes")]
    public string Notes { get; set; } = string.Empty;
    
    [JsonPropertyName("guestCount")]
    public int GuestCount { get; set; } = 1;

    [JsonPropertyName("paymentMethod")]
    public string PaymentMethod { get; set; } = string.Empty;

    [JsonPropertyName("vectorClock")]
    public string VectorClock { get; set; } = "{}";

    [JsonPropertyName("createdAt")]
    public DateTime CreatedAt { get; set; }

    [JsonPropertyName("discountReason")]
    public string DiscountReason { get; set; } = string.Empty;

    [JsonPropertyName("serviceCharge")]
    public decimal ServiceCharge { get; set; }

    [JsonPropertyName("discount")]
    public decimal Discount { get; set; }

    [JsonPropertyName("discountType")]
    public string DiscountType { get; set; } = "none";

    [JsonPropertyName("finalTotal")]
    public decimal FinalTotal { get; set; }

    [JsonPropertyName("paidAt")]
    public DateTime? PaidAt { get; set; }

    [JsonPropertyName("isAmended")]
    public bool IsAmended { get; set; }



    [JsonPropertyName("tableNumber")]
    public string TableNumber { get; set; } = string.Empty;

    [JsonPropertyName("amendmentCount")]
    public int AmendmentCount { get; set; }

    [JsonPropertyName("statusHistory")]
    public string StatusHistory { get; set; } = "[]";
}

public class SyncResultDto
{
    [JsonPropertyName("orderId")]
    public Guid OrderId { get; set; }
    
    [JsonPropertyName("status")]
    public string Status { get; set; } = string.Empty;
}


public class AmendmentResponseDto
{
    [JsonPropertyName("approve")]
    public bool Approve { get; set; }

    [JsonPropertyName("updatedMetadataJson")]
    public string UpdatedMetadataJson { get; set; } = string.Empty;

    [JsonPropertyName("updatedTotalAmount")]
    public decimal UpdatedTotalAmount { get; set; }
}

public class OrderItemSyncDto
{
    [JsonPropertyName("id")]
    public string ProductId { get; set; } = string.Empty;

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("qty")]
    public int Quantity { get; set; }

    [JsonPropertyName("price")]
    public decimal UnitPrice { get; set; }

    [JsonPropertyName("spiceLevel")]
    public string SpiceLevel { get; set; } = string.Empty;

    // Frontend sometimes sends 'spice' instead of 'spiceLevel'
    [JsonPropertyName("spice")]
    public string Spice { get; set; } = string.Empty;

    [JsonPropertyName("amendmentVersion")]
    public int AmendmentVersion { get; set; } = 0;

    [JsonPropertyName("itemStatus")]
    public string ItemStatus { get; set; } = "Active"; // Active, Cancelled

    [JsonPropertyName("created")]
    public DateTime Created { get; set; } = DateTime.UtcNow;

    [JsonPropertyName("isNew")]
    public bool IsNew { get; set; } = false;
}


