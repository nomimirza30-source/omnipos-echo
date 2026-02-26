using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using OmniPOS.Api.Middleware;
using OmniPOS.Api.Services.Payments;
using OmniPOS.Api.Data;
using OmniPOS.Api.Services;
using OmniPOS.Api.Hubs;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Http;
using System.Collections.Generic;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
    });
builder.Services.AddOpenApi();
builder.Services.AddSignalR();

// Register DbContext (Forced SQLite for local stability)
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection") ?? "Data Source=omnipos_v6.db";
Console.WriteLine($"[DEBUG] Using ConnectionString: {connectionString}");
Console.WriteLine($"[DEBUG] Current Directory: {Directory.GetCurrentDirectory()}");

builder.Services.AddDbContext<OmniDbContext>(options =>
    options.UseSqlite(connectionString));



builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.SetIsOriginAllowed(origin => true) // Allow any origin dynamically
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials(); // Required for SignalR
    });
});

builder.Services.AddScoped<ITenantProvider, TenantProvider>();
builder.Services.AddScoped<IPaymentGateway, BankSelectorDriver>();
builder.Services.AddScoped<QrCodeService>();
builder.Services.AddHttpClient<IWiseService, WiseService>();
// builder.Services.AddScoped<VIPService>(); // Shadow VIP Service removed

// Phase 3: JWT & RBAC Configuration
var jwtKey = builder.Configuration["Jwt:Key"] ?? "a_very_secure_and_long_secret_key_for_omnipos_2026";
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "OmniPOS";

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtIssuer,
            ValidAudience = jwtIssuer,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
        };
        
        // SignalR Token Reader
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                var path = context.HttpContext.Request.Path;
                
                if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
                {
                    context.Token = accessToken;
                }
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("RequireAdmin", policy => policy.RequireRole("Admin", "Owner"));
    options.AddPolicy("RequireManager", policy => policy.RequireRole("Admin", "Owner", "Manager"));
    options.AddPolicy("RequireServer", policy => policy.RequireRole("Admin", "Owner", "Manager", "Server", "Waiter", "Till", "Kitchen", "Chef", "Assistant Chef"));
    options.AddPolicy("RequireKitchen", policy => policy.RequireRole("Admin", "Owner", "Manager", "Kitchen"));
});

var app = builder.Build();

