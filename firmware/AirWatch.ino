/*
  ============================================================
       AIRWATCH SMART MONITOR - ESP32-S3-N16R8
       Local firmware: sensor dashboard + uptime + network setup

  PAGES:
    HOME  - Live SCD41 dashboard
    CLOCK - Device uptime timer
    NETWORK - AP, local address, time-limited credential reveal

  TOUCH:
    Swipe LEFT  = next page
    Swipe RIGHT = previous page

  ORIGINAL WIRING PRESERVED:
    SCD41 I2C: SDA GPIO4, SCL GPIO5
    ILI9341: CS10, DC14, RST21, MOSI11, SCK12, MISO13
    XPT2046: T_CS16, shared SPI
    TFT microSD CS17 (kept inactive; SD functions removed)
    Fan driver GPIO6
    Active buzzer driver GPIO7
    NeoPixel GPIO18
    System button GPIO1 to GND
    Mute button GPIO2 to GND

  Arduino IDE:
    Board: ESP32S3 Dev Module
    Flash: 16MB
    PSRAM: OPI PSRAM (for N16R8 boards)
    USB CDC On Boot: choose according to your upload connection.
  ============================================================
*/

#include <Arduino.h>
#include <Wire.h>
#include <SPI.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ILI9341.h>
#include <XPT2046_Touchscreen.h>
#include <Adafruit_NeoPixel.h>
#include <SensirionI2cScd4x.h>
#include <WiFi.h>
#include <WebServer.h>
#include <LittleFS.h>
#include <Preferences.h>
#include <ArduinoJson.h>
#include <esp_system.h>
#include <math.h>

void updateFan(float temp);  // Used by HTTP handlers defined earlier in this file.

// -------------------- ORIGINAL PIN ASSIGNMENTS --------------------
#define PIN_SDA       4
#define PIN_SCL       5

#define TFT_CS        10
#define TFT_DC        14
#define TFT_RST       21

#define TOUCH_CS      16
#define SD_CS         17   // Kept HIGH; SD features are removed.

#define BUTTON_PIN    1
#define MUTE_PIN      2

#define FAN_PIN       6
#define BUZZER_PIN    7
#define NEOPIXEL_PIN  18
#define NEOPIXEL_COUNT 1

#define SPI_SCK       12
#define SPI_MOSI      11
#define SPI_MISO      13

// Local-only control plane. Secrets are generated once and kept in NVS.
WebServer server(80);
Preferences preferences;
String apSSID;
String apPassword;
String controlKey;
String staSSID;
String staPassword;
String apAddress = "192.168.4.1";
bool fsReady = false;
bool touchReady = false;
unsigned long lastStaAttempt = 0;
unsigned long staBackoffMs = 5000;
unsigned long lastStaLog = 0;
unsigned long lastSensorRetry = 0;
unsigned long readingAtMs = 0;
String fanMode = "auto";
bool revealCredentials = false;
unsigned long revealUntilMs = 0;
bool systemButtonWasDown = false;
unsigned long systemButtonDownAt = 0;

struct HistoryEntry {
  uint32_t uptime;
  uint16_t co2;
  float temp;
  float humidity;
};
const uint8_t HISTORY_CAPACITY = 60;
HistoryEntry historyEntries[HISTORY_CAPACITY];
uint8_t historyStart = 0;
uint8_t historyCount = 0;
unsigned long lastHistoryAt = 0;

// -------------------- RUNTIME DISPLAY PALETTES --------------------
uint16_t BG, PANEL, PANEL2, CYAN, GREEN, YELLOW, ORANGE, RED, WHITE, GREY, DARKGREY;
String displayTheme = "light";

void applyDisplayTheme(const String &theme) {
  displayTheme = theme == "dark" ? "dark" : "light";
  if (displayTheme == "dark") {
    BG = 0x0841;
    PANEL = 0x10A3;
    PANEL2 = 0x18E4;
    CYAN = 0x07FF;
    GREEN = 0x07E0;
    YELLOW = 0xFFE0;
    ORANGE = 0xFD20;
    RED = 0xF800;
    WHITE = 0xFFFF;
    GREY = 0x8410;
    DARKGREY = 0x4208;
  } else {
    BG = 0xF7DE;
    PANEL = 0xFFFF;
    PANEL2 = 0xD69A;
    CYAN = 0x0E74;
    GREEN = 0x15A0;
    YELLOW = 0xF500;
    ORANGE = 0xD3A0;
    RED = 0xB900;
    WHITE = 0x102A;
    GREY = 0x6B4D;
    DARKGREY = 0xDEFB;
  }
}

// -------------------- HARDWARE OBJECTS --------------------
Adafruit_ILI9341 tft(TFT_CS, TFT_DC, TFT_RST);
XPT2046_Touchscreen touch(TOUCH_CS);
Adafruit_NeoPixel pixels(
  NEOPIXEL_COUNT, NEOPIXEL_PIN, NEO_GRB + NEO_KHZ800
);
SensirionI2cScd4x scd4x;

// -------------------- PAGE STATE --------------------
enum Page : uint8_t {
  PAGE_HOME = 0,
  PAGE_CLOCK = 1,
  PAGE_NETWORK = 2
};

Page currentPage = PAGE_HOME;
bool pageNeedsDraw = true;
bool systemOn = true;

// -------------------- SENSOR / OUTPUT STATE --------------------
bool sensorOK = false;
bool fanOn = false;
bool soundEnabled = true;
bool buzzerActive = false;
bool beepState = false;

uint16_t co2ppm = 0;
float temperatureC = NAN;
float humidityRH = NAN;
float animatedCO2 = 0.0f;

