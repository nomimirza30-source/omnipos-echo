const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./omnipos.db');

db.serialize(() => {
    db.all("SELECT count(*) as count, CategoryName FROM Products WHERE TenantId='00000000-0000-0000-0000-000000001111' GROUP BY CategoryName;", (err, rows) => {
        if (err) {
            console.error(err.message);
        } else {
            console.log("İYİ Luxury Products Found:");
            rows.forEach((row) => {
                console.log(`- ${row.CategoryName}: ${row.count}`);
            });

            const total = rows.reduce((sum, r) => sum + r.count, 0);
            console.log(`\nTotal Products Seeded: ${total}`);
        }
    });
});

db.close();
