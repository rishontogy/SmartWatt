const http = require('http');

const data = Buffer.from('FAKE_IMAGE_DATA', 'utf-8');

const options = {
  hostname: '127.0.0.1',
  port: 3001,
  path: '/upload',
  method: 'POST',
  headers: {
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  res.on('data', (d) => {
    process.stdout.write(d);
  });
});

req.on('error', (error) => {
  console.error(error);
});

req.write(data);
req.end();