const float FAN_ON_TEMP_C = 30.0f;
const float FAN_OFF_TEMP_C = 28.0f;

const uint16_t CO2_BUZZER_ON_PPM = 2000;
const uint16_t CO2_BUZZER_OFF_PPM = 1800;

const unsigned long BEEP_ON_MS = 200;
const unsigned long BEEP_OFF_MS = 800;

// -------------------- TIMING --------------------
unsigned long lastSensorRead = 0;
unsigned long lastDisplayUpdate = 0;
unsigned long lastAnimation = 0;
unsigned long lastBeepToggle = 0;

const unsigned long SENSOR_INTERVAL = 1000;
const unsigned long DISPLAY_INTERVAL = 50;

// -------------------- BUTTON DEBOUNCE --------------------
bool lastButtonState = HIGH;
bool lastMuteState = HIGH;
unsigned long lastButtonChange = 0;
unsigned long lastMuteChange = 0;
const unsigned long DEBOUNCE_MS = 50;

// -------------------- TOUCH CALIBRATION --------------------
// These are the calibration values from your supplied sketch.
const int TOUCH_X_MIN = 200;
const int TOUCH_X_MAX = 3800;
const int TOUCH_Y_MIN = 240;
const int TOUCH_Y_MAX = 3800;

const bool TOUCH_SWAP_XY = true;
const bool TOUCH_INVERT_X = true;
const bool TOUCH_INVERT_Y = true;

const int SWIPE_MIN_PX = 60;
const unsigned long SWIPE_MAX_MS = 1200;
const unsigned long TOUCH_RELEASE_MS = 60;

bool touching = false;
int touchStartX = 0;
int touchStartY = 0;
int touchLastX = 0;
int touchLastY = 0;
unsigned long touchStartMs = 0;
unsigned long touchLastSeenMs = 0;

// -------------------- DISPLAY CACHE --------------------
uint16_t shownCO2 = 65535;
int shownTemp = -9999;
int shownHumidity = -9999;
int shownFan = -1;
int shownLED = -1;
int shownBuzzer = -1;
int shownQuality = -1;
int shownGaugeW = -1;
uint16_t shownGaugeColor = 0;

// -------------------- SPI CHIP SELECT --------------------
void deselectAllSPI() {
  digitalWrite(TFT_CS, HIGH);
  digitalWrite(TOUCH_CS, HIGH);
  digitalWrite(SD_CS, HIGH);
}

// -------------------- BASIC DISPLAY HELPERS --------------------
void centeredText(const char *text, int x, int y,
                  uint8_t size, uint16_t color) {
  int width = strlen(text) * 6 * size;
  tft.setTextSize(size);
  tft.setTextColor(color);
  tft.setCursor(x - width / 2, y);
  tft.print(text);
}

void drawPanel(int x, int y, int w, int h) {
  tft.fillRoundRect(x, y, w, h, 12, PANEL);
  tft.drawRoundRect(x, y, w, h, 12, PANEL2);
}

uint16_t getCO2Color(uint16_t ppm) {
  if (ppm < 800) return GREEN;
  if (ppm < 1200) return YELLOW;
  if (ppm < 2000) return ORANGE;
  return RED;
}

const char *getAirQuality(uint16_t ppm) {
  if (ppm < 800) return "LOW";
  if (ppm < 1200) return "MODERATE";
  if (ppm < 2000) return "ELEVATED";
  return "HIGH";
}

bool haveValidReading() {
  return sensorOK &&
         co2ppm != 0 &&
         !isnan(temperatureC) &&
         !isnan(humidityRH) &&
         readingAtMs != 0 && millis() - readingAtMs < 15000UL;
}

String randomHex(size_t bytes) {
  static const char hex[] = "0123456789ABCDEF";
  String result;
  for (size_t i = 0; i < bytes; ++i) {
    uint8_t value = (uint8_t)esp_random();
    result += hex[value >> 4];
    result += hex[value & 0x0F];
  }
  return result;
}

void recordHistory() {
  uint8_t index = (historyStart + historyCount) % HISTORY_CAPACITY;
  if (historyCount == HISTORY_CAPACITY) {
    index = historyStart;
    historyStart = (historyStart + 1) % HISTORY_CAPACITY;
  } else {
    historyCount++;
  }
  historyEntries[index] = { millis() / 1000UL, co2ppm, temperatureC, humidityRH };
}

void sendJson(int code, JsonDocument &doc) {
  String body;
  serializeJson(doc, body);
  server.send(code, "application/json; charset=utf-8", body);
}

bool authorized() {
  String supplied = server.header("X-AirWatch-Key");
  if (supplied.length() == 0 || supplied.length() != controlKey.length()) return false;
  uint8_t diff = 0;
  for (size_t i = 0; i < supplied.length(); ++i) diff |= supplied[i] ^ controlKey[i];
  if (diff == 0) return true;
  Serial.println("[HTTP] rejected unauthorized mutation");
  return false;
}

void sendError(int code, const char *message) {
  Serial.printf("[HTTP] status=%d error=%s\n", code, message);
  JsonDocument doc;
  doc["error"] = message;
  sendJson(code, doc);
}

