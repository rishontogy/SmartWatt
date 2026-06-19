#include <WiFi.h>
#include <WebServer.h>
#include <WebSocketsServer.h>
#include <PZEM004Tv30.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>

// ─── PINS ───
#define PZEM_RX_PIN  23
#define PZEM_TX_PIN  22
#define RELAY_PIN     5

// ─── CONFIG ───
const char* ssid     = "SEEWELL BSNL";
const char* password = "481299717069";

// ─── NGROK URLS ───
const char* BACKEND_URL  = "https://extrorsely-prechemical-juan.ngrok-free.dev/api/energy/reading";
const char* CONTROL_URL  = "https://extrorsely-prechemical-juan.ngrok-free.dev/api/control/state";
const char* REGISTER_URL = "https://extrorsely-prechemical-juan.ngrok-free.dev/register";

// ─── OBJECTS ───
PZEM004Tv30      pzem(Serial2, PZEM_RX_PIN, PZEM_TX_PIN);
WebServer        server(80);
WebSocketsServer webSocket(81);
// NO global WiFiClientSecure — each function creates its own fresh instance

// ─── STATE ───
float  voltage = 0, current = 0, power = 0, energy = 0;
bool   relayOn = true;
String deviceId = "ESP32_MAIN";

// ─── TIMERS ───
unsigned long lastSensor   = 0;
unsigned long lastBackend  = 0;
unsigned long lastControl  = 0;
unsigned long lastRegister = 0;

