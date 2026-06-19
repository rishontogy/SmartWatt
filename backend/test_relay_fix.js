const http = require('http');

async function testRelay(deviceId, channel, state) {
    const payload = JSON.stringify({ channel, state, guardEnabled: true });
    
    const options = {
        hostname: 'localhost',
        port: 3001,
        path: `/api/devices/${deviceId}/relay`,
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + process.argv[2] // Pass token as arg
        }
    };

    return new Promise((resolve) => {
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                console.log(`[TEST] Status: ${res.statusCode}, Data: ${data}`);
                resolve(JSON.parse(data));
            });
        });
        req.on('error', (e) => console.error(e));
        req.write(payload);
        req.end();
    });
}

async function run() {
    if (!process.argv[2]) {
        console.error("Usage: node test_relay_fix.js <TOKEN>");
        process.exit(1);
    }
    console.log("Testing Relay 'on' (Should enable Guard)...");
    await testRelay('ESP32_M', 1, 'on');
    
    console.log("\nTesting Relay 'off' (Should stop Guard)...");
    await testRelay('ESP32_M', 1, 'off');
}

run();