// Ensure database is created (Critical for SQLite bootstrap)
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    try
    {
        var context = services.GetRequiredService<OmniDbContext>();
        context.Database.EnsureCreated();

        // Manual Schema Update for Wise Integration (since Migrations are tricky here)
        try 
        {
            context.Database.ExecuteSqlRaw("ALTER TABLE Tenants ADD COLUMN WiseApiKey TEXT DEFAULT ''");
            context.Database.ExecuteSqlRaw("ALTER TABLE Tenants ADD COLUMN WiseProfileId TEXT DEFAULT ''");
            Console.WriteLine("[Schema] Added Wise columns to Tenants table.");
        }
        catch (Exception) { /* Columns likely exist, ignore */ }
        // var context already declared above
        Console.WriteLine("[DEBUG] EF GenerateCreateScript Output:");
        Console.WriteLine(context.Database.GenerateCreateScript());
        context.Database.EnsureCreated();
        Console.WriteLine("[Database] SQLite Initialized.");

        // Manual Schema Update for Payment Adjustments
        try
        {
            context.Database.ExecuteSqlRaw("ALTER TABLE Orders ADD COLUMN ServiceCharge DECIMAL(18,2) DEFAULT 0");
            Console.WriteLine("[Database] Added ServiceCharge column.");
        } catch (Exception ex) { Console.WriteLine($"[Database] ServiceCharge column skip: {ex.Message}"); }
        try
        {
            context.Database.ExecuteSqlRaw("ALTER TABLE Orders ADD COLUMN Discount DECIMAL(18,2) DEFAULT 0");
            Console.WriteLine("[Database] Added Discount column.");
        } catch (Exception ex) { Console.WriteLine($"[Database] Discount column skip: {ex.Message}"); }
        try
        {
            context.Database.ExecuteSqlRaw("ALTER TABLE Orders ADD COLUMN DiscountType TEXT DEFAULT 'none'");
            Console.WriteLine("[Database] Added DiscountType column.");
        } catch (Exception ex) { Console.WriteLine($"[Database] DiscountType column skip: {ex.Message}"); }
        try
        {
            context.Database.ExecuteSqlRaw("ALTER TABLE Orders ADD COLUMN FinalTotal DECIMAL(18,2) DEFAULT 0");
            Console.WriteLine("[Database] Added FinalTotal column.");
        } catch (Exception ex) { Console.WriteLine($"[Database] FinalTotal column skip: {ex.Message}"); }

        // Additional missing columns for Workflow and Sync
        try
        {
            context.Database.ExecuteSqlRaw("ALTER TABLE Orders ADD COLUMN WorkflowStatus TEXT DEFAULT 'Pending'");
            Console.WriteLine("[Database] Added WorkflowStatus column.");
        } catch { }
        try
        {
            context.Database.ExecuteSqlRaw("ALTER TABLE Orders ADD COLUMN CanAmend INTEGER DEFAULT 1");
            Console.WriteLine("[Database] Added CanAmend column.");
        } catch (Exception ex) { Console.WriteLine($"[Database] CanAmend column skip: {ex.Message}"); }
        try
        {
            context.Database.ExecuteSqlRaw("ALTER TABLE Orders ADD COLUMN StatusHistory TEXT DEFAULT '[]'");
            Console.WriteLine("[Database] Added StatusHistory column.");
        } catch (Exception ex) { Console.WriteLine($"[Database] StatusHistory column skip: {ex.Message}"); }
        try
        {
            context.Database.ExecuteSqlRaw("ALTER TABLE Orders ADD COLUMN CustomerId TEXT");
            Console.WriteLine("[Database] Added CustomerId column to Orders.");
        } catch (Exception ex) { Console.WriteLine($"[Database] CustomerId column skip: {ex.Message}"); }
        try
        {
            context.Database.ExecuteSqlRaw("ALTER TABLE Orders ADD COLUMN PaidAt TEXT");
            Console.WriteLine("[Database] Added PaidAt column.");
        } catch (Exception ex) { Console.WriteLine($"[Database] PaidAt column skip: {ex.Message}"); }
        try
        {
            context.Database.ExecuteSqlRaw("ALTER TABLE Orders ADD COLUMN DiscountReason TEXT");
            Console.WriteLine("[Database] Added DiscountReason column.");
        } catch { }

        try
        {
            context.Database.ExecuteSqlRaw("ALTER TABLE Orders ADD COLUMN IsAmended INTEGER DEFAULT 0");
            Console.WriteLine("[Database] Added IsAmended column.");
        } catch (Exception ex) { Console.WriteLine($"[Database] IsAmended column skip: {ex.Message}"); }

        try
        {
            context.Database.ExecuteSqlRaw("ALTER TABLE Orders ADD COLUMN AmendmentCount INTEGER DEFAULT 0");
            Console.WriteLine("[Database] Added AmendmentCount column.");
        } catch (Exception ex) { Console.WriteLine($"[Database] AmendmentCount column skip: {ex.Message}"); }

        try
        {
            context.Database.ExecuteSqlRaw("ALTER TABLE OrderItems ADD COLUMN AmendmentVersion INTEGER DEFAULT 0");
            Console.WriteLine("[Database] Added AmendmentVersion column to OrderItems.");
        } catch (Exception ex) { Console.WriteLine($"[Database] AmendmentVersion column skip: {ex.Message}"); }

        // Manual Schema Create for CashLog
        try 
        {
            context.Database.ExecuteSqlRaw(@"
                CREATE TABLE IF NOT EXISTS ""CashLogs"" (
                    ""CashLogId"" TEXT NOT NULL CONSTRAINT ""PK_CashLogs"" PRIMARY KEY,
                    ""TenantId"" TEXT NOT NULL,
                    ""StaffId"" TEXT NOT NULL,
                    ""StaffName"" TEXT NOT NULL,
                    ""TransactionType"" TEXT NOT NULL,
                    ""Amount"" TEXT NOT NULL,
                    ""Reason"" TEXT NOT NULL,
                    ""CreatedAt"" TEXT NOT NULL
                )");
            Console.WriteLine("[Database] CashLogs table ensured.");
        } 
        catch (Exception ex) 
        { 
            Console.WriteLine($"[Database] CashLogs table creation skip: {ex.Message}"); 
        }

        // Product Menu Mapping Fields
        try { context.Database.ExecuteSqlRaw("ALTER TABLE Products ADD COLUMN CategoryName TEXT DEFAULT ''"); } catch {}
        try { context.Database.ExecuteSqlRaw("ALTER TABLE Products ADD COLUMN StockQuantity INTEGER DEFAULT 50"); } catch {}
        try { context.Database.ExecuteSqlRaw("ALTER TABLE Products ADD COLUMN ImageUrl TEXT DEFAULT ''"); } catch {}
        try { context.Database.ExecuteSqlRaw("ALTER TABLE Products ADD COLUMN StockLevel TEXT DEFAULT 'High'"); } catch {}
        try { context.Database.ExecuteSqlRaw("ALTER TABLE Products ADD COLUMN Allergens TEXT DEFAULT ''"); } catch {}

        // Manual Schema Update for Tenants (Branding & Handles)
        try { context.Database.ExecuteSqlRaw("ALTER TABLE Tenants ADD COLUMN AppName TEXT DEFAULT 'OmniPOS'"); } catch { }
        try { context.Database.ExecuteSqlRaw("ALTER TABLE Tenants ADD COLUMN SiteUrl TEXT DEFAULT ''"); } catch { }
        try { context.Database.ExecuteSqlRaw("ALTER TABLE Tenants ADD COLUMN LogoUrl TEXT DEFAULT ''"); } catch { }
        try { context.Database.ExecuteSqlRaw("ALTER TABLE Tenants ADD COLUMN PrimaryColor TEXT DEFAULT '#38bdf8'"); } catch { }
        try { context.Database.ExecuteSqlRaw("ALTER TABLE Tenants ADD COLUMN SecondaryColor TEXT DEFAULT '#818cf8'"); } catch { }
        try { context.Database.ExecuteSqlRaw("ALTER TABLE Tenants ADD COLUMN ThemeMode TEXT DEFAULT 'dark'"); } catch { }
        try { context.Database.ExecuteSqlRaw("ALTER TABLE Tenants ADD COLUMN WiseHandle TEXT DEFAULT ''"); } catch { }
        try { context.Database.ExecuteSqlRaw("ALTER TABLE Tenants ADD COLUMN RevolutHandle TEXT DEFAULT ''"); } catch { }
        try { context.Database.ExecuteSqlRaw("ALTER TABLE Tenants ADD COLUMN CardPaymentUrl TEXT DEFAULT ''"); } catch { }
        Console.WriteLine("[Database] Tenants branding columns ensured.");

        // 1. Seed Tenant
        var tenants = context.Tenants.IgnoreQueryFilters().ToList();
        Console.WriteLine($"[Database] Current Tenant Count: {tenants.Count}");
        
        if (tenants.Count == 0)
        {
            Console.WriteLine("[Database] Initializing SQLite database...");
            context.Database.EnsureCreated();
            
            var customerType = context.Model.FindEntityType(typeof(Customer));
            var customerProps = customerType?.GetProperties().Select(p => p.Name) ?? Enumerable.Empty<string>();
            Console.WriteLine("[DEBUG] Customer Properties in EF Model: " + string.Join(", ", customerProps));
            
            var orderType = context.Model.FindEntityType(typeof(Order));
            var orderProps = orderType?.GetProperties().Select(p => p.Name) ?? Enumerable.Empty<string>();
            Console.WriteLine("[DEBUG] Order Properties in EF Model: " + string.Join(", ", orderProps));
            
            var tenantId = Guid.NewGuid();
            context.Tenants.Add(new Tenant 
            { 
                TenantId = tenantId, 
                Name = "IYI Luxury Dining - London", 
                AppName = "IYI Luxury Dining",
                PrimaryColor = "#38bdf8"
            });
            context.SaveChanges();
            Console.WriteLine("[Database] Tenant seeded successfully.");
        }

        // 2. Seed Staff
        var staffList = context.StaffMembers.IgnoreQueryFilters().ToList();
        Console.WriteLine($"[Database] Current Staff Count: {staffList.Count}");
        
        if (staffList.Count == 0)
        {
            Console.WriteLine("[Database] Staff table empty. Seeding default accounts...");
            var tenant = context.Tenants.IgnoreQueryFilters().First();
            Console.WriteLine($"[Database] Using Tenant: {tenant.Name} ({tenant.TenantId})");
            
            var adminStaff = new Staff 
            { 
                StaffId = Guid.NewGuid(), 
                TenantId = tenant.TenantId, 
                FullName = "System Admin", 
                Role = "Admin", 
                Username = "admin", 
                PasswordHash = OmniPOS.Api.Services.PasswordHasher.HashPassword("admin123"), 
                Email = "admin@omnipos.com" 
            };
            
            var kitchenStaff = new Staff 
            { 
                StaffId = Guid.NewGuid(), 
                TenantId = tenant.TenantId, 
                FullName = "Kitchen Staff", 
                Role = "Kitchen", 
                Username = "kitchen", 
                PasswordHash = OmniPOS.Api.Services.PasswordHasher.HashPassword("kitchen123"), 
                Email = "kitchen@omnipos.com" 
            };
            
            var waiterStaff = new Staff 
            { 
                StaffId = Guid.NewGuid(), 
                TenantId = tenant.TenantId, 
                FullName = "Senior Waiter", 
                Role = "Waiter", 
                Username = "waiter", 
                PasswordHash = OmniPOS.Api.Services.PasswordHasher.HashPassword("waiter123"), 
                Email = "waiter@omnipos.com" 
            };
 
            var tillStaff = new Staff
            {
                StaffId = Guid.NewGuid(),
                TenantId = tenant.TenantId,
                FullName = "Main Till",
                Role = "Till",
                Username = "till",
                PasswordHash = OmniPOS.Api.Services.PasswordHasher.HashPassword("till123"),
                Email = "till@omnipos.com"
            };
            
            context.StaffMembers.AddRange(adminStaff, kitchenStaff, waiterStaff, tillStaff);
            context.SaveChanges();
            Console.WriteLine("[Database] Staff accounts seeded successfully.");
        }

        // Seed Data for IYI Luxury Dining
Guid iyiTenantId = Guid.Parse("00000000-0000-0000-0000-000000001111");

// --- CATEGORY SEEDING ---
var cats = new List<Category>
{
    new Category { CategoryId = Guid.NewGuid(), Name = "Bbq", TenantId = iyiTenantId },
    new Category { CategoryId = Guid.NewGuid(), Name = "Hot Mezze", TenantId = iyiTenantId },
    new Category { CategoryId = Guid.NewGuid(), Name = "Cold Mezze", TenantId = iyiTenantId },
    new Category { CategoryId = Guid.NewGuid(), Name = "Salad", TenantId = iyiTenantId },
    new Category { CategoryId = Guid.NewGuid(), Name = "Iyi Special", TenantId = iyiTenantId },
    new Category { CategoryId = Guid.NewGuid(), Name = "Desserts", TenantId = iyiTenantId },
    new Category { CategoryId = Guid.NewGuid(), Name = "Drinks", TenantId = iyiTenantId },
    new Category { CategoryId = Guid.NewGuid(), Name = "Cold", TenantId = iyiTenantId },
    new Category { CategoryId = Guid.NewGuid(), Name = "Baked Meat", TenantId = iyiTenantId }
};
context.Categories.AddRange(cats);

// --- PRODUCT SEEDING ---
var products = new List<Product>
{
    new Product {
        ProductId = Guid.NewGuid(),
        Name = "Chicken Wings",
        Price = 9.99m,
        ImageUrl = "/api/placeholder/400/320",
        CategoryName = "Bbq",
        TenantId = iyiTenantId,
        StockQuantity = 50
    },
    new Product {
        ProductId = Guid.NewGuid(),
        Name = "Lahmacun",
        Price = 9.99m,
        ImageUrl = "/api/placeholder/400/320",
        CategoryName = "Hot Mezze",
        TenantId = iyiTenantId,
        StockQuantity = 50
    },
    new Product {
        ProductId = Guid.NewGuid(),
        Name = "Chicken Soup",
        Price = 9.99m,
        ImageUrl = "/api/placeholder/400/320",
        CategoryName = "Hot Mezze",
        TenantId = iyiTenantId,
        StockQuantity = 50
    },
    new Product {
        ProductId = Guid.NewGuid(),
        Name = "Creamy Mushroom Soup",
        Price = 9.99m,
        ImageUrl = "/api/placeholder/400/320",
        CategoryName = "Hot Mezze",
        TenantId = iyiTenantId,
        StockQuantity = 50
    },
    new Product {
        ProductId = Guid.NewGuid(),
        Name = "Lentil Soup",
        Price = 9.99m,
        ImageUrl = "/api/placeholder/400/320",
        CategoryName = "Hot Mezze",
        TenantId = iyiTenantId,
        StockQuantity = 50
    },
    new Product {
        ProductId = Guid.NewGuid(),
        Name = "Chicken Avocado Hummus",
        Price = 9.99m,
        ImageUrl = "/images/menu/chicken_avocado_hummus.png",
        CategoryName = "Cold Mezze",
        TenantId = iyiTenantId,
        StockQuantity = 50
    },
    new Product {
        ProductId = Guid.NewGuid(),
        Name = "Chicken Hummus",
        Price = 9.99m,
        ImageUrl = "/images/menu/chicken_hummus.png",
        CategoryName = "Cold Mezze",
        TenantId = iyiTenantId,
        StockQuantity = 50
    },
    new Product {
        ProductId = Guid.NewGuid(),
        Name = "Lamb Avocado Hummus",
        Price = 9.99m,
        ImageUrl = "/images/menu/lamb_avocado_hummus.png",
        CategoryName = "Cold Mezze",
        TenantId = iyiTenantId,
        StockQuantity = 50
    },
    new Product {
        ProductId = Guid.NewGuid(),
        Name = "Plain Hummus",
        Price = 9.99m,
        ImageUrl = "/images/menu/plain_hummus.png",
        CategoryName = "Cold Mezze",
        TenantId = iyiTenantId,
        StockQuantity = 50
    },
    new Product {
        ProductId = Guid.NewGuid(),
        Name = "Fattoush",
        Price = 9.99m,
        ImageUrl = "/images/menu/fattoush.png",
        CategoryName = "Salad",
        TenantId = iyiTenantId,
        StockQuantity = 50
    },
    new Product {
        ProductId = Guid.NewGuid(),
        Name = "Tabbouleh",
        Price = 9.99m,
        ImageUrl = "/images/menu/tabbouleh.png",
        CategoryName = "Salad",
        TenantId = iyiTenantId,
        StockQuantity = 50
    },
    new Product {
        ProductId = Guid.NewGuid(),
        Name = "Yogurt And Cucumber Salad",
        Price = 9.99m,
        ImageUrl = "/images/menu/yogurt_and_cucumber_salad.png",
        CategoryName = "Salad",
        TenantId = iyiTenantId,
        StockQuantity = 50
    },
    new Product {
        ProductId = Guid.NewGuid(),
        Name = "Chapli Kebab",
        Price = 9.99m,
        ImageUrl = "/images/menu/chapli_kebab.png",
        CategoryName = "Iyi Special",
        TenantId = iyiTenantId,
        StockQuantity = 50
    },
    new Product {
        ProductId = Guid.NewGuid(),
        Name = "Ranjha Gosht",
        Price = 9.99m,
        ImageUrl = "/images/menu/ranjha_gosht.png",
        CategoryName = "Iyi Special",
        TenantId = iyiTenantId,
        StockQuantity = 50
    },
    new Product {
        ProductId = Guid.NewGuid(),
        Name = "Chicken Adana Kebab",
        Price = 9.99m,
        ImageUrl = "/images/menu/chicken_adana_kebab.png",
        CategoryName = "Bbq",
        TenantId = iyiTenantId,
        StockQuantity = 50
    },
    new Product {
        ProductId = Guid.NewGuid(),
        Name = "Chicken Kebab Barg",
        Price = 9.99m,
        ImageUrl = "/images/menu/chicken_kebab_barg.png",
        CategoryName = "Bbq",
        TenantId = iyiTenantId,
        StockQuantity = 50
    },
    new Product {
        ProductId = Guid.NewGuid(),
        Name = "Chicken Shish Kebab",
        Price = 9.99m,
        ImageUrl = "/images/menu/chicken_shish_kebab.png",
        CategoryName = "Bbq",
        TenantId = iyiTenantId,
        StockQuantity = 50
    },
    new Product {
        ProductId = Guid.NewGuid(),
        Name = "Lamb Adana Kebab",
        Price = 9.99m,
        ImageUrl = "/images/menu/lamb_adana_kebab.png",
        CategoryName = "Bbq",
        TenantId = iyiTenantId,
        StockQuantity = 50
    },
    new Product {
        ProductId = Guid.NewGuid(),
        Name = "Lamb Chops",
        Price = 9.99m,
        ImageUrl = "/images/menu/lamb_chops.png",
        CategoryName = "Bbq",
        TenantId = iyiTenantId,
        StockQuantity = 50
    },
    new Product {
        ProductId = Guid.NewGuid(),
        Name = "Lamb Kebab Barg",
        Price = 9.99m,
        ImageUrl = "/images/menu/lamb_kebab_barg.png",
        CategoryName = "Bbq",
        TenantId = iyiTenantId,
        StockQuantity = 50
    },
    new Product {
        ProductId = Guid.NewGuid(),
        Name = "Lamb Ribs",
        Price = 9.99m,
        ImageUrl = "/images/menu/lamb_ribs.png",
        CategoryName = "Bbq",
        TenantId = iyiTenantId,
        StockQuantity = 50
    },
    new Product {
        ProductId = Guid.NewGuid(),
        Name = "Lamb Shish Kebab",
        Price = 9.99m,
        ImageUrl = "/images/menu/lamb_shish_kebab.png",
        CategoryName = "Bbq",
        TenantId = iyiTenantId,
        StockQuantity = 50
    },
    new Product {
        ProductId = Guid.NewGuid(),
        Name = "Prawns Tikka",
        Price = 9.99m,
        ImageUrl = "/images/menu/prawns_tikka.png",
        CategoryName = "Bbq",
        TenantId = iyiTenantId,
        StockQuantity = 50
    },
    new Product {
        ProductId = Guid.NewGuid(),
        Name = "Baklava",
        Price = 9.99m,
        ImageUrl = "/images/menu/baklava.png",
        CategoryName = "Desserts",
        TenantId = iyiTenantId,
        StockQuantity = 50
    },
    new Product {
        ProductId = Guid.NewGuid(),
        Name = "Künefe",
        Price = 9.99m,
        ImageUrl = "/images/menu/k_nefe.png",
        CategoryName = "Desserts",
        TenantId = iyiTenantId,
        StockQuantity = 50
    },
    new Product {
        ProductId = Guid.NewGuid(),
        Name = "English Tea",
        Price = 9.99m,
        ImageUrl = "/images/menu/english_tea.png",
        CategoryName = "Drinks",
        TenantId = iyiTenantId,
        StockQuantity = 50
    },
    new Product {
        ProductId = Guid.NewGuid(),
        Name = "Karak Chai",
        Price = 9.99m,
        ImageUrl = "/images/menu/karak_chai.png",
        CategoryName = "Drinks",
        TenantId = iyiTenantId,
        StockQuantity = 50
    },
    new Product {
        ProductId = Guid.NewGuid(),
        Name = "Lemonade (Non-Alcoholic)",
        Price = 9.99m,
        ImageUrl = "/images/menu/lemonade__non-alcoholic_.png",
        CategoryName = "Cold",
        TenantId = iyiTenantId,
        StockQuantity = 50
    },
    new Product {
        ProductId = Guid.NewGuid(),
        Name = "Margarita (Non-Alcoholic)",
        Price = 9.99m,
        ImageUrl = "/images/menu/margarita__non-alcoholic_.png",
        CategoryName = "Drinks",
        TenantId = iyiTenantId,
        StockQuantity = 50
    },
    new Product {
        ProductId = Guid.NewGuid(),
        Name = "Melon Twist (Non-Alcoholic)",
        Price = 9.99m,
        ImageUrl = "/images/menu/melon_twist__non-alcoholic_.png",
        CategoryName = "Cold",
        TenantId = iyiTenantId,
        StockQuantity = 50
    },
    new Product {
        ProductId = Guid.NewGuid(),
        Name = "Ruby Mint (Non-Alcoholic)",
        Price = 9.99m,
        ImageUrl = "/images/menu/ruby_mint__non-alcoholic_.png",
        CategoryName = "Cold",
        TenantId = iyiTenantId,
        StockQuantity = 50
    },
    new Product {
        ProductId = Guid.NewGuid(),
        Name = "Tropi Colada (Non-Alcoholic)",
        Price = 9.99m,
        ImageUrl = "/images/menu/tropi_colada__non-alcoholic_.png",
        CategoryName = "Cold",
        TenantId = iyiTenantId,
        StockQuantity = 50
    },
    new Product {
        ProductId = Guid.NewGuid(),
        Name = "Turkish Tea (Cáy)",
        Price = 9.99m,
        ImageUrl = "/images/menu/turkish_tea__c_y_.png",
        CategoryName = "Drinks",
        TenantId = iyiTenantId,
        StockQuantity = 50
    },
    new Product {
        ProductId = Guid.NewGuid(),
        Name = "Baked Meat",
        Price = 9.99m,
        ImageUrl = "/images/menu/baked_meat.png",
        CategoryName = "Baked Meat",
        TenantId = iyiTenantId,
        StockQuantity = 50
    },
    new Product {
        ProductId = Guid.NewGuid(),
        Name = "Falafel",
        Price = 9.99m,
        ImageUrl = "/api/placeholder/400/320",
        CategoryName = "Hot Mezze",
        TenantId = iyiTenantId,
        StockQuantity = 50
    },
    new Product {
        ProductId = Guid.NewGuid(),
        Name = "Kibbeh",
        Price = 9.99m,
        ImageUrl = "/api/placeholder/400/320",
        CategoryName = "Hot Mezze",
        TenantId = iyiTenantId,
        StockQuantity = 50
    },
    new Product {
        ProductId = Guid.NewGuid(),
        Name = "Lamb Hummus",
        Price = 9.99m,
        ImageUrl = "/images/menu/lamb_hummus.png",
        CategoryName = "Cold Mezze",
        TenantId = iyiTenantId,
        StockQuantity = 50
    },
    new Product {
        ProductId = Guid.NewGuid(),
        Name = "Plain Avocado Hummus",
        Price = 9.99m,
        ImageUrl = "/images/menu/plain_avocado_hummus.png",
        CategoryName = "Cold Mezze",
        TenantId = iyiTenantId,
        StockQuantity = 50
    },
    new Product {
        ProductId = Guid.NewGuid(),
        Name = "Bannu Pulao",
        Price = 9.99m,
        ImageUrl = "/images/menu/bannu_pulao.png",
        CategoryName = "Iyi Special",
        TenantId = iyiTenantId,
        StockQuantity = 50
    }
};
context.Products.AddRange(products);

        context.SaveChanges();
        Console.WriteLine("[Database] Bootstrap sequence complete.");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[Database] CRITICAL ERROR during bootstrap: {ex.Message}");
        if (ex.InnerException != null) Console.WriteLine($"[Inner] {ex.InnerException.Message}");
    }
}

