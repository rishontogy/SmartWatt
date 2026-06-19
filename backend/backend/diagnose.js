const http = require('http');

const options = {
  hostname: '192.168.1.4',
  port: 3001,
  path: '/',
  method: 'GET'
};

console.log('--- DIAGNOSTIC START ---');
console.log('Testing connection to 192.168.1.4:3001...');

const req = http.request(options, (res) => {
  console.log(`✅ Success! Server is reachable at http://192.168.1.4:3001/`);
  console.log(`Status Code: ${res.statusCode}`);
});

req.on('error', (e) => {
  console.error(`❌ FAILED! Connection refused at http://192.168.1.4:3001/`);
  console.error(`Reason: ${e.message}`);
  
  if (e.message.includes('ECONNREFUSED')) {
    console.log('\n--- GUIDANCE ---');
    console.log('1. Is the server running? Run "node server.js" in the backend folder.');
    console.log('2. Is the IP address correct? Run "ipconfig" to verify it is still 192.168.1.4.');
    console.log('3. Is a firewall blocking it? Try disabling Windows Firewall temporarily to test.');
  }
});

req.end();
