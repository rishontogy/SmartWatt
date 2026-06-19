#include "esp_camera.h"
#include <WiFi.h>
#include <WebServer.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>

const char* ssid     = "SEEWELL BSNL";
const char* password = "481299717069";
const char* deviceId = "ESP32_M";
const char* ngrokUrl = "https://extrorsely-prechemical-juan.ngrok-free.dev";

// ── Camera pins ────────────────────────────────────────────
#define PWDN_GPIO_NUM   -1
#define RESET_GPIO_NUM  -1
#define XCLK_GPIO_NUM   15
#define SIOD_GPIO_NUM    4
#define SIOC_GPIO_NUM    5
#define Y9_GPIO_NUM     16
#define Y8_GPIO_NUM     17
#define Y7_GPIO_NUM     18
#define Y6_GPIO_NUM     12
#define Y5_GPIO_NUM     10
#define Y4_GPIO_NUM      8
#define Y3_GPIO_NUM      9
#define Y2_GPIO_NUM     11
#define VSYNC_GPIO_NUM   6
#define HREF_GPIO_NUM    7
#define PCLK_GPIO_NUM   13

// ── Relay pins ─────────────────────────────────────────────
#define RELAY1_PIN       38
#define RELAY2_PIN       39
#define RELAY_ACTIVE_LOW true

// ── Relay state ────────────────────────────────────────────
bool relay1State = false;
bool relay2State = false;

WebServer server(80);
uint8_t*      imgBuf  = nullptr;
size_t        imgLen  = 0;
unsigned long lastReg = 0;

// ── Relay helper ───────────────────────────────────────────
void setRelay(int ch, bool on) {
  int pin = (ch == 1) ? RELAY1_PIN : RELAY2_PIN;
  if (RELAY_ACTIVE_LOW) digitalWrite(pin, on ? LOW : HIGH);
  else                  digitalWrite(pin, on ? HIGH : LOW);
  if (ch == 1) relay1State = on;
  else         relay2State = on;
  Serial0.printf("[RELAY%d] GPIO%d -> %s\n", ch, pin, on ? "ON" : "OFF");
}

// ── Camera init ────────────────────────────────────────────
bool initCamera() {
  camera_config_t cfg = {};
  cfg.ledc_channel = LEDC_CHANNEL_0;
  cfg.ledc_timer   = LEDC_TIMER_0;
  cfg.pin_d0 = Y2_GPIO_NUM; cfg.pin_d1 = Y3_GPIO_NUM;
  cfg.pin_d2 = Y4_GPIO_NUM; cfg.pin_d3 = Y5_GPIO_NUM;
  cfg.pin_d4 = Y6_GPIO_NUM; cfg.pin_d5 = Y7_GPIO_NUM;
  cfg.pin_d6 = Y8_GPIO_NUM; cfg.pin_d7 = Y9_GPIO_NUM;
  cfg.pin_xclk     = XCLK_GPIO_NUM;
  cfg.pin_pclk     = PCLK_GPIO_NUM;
  cfg.pin_vsync    = VSYNC_GPIO_NUM;
  cfg.pin_href     = HREF_GPIO_NUM;
  cfg.pin_sccb_sda = SIOD_GPIO_NUM;
  cfg.pin_sccb_scl = SIOC_GPIO_NUM;
  cfg.pin_pwdn     = PWDN_GPIO_NUM;
  cfg.pin_reset    = RESET_GPIO_NUM;
  cfg.xclk_freq_hz = 20000000;
  cfg.pixel_format = PIXFORMAT_JPEG;
  cfg.frame_size   = FRAMESIZE_VGA;
  cfg.jpeg_quality = 10;
  cfg.fb_count     = 1;
  cfg.fb_location  = CAMERA_FB_IN_DRAM;
  cfg.grab_mode    = CAMERA_GRAB_WHEN_EMPTY;

  if (esp_camera_init(&cfg) != ESP_OK) return false;

  sensor_t* s = esp_camera_sensor_get();
  if (s) {
    s->set_framesize(s, FRAMESIZE_VGA);
    s->set_quality(s, 10);
    s->set_vflip(s, 1);
    s->set_hmirror(s, 1);
    s->set_brightness(s, 1);
    s->set_contrast(s, 1);
    s->set_saturation(s, 0);
    s->set_whitebal(s, 1);
    s->set_exposure_ctrl(s, 1);
    s->set_aec2(s, 1);
    s->set_gain_ctrl(s, 1);
  }
  return true;
}