void handleStatus() {
  JsonDocument doc;
  const bool valid = haveValidReading();
  doc["schemaVersion"] = 1;
  doc["valid"] = valid;
  doc["co2"] = valid ? co2ppm : 0;
  doc["temperature"] = valid ? temperatureC : 0.0f;
  doc["humidity"] = valid ? humidityRH : 0.0f;
  doc["quality"] = valid ? getAirQuality(co2ppm) : "unavailable";
  doc["displayTheme"] = displayTheme;
  doc["fanOn"] = fanOn;
  doc["fanMode"] = fanMode;
  doc["muted"] = !soundEnabled;
  doc["alarmActive"] = valid && buzzerActive;
  doc["systemOn"] = systemOn;
  doc["uptimeSeconds"] = millis() / 1000UL;
  doc["lastReadingUptime"] = readingAtMs;
  doc["lastReadingEpoch"] = 0;
  JsonObject wifi = doc["wifi"].to<JsonObject>();
  wifi["connected"] = WiFi.status() == WL_CONNECTED;
  wifi["ssid"] = WiFi.status() == WL_CONNECTED ? WiFi.SSID() : "";
  wifi["ip"] = WiFi.status() == WL_CONNECTED ? WiFi.localIP().toString() : "";
  wifi["apSSID"] = apSSID;
  wifi["apIP"] = apAddress;
  sendJson(200, doc);
}

void handleHistory() {
  JsonDocument doc;
  JsonArray samples = doc["samples"].to<JsonArray>();
  for (uint8_t i = 0; i < historyCount; ++i) {
    const HistoryEntry &entry = historyEntries[(historyStart + i) % HISTORY_CAPACITY];
    JsonObject item = samples.add<JsonObject>();
    item["uptime"] = entry.uptime;
    item["epoch"] = 0;
    item["co2"] = entry.co2;
    item["temp"] = entry.temp;
    item["hum"] = entry.humidity;
  }
  sendJson(200, doc);
}

void handleControl() {
  if (!authorized()) return sendError(401, "unauthorized");
  if (server.arg("plain").length() > 256) return sendError(413, "request too large");
  JsonDocument body;
  if (deserializeJson(body, server.arg("plain"))) return sendError(400, "invalid JSON body");
  bool changed = false;
  if (body["displayTheme"].is<const char *>()) {
    String requestedTheme = body["displayTheme"].as<String>();
    if (requestedTheme != "light" && requestedTheme != "dark") return sendError(400, "displayTheme must be light or dark");
    applyDisplayTheme(requestedTheme);
    preferences.putString("theme", displayTheme);
    pageNeedsDraw = true;
    if (!systemOn) tft.fillScreen(BG);
    Serial.printf("[TFT] theme changed to %s\n", displayTheme.c_str());
    changed = true;
  }
  if (body["fanMode"].is<const char *>()) {
    String requested = body["fanMode"].as<String>();
    if (requested != "auto" && requested != "on" && requested != "off") return sendError(400, "fanMode must be auto, on, or off");
    fanMode = requested;
    if (fanMode == "on") fanOn = systemOn;
    else if (fanMode == "off") fanOn = false;
    else updateFan(temperatureC);
    digitalWrite(FAN_PIN, fanOn ? HIGH : LOW);
    changed = true;
  }
  if (body["muted"].is<bool>()) {
    soundEnabled = !body["muted"].as<bool>();
    if (!soundEnabled) { beepState = false; digitalWrite(BUZZER_PIN, LOW); }
    changed = true;
  }
  if (!changed) return sendError(400, "no supported control field");
  JsonDocument result;
  result["ok"] = true;
  sendJson(200, result);
}

void handleWiFiConfig() {
  if (!authorized()) return sendError(401, "unauthorized");
  if (server.arg("plain").length() > 256) return sendError(413, "request too large");
  JsonDocument body;
  if (deserializeJson(body, server.arg("plain"))) return sendError(400, "invalid JSON body");
  String ssid = body["ssid"] | "";
  String password = body["password"] | "";
  if (ssid.length() == 0 || ssid.length() > 32 || password.length() > 63) return sendError(400, "invalid SSID or password length");
  staSSID = ssid;
  staPassword = password;
  preferences.putString("sta_ssid", staSSID);
  preferences.putString("sta_pass", staPassword);
  WiFi.disconnect(false, false);
  lastStaAttempt = 0;
  staBackoffMs = 5000;
  JsonDocument result;
  result["ok"] = true;
  sendJson(200, result);
  Serial.println("[WIFI] credentials saved; reconnect scheduled");
}

String contentTypeFor(const String &path) {
  if (path.endsWith(".html")) return "text/html; charset=utf-8";
  if (path.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (path.endsWith(".css")) return "text/css; charset=utf-8";
  if (path.endsWith(".svg")) return "image/svg+xml";
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".ico")) return "image/x-icon";
  if (path.endsWith(".json")) return "application/json";
  return "application/octet-stream";
}

void serveDashboard() {
  if (!fsReady) return sendError(503, "dashboard filesystem unavailable");
  String path = server.uri();
  if (path == "/") path = "/index.html";
  if (path.indexOf("..") >= 0) return sendError(400, "invalid path");
  if (!LittleFS.exists(path)) {
    if (path.startsWith("/api/")) return sendError(404, "API route not found");
    path = "/index.html";
  }
  File file = LittleFS.open(path, "r");
  if (!file) return sendError(404, "file not found");
  server.streamFile(file, contentTypeFor(path));
  file.close();
}

