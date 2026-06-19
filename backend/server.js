console.log("🔥 SmartWatt Server Starting...");

const path = require('path');
const fs = require('fs');
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const http = require('http');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const ws = require('ws');

const app = express();
const PORT = 3001;
const YOLO_PORT = 5001;
const JWT_SECRET = 'smartwatt_secret_key';

const pool = mysql.createPool({
  host: 'localhost', user: 'root', password: '',
  database: 'smartwatt', port: 3307,
  waitForConnections: true, connectionLimit: 10
});

const UPLOADS_DIR = path.join(__dirname, 'uploads');
const DETECTIONS_DIR = path.join(__dirname, 'detections');
[UPLOADS_DIR, DETECTIONS_DIR].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.raw({ type: 'image/jpeg', limit: '10mb' }));
app.use('/uploads', express.static(UPLOADS_DIR));
app.use('/detections', express.static(DETECTIONS_DIR));

function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }

const authenticate = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'Missing token' });
  try {
    req.user = jwt.verify(header.split(' ')[1], JWT_SECRET);
    next();
  } catch { res.status(401).json({ error: 'Invalid token' }); }
};

const espRegistry = new Map();
const guardState = new Map();
const liveReadings = new Map();
const killStateMap = new Map();

// ── NEW: Per-device relay guard map ───────────────────────────────────
// Map<deviceId, { channel: number, guardEnabled: boolean }>
// "guardEnabled" means: if this device is ON and this channel is clicked ON,
// start human-detection guard for ONLY that channel.
const relayGuardMap = new Map();

const server = http.createServer(app);
const wss = new ws.Server({ server });

function broadcast(data) {
  const payload = typeof data === 'string' ? data : JSON.stringify(data);
  wss.clients.forEach(c => { if (c.readyState === ws.OPEN) c.send(payload); });
}

wss.on('connection', (client, req) => {
  log(`✅ WS client connected from ${req.socket.remoteAddress}`);
  client.on('error', () => { });
  client.on('close', () => log('WS client disconnected'));
});

// ── Send a generic command to ESP32 ────────────────────────
function sendToESP(ip, urlPath) {
  return new Promise(resolve => {
    const req = http.request(
      { host: ip, port: 80, path: urlPath, method: 'GET', timeout: 5000 },
      res => {
        log(`📡 ESP ${ip}${urlPath} → ${res.statusCode}`);
        res.resume();
        res.on('end', resolve);
      }
    );
    req.on('error', (e) => { log(`📡 ESP ERROR ${ip}${urlPath}: ${e.message}`); resolve(); });
    req.on('timeout', () => { log(`📡 ESP TIMEOUT ${ip}${urlPath}`); req.destroy(); resolve(); });
    req.end();
  });
}

// ── NEW: Send a relay command to a specific channel ─────────────────
// channel: 1 or 2
// state: 'on' | 'off'
function sendRelayToESP(ip, channel, state) {
  return sendToESP(ip, `/relay?ch=${channel}&state=${state}`);
}

async function pushKillToAllESPs(userId, state) {
  try {
    const cmd = state === 'OFF' ? 'off' : 'on';
    log(`🚨 [KILL] Pushing ${state} to all ESPs for user ${userId}`);

    const pushPromises = [];
    espRegistry.forEach((entry, deviceId) => {
      if (entry.ip) {
        if (entry.type === 'master' || deviceId === 'ESP32_MAIN') {
          pushPromises.push(sendToESP(entry.ip, `/control?status=${cmd}`));
        } else {
          pushPromises.push(sendToESP(entry.ip, `/relay?ch=1&state=${cmd}`));
          pushPromises.push(sendToESP(entry.ip, `/relay?ch=2&state=${cmd}`));
        }
      }
    });

    const [rows] = await pool.execute(
      'SELECT id, ip_address, type FROM devices WHERE user_id = ? AND ip_address IS NOT NULL',
      [userId]
    );
    for (const row of rows) {
      if (row.ip_address && !espRegistry.has(row.id)) {
        if (row.type === 'master' || row.id === 'ESP32_MAIN') {
            pushPromises.push(sendToESP(row.ip_address, `/control?status=${cmd}`));
        } else {
            pushPromises.push(sendToESP(row.ip_address, `/relay?ch=1&state=${cmd}`));
            pushPromises.push(sendToESP(row.ip_address, `/relay?ch=2&state=${cmd}`));
        }
      }
    }

    await Promise.allSettled(pushPromises);
    log(`✅ Push complete — sent to ${pushPromises.length} commands`);
  } catch (e) {
    log(`pushKillToAllESPs error: ${e.message}`);
  }
}

function fetchImageFromESP(ip) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: ip, port: 80, path: '/image', method: 'GET', timeout: 10000 },
      res => {
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      }
    );
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('ESP image timeout')); });
    req.end();
  });
}

function sendToYOLO(imgBuffer) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: 'localhost', port: YOLO_PORT, path: '/detect', method: 'POST',
      headers: { 'Content-Type': 'image/jpeg', 'Content-Length': imgBuffer.length },
      timeout: 20000
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error('Bad JSON from YOLO')); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('YOLO timeout')); });
    req.write(imgBuffer);
    req.end();
  });
}

async function resolveControlState(deviceId) {
  try {
    if (!deviceId) return { state: 'ON' };

    const [rows] = await pool.execute(
      'SELECT status, user_id FROM devices WHERE id = ?', [deviceId]
    );
    if (rows.length === 0) return { state: 'ON' };

    const userId = rows[0].user_id;
    const dbStatus = rows[0].status;
    const kill = killStateMap.get(userId);

    let state;
    if (kill === 'OFF') state = 'OFF';
    else if (dbStatus === 'inactive') state = 'OFF';
    else state = 'ON';

    return { state };
  } catch (e) {
    log(`[STATE] Error: ${e.message}`);
    return { state: 'ON' };
  }
}

