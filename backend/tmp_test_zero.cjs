const mysql = require('mysql2/promise');
const http = require('http');

async function testZeroValues() {
  const device_id = 'LR_ROOM_ANALYZER';
  
  const pool = mysql.createPool({
    host: 'localhost', user: 'root', password: '',
    database: 'smartwatt', port: 3307
  });

  try {
    // 1. Send reading with current = 0 and power = 0
    const payload = {
      device_id,
      zone: 'Living Room',
      voltage: 230,
      current: 0,
      power: 0,
      energy: 12.0
    };

    console.log('Sending 0-value reading...');
    await post('/api/energy/room-reading', payload);

    // 2. Check DB
    const [rows] = await pool.execute('SELECT * FROM daily_energy_tracking WHERE device_id = ? AND date = CURDATE()', [device_id]);
    console.log('DB Reading:', rows[0]);

    if (rows[0].power === 0 && rows[0].current === 0) {
      console.log('✅ Backend 0-value test PASSED');
    } else {
      console.log('❌ Backend 0-value test FAILED');
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

testZeroValues();
