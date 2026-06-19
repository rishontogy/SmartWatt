const fs = require('fs');

// 1. Fix server.js
let server = fs.readFileSync('d:/SmartWatt/backend/backend/server.js', 'utf8');
server = server.replace(/app\.get\("\/api\/energy\/today", \(req, res\) => \{[\s\S]*?res\.json\(\{\s*start,\s*end,\s*total\s*\}\);\s*\}\);\s*\}\);/,
`app.get("/api/energy/today", async (req, res) => {
  try {
    const sql = \`
        SELECT SUM(energy) as totalEnergy
        FROM energy_readings
        WHERE DATE(created_at) = CURDATE() OR DATE(timestamp) = CURDATE()
    \`;
    const [result] = await db.execute(sql);
    const total = result[0].totalEnergy || 0;

    res.json({ total });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error");
  }
});`);

server = server.replace(/app\.post\("\/api\/energy\/reading", \(req, res\) => \{[\s\S]*?res\.send\("OK"\);\s*\}\);\s*\}\);/,
`app.post("/api/energy/reading", async (req, res) => {
  try {
    const { voltage, current, power } = req.body;
    
    // Calculate kWh used in exactly 5 seconds
    const calculatedEnergy = parseFloat(((power / 1000) * (5 / 3600)).toFixed(8)) || 0;

    const sql = \`
        INSERT INTO energy_readings (energy, voltage, current, power)
        VALUES (?, ?, ?, ?)
    \`;

    await db.execute(sql, [calculatedEnergy, voltage, current, power]);
    console.log("Saved 5s interval energy:", calculatedEnergy, "kWh");
    res.send("OK");
  } catch (err) {
    console.error(err);
    res.status(500).send("DB error");
  }
});`);
fs.writeFileSync('d:/SmartWatt/backend/backend/server.js', server);

// 2. Fix api.ts
let api = fs.readFileSync('d:/SmartWatt/src/app/lib/api.ts', 'utf8');
api = api.replace("async getTodayEnergy() {\\n    return await apiCall('/energy/today');\\n  },\\n\\n  async getDailyAnalysis(date: string, period: 'day' | 'week' | 'month' = 'day') {",
`  async getTodayEnergy() {
    return await apiCall('/energy/today');
  },

  async getDailyAnalysis(date: string, period: 'day' | 'week' | 'month' = 'day') {`);
fs.writeFileSync('d:/SmartWatt/src/app/lib/api.ts', api);

// 3. Fix home-page.tsx
let home = fs.readFileSync('d:/SmartWatt/src/app/pages/home-page.tsx', 'utf8');
home = home.replace(/const today = new Date\(\)\.toISOString\(\)\.split\('T'\)\[0\];\s*const \[devices, currentReading, dailyAnalysis\] = await Promise\.all\(\[\s*devicesAPI\.getDevices\(\),\s*energyAPI\.getCurrentReading\(\),\s*energyAPI\.getTodayEnergy\(\)\s*\]\);/,
`      const [devices, currentReading, todayEnergyData] = await Promise.all([
        devicesAPI.getDevices(),
        energyAPI.getCurrentReading(),
        energyAPI.getTodayEnergy()
      ]);`);

home = home.replace(/\/\/ calculate exact today's energy from DB sum\s*if \(dailyAnalysis\?\.total\?\.total_energy != null\) \{\s*setCurrentEnergy\(parseFloat\(dailyAnalysis\.total\.total_energy\)\.toFixed\(2\)\);\s*\} else \{/,
`      // calculate exact today's energy from DB sum endpoint
      if (todayEnergyData && todayEnergyData.total != null) {
        setCurrentEnergy(parseFloat(todayEnergyData.total).toFixed(4));
      } else {`);
fs.writeFileSync('d:/SmartWatt/src/app/pages/home-page.tsx', home);

console.log("Replacement successful!");