// ════════════════════════════════════════════
//  HUMAN DETECTION
// ════════════════════════════════════════════
async function detectHuman(deviceId) {
  let ip = espRegistry.get(deviceId)?.ip;
  if (!ip) {
    const [ipRow] = await pool.execute('SELECT ip_address FROM devices WHERE id = ?', [deviceId]);
    if (ipRow.length > 0) ip = ipRow[0].ip_address;
  }
  if (!ip) { log(`[DETECT] No IP for ${deviceId}`); return null; } // Error state

  const sampleCount = 3;
  let bestConf = 0;
  let detected = false;
  let lastImage = '';
  let errorCount = 0;

  for (let i = 1; i <= sampleCount; i++) {
    try {
      log(`[DETECT] ${deviceId} Scanning sample ${i}/${sampleCount}...`);
      
      // Clear buffer & trigger capture
      await sendToESP(ip, '/capture');
      await new Promise(r => setTimeout(r, 1000)); 

      const imgBuffer = await fetchImageFromESP(ip);
      if (!imgBuffer || imgBuffer.length < 500) throw new Error('Incomplete frame');

      const filename = `detect_${deviceId}_s${i}_${Date.now()}.jpg`;
      fs.writeFileSync(path.join(DETECTIONS_DIR, filename), imgBuffer);
      lastImage = `/detections/${filename}`;

      const yolo = await sendToYOLO(imgBuffer);
      if (yolo.human_detected) {
        log(`[DETECT] ${deviceId} ✅ HUMAN FOUND (conf: ${yolo.confidence})`);
        detected = true;
        bestConf = Math.max(bestConf, yolo.confidence);
        
        broadcast({
          type: 'detection_result', deviceId,
          human_detected: true, confidence: yolo.confidence,
          image_url: lastImage, timestamp: new Date().toISOString()
        });
        
        return true; // Found!
      } else {
        log(`[DETECT] ${deviceId} ❌ Sample ${i} empty (conf: ${yolo.confidence || 0})`);
        bestConf = Math.max(bestConf, yolo.confidence || 0);
        await new Promise(r => setTimeout(r, 400));
      }
    } catch (e) {
      log(`[DETECT] ${deviceId} Sample ${i} error: ${e.message}`);
      errorCount++;
    }
  }

  // FAIL-SAFE: If all samples returned clear "no human", then return false.
  // BUT if some samples failed (errors), return NULL to stay ON for safety.
  if (!detected) {
    if (errorCount >= sampleCount) {
      log(`[DETECT] ⚠️ ${deviceId} ALL SAMPLES FAILED — Status: UNCERTAIN (Staying ON)`);
      return null;
    }
    log(`[DETECT] ${deviceId} 🏁 ABSENCE CONFIRMED (3 samples, Best conf: ${bestConf})`);
    broadcast({
      type: 'detection_result', deviceId,
      human_detected: false, confidence: bestConf,
      image_url: lastImage, timestamp: new Date().toISOString()
    });
    return false;
  }
  return true;
}

// ════════════════════════════════════════════
//  GUARD HELPERS — channel-aware version
//  When no human found on 2nd check:
//    • Turn OFF only the guarded relay channel
//    • Leave the other channel in whatever state it's in
// ════════════════════════════════════════════
function armGuard(deviceId, delayMs, guardedChannel) {
  const existing = guardState.get(deviceId);
  if (existing?.timerId) clearTimeout(existing.timerId);
  guardState.set(deviceId, {
    active: true,
    phase: 'armed',
    cmd: 'idle',
    guardedChannel: guardedChannel || null,  // which relay channel to cut on no-human
    timerId: setTimeout(() => triggerCapture(deviceId), delayMs)
  });
  log(`[GUARD] Armed for ${deviceId} ch=${guardedChannel}, triggers in ${delayMs / 1000}s`);
}

function stopGuard(deviceId) {
  const gs = guardState.get(deviceId);
  if (gs?.timerId) clearTimeout(gs.timerId);
  guardState.set(deviceId, { active: false, phase: 'idle', cmd: 'idle', timerId: null, guardedChannel: null });
  log(`[GUARD] Stopped for ${deviceId}`);
}

async function turnOffGuardedChannel(origDeviceId, channel) {
  // Only the guarded channel goes OFF
  log(`[GUARD] Silence confirmed — turning OFF ch=${channel} on ${origDeviceId}`);
  
  let targetId = origDeviceId;
  // If we are using the internal ESP32_M ID, find its public-facing device ID for DB updates
  if (targetId === 'ESP32_M') targetId = 'ESP32_MAIN';

  let ip = espRegistry.get(origDeviceId)?.ip;
  if (!ip) {
    const [ipRow] = await pool.execute('SELECT ip_address FROM devices WHERE id = ?', [origDeviceId]);
    if (ipRow.length > 0) ip = ipRow[0].ip_address;
  }
  if (ip) {
    await sendRelayToESP(ip, channel, 'off');
  }

  // Persist state in DB using the PUBLIC ID
  try {
    await pool.execute(
      `UPDATE devices SET relay_ch${channel}_state = 'off' WHERE id IN (?, ?)`,
      [targetId, origDeviceId]
    );
  } catch (e) {
    log(`[GUARD] DB update error: ${e.message}`);
  }

  broadcast({
    type: 'relay_state',
    deviceId: targetId,
    channel,
    state: 'off',
    reason: 'absence_confirmed',
    timestamp: new Date().toISOString()
  });
}

