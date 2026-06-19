const http = require('http');

const ip = '192.168.1.15';

console.log('Sending /capture...');
http.get(`http://${ip}/capture`, res => {
  let body = '';
  res.on('data', c => body += c);
  res.on('end', () => {
    console.log('/capture result:', body);
    
    setTimeout(() => {
      console.log('Fetching /image...');
      const req = http.get(`http://${ip}/image`, res => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          console.log(`Received image size: ${buf.length} bytes`);
        });
      });
      req.on('error', e => console.error('/image error:', e));
    }, 2000);
  });
}).on('error', e => console.error('/capture error:', e));