void initializeNetworkAndApi() {
  preferences.begin("airwatch", false);
  applyDisplayTheme(preferences.getString("theme", "light"));
  apSSID = preferences.getString("ap_ssid", "");
  apPassword = preferences.getString("ap_pass", "");
  controlKey = preferences.getString("api_key", "");
  if (apSSID.length() == 0 || apPassword.length() < 12 || controlKey.length() < 32) {
    String suffix = WiFi.macAddress().substring(12);
    suffix.replace(":", "");
    apSSID = "AirWatch-" + suffix;
    apPassword = randomHex(8);
    controlKey = randomHex(24);
    preferences.putString("ap_ssid", apSSID);
    preferences.putString("ap_pass", apPassword);
    preferences.putString("api_key", controlKey);
    Serial.println("[AUTH] generated setup credentials; reveal on TFT Network page with 3-second system-button hold");
  }
  staSSID = preferences.getString("sta_ssid", "");
  staPassword = preferences.getString("sta_pass", "");

  fsReady = LittleFS.begin(false);
  Serial.printf("[FS] mount %s, used=%u total=%u bytes\n", fsReady ? "OK" : "FAILED", fsReady ? (unsigned)LittleFS.usedBytes() : 0, fsReady ? (unsigned)LittleFS.totalBytes() : 0);

  WiFi.mode(WIFI_AP_STA);
  IPAddress apIP(192, 168, 4, 1), gateway(192, 168, 4, 1), subnet(255, 255, 255, 0);
  WiFi.softAPConfig(apIP, gateway, subnet);
  bool apOK = WiFi.softAP(apSSID.c_str(), apPassword.c_str());
  Serial.printf("[WIFI] AP %s (%s) IP=%s\n", apOK ? "started" : "failed", apSSID.c_str(), WiFi.softAPIP().toString().c_str());
  if (staSSID.length()) Serial.printf("[WIFI] saved router profile found; reconnect will start\n");

  const char *headers[] = { "X-AirWatch-Key" };
  server.collectHeaders(headers, 1);
  server.on("/api/status", HTTP_GET, handleStatus);
  server.on("/api/history", HTTP_GET, handleHistory);
  server.on("/api/control", HTTP_POST, handleControl);
  server.on("/api/wifi", HTTP_POST, handleWiFiConfig);
  server.onNotFound(serveDashboard);
  server.begin();
  Serial.println("[HTTP] local server listening on port 80");
}

void maintainStationWiFi() {
  if (staSSID.length() == 0 || WiFi.status() == WL_CONNECTED) return;
  unsigned long now = millis();
  if (now - lastStaAttempt < staBackoffMs) return;
  lastStaAttempt = now;
  WiFi.begin(staSSID.c_str(), staPassword.c_str());
  Serial.printf("[WIFI] STA reconnect attempt; backoff=%lu ms\n", staBackoffMs);
  staBackoffMs = min(staBackoffMs * 2UL, 60000UL);
}

// ============================================================
// STARTUP LOADING SCREEN
// ============================================================
uint8_t startupPercent = 0;

void drawStartupScreen() {
  tft.fillScreen(BG);
  tft.drawRoundRect(18, 28, 284, 184, 18, PANEL2);

  centeredText("AIRWATCH", 160, 62, 3, CYAN);
  centeredText("SMART ENVIRONMENT MONITOR", 160, 105, 1, WHITE);

  tft.setTextSize(1);
  tft.setTextColor(GREY);
  tft.setCursor(25, 145);
  tft.print("STARTING SYSTEM");

  tft.drawRoundRect(25, 166, 270, 16, 7, PANEL2);
  tft.fillRoundRect(28, 169, 264, 10, 4, DARKGREY);

  tft.setTextColor(CYAN);
  tft.setCursor(25, 190);
  tft.print("PLEASE WAIT...");
}

void startupProgress(uint8_t target, const char *message) {
  target = constrain(target, 0, 100);

  tft.fillRect(24, 137, 272, 18, BG);
  tft.setTextSize(1);
  tft.setTextColor(GREY);
  tft.setCursor(25, 145);
  tft.print(message);

  while (startupPercent < target) {
    startupPercent = min((int)startupPercent + 2, (int)target);

    tft.fillRoundRect(28, 169, 264, 10, 4, DARKGREY);
    int fillWidth = (264 * startupPercent) / 100;

    if (fillWidth > 0) {
      tft.fillRoundRect(28, 169, fillWidth, 10, 4, CYAN);
      int pulseX = 28 + max(0, fillWidth - 9);
      tft.fillRoundRect(pulseX, 169, min(9, fillWidth), 10, 3, WHITE);
    }
    delay(12);
  }
}

// ============================================================
// FAN, NEOPIXEL AND BUZZER CONTROL
// ============================================================
void updateFan(float temp) {
  if (!systemOn) {
    fanOn = false;
  } else if (fanMode == "on") {
    fanOn = true;
  } else if (fanMode == "off") {
    fanOn = false;
  } else if (!haveValidReading()) {
    fanOn = false;
  } else if (!isnan(temp)) {
    if (!fanOn && temp >= FAN_ON_TEMP_C) fanOn = true;
    else if (fanOn && temp <= FAN_OFF_TEMP_C) fanOn = false;
  }
  digitalWrite(FAN_PIN, fanOn ? HIGH : LOW);
}

void updateLED() {
  if (!systemOn || !haveValidReading()) {
    pixels.clear();
  } else if (co2ppm < 800) {
    pixels.setPixelColor(0, pixels.Color(0, 255, 0));
  } else if (co2ppm < 2000) {
    pixels.setPixelColor(0, pixels.Color(255, 180, 0));
  } else {
    pixels.setPixelColor(0, pixels.Color(255, 0, 0));
  }
  pixels.show();
}

void updateBuzzerState() {
  if (!haveValidReading()) {
    buzzerActive = false;
    return;
  }
  if (co2ppm >= CO2_BUZZER_ON_PPM) {
    buzzerActive = true;
  } else if (co2ppm <= CO2_BUZZER_OFF_PPM) {
    buzzerActive = false;
  }
}

void handleBuzzer() {
  unsigned long now = millis();

  if (!systemOn || !soundEnabled || !buzzerActive) {
    digitalWrite(BUZZER_PIN, LOW);
    beepState = false;
    return;
  }

  unsigned long interval = beepState ? BEEP_ON_MS : BEEP_OFF_MS;
  if (now - lastBeepToggle >= interval) {
    lastBeepToggle = now;
    beepState = !beepState;
    digitalWrite(BUZZER_PIN, beepState ? HIGH : LOW);
  }
}