// Configure the HTTP request pipeline.
app.UseForwardedHeaders(new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto,
    // Trust all proxies in the local network (Docker environment)
    KnownNetworks = { },
    KnownProxies = { }
});

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

// app.UseHttpsRedirection(); // Disabled for HTTP-only testing until SSL is ready

app.UseStaticFiles();

app.UseCors("AllowFrontend");
app.UseAuthentication();
app.UseAuthorization();
app.UseMiddleware<TenantMiddleware>();

app.MapControllers();

app.MapGet("/api/debug/sql-query", async (OmniDbContext db, string sql) => {
    try {
        var connection = db.Database.GetDbConnection();
        await db.Database.OpenConnectionAsync();
        using var command = connection.CreateCommand();
        command.CommandText = sql;
        using var reader = await command.ExecuteReaderAsync();
        var result = new List<Dictionary<string, object>>();
        while (await reader.ReadAsync()) {
            var row = new Dictionary<string, object>();
            for (int i = 0; i < reader.FieldCount; i++) {
                row[reader.GetName(i)] = reader.IsDBNull(i) ? null : reader.GetValue(i);
            }
            result.Add(row);
        }
        return Results.Ok(result);
    } catch (Exception ex) {
        return Results.Problem(ex.Message);
    }
});

app.MapGet("/api/debug/sql", async (OmniDbContext db, string sql) => {
    try {
        int affected = await db.Database.ExecuteSqlRawAsync(sql);
        return Results.Ok(new { affected, status = "Success" });
    } catch (Exception ex) {
        return Results.Problem(ex.Message);
    }
});

app.MapGet("/api/debug/ping", () => "Pong");

app.MapGet("/api/auth/debug-staff", async (OmniDbContext db) => {
    var staff = await db.StaffMembers.IgnoreQueryFilters().ToListAsync();
    return Results.Ok(staff.Select(s => new { s.Username, s.Role, s.FullName }));
});

app.MapHub<NotificationHub>("/hubs/notifications");

app.Run();