async function triggerCapture(deviceId) {
  const gs = guardState.get(deviceId);
  if (!gs || !gs.active) return;
  
  if (gs.timerId) clearTimeout(gs.timerId);

  if (gs.phase === 'armed' || gs.phase === 'idle') gs.phase = 'first_check';
  gs.cmd = 'capturing';
  guardState.set(deviceId, gs);
  
  log(`[GUARD] Run: device=${deviceId} phase=${gs.phase}`);

  const humanFound = await detectHuman(deviceId);
  
  const gsNow = guardState.get(deviceId);
  if (!gsNow || !gsNow.active) return;

  // ── PARANOID GUARD LOGIC ──
  if (humanFound === true) {
    // HUMAN SEEN: Reset to 30s re-check
    gsNow.phase = 'first_check';
    gsNow.timerId = setTimeout(() => triggerCapture(deviceId), 30000);
    log(`[GUARD] Human present — staying ON, rechecking in 30s`);
  } 
  else if (humanFound === null) {
    // SYSTEM ERROR (e.g. timeout): Benefit of the doubt — Stay ON, re-check in 15s
    // WE DO NOT advance the phase (e.g. from 1st to 2nd) on technical errors.
    gsNow.timerId = setTimeout(() => triggerCapture(deviceId), 15000);
    log(`[GUARD] ⚠️ SYSTEM GLITCH: Photo failed or camera timeout. Staying ON for safety, retry in 15s.`);
  }
  else {
    // HUMAN CLEARLY ABSENT: Advance miss-count
    if (gsNow.phase === 'first_check') {
      gsNow.phase = 'second_check';
      gsNow.timerId = setTimeout(() => triggerCapture(deviceId), 15000);
      log(`[GUARD] Miss 1/3 — re-verifying in 15s`);
    } else if (gsNow.phase === 'second_check') {
      gsNow.phase = 'third_check';
      gsNow.timerId = setTimeout(() => triggerCapture(deviceId), 15000);
      log(`[GUARD] Miss 2/3 — final verification in 15s`);
    } else if (gsNow.phase === 'third_check') {
      // 3 SUNNY PHOTO SESSIONS IN A ROW SHOW NO ONE! 
      const ch = gsNow.guardedChannel;
      log(`[GUARD] Miss 3/3 confirmed — turning OFF ch=${ch}`);
      
      gsNow.active = false;
      gsNow.phase = 'idle';
      gsNow.timerId = null;
      
      if (ch) await turnOffGuardedChannel(deviceId, ch);
    }
  }

  gsNow.cmd = 'idle';
  guardState.set(deviceId, gsNow);
  
  broadcast({
    type: 'guard_update',
    deviceId,
    phase: gsNow.phase,
    active: gsNow.active,
    guardedChannel: gsNow.guardedChannel,
    human_present: humanFound === true,
    error: humanFound === null
  });
}

// ════════════════════════════════════════════
//  AUTH
// ════════════════════════════════════════════
app.get('/', (req, res) => res.json({ status: 'SmartWatt Server v2.1', port: PORT }));