// ── Capture ────────────────────────────────────────────────
bool captureFrame() {
  Serial0.println("[CAM] Capturing...");
  for (int i = 0; i < 8; i++) {
    camera_fb_t* fb = esp_camera_fb_get();
    if (fb) esp_camera_fb_return(fb);
    delay(40);
  }
  camera_fb_t* fb = esp_camera_fb_get();
  if (!fb || fb->len < 500) {
    Serial0.println("[CAM] Failed");
    if (fb) esp_camera_fb_return(fb);
    return false;
  }
  if (imgBuf) { free(imgBuf); imgBuf = nullptr; imgLen = 0; }
  imgBuf = (uint8_t*)malloc(fb->len);
  if (imgBuf) {
    memcpy(imgBuf, fb->buf, fb->len);
    imgLen = fb->len;
    Serial0.printf("[CAM] OK: %u bytes\n", imgLen);
  }
  esp_camera_fb_return(fb);
  return imgBuf != nullptr;
}

// ── Registration — uses HTTPClient instead of raw TCP ──────
// HTTPClient handles chunked encoding, redirects, and \r\n
// correctly — raw WiFiClientSecure does not.
void registerWithBackend() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial0.println("[REG] Skipped — no WiFi");
    return;
  }

  String host = String(ngrokUrl);
  host.replace("https://", "");
  host.replace("http://", "");
  host.trim();

  String path = "/register?id=" + String(deviceId)
              + "&ip=" + WiFi.localIP().toString()
              + "&type=slave";

  Serial0.println("[REG] Connecting to: " + host);

  WiFiClientSecure client;
  client.setInsecure();
  client.setTimeout(15);

  if (!client.connect(host.c_str(), 443)) {
    Serial0.println("[REG] TLS connect FAILED");
    lastReg = millis();
    return;
  }

  client.print("GET " + path + " HTTP/1.1\r\n"
             + "Host: " + host + "\r\n"
             + "User-Agent: ESP32\r\n"
             + "ngrok-skip-browser-warning: true\r\n"
             + "Accept: application/json\r\n"
             + "Connection: close\r\n\r\n");

  // Read status line only — drain the rest
  // ngrok uses chunked encoding; don't try to parse body line-by-line
  unsigned long t = millis();
  int httpCode = 0;

  while ((client.connected() || client.available()) && millis() - t < 10000) {
    if (!client.available()) { delay(10); continue; }
    String line = client.readStringUntil('\n');
    line.trim();
    if (httpCode == 0 && line.startsWith("HTTP/")) {
      int sp1 = line.indexOf(' ');
      int sp2 = line.indexOf(' ', sp1 + 1);
      if (sp1 >= 0) {
        httpCode = line.substring(sp1 + 1, sp2 > sp1 ? sp2 : line.length()).toInt();
        Serial0.printf("[REG] HTTP %d\n", httpCode);
      }
      // Don't break — drain remaining bytes so TCP closes cleanly
    }
  }
  client.stop();

  if (httpCode == 200) {
    Serial0.println("[REG] OK — registered");
  } else if (httpCode == 0) {
    Serial0.println("[REG] No HTTP status — server may still have registered (check backend)");
  } else {
    Serial0.printf("[REG] Failed HTTP %d\n", httpCode);
  }

  lastReg = millis();
}

// ── HTTP Handlers ──────────────────────────────────────────
void handleImage() {
  if (!imgBuf || imgLen == 0) {
    server.send(404, "text/plain", "No image");
    return;
  }
  WiFiClient client = server.client();
  client.setTimeout(30000);
  String headers = "HTTP/1.1 200 OK\r\n"
                   "Content-Type: image/jpeg\r\n"
                   "Content-Length: " + String(imgLen) + "\r\n"
                   "Connection: close\r\n"
                   "Cache-Control: no-cache\r\n"
                   "\r\n";
  client.print(headers);
  const size_t chunkSize = 512;
  size_t offset = 0;
  while (offset < imgLen) {
    size_t toSend = min(chunkSize, imgLen - offset);
    client.write((const char*)(imgBuf + offset), toSend);
    offset += toSend;
    delay(1);
  }
  Serial0.printf("[HTTP] Image sent: %u bytes\n", imgLen);
}

void handleCapture() {
  server.send(200, "application/json",
    captureFrame() ? "{\"ok\":true}" : "{\"ok\":false}");
}

void handleStatus() {
  String json = "{\"device\":\"" + String(deviceId) +
                "\",\"ip\":\""   + WiFi.localIP().toString() +
                "\",\"rssi\":"   + String(WiFi.RSSI()) +
                ",\"imgLen\":"   + String(imgLen) +
                ",\"heap\":"     + String(esp_get_free_heap_size()) +
                ",\"relay1\":"   + (relay1State ? "true" : "false") +
                ",\"relay2\":"   + (relay2State ? "true" : "false") + "}";
  server.send(200, "application/json", json);
}

