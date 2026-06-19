const mysql = require('./backend/node_modules/mysql2/promise');

async function run() {
  try {
    const pool = await mysql.createPool({ 
      host: 'localhost', 
      user: 'root', 
      password: '', 
      database: 'smartwatt', 
      port: 3307 
    });
    
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
      )`
    );
    
    console.log('TABLE CREATED SUCCESSFULLY');
    process.exit(0);
  } catch(e) {
    console.error(e.message);
    process.exit(1);
  }
}
run();
