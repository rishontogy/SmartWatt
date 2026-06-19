const { execSync } = require('child_process');

try {
  const output = execSync('netstat -ano | findstr :3001').toString();
  const lines = output.split('\n').filter(l => l.includes('LISTENING') || l.includes('ESTABLISHED'));
  const pids = new Set();
  lines.forEach(l => {
    const parts = l.trim().split(/\s+/);
    if (parts.length > 4) {
      if (!isNaN(parts[4])) pids.add(parts[4]);
      else if (parts.length > 5 && !isNaN(parts[5])) pids.add(parts[5]);
    }
  });
  
  for (const pid of pids) {
    if (pid !== '0') {
      console.log(`Killing PID ${pid} listening on port 3001...`);
      try { execSync(`taskkill /F /PID ${pid}`); } catch (e) { console.log(`Failed to kill ${pid}: ${e.message}`); }
    }
  }
} catch (e) {
  console.log('No process found on 3001 or error: ' + e.message);
}