// ============================================================
// SCD41 SENSOR
// ============================================================
void readSensor() {
  if (!sensorOK) {
    if (millis() - lastSensorRetry >= 30000UL) {
      lastSensorRetry = millis();
      Serial.println("[SENSOR] retrying SCD41 initialization");
      scd4x.begin(Wire, SCD41_I2C_ADDR_62);
      int16_t retryError = scd4x.startPeriodicMeasurement();
      sensorOK = retryError == 0;
      Serial.printf("[SENSOR] retry %s (%d)\n", sensorOK ? "OK" : "failed", retryError);
    }
    return;
  }

  bool ready = false;
  int16_t error = scd4x.getDataReadyStatus(ready);
  if (error != 0) {
    Serial.printf("[SENSOR] readiness error=%d\n", error);
    return;
  }
  if (!ready) return;

  uint16_t newCO2 = 0;
  float newTemp = NAN;
  float newHumidity = NAN;

  error = scd4x.readMeasurement(newCO2, newTemp, newHumidity);
  if (error != 0 || newCO2 == 0) {
    Serial.printf("[SENSOR] measurement unavailable error=%d co2=%u\n", error, newCO2);
    return;
  }

  co2ppm = newCO2;
  temperatureC = newTemp;
  humidityRH = newHumidity;
  readingAtMs = millis();

  updateFan(temperatureC);
  updateLED();
  updateBuzzerState();
  if (millis() - lastHistoryAt >= 5000UL) {
    recordHistory();
    lastHistoryAt = millis();
  }

  Serial.print("[SENSOR] CO2: ");
  Serial.print(co2ppm);
  Serial.print(" ppm | TEMP: ");
  Serial.print(temperatureC, 1);
  Serial.print(" C | HUM: ");
  Serial.printf("[MEM] free heap=%u\n", (unsigned)ESP.getFreeHeap());
  Serial.println(humidityRH, 1);
}

// ============================================================
// MAIN DASHBOARD
// ============================================================
void drawHeader(const char *subtitle) {
  tft.fillRect(0, 0, 320, 35, BG);

  tft.setTextSize(2);
  tft.setTextColor(CYAN);
  tft.setCursor(12, 10);
  tft.print("AIRWATCH");

  tft.setTextSize(1);
  tft.setTextColor(WiFi.status() == WL_CONNECTED ? GREEN : GREY);
  tft.fillCircle(225, 17, 3, WiFi.status() == WL_CONNECTED ? GREEN : GREY);
  tft.setCursor(233, 13);
  tft.print(subtitle);

  tft.drawFastHLine(10, 37, 300, PANEL2);
}

void drawHomePage() {
  tft.fillScreen(BG);
  drawHeader("LIVE MONITOR");

  drawPanel(10, 45, 300, 91);
  tft.setTextSize(1);
  tft.setTextColor(GREY);
  tft.setCursor(23, 55);
  tft.print("CO2  /  VENTILATION INDICATOR");
  tft.setCursor(250, 55);
  tft.print("PPM");

  drawPanel(10, 145, 145, 65);
  tft.setTextSize(1);
  tft.setTextColor(GREY);
  tft.setCursor(22, 155);
  tft.print("TEMPERATURE");

  drawPanel(165, 145, 145, 65);
  tft.setCursor(177, 155);
  tft.print("HUMIDITY");

  tft.setTextSize(1);
  tft.setTextColor(GREY);
  tft.setCursor(13, 216);
  tft.print("FAN");
  tft.setCursor(103, 216);
  tft.print("LED");
  tft.setCursor(193, 216);
  tft.print("BUZZER");

  shownCO2 = 65535;
  shownTemp = -9999;
  shownHumidity = -9999;
  shownFan = -1;
  shownLED = -1;
  shownBuzzer = -1;
  shownQuality = -1;
  shownGaugeW = -1;
}

void drawCO2Gauge() {
  bool hasReading = haveValidReading();
  float target = hasReading
    ? constrain((float)co2ppm / 3000.0f, 0.0f, 1.0f)
    : 0.0f;

  unsigned long now = millis();
  if (now - lastAnimation >= 25) {
    lastAnimation = now;
    animatedCO2 += (target - animatedCO2) * 0.12f;
  }

  int width = constrain((int)(animatedCO2 * 280.0f), 0, 280);
  uint16_t color = hasReading ? getCO2Color(co2ppm) : GREY;

  if (width == shownGaugeW && color == shownGaugeColor) return;
  shownGaugeW = width;
  shownGaugeColor = color;

  tft.fillRoundRect(20, 130, 280, 12, 5, DARKGREY);
  if (width > 0) {
    tft.fillRoundRect(20, 130, width, 12, min(5, width / 2), color);
  }
}

