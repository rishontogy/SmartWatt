const net = require('net');
const fs = require('fs');

const PORT = 3002;
const logFile = 'd:/SmartWatt/backend/server-debug.log';

function debugLog(msg) {
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] [TCP-SNIFFER] ${msg}\n`;
  console.log(entry);
  fs.appendFileSync(logFile, entry);
}

const server = net.createServer((socket) => {
  debugLog(`🔔 TCP Connection detected from ${socket.remoteAddress}`);
  socket.on('data', (data) => {
    debugLog(`📡 Raw Data Received (${data.length} bytes): ${data.toString().substring(0, 50)}...`);
  });
  socket.write('I SAW YOU');
  socket.end();
});

server.listen(PORT, '0.0.0.0', () => {
  debugLog(`🚀 SNIFFER ACTIVE! Please try reaching http://192.168.1.3:3002 from your ESP32 or Phone.`);
});

server.on('error', (err) => {
  debugLog(`❌ Sniffer Error: ${err.message}`);
});
