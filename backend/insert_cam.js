const mysql = require('mysql2/promise');

async function fix() {
  const pool = mysql.createPool({ 
    host: 'localhost', user: 'root', password: '', database: 'smartwatt', port: 3307
  });
  try {
    const [users] = await pool.query('SELECT id FROM users LIMIT 1');
    const userId = users[0].id;
    await pool.query(
      `INSERT INTO devices (id, name, zone, type, relay_count, user_id, status, ip_address) 
       VALUES ('ESP32_M', 'ESP32_M', 'Living Room', 'slave', 2, ?, 'active', '192.168.1.15')
       ON DUPLICATE KEY UPDATE ip_address = '192.168.1.15'`, 
      [userId]
    );
    console.log('Inserted ESP32_M successfully!');
  } catch(e) {
    console.log('Error:', e.message);
  }
  process.exit(0);
}
fix();