void updateHomePage() {
  bool hasReading = haveValidReading();

  uint16_t co2Now = hasReading ? co2ppm : 0;
  if (co2Now != shownCO2) {
    shownCO2 = co2Now;
    tft.fillRect(20, 74, 165, 44, PANEL);
    tft.setTextSize(4);
    tft.setCursor(23, 77);

    if (hasReading) {
      tft.setTextColor(getCO2Color(co2ppm));
      tft.print(co2ppm);
    } else {
      tft.setTextColor(GREY);
      tft.print("----");
    }
  }

  int quality = !sensorOK ? 5 : (!hasReading ? 4 :
                 (co2ppm < 800 ? 0 :
                 (co2ppm < 1200 ? 1 :
                 (co2ppm < 2000 ? 2 : 3))));

  if (quality != shownQuality) {
    shownQuality = quality;
    tft.fillRect(185, 98, 115, 20, PANEL);
    tft.setTextSize(1);
    tft.setCursor(190, 104);

    if (quality == 5) {
      tft.setTextColor(RED);
      tft.print("NO SENSOR");
    } else if (quality == 4) {
      tft.setTextColor(GREY);
      tft.print("WAITING...");
    } else {
      tft.setTextColor(getCO2Color(co2ppm));
      tft.print(getAirQuality(co2ppm));
    }
  }

  drawCO2Gauge();

  int temp = hasReading ? (int)(temperatureC * 10.0f) : -9998;
  if (temp != shownTemp) {
    shownTemp = temp;
    tft.fillRect(20, 175, 130, 29, PANEL);
    tft.setTextSize(3);
    tft.setTextColor(hasReading ? WHITE : GREY);
    tft.setCursor(22, 177);

    if (hasReading) {
      tft.print(temperatureC, 1);
      tft.setTextSize(1);
      tft.print(" C");
    } else {
      tft.print("--.-");
    }
  }

  int hum = hasReading ? (int)(humidityRH + 0.5f) : -9998;
  if (hum != shownHumidity) {
    shownHumidity = hum;
    tft.fillRect(175, 175, 130, 29, PANEL);
    tft.setTextSize(3);
    tft.setTextColor(hasReading ? WHITE : GREY);
    tft.setCursor(177, 177);

    if (hasReading) {
      tft.print(hum);
      tft.print("%");
    } else {
      tft.print("--%");
    }
  }

  int fan = fanOn ? 1 : 0;
  if (fan != shownFan) {
    shownFan = fan;
    tft.fillRect(12, 226, 75, 9, BG);
    tft.setTextSize(1);
    tft.setTextColor(fanOn ? GREEN : GREY);
    tft.setCursor(13, 226);
    tft.print(fanOn ? "ON" : "OFF");
  }

  int led = !hasReading ? 0 : (co2ppm < 800 ? 1 :
             (co2ppm < 2000 ? 2 : 3));
  if (led != shownLED) {
    shownLED = led;
    tft.fillRect(102, 226, 75, 9, BG);
    tft.setTextSize(1);
    tft.setTextColor(led == 0 ? GREY :
                     (led == 1 ? GREEN :
                     (led == 2 ? YELLOW : RED)));
    tft.setCursor(103, 226);
    tft.print(led == 0 ? "--" :
              (led == 1 ? "GREEN" :
              (led == 2 ? "YELLOW" : "RED")));
  }

  int buz = !soundEnabled ? 2 : (buzzerActive ? 1 : 0);
  if (buz != shownBuzzer) {
    shownBuzzer = buz;
    tft.fillRect(192, 226, 95, 9, BG);
    tft.setTextSize(1);
    tft.setTextColor(buz == 1 ? RED :
                     (buz == 2 ? YELLOW : GREEN));
    tft.setCursor(193, 226);
    tft.print(buz == 1 ? "ALARM" :
              (buz == 2 ? "MUTED" : "IDLE"));
  }
}

// ============================================================
// UPTIME TIMER PAGE
// ============================================================
void drawClockPage() {
  tft.fillScreen(BG);
  drawHeader("UPTIME TIMER");

  drawPanel(15, 65, 290, 120);

  tft.setTextSize(1);
  tft.setTextColor(GREY);
  tft.setCursor(110, 85);
  tft.print("DEVICE UPTIME");

  tft.setTextSize(4);
  tft.setTextColor(CYAN);
  tft.setCursor(60, 120);
  tft.print("00:00:00");

  tft.setTextSize(1);
  tft.setTextColor(GREY);
  tft.setCursor(95, 160);
  tft.print("SINCE POWER ON");
}

void drawNetworkPage() {
  tft.fillScreen(BG);
  drawHeader("LOCAL ACCESS");
  drawPanel(10, 48, 300, 75);
  tft.setTextSize(1);
  tft.setTextColor(GREY);
  tft.setCursor(22, 59);
  tft.print("AIRWATCH SETUP WI-FI");
  tft.setTextSize(2);
  tft.setTextColor(CYAN);
  tft.setCursor(22, 78);
  tft.print(apSSID);
  tft.setTextSize(1);
  tft.setTextColor(WHITE);
  tft.setCursor(22, 105);
  tft.print("http://192.168.4.1");

  drawPanel(10, 131, 300, 89);
  tft.setTextColor(GREY);
  tft.setCursor(22, 142);
  tft.print("CONTROL KEY  (HOLD SYSTEM BUTTON 3 SEC TO REVEAL)");
  bool visible = revealCredentials && millis() < revealUntilMs;
  tft.setTextColor(visible ? CYAN : DARKGREY);
  tft.setCursor(22, 160);
  if (visible) {
    tft.print(controlKey.substring(0, 24));
    tft.setCursor(22, 174);
    tft.print(controlKey.substring(24));
    tft.setTextColor(WHITE);
    tft.setCursor(22, 194);
    tft.print("AP PASS: ");
    tft.print(apPassword);
  } else {
    tft.print("************************");
    tft.setCursor(22, 174);
    tft.print("************************");
    tft.setTextColor(GREY);
    tft.setCursor(22, 194);
    tft.print("AP PASS: ****************");
  }
  tft.setTextColor(GREY);
  tft.setCursor(14, 226);
  tft.print(WiFi.status() == WL_CONNECTED ? "Router connected" : "Router offline - setup AP stays active");
}

