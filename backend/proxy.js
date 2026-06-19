const http  = require('http');
const https = require('https');

const PROXY_PORT  = 3002;
const NGROK_HOST  = 'extrorsely-prechemical-juan.ngrok-free.app';
const NGROK_PATH  = '/api/energy/room-reading';

http.createServer((req, res) => {
  if (req.method !== 'POST') { res.writeHead(405).end(); return; }

  const chunks = [];
  req.on('data', c => chunks.push(c));
  req.on('end', () => {
    const body = Buffer.concat(chunks);

    const options = {
      hostname : NGROK_HOST,
      port     : 443,
      path     : NGROK_PATH,
      method   : 'POST',
      headers  : {
        'Content-Type'               : 'application/json',
        'Content-Length'             : body.length,
        'ngrok-skip-browser-warning' : 'true',
        'User-Agent'                 : 'ESP8266-SmartWatt-Proxy',
      }
    };

    const fwd = https.request(options, fwdRes => {
      let resp = '';
      fwdRes.on('data', c => resp += c);
      fwdRes.on('end', () => {
        console.log(`[PROXY] ${fwdRes.statusCode} — ${body.toString().slice(0, 80)}`);
        res.writeHead(fwdRes.statusCode, { 'Content-Type': 'application/json' });
        res.end(resp);
      });
    });

    fwd.on('error', e => {
      console.error('[PROXY] Forward error:', e.message);
      res.writeHead(502).end(JSON.stringify({ error: e.message }));
    });

    fwd.write(body);
    fwd.end();
  });
}).listen(PROXY_PORT, '0.0.0.0', () => {
  console.log(`[PROXY] Listening on http://0.0.0.0:${PROXY_PORT}`);
  console.log(`[PROXY] Forwarding -> https://${NGROK_HOST}${NGROK_PATH}`);
});
