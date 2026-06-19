const mysql = require('mysql2/promise');
const http = require('http');

async function test() {
  const device_id = 'LR_ROOM_ANALYZER';
  const user_id = 'user_1744776264194'; // From previous DB check if possible, or I'll just fetch it.
  
  const pool = mysql.createPool({
    host: 'localhost', user: 'root', password: '',
    database: 'smartwatt', port: 3307
  });

  try {
    // 1. Get user_id for this device
    const [devs] = await pool.execute('SELECT user_id FROM devices WHERE id = ?', [device_id]);
    if (!devs.length) {
      console.error('Device not found');
      return;
    }
    const uid = devs[0].user_id;

    // 2. Clear today's entry for clean test
    await pool.execute('DELETE FROM daily_energy_tracking WHERE device_id = ? AND date = CURDATE()', [device_id]);
    console.log('Cleaned up today\'s data for test');

    // 3. Send initial reading (First reading of the day)
    // Starting energy: 10.0 kWh
    const payload1 = {
      device_id,
      zone: 'Living Room',
      voltage: 230,
      current: 1,
      power: 230,
      energy: 10.0
    };

    console.log('Sending initial reading...');
    await post('/api/energy/room-reading', payload1);

    // Check DB
    let [rows] = await pool.execute('SELECT * FROM daily_energy_tracking WHERE device_id = ? AND date = CURDATE()', [device_id]);
    console.log('After Initial Reading:', rows[0]);

    // 4. Send second reading (Total energy increased to 10.5 kWh)
    // Expected daily_energy = 10.5 - 10.0 = 0.5 kWh
    const payload2 = {
      device_id,
      zone: 'Living Room',
      voltage: 230,
      current: 2,
      power: 460,
      energy: 10.5
    };

    console.log('Sending second reading...');
    await post('/api/energy/room-reading', payload2);

    // Check DB
    [rows] = await pool.execute('SELECT * FROM daily_energy_tracking WHERE device_id = ? AND date = CURDATE()', [device_id]);
    console.log('After Second Reading:', rows[0]);

    if (rows[0].daily_energy === 0.5) {
      console.log('✅ Energy calculation test PASSED (0.5 kWh)');
    } else {
      console.log('❌ Energy calculation test FAILED. Expected 0.5, got', rows[0].daily_energy);
    }

  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}

function post(path, data) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const req = http.request({
      host: 'localhost',
      port: 3001,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': payload.length
      }
    }, res => {
      res.on('data', () => {});
      res.on('end', resolve);
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

test();