void updateClockPage() {
  static unsigned long previousSecond = ULONG_MAX;

  unsigned long seconds = millis() / 1000UL;
  if (seconds == previousSecond) return;
  previousSecond = seconds;

  unsigned long hours = seconds / 3600UL;
  unsigned long minutes = (seconds / 60UL) % 60UL;
  unsigned long secs = seconds % 60UL;

  char clockText[20];
  snprintf(clockText, sizeof(clockText),
           "%02lu:%02lu:%02lu", hours, minutes, secs);

  tft.fillRect(45, 115, 230, 45, PANEL);
  tft.setTextSize(4);
  tft.setTextColor(CYAN);
  tft.setCursor(55, 120);
  tft.print(clockText);
}

// ============================================================
// PAGE SWITCHING - ONLY HOME AND CLOCK
// ============================================================
void switchPage(uint8_t page) {
  currentPage = static_cast<Page>(page);
  pageNeedsDraw = true;
  touching = false;

  Serial.printf("[PAGE] %s\n", currentPage == PAGE_HOME ? "HOME" : currentPage == PAGE_CLOCK ? "UPTIME" : "NETWORK");
}

void changePage(int direction) {
  if (direction > 0) {
    switchPage(((uint8_t)currentPage + 1) % 3);
  } else {
    switchPage(((uint8_t)currentPage + 2) % 3);
  }
}

void renderPage() {
  if (!pageNeedsDraw) return;

  deselectAllSPI();
  if (currentPage == PAGE_HOME) {
    drawHomePage();
  } else {
    if (currentPage == PAGE_CLOCK) drawClockPage();
    else drawNetworkPage();
  }
  pageNeedsDraw = false;
}

// ============================================================
// TOUCH INPUT AND SWIPE NAVIGATION
// ============================================================
bool readTouch(int &sx, int &sy) {
  digitalWrite(TFT_CS, HIGH);
  digitalWrite(SD_CS, HIGH);

  if (!touch.touched()) {
    digitalWrite(TOUCH_CS, HIGH);
    return false;
  }

  TS_Point p = touch.getPoint();
  digitalWrite(TOUCH_CS, HIGH);

  int a = TOUCH_SWAP_XY ? p.y : p.x;
  int b = TOUCH_SWAP_XY ? p.x : p.y;

  sx = map(a, TOUCH_X_MIN, TOUCH_X_MAX, 0, 319);
  sy = map(b, TOUCH_Y_MIN, TOUCH_Y_MAX, 0, 239);

  if (TOUCH_INVERT_X) sx = 319 - sx;
  if (TOUCH_INVERT_Y) sy = 239 - sy;

  sx = constrain(sx, 0, 319);
  sy = constrain(sy, 0, 239);
  return true;
}

void checkSwipe() {
  int sx, sy;
  unsigned long now = millis();

  if (readTouch(sx, sy)) {
    if (!touching) {
      touching = true;
      touchStartX = sx;
      touchStartY = sy;
      touchStartMs = now;
    }
    touchLastX = sx;
    touchLastY = sy;
    touchLastSeenMs = now;
    return;
  }

  if (touching && now - touchLastSeenMs > TOUCH_RELEASE_MS) {
    touching = false;

    int dx = touchLastX - touchStartX;
    int dy = touchLastY - touchStartY;
    unsigned long duration = touchLastSeenMs - touchStartMs;

    if (duration <= SWIPE_MAX_MS &&
        abs(dx) >= SWIPE_MIN_PX &&
        abs(dx) > abs(dy) * 2) {
      if (dx < 0) {
        Serial.println("[SWIPE] LEFT -> NEXT PAGE");
        changePage(1);
      } else {
        Serial.println("[SWIPE] RIGHT -> PREVIOUS PAGE");
        changePage(-1);
      }
    }
  }
}

// ============================================================
// PHYSICAL BUTTONS
// GPIO1: system display/output ON/OFF
// GPIO2: mute/unmute buzzer
// ============================================================
void setSystem(bool enabled) {
  systemOn = enabled;

  if (enabled) {
    updateFan(temperatureC);
    updateLED();
    pageNeedsDraw = true;
    Serial.println("[SYSTEM] ON");
  } else {
    fanOn = false;
    digitalWrite(FAN_PIN, LOW);
    digitalWrite(BUZZER_PIN, LOW);
    buzzerActive = false;
    beepState = false;
    pixels.clear();
    pixels.show();

    deselectAllSPI();
    tft.fillScreen(BG);
    centeredText("AIRWATCH", 160, 85, 3, CYAN);
    centeredText("SYSTEM OFF", 160, 130, 2, GREY);
    Serial.println("[SYSTEM] OFF");
  }
}

void checkButton() {
  bool state = digitalRead(BUTTON_PIN);

  if (state != lastButtonState &&
      millis() - lastButtonChange > DEBOUNCE_MS) {
    lastButtonChange = millis();
    lastButtonState = state;

    if (state == LOW) {
      systemButtonWasDown = true;
      systemButtonDownAt = millis();
      if (currentPage != PAGE_NETWORK) setSystem(!systemOn);
    } else if (systemButtonWasDown) {
      systemButtonWasDown = false;
      if (currentPage == PAGE_NETWORK && millis() - systemButtonDownAt >= 3000UL) {
        revealCredentials = true;
        revealUntilMs = millis() + 30000UL;
        pageNeedsDraw = true;
        Serial.println("[AUTH] credential reveal activated for 30 seconds");
      }
    }
  }
}

