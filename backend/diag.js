const http = require('http');

const optionsLocal = {
  hostname: '127.0.0.1',
  port: 3001,
  path: '/test',
  method: 'GET',
  timeout: 2000
};

const optionsLAN = {
  hostname: '192.168.1.3',
  port: 3001,
  path: '/test',
  method: 'GET',
  timeout: 2000
};

console.log("🔍 Checking Localhost (127.0.0.1:3001)...");
const req1 = http.request(optionsLocal, (res) => {
  console.log(`✅ LOCALHOST SUCCESS: Status ${res.statusCode}`);
});
req1.on('error', (e) => console.log(`❌ LOCALHOST FAILED: ${e.message}`));
req1.end();

console.log("🔍 Checking LAN IP (192.168.1.3:3001)...");
const req2 = http.request(optionsLAN, (res) => {
  console.log(`✅ LAN SUCCESS: Status ${res.statusCode}`);
});
req2.on('error', (e) => console.log(`❌ LAN FAILED: ${e.message}`));
req2.end();
