const mysql = require('mysql2/promise');

async function check() {
  const pool = mysql.createPool({
    host: 'localhost', user: 'root', password: '',
    database: 'smartwatt', port: 3307
  });

  try {
    const [devices] = await pool.execute('SELECT id, name, zone FROM devices');
    console.log('--- Devices ---');
    console.table(devices);

    const [tracking] = await pool.execute('SELECT * FROM daily_energy_tracking ORDER BY id DESC LIMIT 5');
    console.log('--- Latest Tracking ---');
    console.table(tracking);
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}

check();