void checkMuteButton() {
  bool state = digitalRead(MUTE_PIN);

  if (state != lastMuteState &&
      millis() - lastMuteChange > DEBOUNCE_MS) {
    lastMuteChange = millis();
    lastMuteState = state;

    if (state == LOW) {
      soundEnabled = !soundEnabled;
      if (!soundEnabled) {
        digitalWrite(BUZZER_PIN, LOW);
        beepState = false;
      }
      Serial.println(soundEnabled ? "[BUZZER] ENABLED"
                                  : "[BUZZER] MUTED");
      pageNeedsDraw = true;
    }
  }
}

// ============================================================
// DISPLAY UPDATE
// ============================================================
void updateDisplay() {
  if (!systemOn) return;

  renderPage();

  if (currentPage == PAGE_HOME) {
    updateHomePage();
  } else if (currentPage == PAGE_CLOCK) {
    updateClockPage();
  } else if (revealCredentials && millis() >= revealUntilMs) {
    revealCredentials = false;
    pageNeedsDraw = true;
  }
}

void enforceFreshness() {
  static bool staleHandled = false;
  if (!readingAtMs || millis() - readingAtMs < 15000UL) {
    staleHandled = false;
    return;
  }
  if (staleHandled) return;
  staleHandled = true;
  Serial.println("[SENSOR] reading stale; automatic outputs fail safe");
  updateFan(NAN);
  updateBuzzerState();
  handleBuzzer();
  updateLED();
  pageNeedsDraw = true;
}

// ============================================================
// SETUP
// ============================================================
void setup() {
  Serial.begin(115200);
  delay(300);
  applyDisplayTheme("light");

  Serial.println();
  Serial.println("================================");
  Serial.println(" AIRWATCH SMART MONITOR - S3");
  Serial.println(" SENSOR + LOCAL UI + LOCAL API");
  Serial.println("================================");

  setCpuFrequencyMhz(160);

  pinMode(FAN_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(FAN_PIN, LOW);
  digitalWrite(BUZZER_PIN, LOW);

  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(MUTE_PIN, INPUT_PULLUP);

  // Keep all original SPI chip-select wiring.
  pinMode(TFT_CS, OUTPUT);
  pinMode(TOUCH_CS, OUTPUT);
  pinMode(SD_CS, OUTPUT);
  deselectAllSPI();

  SPI.begin(SPI_SCK, SPI_MISO, SPI_MOSI);
  deselectAllSPI();

  // TFT initialization
  tft.begin();
  tft.setRotation(1);
  Serial.println("[TFT] initialized; rotation=landscape 320x240");
  drawStartupScreen();
  startupProgress(20, "DISPLAY INITIALIZED");

  // Touchscreen remains enabled for page swiping.
  touchReady = touch.begin();
  Serial.printf("[TOUCH] initialization %s\n", touchReady ? "OK" : "FAILED");
  startupProgress(35, touchReady ? "TOUCHSCREEN READY" : "TOUCH NOT FOUND");

  // NeoPixel
  pixels.begin();
  pixels.setBrightness(80);
  pixels.clear();
  pixels.show();
  Serial.printf("[LED] initialized; count=%u brightness=80\n", (unsigned)NEOPIXEL_COUNT);
  startupProgress(45, "STATUS LED READY");

  // I2C
  Wire.begin(PIN_SDA, PIN_SCL);
  Wire.setClock(100000);
  Serial.printf("[I2C] initialized SDA=%u SCL=%u clock=100kHz\n", (unsigned)PIN_SDA, (unsigned)PIN_SCL);
  startupProgress(55, "I2C BUS READY");

  // SCD41
  Serial.println("[SENSOR] Starting SCD41...");
  scd4x.begin(Wire, SCD41_I2C_ADDR_62);

  int16_t error = scd4x.stopPeriodicMeasurement();
  if (error != 0) Serial.printf("[SENSOR] initial stop returned %d\n", error);
  delay(500); // SCD4x requires a stop-command interval before restarting periodic mode.
  error = scd4x.startPeriodicMeasurement();

  sensorOK = (error == 0);
  if (sensorOK) {
    Serial.println("[SENSOR] SCD41 ONLINE");
  } else {
    Serial.print("[SENSOR] ERROR: ");
    Serial.println(error);
  }

  startupProgress(85, sensorOK
                  ? "SCD41 SENSOR ONLINE"
                  : "SCD41 SENSOR NOT FOUND");

  initializeNetworkAndApi();
  startupProgress(100, fsReady ? "LOCAL DASHBOARD READY" : "API READY - NO DASHBOARD FILES");
  tft.fillScreen(BG);
  currentPage = PAGE_HOME;
  pageNeedsDraw = true;
  renderPage();

  Serial.println("[SYSTEM] INITIALIZATION COMPLETE");
  Serial.println("[SYSTEM] READY");
}

// ============================================================
// MAIN LOOP
// ============================================================
void loop() {
  unsigned long now = millis();

  server.handleClient();
  maintainStationWiFi();
  static bool wasStaConnected = false;
  bool staConnected = WiFi.status() == WL_CONNECTED;
  if (staConnected != wasStaConnected) {
    wasStaConnected = staConnected;
    if (staConnected) staBackoffMs = 5000;
    Serial.printf("[WIFI] STA %s%s\n", staConnected ? "connected: " : "disconnected", staConnected ? WiFi.localIP().toString().c_str() : "");
    pageNeedsDraw = true;
  }
  checkButton();
  checkMuteButton();
  if (systemOn && touchReady) checkSwipe();

  if (now - lastSensorRead >= SENSOR_INTERVAL) {
    lastSensorRead = now;
    readSensor();
  }

  enforceFreshness();
  handleBuzzer();

  if (systemOn && now - lastDisplayUpdate >= DISPLAY_INTERVAL) {
    lastDisplayUpdate = now;
    updateDisplay();
  }

  delay(1);
}
