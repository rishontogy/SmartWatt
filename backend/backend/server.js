const path = require('path');
const fs = require('fs');
const os = require('os');
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 3002;

// Persistent Logging System
const logFile = path.join(__dirname, 'server-debug.log');
function debugLog(msg) {
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] ${msg}\n`;
  console.log(msg);
  try {
    fs.appendFileSync(logFile, entry);
  } catch (e) {
    console.error("Failed to write to log file", e);
  }
}

// 1. FIRST MIDDLEWARE: Log EVERYTHING instantly to catch malformed ESP32 requests
app.use((req, res, next) => {
  debugLog(`🔔 RECEIVING: ${req.method} ${req.url} from ${req.ip} (UA: ${req.get('User-Agent')})`);
  next();
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Unity Storage Path for all servers
const UPLOADS_DIR = 'D:\\SmartWatt\\backend\\uploads';
app.use('/uploads', express.static(UPLOADS_DIR));

// Test route to verify connectivity
app.get('/test', (req, res) => {
  res.send('✅ SUCCESS! You have reached the SmartWatt Server!');
});

// Welcome route for browser testing
app.get('/', (req, res) => {
  res.send('<h1>🚀 SmartWatt Server is ONLINE!</h1><p>Your network is working perfectly. Use <b>/upload</b> for photos.</p>');
});

// Get latest uploaded image
app.get('/api/latest-image', (req, res) => {
  const uploadsDir = UPLOADS_DIR;
  if (!fs.existsSync(uploadsDir)) return res.json({ error: 'No uploads yet' });

  fs.readdir(uploadsDir, (err, files) => {
    if (err || !files || files.length === 0) return res.json({ error: 'No images found' });

    const latest = files
      .filter(f => f.toLowerCase().endsWith('.jpg'))
      .map(f => {
        try {
          return { name: f, time: fs.statSync(path.join(uploadsDir, f)).mtime.getTime() };
        } catch (e) {
          return { name: f, time: 0 };
        }
      })
      .sort((a, b) => b.time - a.time)[0];

    if (!latest || latest.time === 0) return res.json({ error: 'No images found' });
    res.json({ url: `/uploads/${latest.name}`, timestamp: latest.time });
  });
});

// ESP32 Camera Image Upload - Accept ANY content-type
app.post('/upload', express.raw({ type: () => true, limit: '100mb' }), (req, res) => {
  try {
    const filename = `image_${Date.now()}.jpg`;
    const uploadsDir = UPLOADS_DIR;
    const filepath = path.join(uploadsDir, filename);

    const receivedType = req.get('Content-Type');
    const bodySize = req.body ? req.body.length : 0;
    debugLog(`📸 PROCESSING UPLOAD... Type: ${receivedType}, Size: ${bodySize} bytes`);
    
    if (!req.body || req.body.length === 0) {
      debugLog('⚠️ Empty upload body');
      return res.status(400).send('Empty body');
    }

    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    fs.writeFile(filepath, req.body, (err) => {
      if (err) {
        debugLog(`❌ Write failed: ${err.message}`);
        return res.status(500).send('Save failed');
      }
      debugLog(`✅ Success! Saved to ${filename}`);
      res.status(200).send('OK');
    });
  } catch (error) {
    debugLog(`🔥 CRASH in /upload: ${error.stack}`);
    res.status(500).send('Internal Server Error');
  }
});

// MySQL connection
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '', 
  database: 'smartwatt',
  port: 3307
};

let db;

// Initialize database connection
async function initDB() {
  try {
    db = await mysql.createConnection(dbConfig);
    debugLog('✅ Connected to MySQL database');
  } catch (error) {
    debugLog(`❌ Database connection failed: ${error.message}`);
  }
}

// Start server
async function startServer() {
    try {
        // 1. Start listening IMMEDIATELY so /upload is ready instantly
        const server = app.listen(PORT, "0.0.0.0", () => {
            debugLog(`\n🚀 SERVER ONLINE ON PORT ${PORT}`);
            debugLog("-------------------------------------------");
            debugLog("📡 ESP32 URL Target:");
            const nets = os.networkInterfaces();
            for (const name of Object.keys(nets)) {
                for (const net of nets[name]) {
                    if (net.family === 'IPv4' && !net.internal) {
                        debugLog(`   - http://${net.address}:${PORT}/upload`);
                    }
                }
            }
            debugLog("-------------------------------------------\n");
        });

        server.on('error', (e) => {
            if (e.code === 'EADDRINUSE') {
                debugLog(`❌ Port ${PORT} is BUSY. Close other terminals or XAMPP!`);
                process.exit = function(code) { 
                  console.log(`Force closing due to port conflict... Exit Code ${code}`);
                };
                process.exit(1);
            } else {
                debugLog(`🔥 Server Error: ${e.message}`);
            }
        });

        // 2. Connect to DB in background
        initDB();

    } catch (e) {
        debugLog(`🔥 FAILED TO START: ${e.message}`);
    }
}

startServer();

// Prevention of accidental exits
process.on('uncaughtException', (err) => debugLog(`🔥 UNCAUGHT THROW: ${err.stack}`));
process.on('unhandledRejection', (reason) => debugLog(`🔥 UNHANDLED REJECTION: ${reason}`));
process.exit = () => debugLog("🚫 process.exit() was blocked to keep the server alive.");