// ─── HTML PAGE ───
const char* htmlPage = R"=====(
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>SmartWatt Power Monitor</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body {
  background:linear-gradient(135deg,#0a0e27,#172a44);
  color:#e2e8f0;
  font-family:'Segoe UI',sans-serif;
  min-height:100vh;
  padding:20px;
}
h1 {
  text-align:center;
  font-size:2rem;
  background:linear-gradient(135deg,#00a5fa,#a78bfa);
  -webkit-background-clip:text;
  -webkit-text-fill-color:transparent;
  margin-bottom:20px;
}
.grid {
  display:grid;
  grid-template-columns:repeat(2,1fr);
  gap:16px;
  max-width:500px;
  margin:0 auto 20px;
}
.card {
  background:rgba(255,255,255,0.05);
  border:1px solid rgba(255,255,255,0.1);
  border-radius:12px;
  padding:16px;
  text-align:center;
}
.card .label { font-size:0.75rem; color:#94a3b8; margin-bottom:4px; }
.card .value { font-size:1.8rem; font-weight:bold; color:#00a5fa; }
.card .unit  { font-size:0.75rem; color:#64748b; }
.status {
  text-align:center; padding:10px; border-radius:8px;
  margin:10px auto; max-width:300px; font-weight:bold;
}
.on  { background:#16a34a33; color:#4ade80; border:1px solid #16a34a; }
.off { background:#dc262633; color:#f87171; border:1px solid #dc2626; }
canvas { max-width:600px; display:block; margin:0 auto; }
</style>
</head>
<body>
<h1>SmartWatt Monitor</h1>
<div class="grid">
  <div class="card"><div class="label">Voltage</div><div class="value" id="v">--</div><div class="unit">V</div></div>
  <div class="card"><div class="label">Current</div><div class="value" id="i">--</div><div class="unit">A</div></div>
  <div class="card"><div class="label">Power</div><div class="value" id="p">--</div><div class="unit">W</div></div>
  <div class="card"><div class="label">Energy</div><div class="value" id="e">--</div><div class="unit">kWh</div></div>
</div>
<div class="status" id="relay">Loading...</div>
<canvas id="chart"></canvas>
<script>
const chart = new Chart(document.getElementById('chart'), {
  type:'line',
  data:{ labels:[], datasets:[{ label:'Power (W)', data:[],
    borderColor:'#00a5fa', backgroundColor:'rgba(0,165,250,0.1)',
    tension:0.4, fill:true }] },
  options:{ animation:false,
    scales:{
      x:{ ticks:{color:'#94a3b8'}, grid:{color:'#1e293b'} },
      y:{ ticks:{color:'#94a3b8'}, grid:{color:'#1e293b'} }
    },
    plugins:{ legend:{ labels:{color:'#e2e8f0'} } }
  }
});
const ws = new WebSocket('ws://'+location.hostname+':81');
ws.onmessage = (event) => {
  const d = JSON.parse(event.data);
  document.getElementById('v').textContent = d.voltage ? d.voltage.toFixed(1) : '--';
  document.getElementById('i').textContent = d.current ? d.current.toFixed(3) : '--';
  document.getElementById('p').textContent = d.power   ? d.power.toFixed(2)   : '--';
  document.getElementById('e').textContent = d.energy  ? d.energy.toFixed(3)  : '--';
  const el = document.getElementById('relay');
  el.textContent = d.relay ? 'Relay ON — Power Active' : 'Relay OFF — Kill Switch Active';
  el.className = 'status ' + (d.relay ? 'on' : 'off');
  const now = new Date().toLocaleTimeString();
  chart.data.labels.push(now);
  chart.data.datasets[0].data.push(d.power||0);
  if(chart.data.labels.length>20){ chart.data.labels.shift(); chart.data.datasets[0].data.shift(); }
  chart.update();
};
ws.onclose = () => setTimeout(()=>location.reload(), 3000);
</script>
</body>
</html>
)=====";

// ─── RELAY ───
void applyRelay(bool turnOn) {
  relayOn = turnOn;
  // ✅ Hardware Sync: Active-High (HIGH=ON, LOW=OFF)
  // Your relay module requires a HIGH signal to switch ON.
  digitalWrite(RELAY_PIN, turnOn ? HIGH : LOW);
  Serial.printf("[RELAY] ══► %s (%s)\n", 
    turnOn ? "ON (HIGH) ✅" : "OFF (LOW) 🔴",
    "Active-High Logic");
}

// ─── SENSOR ───
void readSensor() {
  float v = pzem.voltage();
  float i = pzem.current();
  float p = pzem.power();
  float e = pzem.energy();
  voltage = (isnan(v)||isinf(v)) ? 0 : v;
  current = (isnan(i)||isinf(i)) ? 0 : i;
  power   = (isnan(p)||isinf(p)) ? 0 : p;
  energy  = (isnan(e)||isinf(e)) ? 0 : e;
  Serial.printf("[PZEM] V:%.1f I:%.3f P:%.2f E:%.3f\n",
                voltage, current, power, energy);
}

// ─── LOCAL BROADCAST ───
void broadcastLocal() {
  String json = "{";
  json += "\"voltage\":"  + String(voltage, 2) + ",";
  json += "\"current\":"  + String(current, 3) + ",";
  json += "\"power\":"    + String(power,   2) + ",";
  json += "\"energy\":"   + String(energy,  3) + ",";
  json += "\"relay\":"    + String(relayOn ? "true" : "false");
  json += "}";
  webSocket.broadcastTXT(json);
}

// ─── REGISTER ───
// Fresh WiFiClientSecure per call — prevents SSL state corruption
void registerDevice() {
  if (WiFi.status() != WL_CONNECTED) return;
  WiFiClientSecure client;
  client.setInsecure();
  client.setTimeout(10);

  String url = String(REGISTER_URL)
             + "?id="   + deviceId
             + "&ip="   + WiFi.localIP().toString()
             + "&type=master";

  HTTPClient http;
  http.begin(client, url);
  http.setTimeout(8000);
  http.addHeader("ngrok-skip-browser-warning", "true");
  http.addHeader("User-Agent", "ESP32-SmartWatt/1.0");

  int code = http.GET();
  Serial.printf("[REGISTER] HTTP %d\n", code);
  if (code == 200) Serial.println("[REGISTER] ✅ OK");
  else Serial.printf("[REGISTER] ❌ Failed: %s\n", http.errorToString(code).c_str());
  http.end();
}

// ─── SEND TO BACKEND ───
// Fresh client per call
void sendToBackend() {
  if (WiFi.status() != WL_CONNECTED) return;
  WiFiClientSecure client;
  client.setInsecure();
  client.setTimeout(10);

  String json = "{";
  json += "\"device_id\":\"" + deviceId + "\",";
  json += "\"voltage\":"  + String(voltage, 2) + ",";
  json += "\"current\":"  + String(current, 3) + ",";
  json += "\"power\":"    + String(power,   2) + ",";
  json += "\"energy\":"   + String(energy,  3);
  json += "}";

  HTTPClient http;
  http.begin(client, BACKEND_URL);
  http.setTimeout(8000);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("ngrok-skip-browser-warning", "true");
  http.addHeader("User-Agent", "ESP32-SmartWatt/1.0");

  int code = http.POST(json);
  Serial.printf("[BACKEND] HTTP %d\n", code);
  if (code != 200)
    Serial.printf("[BACKEND] ❌ %s\n", http.errorToString(code).c_str());
  http.end();
}

// ─── FETCH CONTROL STATE — POST bypasses ngrok browser warning ───
void fetchControlCommand() {
  if (WiFi.status() != WL_CONNECTED) return;

  WiFiClientSecure client;
  client.setInsecure();
  client.setTimeout(10);

  // POST with JSON body — GET gets blocked by ngrok with HTML warning page → causes -1
  String body = "{\"id\":\"" + deviceId + "\"}";

  HTTPClient http;
  http.begin(client, CONTROL_URL);
  http.setTimeout(10000);
  http.addHeader("Content-Type",               "application/json");
  http.addHeader("ngrok-skip-browser-warning", "true");
  http.addHeader("User-Agent",                 "ESP32-SmartWatt/2.0");

  int code = http.POST(body);
  Serial.printf("[CONTROL] HTTP %d\n", code);

  if (code == 200) {
    String payload = http.getString();
    Serial.println("[CONTROL] Response: " + payload);

    String lower = payload;
    lower.toLowerCase();

    bool shouldBeOff = (lower.indexOf("\"state\":\"off\"") >= 0);

    Serial.printf("[CONTROL] shouldBeOff=%s relayOn=%s\n",
      shouldBeOff ? "YES" : "NO",
      relayOn     ? "YES" : "NO");

    if (shouldBeOff && relayOn) {
      Serial.println("[CONTROL] *** RELAY OFF ***");
      applyRelay(false);
    } else if (!shouldBeOff && !relayOn) {
      Serial.println("[CONTROL] *** RELAY ON ***");
      applyRelay(true);
    } else {
      Serial.println("[CONTROL] No change needed");
    }

  } else if (code == -1) {
    Serial.println("[CONTROL] ❌ -1 → ngrok URL changed or not running");
    Serial.printf("[CONTROL]    RSSI: %d dBm\n", WiFi.RSSI());
  } else {
    Serial.printf("[CONTROL] ❌ HTTP %d → %s\n", code, http.getString().c_str());
  }

  http.end();
}

// ─── WEBSOCKET EVENT ───
void webSocketEvent(uint8_t num, WStype_t type, uint8_t* payload, size_t length) {
  if (type == WStype_CONNECTED)
    Serial.printf("[WS] Client %u connected\n", num);
  if (type == WStype_DISCONNECTED)
    Serial.printf("[WS] Client %u disconnected\n", num);
}

// ─── SETUP ───
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n════════════════════════════");
  Serial.println("   SmartWatt ESP32 Starting");
  Serial.println("════════════════════════════");

  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, LOW); // Default OFF (LOW) for Active-High
  relayOn = false;

  // Connect WiFi
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  Serial.printf("Connecting to %s", ssid);
  int retries = 0;
  while (WiFi.status() != WL_CONNECTED && retries < 40) {
    delay(500);
    Serial.print(".");
    retries++;
  }

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("\n[WiFi] ❌ Failed — restarting in 3s");
    delay(3000);
    ESP.restart();
  }

  Serial.printf("\n[WiFi] ✅ Connected: %s\n", WiFi.localIP().toString().c_str());
  Serial.printf("[WiFi] Signal: %d dBm\n", WiFi.RSSI());

  // Register immediately on boot
  registerDevice();

  // ── HTTP server routes ──
  server.on("/", HTTP_GET, []() {
    server.send(200, "text/html", htmlPage);
  });

  // GET /control?status=on|off — called by backend push (if ever reachable)
  server.on("/control", HTTP_GET, []() {
    String s = server.arg("status");
    s.toLowerCase();
    Serial.println("[HTTP] /control?status=" + s);
    bool turnOff = (s == "off" || s == "inactive");
    applyRelay(!turnOff);
    server.send(200, "application/json",
      "{\"ok\":true,\"relay\":" + String(relayOn ? "true" : "false") + "}");
  });

  // GET /status — debug endpoint
  server.on("/status", HTTP_GET, []() {
    String json = "{";
    json += "\"relay\":"    + String(relayOn ? "true" : "false") + ",";
    json += "\"voltage\":"  + String(voltage, 2) + ",";
    json += "\"current\":"  + String(current, 3) + ",";
    json += "\"power\":"    + String(power,   2) + ",";
    json += "\"energy\":"   + String(energy,  3) + ",";
    json += "\"deviceId\":\"" + deviceId + "\"";
    json += "}";
    server.send(200, "application/json", json);
  });

  server.begin();
  webSocket.begin();
  webSocket.onEvent(webSocketEvent);

  Serial.println("[BOOT] ✅ All servers ready");
  Serial.printf("[BOOT] Dashboard: http://%s\n", WiFi.localIP().toString().c_str());
  Serial.printf("[BOOT] Control URL: %s\n", CONTROL_URL);
}

// ─── LOOP ───
void loop() {

  // ── WiFi watchdog — auto reconnect if dropped ──
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WiFi] ❌ Lost connection — reconnecting...");
    WiFi.disconnect();
    delay(1000);
    WiFi.begin(ssid, password);
    int retries = 0;
    while (WiFi.status() != WL_CONNECTED && retries < 20) {
      delay(500);
      Serial.print(".");
      retries++;
    }
    if (WiFi.status() == WL_CONNECTED) {
      Serial.printf("\n[WiFi] ✅ Reconnected: %s\n",
        WiFi.localIP().toString().c_str());
      lastRegister = 0; // force immediate re-register
    } else {
      Serial.println("\n[WiFi] ❌ Reconnect failed — retrying next loop");
      delay(2000);
      return;
    }
  }

  server.handleClient();
  webSocket.loop();

  unsigned long now = millis();

  // Read sensor + broadcast locally every 1s
  if (now - lastSensor >= 1000) {
    lastSensor = now;
    readSensor();
    broadcastLocal();
  }

  // Send energy data to backend every 5s
  if (now - lastBackend >= 5000) {
    lastBackend = now;
    sendToBackend();
  }

  // Poll control state every 3s — THIS drives the relay
  if (now - lastControl >= 3000) {
    lastControl = now;
    fetchControlCommand();
  }

  // Re-register every 60s
  if (now - lastRegister >= 60000) {
    lastRegister = now;
    registerDevice();
  }
}