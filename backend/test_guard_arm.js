const http = require('http');

const options = {
  hostname: '127.0.0.1',
  port: 3001,
  path: '/api/devices/ESP32_M/relay',
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + require('jsonwebtoken').sign({ id: 'test' }, 'smartwatt_secret_key')
  }
};

const req = http.request(options, res => {
  res.pipe(process.stdout);
});
req.write(JSON.stringify({ channel: 2, state: 'off', guardEnabled: true }));
req.end();