app.post('/api/auth/signup', async (req, res) => {
  const { email, password, name } = req.body;
  try {
    const hashed = await bcrypt.hash(password, 10);
    const id = 'user_' + Date.now();
    await pool.execute(
      'INSERT INTO users (id, email, password, full_name) VALUES (?, ?, ?, ?)',
      [id, email, hashed, name]
    );
    const token = jwt.sign({ id, email }, JWT_SECRET);
    res.json({ token, user: { id, email, name } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
    if (!rows.length) return res.status(401).json({ error: 'User not found' });
    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });
    await pool.execute('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET);
    res.json({ token, user: { id: user.id, email: user.email, name: user.full_name } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════
//  DEVICES
// ════════════════════════════════════════════
app.get('/api/devices', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM devices WHERE user_id = ?', [req.user.id]);
    res.json(rows.map(d => ({
      ...d,
      online: espRegistry.has(d.id),
      lastSeen: espRegistry.get(d.id)?.lastSeen || null
    })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/devices', authenticate, async (req, res) => {
  const { id, name, zone, type, power_rating, icon_name, relay_channel } = req.body;
  try {
    await pool.execute(
      `INSERT INTO devices
         (id, name, zone, type, power_rating, icon_name, user_id, status, relay_channel)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, name, zone, type || 'slave', power_rating || 0,
        icon_name || 'Zap', req.user.id, 'inactive', relay_channel || null]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/devices/:id', authenticate, async (req, res) => {
  const fields = [];
  const values = [];

  if (req.body.name) { fields.push('name = ?'); values.push(req.body.name.trim()); }
  if (req.body.relay_channel !== undefined) {
    fields.push('relay_channel = ?');
    values.push(req.body.relay_channel);
  }
  if (req.body.guard_enabled !== undefined) {
    fields.push('guard_enabled = ?');
    values.push(req.body.guard_enabled ? 1 : 0);
  }

  if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });

  try {
    values.push(req.params.id, req.user.id);
    await pool.execute(
      `UPDATE devices SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
      values
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/devices/:id', authenticate, async (req, res) => {
  try {
    await pool.execute(
      'DELETE FROM devices WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/devices/:id/toggle', authenticate, async (req, res) => {
  const { status } = req.body;
  const { id } = req.params;
  try {
    await pool.execute(
      'UPDATE devices SET status = ? WHERE id = ? AND user_id = ?',
      [status, id, req.user.id]
    );

    const espCmd = status === 'active' ? 'on' : 'off';
    const entry = espRegistry.get(id);
    if (entry?.ip) {
      log(`📡 Device toggle: ${id} @ ${entry.ip} → ${espCmd}`);
      // Legacy global control
      await sendToESP(entry.ip, `/control?status=${espCmd}`);
    }

    const [allDevs] = await pool.execute(
      'SELECT status FROM devices WHERE user_id = ?', [req.user.id]
    );
    const allOff = allDevs.every(d => d.status === 'inactive');
    if (allOff) killStateMap.set(req.user.id, 'OFF');
    else killStateMap.delete(req.user.id);

    broadcast({ type: 'device_toggle', deviceId: id, status });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════
//  NEW: RELAY CHANNEL CONTROL
//  PUT /api/devices/:id/relay
//  body: { channel: 1|2, state: 'on'|'off' }
//
//  This is separate from the kill-switch toggle.
//  It controls individual relay channels on the ESP32
//  that shares the device's registered IP.
//
//  Guard logic:
//  If body.guardEnabled === true, arm guard for that channel.
//  If state === 'off', stop any running guard for that channel.
// ════════════════════════════════════════════
app.put('/api/devices/:id/relay', authenticate, async (req, res) => {
  const { id } = req.params;
  const { channel, state, guardEnabled } = req.body;

  if (!channel || !state) {
    return res.status(400).json({ error: 'channel and state are required' });
  }
  if (channel !== 1 && channel !== 2) {
    return res.status(400).json({ error: 'channel must be 1 or 2' });
  }
  if (state !== 'on' && state !== 'off') {
    return res.status(400).json({ error: 'state must be on or off' });
  }

  try {
    const [rows] = await pool.execute(
      'SELECT * FROM devices WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Device not found' });

    const device = rows[0];
    let espId = device.id;  
    if (espId === 'ESP32_MAIN' || espId === 'Main Switch') espId = 'ESP32_M'; 
    const entry = espRegistry.get(espId);
    let ip = entry?.ip;
    if (!ip) {
      const [ipRow] = await pool.execute('SELECT ip_address FROM devices WHERE id = ?', [espId]);
      if (ipRow.length > 0) ip = ipRow[0].ip_address;
      else ip = device.ip_address;
    }

    if (!ip) {
      log(`[RELAY] No IP for device ${id}`);
      return res.status(503).json({ error: 'ESP not reachable' });
    }

    log(`[RELAY] ${id} ch=${channel} state=${state} guard=${guardEnabled}`);

    // Send command
    await sendRelayToESP(ip, channel, state);

    // Update DB using both possible IDs (Main Switch / ESP32_MAIN / ESP32_M)
    // This solves the sync issues where the UI and DB get mismatched
    try {
      await pool.execute(
        `UPDATE devices SET relay_channel = ?, guard_enabled = ?, relay_ch${channel}_state = ? WHERE id IN (?, ?, 'Main Switch')`,
        [channel, guardEnabled ? 1 : 0, state, id, espId]
      );
    } catch (e) {
      log(`[RELAY] DB update error: ${e.message}`);
    }

    // Guard logic: ON=Arm, OFF=Stop
    if (state === 'on' && guardEnabled) {
      armGuard(espId, 30000, channel);
      log(`[RELAY] Guard armed for ch=${channel} on ${espId}`);
    } else if (state === 'off') {
      const gs = guardState.get(espId);
      const gs2 = guardState.get(id); // Check both keys
      if (gs?.active && gs.guardedChannel === channel) stopGuard(espId);
      if (gs2?.active && gs2.guardedChannel === channel) stopGuard(id);
      log(`[RELAY] Guard stopped — ch=${channel} turned off manually`);
    }

    broadcast({
      type: 'relay_state',
      deviceId: id,
      channel,
      state,
      guardEnabled: !!guardEnabled,
      timestamp: new Date().toISOString()
    });

    res.json({ ok: true, channel, state, guardEnabled: !!guardEnabled });
  } catch (e) {
    log(`[RELAY] Error: ${e.message}`);
    res.status(500).json({ error: e.message });
  }
});

// ── GET relay status for a device ──────────────────────────
app.get('/api/devices/:id/relay', authenticate, async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM devices WHERE id = ? AND user_id = ?', [id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Device not found' });

    const device = rows[0];
    let espId = device.id;
    if (espId === 'ESP32_MAIN') espId = 'ESP32_M'; // Force relay override
    const entry = espRegistry.get(espId);
    let ip = entry?.ip;
    if (!ip) {
      // Look up target overriding in database natively
      const [ipRow] = await pool.execute('SELECT ip_address FROM devices WHERE id = ?', [espId]);
      if (ipRow.length > 0) ip = ipRow[0].ip_address;
      else ip = device.ip_address;
    }

    let espStatus = null;
    if (ip) {
      try {
        const statusRes = await new Promise((resolve, reject) => {
          const r = http.request(
            { host: ip, port: 80, path: '/relay/status', method: 'GET', timeout: 3000 },
            res2 => {
              let body = '';
              res2.on('data', c => body += c);
              res2.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve(null); } });
            }
          );
          r.on('error', reject);
          r.on('timeout', () => { r.destroy(); reject(new Error('timeout')); });
          r.end();
        });
        espStatus = statusRes;
      } catch (e) { log(`[RELAY STATUS] ESP query failed: ${e.message}`); }
    }

    res.json({
      deviceId: id,
      relay_channel: device.relay_channel,
      guard_enabled: !!device.guard_enabled,
      esp: espStatus,
      guard: guardState.get(id) || null
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════
//  ESP32 REGISTRATION
// ════════════════════════════════════════════
app.get('/register', async (req, res) => {
  const deviceId = req.query.id;
  const ip = req.query.ip || req.ip.replace('::ffff:', '');
  const type = req.query.type || 'slave';
  if (!deviceId) return res.status(400).json({ error: 'Missing device id' });

  espRegistry.set(deviceId, { ip, lastSeen: new Date(), type });
  log(`📡 ESP registered: ${deviceId} @ ${ip} (${type})`);

  try {
    await pool.execute('UPDATE devices SET ip_address = ? WHERE id = ?', [ip, deviceId]);

    const [rows] = await pool.execute(
      'SELECT user_id, status FROM devices WHERE id = ?', [deviceId]
    );

    let pushCmd = 'on';
    if (rows.length > 0) {
      const userId = rows[0].user_id;
      const dbStatus = rows[0].status;
      const kill = killStateMap.get(userId);
      pushCmd = (kill === 'OFF' || dbStatus === 'inactive') ? 'off' : 'on';
    }
    
    if (type === 'master' || deviceId === 'ESP32_MAIN') {
      log(`📡 On-register push: ${deviceId} → /control?status=${pushCmd}`);
      await sendToESP(ip, `/control?status=${pushCmd}`);
    } else {
      log(`📡 On-register push: ${deviceId} → /relay?ch=1&state=${pushCmd} and ch2`);
      await sendRelayToESP(ip, 1, pushCmd);
      await sendRelayToESP(ip, 2, pushCmd);
    }
  } catch (e) { log(`Register DB error: ${e.message}`); }

  res.json({ ok: true, deviceId, ip });
});

// ════════════════════════════════════════════
//  CONTROL STATE POLLING (legacy kill-switch polling)
// ════════════════════════════════════════════
app.get('/api/control/state', async (req, res) => {
  const deviceId = req.query.id;
  try { res.json(await resolveControlState(deviceId)); }
  catch (e) { res.json({ state: 'ON' }); }
});

app.post('/api/control/state', async (req, res) => {
  const deviceId = req.body.id || req.query.id;
  try { res.json(await resolveControlState(deviceId)); }
  catch (e) { res.json({ state: 'ON' }); }
});

// ════════════════════════════════════════════
//  KILL SWITCH
// ════════════════════════════════════════════
app.post('/api/control/kill', authenticate, async (req, res) => {
  try {
    killStateMap.set(req.user.id, 'OFF');
    await pool.execute('UPDATE devices SET status = ? WHERE user_id = ?', ['inactive', req.user.id]);
    await pushKillToAllESPs(req.user.id, 'OFF');
    broadcast({ type: 'kill_switch', state: 'OFF', userId: req.user.id });
    res.json({ ok: true, state: 'OFF' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/control/on', authenticate, async (req, res) => {
  try {
    killStateMap.delete(req.user.id);
    await pool.execute('UPDATE devices SET status = ? WHERE user_id = ?', ['active', req.user.id]);
    await pushKillToAllESPs(req.user.id, 'ON');
    broadcast({ type: 'kill_switch', state: 'ON', userId: req.user.id });
    res.json({ ok: true, state: 'ON' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/devices/turn-all-on', authenticate, async (req, res) => {
  try {
    killStateMap.delete(req.user.id);
    // 1. Update all devices for this user to 'active'
    await pool.execute('UPDATE devices SET status = ? WHERE user_id = ?', ['active', req.user.id]);
    
    // 2. Push ON command to all registered ESPs
    await pushKillToAllESPs(req.user.id, 'ON');
    
    // 3. Broadcast to all clients to sync UI
    broadcast({ type: 'device_toggle', deviceId: 'all', status: 'active', userId: req.user.id });
    
    res.json({ ok: true, message: 'All devices turned ON' });
  } catch (e) {
    log(`[TURN-ALL-ON] Error: ${e.message}`);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/devices/turn-all-off', authenticate, async (req, res) => {
  try {
    // 1. Update all devices for this user to 'inactive'
    await pool.execute('UPDATE devices SET status = ? WHERE user_id = ?', ['inactive', req.user.id]);

    // 2. Push OFF command to all registered ESPs
    await pushKillToAllESPs(req.user.id, 'OFF');

    // 3. Broadcast to all clients to sync UI (NOT kill_switch, so sidebar Kill Power is unaffected)
    broadcast({ type: 'device_toggle', deviceId: 'all', status: 'inactive', userId: req.user.id });

    res.json({ ok: true, message: 'All devices turned OFF' });
  } catch (e) {
    log(`[TURN-ALL-OFF] Error: ${e.message}`);
    res.status(500).json({ error: e.message });
  }
});

// ════════════════════════════════════════════
//  ENERGY (unchanged from original)
// ════════════════════════════════════════════
app.post('/api/energy/room-reading', async (req, res) => {
  const { device_id, zone, voltage, current, power, energy } = req.body;
  if (!device_id) return res.status(400).json({ error: 'Missing device id' });

  const num = v => v != null && !isNaN(parseFloat(v)) ? parseFloat(parseFloat(v).toFixed(3)) : 0;
  const v = num(voltage); const c = num(current);
  let p = num(power); const e = num(energy);
  if (p === 0) p = num(v * c);

  try {
    const [rows] = await pool.execute('SELECT user_id FROM devices WHERE id = ?', [device_id]);
    if (rows.length > 0) {
      await pool.execute(`
        INSERT INTO daily_energy_tracking (date, device_id, user_id, voltage, current, power, total_energy, starting_energy, daily_energy)
        VALUES (CURDATE(), ?, ?, ?, ?, ?, ?, ?, 0)
        ON DUPLICATE KEY UPDATE
          voltage = VALUES(voltage),
          current = VALUES(current),
          power = VALUES(power),
          daily_energy = GREATEST(0, VALUES(total_energy) - starting_energy),
          total_energy = VALUES(total_energy)
      `, [device_id, rows[0].user_id, v, c, p, e, e]);
      
      const [trackRows] = await pool.execute(
        'SELECT daily_energy FROM daily_energy_tracking WHERE device_id = ? AND date = CURDATE()',
        [device_id]
      );
      const calculatedEnergy = trackRows[0]?.daily_energy || 0;
      
      liveReadings.set(device_id, { voltage: v, current: c, power: p, energy: calculatedEnergy, zone, timestamp: new Date().toISOString() });
      broadcast({ type: 'energy_reading', device_id, zone, voltage: v, current: c, power: p, energy: calculatedEnergy, timestamp: new Date().toISOString() });
    }
    res.json({ ok: true });
  } catch (e2) { res.status(500).json({ error: e2.message }); }
});

app.post('/api/energy/reading', async (req, res) => {
  let { device_id } = req.body;
  const num = v => v != null && !isNaN(parseFloat(v)) ? parseFloat(parseFloat(v).toFixed(3)) : 0;
  let current = num(req.body.current ?? req.body.Current ?? req.body.I ?? req.body.amp);
  let voltage = num(req.body.voltage ?? req.body.Voltage ?? req.body.V);
  let power = num(req.body.power ?? req.body.Power ?? req.body.P ?? req.body.watt);
  let energy = num(req.body.energy ?? req.body.Energy ?? req.body.E ?? req.body.kWh);
  if (power === 0) power = num(voltage * current);

  try {
    if (!device_id) {
      const [devs] = await pool.execute('SELECT id FROM devices LIMIT 1');
      if (devs.length > 0) device_id = devs[0].id;
      else return res.json({ ok: true });
    }
    const [devices] = await pool.execute('SELECT user_id FROM devices WHERE id = ?', [device_id]);
    if (!devices.length) return res.json({ ok: true });
    
    await pool.execute(`
      INSERT INTO daily_energy_tracking (date, device_id, user_id, voltage, current, power, total_energy, starting_energy, daily_energy)
      VALUES (CURDATE(), ?, ?, ?, ?, ?, ?, ?, 0)
      ON DUPLICATE KEY UPDATE
        voltage = VALUES(voltage),
        current = VALUES(current),
        power = VALUES(power),
        daily_energy = GREATEST(0, VALUES(total_energy) - starting_energy),
        total_energy = VALUES(total_energy)
    `, [device_id, devices[0].user_id, voltage, current, power, energy, energy]);
    
    const [trackRows] = await pool.execute(
      'SELECT daily_energy FROM daily_energy_tracking WHERE device_id = ? AND date = CURDATE()',
      [device_id]
    );
    const calculatedEnergy = trackRows[0]?.daily_energy || 0;
    
    liveReadings.set(device_id, { voltage, current, power, energy: calculatedEnergy, timestamp: new Date().toISOString() });
    broadcast({ type: 'energy_reading', device_id, current, voltage, power, energy: calculatedEnergy, timestamp: new Date().toISOString() });
    
    if (espRegistry.has(device_id)) espRegistry.get(device_id).lastSeen = new Date();
  } catch (e) { log(`❌ Energy DB error: ${e.message}`); }

  res.json({ ok: true });
});

app.get('/api/energy/live', authenticate, async (req, res) => {
  const deviceId = req.query.device_id;
  if (deviceId) {
    const live = liveReadings.get(deviceId);
    if (live) return res.json(live);
    try {
      const [rows] = await pool.execute(
        'SELECT voltage, current, power, daily_energy as energy FROM daily_energy_tracking WHERE device_id = ? AND user_id = ? ORDER BY date DESC LIMIT 1',
        [deviceId, req.user.id]
      );
      return res.json(rows[0] || { voltage: 0, current: 0, power: 0, energy: 0 });
    } catch (e) { return res.json({ voltage: 0, current: 0, power: 0, energy: 0 }); }
  }
  const [masterRows] = await pool.execute(
    "SELECT id FROM devices WHERE user_id = ? AND type = 'master' LIMIT 1", [req.user.id]
  ).catch(() => [[]]);
  const masterId = masterRows[0]?.id;
  if (masterId && liveReadings.has(masterId)) return res.json(liveReadings.get(masterId));
  try {
    const [rows] = await pool.execute(
      'SELECT voltage, current, power, daily_energy as energy FROM daily_energy_tracking WHERE user_id = ? ORDER BY date DESC LIMIT 1', [req.user.id]
    );
    res.json(rows[0] || { voltage: 0, current: 0, power: 0, energy: 0 });
  } catch (e) { res.json({ voltage: 0, current: 0, power: 0, energy: 0 }); }
});

app.get('/api/energy/device/:id', authenticate, async (req, res) => {
  const live = liveReadings.get(req.params.id);
  if (live) return res.json(live);
  try {
    const [rows] = await pool.execute(
      'SELECT voltage, current, power, daily_energy as energy FROM daily_energy_tracking WHERE device_id = ? AND user_id = ? ORDER BY date DESC LIMIT 1',
      [req.params.id, req.user.id]
    );
    res.json(rows[0] || { voltage: 0, current: 0, power: 0, energy: 0 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/energy/device-stats/:id', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT total_energy, starting_energy, voltage, current, power, daily_energy 
       FROM daily_energy_tracking 
       WHERE device_id = ? AND user_id = ? 
       ORDER BY date DESC LIMIT 1`,
      [req.params.id, req.user.id]
    );
    res.json(rows[0] || { total_energy: 0, starting_energy: 0, voltage: 0, current: 0, power: 0, daily_energy: 0 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/energy/current', authenticate, async (req, res) => {
  const deviceId = req.query.device_id;
  try {
    if (deviceId) {
      const live = liveReadings.get(deviceId);
      if (live) return res.json(live);
      const [rows] = await pool.execute(
        'SELECT current, voltage, power, daily_energy as energy FROM daily_energy_tracking WHERE device_id = ? AND user_id = ? ORDER BY date DESC LIMIT 1',
        [deviceId, req.user.id]
      );
      return res.json(rows[0] || { current: 0, voltage: 0, power: 0, energy: 0 });
    }
    const [rows] = await pool.execute(
      'SELECT current, voltage, power, daily_energy as energy FROM daily_energy_tracking WHERE user_id = ? ORDER BY date DESC LIMIT 1', [req.user.id]
    );
    res.json(rows[0] || { current: 0, voltage: 0, power: 0, energy: 0 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/energy/today', authenticate, async (req, res) => {
  const deviceId = req.query.device_id;
  try {
    let rows;
    if (deviceId) {
      [rows] = await pool.execute(
        `SELECT daily_energy as total FROM daily_energy_tracking
         WHERE user_id = ? AND device_id = ? AND date = CURDATE()`,
        [req.user.id, deviceId]
      );
    } else {
      [rows] = await pool.execute(
        `SELECT SUM(er.daily_energy) as total FROM daily_energy_tracking er
         JOIN devices d ON er.device_id = d.id
         WHERE er.user_id = ? AND d.type = 'master' AND er.date = CURDATE()`,
        [req.user.id]
      );
      // Fallback if no master device logic matches exactly
      if (!rows[0].total) {
         [rows] = await pool.execute(
            `SELECT SUM(daily_energy) as total FROM daily_energy_tracking
             WHERE user_id = ? AND date = CURDATE()`,
            [req.user.id]
          );
      }
    }
    res.json({ total: rows[0]?.total || 0 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/energy/history', authenticate, async (req, res) => {
  const period = req.query.period || 'day';
  try {
    let rows = [];
    if (period === 'month') {
      // Last 6 months aggregated
      [rows] = await pool.execute(`
        SELECT DATE_FORMAT(date, '%Y-%m-01') as time,
               SUM(power) as power,
               SUM(daily_energy) as energy
        FROM daily_energy_tracking
        WHERE user_id = ? AND daily_energy >= 0 AND date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
        GROUP BY YEAR(date), MONTH(date)
        ORDER BY YEAR(date) DESC, MONTH(date) DESC
      `, [req.user.id]);
    } else if (period === 'week') {
      // Last 7 days aggregated
      [rows] = await pool.execute(`
        SELECT date as time,
               SUM(power) as power,
               SUM(daily_energy) as energy
        FROM daily_energy_tracking
        WHERE user_id = ? AND daily_energy >= 0 AND date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        GROUP BY date
        ORDER BY date DESC
      `, [req.user.id]);
    } else {
      // Aggregate for today
      [rows] = await pool.execute(`
        SELECT date as time,
               SUM(power) as power,
               SUM(daily_energy) as energy
        FROM daily_energy_tracking
        WHERE user_id = ? AND daily_energy >= 0 AND date = CURDATE()
        GROUP BY date
      `, [req.user.id]);
    }

    res.json(rows.reverse().map(r => ({
      time: new Date(r.time).toISOString(),
      power: r.power || 0,
      energy: r.energy || 0
    })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/energy/analysis', authenticate, async (req, res) => {
  const { date, period } = req.query; 
  if (!date) return res.status(400).json({ error: "Missing date" });

  try {
    let totalRows, zoneRows;

    if (period === 'week') {
      [totalRows] = await pool.execute(`
        SELECT 
          AVG(current) as avg_current,
          AVG(power) as avg_power,
          SUM(daily_energy) as total_energy
        FROM daily_energy_tracking
        WHERE user_id = ? AND daily_energy >= 0 AND date >= DATE_SUB(?, INTERVAL 7 DAY) AND date <= ?
      `, [req.user.id, date, date]);

      [zoneRows] = await pool.execute(`
        SELECT 
          d.zone as zone_name,
          AVG(det.current) as avg_current,
          AVG(det.power) as avg_power,
          SUM(det.daily_energy) as total_energy
        FROM daily_energy_tracking det
        JOIN devices d ON det.device_id = d.id
        WHERE det.user_id = ? AND d.zone IS NOT NULL AND det.daily_energy >= 0 AND det.date >= DATE_SUB(?, INTERVAL 7 DAY) AND det.date <= ?
        GROUP BY d.zone
      `, [req.user.id, date, date]);

    } else if (period === 'month') {
      [totalRows] = await pool.execute(`
        SELECT 
          AVG(current) as avg_current,
          AVG(power) as avg_power,
          SUM(daily_energy) as total_energy
        FROM daily_energy_tracking
        WHERE user_id = ? AND daily_energy >= 0 AND MONTH(date) = MONTH(?) AND YEAR(date) = YEAR(?)
      `, [req.user.id, date, date]);

      [zoneRows] = await pool.execute(`
        SELECT 
          d.zone as zone_name,
          AVG(det.current) as avg_current,
          AVG(det.power) as avg_power,
          SUM(det.daily_energy) as total_energy
        FROM daily_energy_tracking det
        JOIN devices d ON det.device_id = d.id
        WHERE det.user_id = ? AND d.zone IS NOT NULL AND det.daily_energy >= 0 AND MONTH(det.date) = MONTH(?) AND YEAR(det.date) = YEAR(?)
        GROUP BY d.zone
      `, [req.user.id, date, date]);

    } else { // 'day'
      [totalRows] = await pool.execute(`
        SELECT 
          AVG(current) as avg_current,
          AVG(power) as avg_power,
          SUM(daily_energy) as total_energy
        FROM daily_energy_tracking
        WHERE user_id = ? AND daily_energy >= 0 AND date = ?
      `, [req.user.id, date]);

      [zoneRows] = await pool.execute(`
        SELECT 
          d.zone as zone_name,
          AVG(det.current) as avg_current,
          AVG(det.power) as avg_power,
          SUM(det.daily_energy) as total_energy
        FROM daily_energy_tracking det
        JOIN devices d ON det.device_id = d.id
        WHERE det.user_id = ? AND d.zone IS NOT NULL AND det.daily_energy >= 0 AND det.date = ?
        GROUP BY d.zone
      `, [req.user.id, date]);
    }

    res.json({
      total: totalRows[0] || { avg_current: 0, avg_power: 0, total_energy: 0 },
      zones: zoneRows || []
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════
//  ESP COMMAND POLLING + ACK
// ════════════════════════════════════════════
app.get('/api/esp/command', (req, res) => {
  const deviceId = req.query.id || 'cam';
  const gs = guardState.get(deviceId) || { active: false, cmd: 'idle' };
  res.json({ cmd: gs.cmd || 'idle' });
});

app.post('/api/esp/ack', (req, res) => {
  const { ack, device_id } = req.body;
  const deviceId = device_id || 'cam';
  const gs = guardState.get(deviceId);
  if (gs && (ack === 'capture_done' || ack === 'capture_failed')) gs.cmd = 'idle';
  res.json({ ok: true });
});

// ════════════════════════════════════════════
//  GUARD START / STOP (manual API endpoints)
// ════════════════════════════════════════════
app.get('/api/start-guard', async (req, res) => {
  const deviceId = req.query.device_id || 'ESP32_M';
  const channel = parseInt(req.query.channel || '1', 10);
  armGuard(deviceId, 30000, channel);
  res.json({ ok: true, deviceId, channel, message: `Guard armed for ch=${channel} — first detection in 30s` });
});

app.get('/api/stop-guard', async (req, res) => {
  const deviceId = req.query.device_id || 'ESP32_M';
  stopGuard(deviceId);
  res.json({ ok: true });
});

// ════════════════════════════════════════════
//  DETECTION RESULT (manual override)
// ════════════════════════════════════════════
app.post('/api/detection/result', (req, res) => {
  const { human_detected, device_id } = req.body;
  const deviceId = device_id || 'cam';
  broadcast({ type: 'detection_result', deviceId, human_detected, timestamp: new Date().toISOString() });
  res.json({ ok: true });
});

// ════════════════════════════════════════════
//  IMAGE UPLOAD
// ════════════════════════════════════════════
app.post('/upload', (req, res) => {
  const filename = `image_${Date.now()}.jpg`;
  const filepath = path.join(UPLOADS_DIR, filename);
  fs.writeFile(filepath, req.body, err => {
    if (err) return res.status(500).send('Save failed');
    broadcast({ type: 'new_image', url: `/uploads/${filename}`, timestamp: new Date().toISOString() });
    res.status(200).send('OK');
  });
});

app.get('/api/latest-image', authenticate, (req, res) => {
  fs.readdir(UPLOADS_DIR, (err, files) => {
    if (err || !files) return res.json({});
    const jpgs = files.filter(f => f.endsWith('.jpg')).sort().reverse();
    res.json(jpgs.length ? { url: `/uploads/${jpgs[0]}` } : {});
  });
});

// ════════════════════════════════════════════
//  PROFILE / ZONES / ALERTS / BILLING
// ════════════════════════════════════════════
app.get('/api/billing/time-slots', authenticate, (req, res) => {
  res.json([]);
});

app.get('/api/profile', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM profiles WHERE user_id = ?', [req.user.id]);
    res.json(rows[0] || null);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/profile', authenticate, async (req, res) => {
  const { full_name, email, is_verified } = req.body;
  try {
    await pool.execute(
      'INSERT INTO profiles (user_id, full_name, email, is_verified) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE full_name=?, is_verified=?',
      [req.user.id, full_name, email, is_verified, full_name, is_verified]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/zones', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM zones WHERE user_id = ?', [req.user.id]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/zones', authenticate, async (req, res) => {
  const { name } = req.body;
  try {
    await pool.execute('INSERT INTO zones (name, user_id) VALUES (?, ?)', [name, req.user.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/alerts', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM alerts WHERE user_id = ? ORDER BY created_at DESC LIMIT 10', [req.user.id]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/billing/summary', authenticate, async (req, res) => {
  try {
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const targetDevice = req.query.device_id || 'ESP32_MAIN';

    // Verify if that device exists for the user; if not, fallback to any master
    let activeDeviceId = targetDevice;
    const [devCheck] = await pool.execute(
      'SELECT id FROM devices WHERE user_id = ? AND id = ?', 
      [req.user.id, targetDevice]
    );

    if (!devCheck.length) {
       const [masterCheck] = await pool.execute(
          "SELECT id FROM devices WHERE user_id = ? AND type = 'master' LIMIT 1",
          [req.user.id]
       );
       if (masterCheck.length > 0) activeDeviceId = masterCheck[0].id;
    }

    const [rows] = await pool.execute(
      `SELECT 
         SUM(daily_energy) as total_monthly_energy, 
         COUNT(DISTINCT date) as days_tracked
       FROM daily_energy_tracking 
       WHERE user_id = ? AND device_id = ? AND MONTH(date) = ? AND YEAR(date) = ?`,
      [req.user.id, activeDeviceId, month, year]
    );

    const [dailyRows] = await pool.execute(
      `SELECT date, daily_energy 
       FROM daily_energy_tracking 
       WHERE user_id = ? AND device_id = ? AND MONTH(date) = ? AND YEAR(date) = ?
       ORDER BY date DESC`,
      [req.user.id, activeDeviceId, month, year]
    );

    res.json({
      total_monthly_energy: rows[0]?.total_monthly_energy || 0,
      days_tracked: rows[0]?.days_tracked || 0,
      daily_breakdown: dailyRows,
      device_id: activeDeviceId
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════
//  DEBUG
// ════════════════════════════════════════════
app.get('/debug/state', async (req, res) => {
  try {
    const [devices] = await pool.execute('SELECT id, status, user_id, ip_address, relay_channel, guard_enabled FROM devices');
    const killMap = {}, espMap = {}, liveMap = {}, guardMap = {};
    killStateMap.forEach((v, k) => { killMap[k] = v; });
    espRegistry.forEach((v, k) => { espMap[k] = { ip: v.ip, type: v.type, lastSeen: v.lastSeen }; });
    liveReadings.forEach((v, k) => { liveMap[k] = v; });
    guardState.forEach((v, k) => { guardMap[k] = { active: v.active, phase: v.phase, guardedChannel: v.guardedChannel }; });
    res.json({ devices, killState: killMap, espRegistry: espMap, liveReadings: liveMap, guardState: guardMap, timestamp: new Date().toISOString() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/debug/yolo', (req, res) => {
  const req2 = http.request(
    { host: 'localhost', port: YOLO_PORT, path: '/health', method: 'GET', timeout: 3000 },
    res2 => {
      let body = '';
      res2.on('data', chunk => body += chunk);
      res2.on('end', () => res.json({ yolo: JSON.parse(body), ok: true }));
    }
  );
  req2.on('error', () => res.json({ ok: false, error: 'detector.py not running' }));
  req2.on('timeout', () => { req2.destroy(); res.json({ ok: false, error: 'timeout' }); });
  req2.end();
});

app.use((req, res) => {
  res.status(404).json({ error: `${req.method} ${req.url} not found` });
});

async function initDatabase() {
  try {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS daily_energy_tracking (
        id INT AUTO_INCREMENT PRIMARY KEY,
        date DATE NOT NULL,
        device_id VARCHAR(50) NOT NULL,
        user_id VARCHAR(50) NOT NULL,
        voltage FLOAT DEFAULT 0,
        current FLOAT DEFAULT 0,
        power FLOAT DEFAULT 0,
        total_energy FLOAT DEFAULT 0,
        starting_energy FLOAT DEFAULT 0,
        daily_energy FLOAT DEFAULT 0,
        UNIQUE KEY unique_device_date (device_id, date)
      )
    `);
    log("✅ Checked/Created daily_energy_tracking table");
  } catch (e) {
    log(`❌ DB Init Error: ${e.message}`);
  }
}
initDatabase();

server.listen(PORT, '0.0.0.0', () => {
  log(`🚀 SmartWatt Server running on port ${PORT}`);
  log(`🔌 WebSocket ready at ws://localhost:${PORT}`);
  log(`🤖 YOLO detector expected at http://localhost:${YOLO_PORT}`);
  log(`🔁 New relay endpoint: PUT /api/devices/:id/relay  { channel, state, guardEnabled }`);
});
// Plain HTTP on 3002 for ESP8266
require('http').createServer(app).listen(3002, '0.0.0.0', () => {
  log('ESP plain-HTTP listener ready on port 3002');
});
