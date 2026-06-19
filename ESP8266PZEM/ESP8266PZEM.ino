#include <ESP8266WiFi.h>
#include <PZEM004Tv30.h>
#include <SoftwareSerial.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClient.h>

const char* ssid     = "SEEWELL BSNL";
const char* password = "481299717069";

const char* PROXY_IP   = "192.168.1.6";              // ✅ your PC's IP
const int   PROXY_PORT = 3002;
const char* PROXY_PATH = "/api/energy/room-reading";  // ✅ correct path

#define PZEM_RX_PIN D6
#define PZEM_TX_PIN D5

SoftwareSerial pzemSerial(PZEM_RX_PIN, PZEM_TX_PIN);
PZEM004Tv30    pzem(pzemSerial);

WiFiClient plainClient;

float voltage = 0, current = 0, power = 0, energy = 0;
unsigned long lastSend   = 0;
unsigned long wifiLostAt = 0;

void readSensor() {
  float v = pzem.voltage();
  float i = pzem.current();
  float p = pzem.power();
  float e = pzem.energy();
  voltage = (isnan(v) || isinf(v)) ? 0 : v;
  current = (isnan(i) || isinf(i)) ? 0 : i;
  power   = (isnan(p) || isinf(p)) ? 0 : p;
  energy  = (isnan(e) || isinf(e)) ? 0 : e;
  Serial.printf("[PZEM] V:%.1f I:%.3f P:%.1f E:%.3f\n",
    voltage, current, power, energy);
}

void sendToBackend() {
  if (WiFi.status() != WL_CONNECTED) return;
  if (voltage < 10) { Serial.println("[HTTP] Low voltage — skip"); return; }

  Serial.printf("[HEAP] Before send: %u\n", ESP.getFreeHeap());

  char json[180];
  snprintf(json, sizeof(json),
    "{\"device_id\":\"LR_ROOM_ANALYZER\","
    "\"zone\":\"Living Room\","
    "\"voltage\":%.1f,"
    "\"current\":%.3f,"
    "\"power\":%.1f,"
    "\"energy\":%.3f}",
    voltage, current, power, energy
  );

  HTTPClient http;
  char url[60];
  snprintf(url, sizeof(url), "http://%s:%d%s", PROXY_IP, PROXY_PORT, PROXY_PATH); // ✅ no String heap use

  http.begin(plainClient, url);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(10000);

  int code = http.POST(json);

  if      (code == 200) Serial.println("[HTTP] ✅ 200 OK — data sent");
  else if (code == 404) Serial.println("[HTTP] ❌ 404 — route missing");
  else if (code >  0)   Serial.printf("[HTTP] ⚠️  Response: %d\n", code);
  else                  Serial.printf("[HTTP] ❌ Failed: %s\n", http.errorToString(code).c_str());

  http.end();
  Serial.printf("[HEAP] After send:  %u\n", ESP.getFreeHeap());
}

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n[ROOM] ESP8266 PZEM Starting...");
  Serial.printf("[HEAP] Free: %u\n", ESP.getFreeHeap());

  pzemSerial.begin(9600);
  delay(2000);

  uint8_t addr = pzem.getAddress();
  Serial.printf("[PZEM] Address: 0x%02X %s\n", addr,
    (addr == 0x00 || addr == 0xFF) ? "⚠️ check wiring" : "✅ OK");

  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  Serial.print("[WiFi] Connecting");
  int r = 0;
  while (WiFi.status() != WL_CONNECTED && r < 40) {
    delay(500); Serial.print("."); r++;
  }
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("\n❌ WiFi failed — restarting");
    delay(3000); ESP.restart();
  }
  Serial.printf("\n[WiFi] ✅ %s\n", WiFi.localIP().toString().c_str());
  Serial.printf("[HEAP] After WiFi:  %u\n", ESP.getFreeHeap());
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    if (wifiLostAt == 0) { wifiLostAt = millis(); WiFi.reconnect(); }
    else if (millis() - wifiLostAt > 30000) ESP.restart();
    delay(500); return;
  }
  if (wifiLostAt != 0) { wifiLostAt = 0; }

  readSensor();

  if (millis() - lastSend >= 5000) {
    lastSend = millis();
    sendToBackend();
  }

  delay(1000);
}