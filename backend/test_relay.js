const http = require('http');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'smartwatt_secret_key'; // From server.js
const token = jwt.sign({ id: 'SW-20260320-000001', email: 'test@example.com' }, JWT_SECRET);

const postData = JSON.stringify({ channel: 2, state: 'off' });

const options = {
  hostname: '127.0.0.1',
  port: 3001,
  path: '/api/devices/ESP32_M/relay',
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
    'Authorization': 'Bearer ' + token
  }
};

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  res.setEncoding('utf8');
  res.on('data', (chunk) => {
    console.log(`BODY: ${chunk}`);
  });
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});

req.write(postData);
req.end();
