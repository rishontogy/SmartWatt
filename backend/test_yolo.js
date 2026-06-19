const http = require('http');
const fs = require('fs');

const imgBuffer = fs.readFileSync('detections/detect_ESP32_M_1775394160366.jpg');

const req = http.request({
  host: 'localhost', port: 5001, path: '/detect', method: 'POST',
  headers: { 'Content-Type': 'image/jpeg', 'Content-Length': imgBuffer.length }
}, res => {
  let body = '';
  res.on('data', c => body += c);
  res.on('end', () => console.log('YOLO RESPONSE:', body));
});

req.on('error', e => console.error('YOLO ERROR:', e));
req.write(imgBuffer);
req.end();
