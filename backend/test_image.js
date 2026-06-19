const http = require('http');
const fs = require('fs');

const ip = '192.168.1.15';

http.get(`http://${ip}/image`, res => {
  const chunks = [];
  res.on('data', c => chunks.push(c));
  res.on('end', () => {
    const buf = Buffer.concat(chunks);
    console.log(`IMAGE_SIZE: ${buf.length}`);
    fs.writeFileSync('dump.jpg', buf);
  });
}).on('error', e => console.error(e));
