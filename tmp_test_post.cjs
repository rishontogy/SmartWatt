const http = require('http');
const req = http.request({
  host: 'localhost',
  port: 3001,
  path: '/api/energy/reading',
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
}, (res) => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => console.log('Status:', res.statusCode, 'Body:', body));
});
req.on('error', e => console.error(e));
req.write(JSON.stringify({
  device_id: 'ESP32_MAIN',
  voltage: 230,
  current: 2.5,
  power: 575,
  energy: 10.5
}));
req.end();