void handleRelay() {
  if (!server.hasArg("ch") || !server.hasArg("state")) {
    server.send(400, "application/json",
      "{\"ok\":false,\"error\":\"missing ch or state\"}");
    return;
  }
  int    ch    = server.arg("ch").toInt();
  String state = server.arg("state");
  state.toLowerCase();

  if (ch != 1 && ch != 2) {
    server.send(400, "application/json",
      "{\"ok\":false,\"error\":\"ch must be 1 or 2\"}");
    return;
  }

  bool currentState = (ch == 1) ? relay1State : relay2State;
  bool newState;

  if      (state == "on")     newState = true;
  else if (state == "off")    newState = false;
  else if (state == "toggle") newState = !currentState;
  else {
    server.send(400, "application/json",
      "{\"ok\":false,\"error\":\"state must be on/off/toggle\"}");
    return;
  }

  setRelay(ch, newState);

  String json = "{\"ok\":true,\"ch\":" + String(ch) +
                ",\"state\":\"" + (newState ? "on" : "off") + "\"}";
  server.send(200, "application/json", json);
}

void handleRelayStatus() {
  String json = "{\"ch1\":" + String(relay1State ? "true" : "false") +
                ",\"ch2\":" + String(relay2State ? "true" : "false") + "}";
  server.send(200, "application/json", json);
}

void handleNotFound() {
  server.send(404, "text/plain", "Not found: " + server.uri());
}

// ── WiFi ───────────────────────────────────────────────────
void connectWiFi() {
  Serial0.printf("[WiFi] Connecting to %s\n", ssid);
  WiFi.mode(WIFI_STA);
  WiFi.disconnect(true);
  delay(500);
  WiFi.begin(ssid, password);
  int retries = 0;
  while (WiFi.status() != WL_CONNECTED && retries < 40) {
    delay(500);
    Serial0.print(".");
    retries++;
  }
  Serial0.println();
  if (WiFi.status() != WL_CONNECTED) {
    Serial0.println("[WiFi] FAILED — restarting");
    delay(2000);
    ESP.restart();
  }
  Serial0.printf("[WiFi] Connected! IP: %s  RSSI: %d dBm\n",
    WiFi.localIP().toString().c_str(), WiFi.RSSI());
}

// ── Setup ──────────────────────────────────────────────────
void setup() {
  Serial0.begin(115200);
  delay(500);
  Serial0.println("\n=== ESP32-S3 CAM + RELAY SERVER ===");
  Serial0.printf("Heap: %u  PSRAM: %s\n",
    esp_get_free_heap_size(), psramFound() ? "YES" : "NO");

  pinMode(RELAY1_PIN, OUTPUT);
  pinMode(RELAY2_PIN, OUTPUT);
  setRelay(1, false);
  setRelay(2, false);
  Serial0.println("[RELAY] Both OFF on boot");

  if (!initCamera()) {
    Serial0.println("[CAM] FAILED — halting");
    while (true) delay(1000);
  }
  Serial0.println("[CAM] OK");

  connectWiFi();
  registerWithBackend();
  captureFrame();

  server.on("/image",        HTTP_GET,  handleImage);
  server.on("/capture",      HTTP_ANY,  handleCapture);
  server.on("/status",       HTTP_GET,  handleStatus);
  server.on("/relay",        HTTP_GET,  handleRelay);
  server.on("/relay/status", HTTP_GET,  handleRelayStatus);
  server.onNotFound(handleNotFound);
  server.begin();

  Serial0.println("[HTTP] Server ready on port 80");
  server.on("/relay",        HTTP_GET,  handleRelay);
  server.on("/relay/status", HTTP_GET,  handleRelayStatus);
  server.onNotFound(handleNotFound);
  server.begin();
  Serial0.println("[HTTP] Server ready on port 80");

  // CHANGE 3: Wait for HTTP server to be fully ready before registering
  // This prevents the "socket hang up" on the on-register push from the backend
  delay(3000);
  registerWithBackend();
  captureFrame();
}

// ── Loop ───────────────────────────────────────────────────
void loop() {
  server.handleClient();

  if (millis() - lastReg > 90000UL) {
    registerWithBackend();
  }

  if (WiFi.status() != WL_CONNECTED) {
    Serial0.println("[WiFi] Lost — reconnecting");
    connectWiFi();
    registerWithBackend();
  }

  delay(2);
}