import { spawn } from 'child_process';
import fs from 'fs';

console.log("Starting localtunnel...");
const lt = spawn('npx', ['localtunnel', '--port', '3005', '--subdomain', 'smartwatt-esp32-upload'], { shell: true });

lt.stdout.on('data', (data) => {
  const output = data.toString();
  console.log(output);
  if (output.includes('your url is:')) {
    const url = output.split('your url is:')[1].trim();
    fs.writeFileSync('d:\\SmartWatt\\lt_url.txt', url);
    console.log(`[TUNNEL] Extracted URL: ${url}`);
  }
});

lt.stderr.on('data', (data) => {
  console.error(`Tunnel Error: ${data.toString()}`);
});
