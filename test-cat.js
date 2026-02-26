const http = require('http');

const req = http.request({
    hostname: 'localhost',
    port: 5200,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
}, res => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        console.log('Login Response:', res.statusCode, data);
        const parsed = JSON.parse(data);
        if(!parsed.token) return;
        
        const token = parsed.token;
        const tenantId = parsed.user.tenantId;
        
        const catData = JSON.stringify({
            CategoryId: '492b4fae-7dec-11d0-a765-00a0c91e6bf6',
            TenantId: tenantId,
            Name: 'Test Category Node'
        });
        
        const catReq = http.request({
            hostname: 'localhost',
            port: 5200,
            path: '/api/menu/categories',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token,
                'X-Tenant-ID': tenantId
            }
        }, catRes => {
            let catBody = '';
            catRes.on('data', c => catBody += c);
            catRes.on('end', () => console.log('Category Response:', catRes.statusCode, catBody));
        });
        console.log("Sending POST data:", catData);
        catReq.write(catData);
        catReq.end();
    });
});
req.write(JSON.stringify({ username: 'admin', password: 'admin123', tenantId: '1e2b28ff-41e4-477f-b073-84c476b6ae01' }));
req.end();
