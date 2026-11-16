/*
 AirWatch v3.3 MODERN LANDSCAPE + STARTUP CHIME — ESP32-S3-N16R8
 Original GPIO assignments and original device functions retained.
 Features: Modern 320x240 TFT, four swipe pages, Wi-Fi (AP + STA),
 LittleFS React/Vite site hosting, JSON sensor APIs and remote controls.
 Hardware outputs GPIO6/7 MUST drive appropriate transistor/MOSFET stages;
 never connect a motor or high-current buzzer directly to an ESP32 GPIO.
 Wi-Fi is 2.4 GHz. Use trusted local networks only (HTTP, not HTTPS).
*/
#include <Arduino.h>
#include <Wire.h>
#include <SPI.h>
#include <WiFi.h>
#include <WebServer.h>
#include <LittleFS.h>
#include <Preferences.h>
#include <time.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ILI9341.h>
#include <XPT2046_Touchscreen.h>
#include <Adafruit_NeoPixel.h>
#include <SensirionI2cScd4x.h>
#include <qrcode.h> // ESP32-S3 built-in Espressif QR encoder
#include <math.h>

// Original project GPIOs
#define PIN_SDA 4
#define PIN_SCL 5
#define TFT_CS 10
#define TFT_DC 14
#define TFT_RST 21
#define TOUCH_CS 16
#define SD_CS 17
#define BUTTON_PIN 1
#define MUTE_PIN 2
#define FAN_PIN 6
#define BUZZER_PIN 7
#define NEOPIXEL_PIN 18
#define SPI_SCK 12
#define SPI_MOSI 11
#define SPI_MISO 13
#define TFT_WIDTH 320
#define TFT_HEIGHT 240

// RGB565 palette follows the web app's light and dark dashboard themes.
uint16_t BG, PANEL, PANEL2, CYAN, GREEN, YELLOW, ORANGE, RED, WHITE=0xFFFF, NAVY, GREY, DARKGREY, BLUE, TEXT;
String displayTheme="dark";
void applyDisplayTheme(const String& theme) {
  displayTheme=theme=="dark"?"dark":"light";
  if(displayTheme=="dark") {
    BG=0x08A3; PANEL=0x08E5; PANEL2=0x2229; CYAN=0x05BA;
    GREEN=0x25EB; YELLOW=0xFCA1; ORANGE=0xFB64; RED=0xE222;
    NAVY=0x08A3; GREY=0x94B6; DARKGREY=0x4208; BLUE=0x363F; TEXT=0xEF5E;
  } else {
    BG=0xF7BE; PANEL=0xFFFF; PANEL2=0xE71E; CYAN=0x05BA;
    GREEN=0x25EB; YELLOW=0xFCA1; ORANGE=0xFB64; RED=0xE222;
    NAVY=0x1128; GREY=0x6BD1; DARKGREY=0x9CD3; BLUE=0x363F; TEXT=NAVY;
  }
}

Adafruit_ILI9341 tft(TFT_CS,TFT_DC,TFT_RST);
XPT2046_Touchscreen touch(TOUCH_CS);
Adafruit_NeoPixel pixels(1,NEOPIXEL_PIN,NEO_GRB+NEO_KHZ800);
SensirionI2cScd4x scd4x;
WebServer server(80);
Preferences prefs;

enum Page : uint8_t { PAGE_HOME=0, PAGE_CLOCK=1, PAGE_WIFI=2, PAGE_TIME=3 };
enum FanMode : uint8_t { FAN_AUTO=0, FAN_FORCE_ON=1, FAN_FORCE_OFF=2 };
Page currentPage=PAGE_HOME;
FanMode fanMode=FAN_AUTO;
bool systemOn=true, soundEnabled=true, fanOn=false, buzzerActive=false, beepState=false, sensorOK=false;
uint16_t co2ppm=0;
float temperatureC=NAN, humidityRH=NAN;
float fanOnTemp=30.0f, fanOffTemp=28.0f;
uint16_t alarmOnPPM=2000, alarmOffPPM=1800;
unsigned long lastSensorPoll=0,lastDisplayUpdate=0,lastBeepToggle=0,lastWifiAttempt=0,lastWifiScreenUpdate=0;
uint32_t latestSampleMillis=0;
uint64_t uptimeMs64=0;
uint32_t previousMillis32=0;
bool pageNeedsDraw=true;

// Set false to disable the startup confirmation sounds.
const bool STARTUP_SOUND_ENABLED = true;
bool startupSoundAllowed = true;
uint8_t bootProgress = 0;

String apSSID,apPassword,adminKey,staSSID,staPassword;
bool setupRequired=false;
String lastWiFiSignature;
const char* HOSTNAME="airwatch";
// All samples are volatile: they disappear when the ESP32 restarts.
const size_t HISTORY_CAP=360;
struct Sample { uint32_t uptimeSec; uint32_t epoch; uint16_t ppm; int16_t temp10; uint16_t rh10; };
Sample history[HISTORY_CAP];
size_t historyHead=0,historySize=0;

// Raw XPT2046 calibration from original working sketch.
const int TOUCH_X_MIN=200, TOUCH_X_MAX=3800, TOUCH_Y_MIN=240, TOUCH_Y_MAX=3800;
const bool TOUCH_SWAP_XY=true,TOUCH_INVERT_X=true,TOUCH_INVERT_Y=true;
const int SWIPE_MIN_PX=60;
const unsigned long SWIPE_MAX_MS=1200,TOUCH_RELEASE_MS=60;
bool touching=false;
int touchStartX=0,touchStartY=0,touchLastX=0,touchLastY=0;
unsigned long touchStartMs=0,touchLastSeenMs=0;
bool lastButtonState=HIGH,lastMuteState=HIGH;
unsigned long lastButtonChange=0,lastMuteChange=0;
const unsigned long DEBOUNCE_MS=50;

void textAt(const String& s, int x, int y, uint8_t sz, uint16_t color) {
  tft.setTextWrap(false);
  tft.setTextSize(sz);
  tft.setTextColor(color);
  tft.setCursor(x,y);
  tft.print(s);
}
void centerAt(const String& s, int x, int y, uint8_t sz, uint16_t color) {
  textAt(s, x - (int)s.length()*3*sz, y, sz, color);
}
void panel(int x,int y,int w,int h) {
  tft.fillRoundRect(x,y,w,h,11,PANEL);
  tft.drawRoundRect(x,y,w,h,11,PANEL2);
}
void labelCaps(const String& s, int x, int y) { textAt(s,x,y,1,GREY); }
void drawLogoSegment(int x,int y,int size,float x1,float y1,float x2,float y2,int stroke) {
  const float scale=size/40.0f;
  int sx=x+(int)lroundf((8.0f+x1)*scale), sy=y+(int)lroundf((8.0f+y1)*scale);
  int ex=x+(int)lroundf((8.0f+x2)*scale), ey=y+(int)lroundf((8.0f+y2)*scale);
  tft.drawLine(sx,sy,ex,ey,WHITE);
  if(stroke>1) { tft.fillCircle(sx,sy,stroke/2,WHITE); tft.fillCircle(ex,ey,stroke/2,WHITE); }
}
void drawLogoArc(int x,int y,int size,float x1,float y1,float x2,float y2,float radius,bool largeArc,bool sweep,int stroke) {
  const float scale=size/40.0f;
  const float dx=(x1-x2)*0.5f, dy=(y1-y2)*0.5f;
  float r2=radius*radius, lambda=(dx*dx+dy*dy)/r2;
  if(lambda>1.0f) { radius*=sqrtf(lambda); r2=radius*radius; }
  float factor=sqrtf(max(0.0f,(r2-dx*dx-dy*dy)/(dx*dx+dy*dy)));
  if(largeArc==sweep) factor=-factor;
  const float cx=(x1+x2)*0.5f+factor*dy, cy=(y1+y2)*0.5f-factor*dx;
  const float start=atan2f(y1-cy,x1-cx), finish=atan2f(y2-cy,x2-cx);
  float delta=finish-start;
  if(!sweep && delta>0) delta-=2.0f*PI;
  if(sweep && delta<0) delta+=2.0f*PI;
  if(largeArc && fabsf(delta)<PI) delta+=sweep?2.0f*PI:-2.0f*PI;
  if(!largeArc && fabsf(delta)>PI) delta+=sweep?-2.0f*PI:2.0f*PI;
  const int steps=max(8,(int)(fabsf(delta)*radius*scale*1.5f));
  float px=x1,py=y1;
  for(int i=1;i<=steps;i++) {
    float a=start+delta*(float)i/steps;
    float nx=cx+radius*cosf(a),ny=cy+radius*sinf(a);
    drawLogoSegment(x,y,size,px,py,nx,ny,stroke);
    px=nx;py=ny;
  }
}
void drawAirWatchLogo(int x, int y, int size) {
  const int radius=size*12/40;
  const int stroke=max(1,(size*23+200)/400);
  tft.fillRoundRect(x,y,size,size,radius,0x1148);
  drawLogoSegment(x,y,size,4,8.5f,13.5f,8.5f,stroke);
  drawLogoArc(x,y,size,13.5f,8.5f,11.3f,4.8f,2.5f,true,false,stroke);
  drawLogoSegment(x,y,size,3,12,18.5f,12,stroke);
  drawLogoArc(x,y,size,18.5f,12,16.3f,15.7f,2.5f,true,true,stroke);
  drawLogoSegment(x,y,size,4,15.5f,11,15.5f,stroke);
}
void navDots() {
  for(int i=0;i<4;i++) {
    int x=270+i*11;
    tft.fillCircle(x,16,i==(int)currentPage?3:2,i==(int)currentPage?CYAN:DARKGREY);
  }
}
void header(const char* subtitle) {
  tft.fillRect(0,0,320,43,BG);
  drawAirWatchLogo(11,7,25);
  textAt("AIRWATCH",39,8,2,TEXT);
  labelCaps(subtitle,40,29);
  navDots();
  tft.drawFastHLine(10,42,300,PANEL2);
}
void footer(const char* hint) {
  tft.fillRect(0,223,320,17,BG);
  tft.drawFastHLine(11,220,298,PANEL2);
  labelCaps(hint,13,227);
  for(int i=0;i<4;i++) tft.fillCircle(273+i*10,231,i==(int)currentPage?3:2,i==(int)currentPage?CYAN:DARKGREY);
}
void deselectSPI(){digitalWrite(TFT_CS,HIGH);digitalWrite(TOUCH_CS,HIGH);digitalWrite(SD_CS,HIGH);}
String qualityName(uint16_t c){return c<800?"EXCELLENT":c<1200?"GOOD":c<2000?"POOR":"UNHEALTHY";}
uint16_t qualityColor(uint16_t c){return c<800?GREEN:c<1200?YELLOW:c<2000?ORANGE:RED;}
bool valid(){return sensorOK&&co2ppm>0&&!isnan(temperatureC)&&!isnan(humidityRH);}
const char* fanModeName(){return fanMode==FAN_AUTO?"auto":fanMode==FAN_FORCE_ON?"on":"off";}
void addSample(){Sample &s=history[historyHead];s.uptimeSec=(uint32_t)(uptimeMs64/1000ULL);time_t e=time(nullptr);s.epoch=e>1700000000?(uint32_t)e:0;s.ppm=co2ppm;s.temp10=(int16_t)roundf(temperatureC*10);s.rh10=(uint16_t)roundf(humidityRH*10);historyHead=(historyHead+1)%HISTORY_CAP;if(historySize<HISTORY_CAP)historySize++;}
void fanUpdate(){if(!systemOn)fanOn=false;else if(fanMode==FAN_FORCE_ON)fanOn=true;else if(fanMode==FAN_FORCE_OFF)fanOn=false;else if(!isnan(temperatureC)){if(!fanOn&&temperatureC>=fanOnTemp)fanOn=true;else if(fanOn&&temperatureC<=fanOffTemp)fanOn=false;}digitalWrite(FAN_PIN,fanOn?HIGH:LOW);}
void ledUpdate(){pixels.clear();if(systemOn&&valid()){if(co2ppm<800)pixels.setPixelColor(0,pixels.Color(0,255,0));else if(co2ppm<2000)pixels.setPixelColor(0,pixels.Color(255,180,0));else pixels.setPixelColor(0,pixels.Color(255,0,0));}pixels.show();}
void buzzerUpdate(){if(!systemOn||!valid()){buzzerActive=false;}else if(co2ppm>=alarmOnPPM)buzzerActive=true;else if(co2ppm<alarmOffPPM)buzzerActive=false;}
void handleBuzzer(){if(!systemOn||!soundEnabled||!buzzerActive){digitalWrite(BUZZER_PIN,LOW);beepState=false;lastBeepToggle=millis();return;}uint32_t now=millis();if(now-lastBeepToggle >= (beepState?200UL:800UL)){lastBeepToggle=now;beepState=!beepState;digitalWrite(BUZZER_PIN,beepState?HIGH:LOW);}}
void readSensor(){if(!sensorOK)return;bool ready=false;int16_t err=scd4x.getDataReadyStatus(ready);if(err||!ready)return;uint16_t c=0;float t=NAN,h=NAN;err=scd4x.readMeasurement(c,t,h);if(err||!c||isnan(t)||isnan(h))return;co2ppm=c;temperatureC=t;humidityRH=h;latestSampleMillis=millis();addSample();fanUpdate();ledUpdate();buzzerUpdate();Serial.printf("[SCD41] %u ppm, %.1f C, %.1f %%RH\n",co2ppm,temperatureC,humidityRH);}

// -------------------- MODERN 320 x 240 LANDSCAPE UI --------------------
// Active buzzer (not a passive piezo): short on/off chirps, not musical tones.
// Never drive a high-current buzzer directly from an ESP32 pin.
void startupChirp(uint8_t pulses, uint16_t onMs = 45, uint16_t offMs = 65) {
  if (!STARTUP_SOUND_ENABLED || !startupSoundAllowed) return;
  for (uint8_t i = 0; i < pulses; ++i) {
    digitalWrite(BUZZER_PIN, HIGH);
    delay(onMs);
    digitalWrite(BUZZER_PIN, LOW);
    if (i + 1 < pulses) delay(offMs);
  }
  digitalWrite(BUZZER_PIN, LOW);
}

void startup() {
  bootProgress = 0;
  tft.fillScreen(BG);
  tft.fillRoundRect(106, 22, 108, 105, 24, PANEL);
  tft.drawRoundRect(106, 22, 108, 105, 24, PANEL2);
  drawAirWatchLogo(134, 46, 52);
  centerAt("AIRWATCH", 160, 140, 3, TEXT);
  centerAt("SMART AIR MONITOR", 160, 174, 1, GREY);
  tft.drawRoundRect(32, 209, 256, 13, 5, PANEL2);
  tft.fillRoundRect(35, 212, 250, 7, 3, DARKGREY);
  centerAt("INITIALIZING...", 160, 189, 1, CYAN);
}

void startupProgress(uint8_t percent, const char* message, uint8_t chirps = 0) {
  if (percent > 100) percent = 100;
  if (percent < bootProgress) percent = bootProgress;
  tft.fillRect(15, 187, 290, 17, BG);
  centerAt(String(message), 160, 189, 1, GREY);
  const int width = (250 * percent) / 100;
  tft.fillRoundRect(35, 212, 250, 7, 3, DARKGREY);
  if (width > 0) tft.fillRoundRect(35, 212, width, 7, 3, CYAN);
  bootProgress = percent;
  if (chirps) startupChirp(chirps);
}

void sparkline(int x,int y,int w,int h) {
  // Uses real measured CO2 readings; no artificial demo values.
  if(historySize<2) {
    labelCaps("LIVE TREND",x+12,y+10);
    textAt("Waiting...",x+12,y+30,1,GREY);
    return;
  }
  const size_t count=historySize<24?historySize:24;
  uint16_t lo=65535,hi=0;
  for(size_t i=0;i<count;i++) {
    const Sample& sm=history[(historyHead+HISTORY_CAP-count+i)%HISTORY_CAP];
    if(sm.ppm<lo)lo=sm.ppm;
    if(sm.ppm>hi)hi=sm.ppm;
  }
  if(hi==lo)hi=lo+1;
  for(size_t i=1;i<count;i++) {
    const Sample& a=history[(historyHead+HISTORY_CAP-count+i-1)%HISTORY_CAP];
    const Sample& b=history[(historyHead+HISTORY_CAP-count+i)%HISTORY_CAP];
    int x1=x+(int)((i-1)*(w-1)/(count-1));
    int x2=x+(int)(i*(w-1)/(count-1));
    int y1=y+h-1-(int)((a.ppm-lo)*(h-1)/(hi-lo));
    int y2=y+h-1-(int)((b.ppm-lo)*(h-1)/(hi-lo));
    tft.drawLine(x1,y1,x2,y2,CYAN);
  }
  tft.fillCircle(x+w-1,y+h-1-(int)((history[(historyHead+HISTORY_CAP-1)%HISTORY_CAP].ppm-lo)*(h-1)/(hi-lo)),2,GREEN);
}
void drawHome() {
  tft.fillScreen(BG);header("ENVIRONMENT / LIVE");
  panel(10,50,300,100);
  labelCaps("CARBON DIOXIDE",22,61);
  textAt("ppm",119,97,1,GREY);
  tft.drawFastVLine(164,67,68,PANEL2);
  labelCaps("LAST 24 READINGS",179,61);
  panel(10,158,146,61);panel(164,158,146,61);
  labelCaps("TEMPERATURE",21,168);
  labelCaps("HUMIDITY",175,168);
  footer("SWIPE LEFT FOR DEVICE STATUS");
}
void updateHome() {
  // Redraw only content regions to avoid unnecessary full-screen flashes.
  tft.fillRect(21,83,135,59,PANEL);
  if(valid()) {
    textAt(String(co2ppm),21,85,4,qualityColor(co2ppm));
    textAt(qualityName(co2ppm),22,128,1,qualityColor(co2ppm));
    textAt("ppm",129,113,1,GREY);
  } else {
    textAt("----",21,85,4,GREY);
    textAt(sensorOK?"WARMING UP":"SENSOR OFFLINE",22,128,1,YELLOW);
  }
  tft.fillRect(174,78,126,61,PANEL);
  sparkline(178,87,116,43);
  tft.fillRect(20,184,130,28,PANEL);
  tft.fillRect(175,184,128,28,PANEL);
  if(valid()) {
    textAt(String(temperatureC,1),21,186,3,TEXT);
    textAt("C",123,201,1,GREY);
    textAt(String(humidityRH,1),175,186,3,TEXT);
    textAt("%",283,201,1,GREY);
  } else {
    textAt("--.-",21,186,3,GREY);
    textAt("--.-",175,186,3,GREY);
  }
  // Quick status chips appear in the reserved lower part of the CO2 card.
  tft.fillRect(175,133,125,13,PANEL);
  textAt(fanOn?"FAN ON":"FAN OFF",177,136,1,fanOn?GREEN:GREY);
  textAt(!soundEnabled?"MUTE":buzzerActive?"ALARM":"SAFE",255,136,1,buzzerActive&&soundEnabled?RED:GREEN);
}
void drawClock() {
  tft.fillScreen(BG);header("DEVICE / UPTIME");
  panel(10,55,300,149);
  labelCaps("RUNNING SINCE LAST RESTART",24,73);
  tft.drawFastHLine(24,158,272,PANEL2);
  labelCaps("STATUS",25,174);
  textAt("MONITOR ONLINE",77,174,1,GREEN);
  footer("SWIPE LEFT FOR WI-FI SETUP");
}
void updateClock() {
  uint64_t secs=uptimeMs64/1000ULL;
  unsigned long hours=(unsigned long)(secs/3600ULL);
  unsigned long minutes=(unsigned long)((secs/60ULL)%60ULL);
  unsigned long seconds=(unsigned long)(secs%60ULL);
  char buf[32];
  snprintf(buf,sizeof(buf),"%02lu:%02lu:%02lu",hours,minutes,seconds);
  tft.fillRect(21,103,280,47,PANEL);
  centerAt(String(buf),160,109,4,CYAN);
  tft.fillRect(77,174,220,15,PANEL);
  textAt(systemOn?"MONITOR ONLINE":"MONITOR OFF",77,174,1,systemOn?GREEN:RED);
}
void drawTimeDate() {
  tft.fillScreen(BG);header("CLOCK / PHILIPPINES");
  panel(10,55,300,149);
  labelCaps("PHILIPPINE STANDARD TIME / UTC+8",23,72);
  tft.drawFastHLine(24,157,272,PANEL2);
  labelCaps("NTP TIME SYNC REQUIRES INTERNET",25,172);
  footer("SWIPE RIGHT FOR WI-FI SETUP");
}
void updateTimeDate() {
  time_t now=time(nullptr);
  tft.fillRect(20,99,280,52,PANEL);
  tft.fillRect(20,185,280,16,PANEL);
  if(now<1700000000) {
    centerAt("SYNCING TIME",160,110,2,YELLOW);
    centerAt("CONNECT TO INTERNET",160,187,1,GREY);
    return;
  }
  struct tm lt;
  localtime_r(&now,&lt);
  char timeText[24],dateText[36];
  strftime(timeText,sizeof(timeText),"%I:%M:%S %p",&lt);
  strftime(dateText,sizeof(dateText),"%a, %b %d, %Y",&lt);
  centerAt(timeText,160,109,3,TEXT);
  centerAt(dateText,160,187,1,CYAN);
}
String staIP(){return WiFi.status()==WL_CONNECTED?WiFi.localIP().toString():"";}
String currentURL(){return String("http://")+(WiFi.status()==WL_CONNECTED?WiFi.localIP().toString():WiFi.softAPIP().toString())+"/";}
// ESP32 Arduino core provides the Espressif QR encoder through qrcode.h.
// This avoids the header-name collision with the separate Ricmoo QRCode library.
void drawQRModules(esp_qrcode_handle_t qr) {
  const int qrSize=esp_qrcode_get_size(qr);
  const int quiet=4;
  const int module=(qrSize+2*quiet<=45)?3:2;
  const int side=(qrSize+2*quiet)*module;
  const int x0=18+(140-side)/2;
  const int y0=62+(144-side)/2;
  tft.fillRect(x0,y0,side,side,WHITE);
  for(int y=0;y<qrSize;y++)
    for(int x=0;x<qrSize;x++)
      if(esp_qrcode_get_module(qr,x,y))
        tft.fillRect(x0+(x+quiet)*module,y0+(y+quiet)*module,module,module,0x0000);
}
void drawQR(const String& url) {
  esp_qrcode_config_t config={};
  config.display_func=drawQRModules;
  config.max_qrcode_version=5;
  config.qrcode_ecc_level=ESP_QRCODE_ECC_LOW;
  if(esp_qrcode_generate(&config,url.c_str())!=ESP_OK)
    centerAt("QR ERROR",88,131,1,RED);
}
void drawWiFi() {
  tft.fillScreen(BG);header("NETWORK / CONNECT");
  panel(10,50,155,166);
  panel(173,50,137,166);
  labelCaps("SCAN FOR DASHBOARD",23,60);
  drawQR(currentURL());
  const bool connected=WiFi.status()==WL_CONNECTED;
  textAt(connected?"ROUTER ONLINE":"SETUP AP ACTIVE",181,62,1,connected?GREEN:YELLOW);
  labelCaps("DEVICE IP",181,81);
  textAt(connected?staIP():WiFi.softAPIP().toString(),181,94,1,TEXT);
  labelCaps("SETUP WI-FI",181,116);
  textAt(apSSID,181,129,1,CYAN);
  labelCaps("AP PASSWORD",181,151);
  textAt(apPassword.isEmpty()?"NOT SET":apPassword,181,163,1,TEXT);
  labelCaps("CONTROL KEY",181,185);
  // Long key is intentionally clipped to the card width on small displays.
  textAt(adminKey.isEmpty()?"NOT SET":adminKey,181,198,1,CYAN);
  footer("JOIN NETWORK BEFORE SCANNING QR");
}
void drawPage(){deselectSPI();if(currentPage==PAGE_HOME)drawHome();else if(currentPage==PAGE_CLOCK)drawClock();else if(currentPage==PAGE_WIFI)drawWiFi();else drawTimeDate();pageNeedsDraw=false;}
void changePage(int direction){int p=((int)currentPage+direction+4)%4;currentPage=(Page)p;pageNeedsDraw=true;touching=false;}
bool readTouch(int&sx,int&sy){digitalWrite(TFT_CS,HIGH);digitalWrite(SD_CS,HIGH);if(!touch.touched()){digitalWrite(TOUCH_CS,HIGH);return false;}TS_Point p=touch.getPoint();digitalWrite(TOUCH_CS,HIGH);int a=TOUCH_SWAP_XY?p.y:p.x,b=TOUCH_SWAP_XY?p.x:p.y;sx=map(a,TOUCH_X_MIN,TOUCH_X_MAX,0,TFT_WIDTH-1);sy=map(b,TOUCH_Y_MIN,TOUCH_Y_MAX,0,TFT_HEIGHT-1);if(TOUCH_INVERT_X)sx=TFT_WIDTH-1-sx;if(TOUCH_INVERT_Y)sy=TFT_HEIGHT-1-sy;sx=constrain(sx,0,TFT_WIDTH-1);sy=constrain(sy,0,TFT_HEIGHT-1);return true;}
void checkSwipe(){int x,y;unsigned long now=millis();if(readTouch(x,y)){if(!touching){touching=true;touchStartX=x;touchStartY=y;touchStartMs=now;}touchLastX=x;touchLastY=y;touchLastSeenMs=now;return;}if(touching&&now-touchLastSeenMs>TOUCH_RELEASE_MS){touching=false;int dx=touchLastX-touchStartX,dy=touchLastY-touchStartY;if(touchLastSeenMs-touchStartMs<=SWIPE_MAX_MS&&abs(dx)>=SWIPE_MIN_PX&&abs(dx)>abs(dy)*2)changePage(dx<0?1:-1);}}
void setSystem(bool enabled){systemOn=enabled;fanUpdate();ledUpdate();buzzerUpdate();if(!enabled){digitalWrite(BUZZER_PIN,LOW);beepState=false;deselectSPI();tft.fillScreen(BG);centerAt("AIRWATCH",160,88,3,CYAN);centerAt("MONITOR PAUSED",160,137,2,GREY);centerAt("PRESS SYSTEM BUTTON TO RESUME",160,191,1,TEXT);}else pageNeedsDraw=true;}
void checkButtons(){unsigned long now=millis();bool state=digitalRead(BUTTON_PIN);if(state!=lastButtonState&&now-lastButtonChange>DEBOUNCE_MS){lastButtonState=state;lastButtonChange=now;if(state==LOW)setSystem(!systemOn);}state=digitalRead(MUTE_PIN);if(state!=lastMuteState&&now-lastMuteChange>DEBOUNCE_MS){lastMuteState=state;lastMuteChange=now;if(state==LOW){soundEnabled=!soundEnabled;if(!soundEnabled){digitalWrite(BUZZER_PIN,LOW);beepState=false;}pageNeedsDraw=true;}}}

// Very simple fixed-shape JSON parsing for POST bodies. No external ArduinoJson dependency.
String getJsonString(const String&body,const char*name){
  String needle=String('"')+name+'"';int i=body.indexOf(needle);
  if(i<0)return "";
  i=body.indexOf(':',i+needle.length());if(i<0)return "";
  i++;while(i<(int)body.length()&&isspace((unsigned char)body[i]))i++;
  if(i>=(int)body.length())return "";
  if(body[i]!='"'){
    int end=i;while(end<(int)body.length()&&body[end]!=','&&body[end]!='}'&&!isspace((unsigned char)body[end]))end++;
    return body.substring(i,end);
  }
  String value="";i++;
  for(;i<(int)body.length();i++){
    char c=body[i];if(c=='"')return value;
    if(c=='\\'){
      if(++i>=(int)body.length())return "";
      c=body[i];
      if(c=='n')c='\n';else if(c=='r')c='\r';else if(c=='t')c='\t';
      else if(c!='"'&&c!='\\'&&c!='/')return "";
    }
    value+=c;
  }
  return "";
}
void noCache(){server.sendHeader("Cache-Control","no-store");server.sendHeader("X-Content-Type-Options","nosniff");}
void sendError(int code,const String&msg){noCache();server.send(code,"application/json",String("{\"error\":\"")+msg+"\"}");}
bool authenticated(){String incoming=server.header("X-AirWatch-Key");if(!setupRequired&&!adminKey.isEmpty()&&incoming.length()==adminKey.length()&&incoming==adminKey)return true;sendError(403,setupRequired?"Complete device setup first":"Incorrect device access key");return false;}
String jsonEscape(const String& input) {
  String result;result.reserve(input.length()+8);
  for(size_t i=0;i<input.length();i++) {
    unsigned char c=(unsigned char)input[i];
    if(c=='"'||c=='\\'){result+='\\';result+=(char)c;}
    else if(c=='\n')result+="\\n";
    else if(c=='\r')result+="\\r";
    else if(c=='\t')result+="\\t";
    else if(c<0x20)result+=' ';
    else result+=(char)c;
  }
  return result;
}
void handleStatus(){noCache();String out="{";out+="\"setupRequired\":"+String(setupRequired?"true":"false");out+=",\"valid\":"+String(valid()?"true":"false");out+=",\"co2\":"+String(valid()?co2ppm:0);out+=",\"temperature\":"+String(valid()?temperatureC:0,1);out+=",\"humidity\":"+String(valid()?humidityRH:0,1);out+=",\"quality\":\""+(valid()?qualityName(co2ppm):"WAITING")+"\"";out+=",\"displayTheme\":\""+displayTheme+"\"";out+=",\"fanOn\":"+String(fanOn?"true":"false");out+=",\"fanMode\":\""+String(fanModeName())+"\"";out+=",\"muted\":"+String(soundEnabled?"false":"true");out+=",\"alarmActive\":"+String(buzzerActive?"true":"false");out+=",\"systemOn\":"+String(systemOn?"true":"false");out+=",\"uptimeSeconds\":"+String((unsigned long)(uptimeMs64/1000ULL));out+=",\"lastReadingUptime\":"+String((unsigned long)latestSampleMillis);uint32_t stamp=0;if(historySize)stamp=history[(historyHead+HISTORY_CAP-1)%HISTORY_CAP].epoch;out+=",\"lastReadingEpoch\":"+String(stamp);out+=",\"wifi\":{\"connected\":"+String(WiFi.status()==WL_CONNECTED?"true":"false");out+=",\"ssid\":\""+jsonEscape(WiFi.status()==WL_CONNECTED?WiFi.SSID():String("-"))+"\"";out+=",\"ip\":\""+staIP()+"\"";out+=",\"apSSID\":\""+apSSID+"\"";out+=",\"apIP\":\""+WiFi.softAPIP().toString()+"\"}}";server.send(200,"application/json",out);}
void handleHistory(){noCache();server.setContentLength(CONTENT_LENGTH_UNKNOWN);server.send(200,"application/json","");server.sendContent("{\"samples\":[");for(size_t i=0;i<historySize;i++){const Sample&s=history[(historyHead+HISTORY_CAP-historySize+i)%HISTORY_CAP];String row=(i?",":"");row+="{\"uptime\":"+String(s.uptimeSec)+",\"epoch\":"+String(s.epoch)+",\"co2\":"+String(s.ppm)+",\"temp\":"+String(s.temp10/10.0f,1)+",\"hum\":"+String(s.rh10/10.0f,1)+"}";server.sendContent(row);}server.sendContent("]}");server.sendContent("");}
void handleControl(){
  if(!authenticated())return;
  String body=server.arg("plain");
  if(body.length()>512){sendError(413,"Command too large");return;}
  String fm=getJsonString(body,"fanMode");
  String mute=getJsonString(body,"muted");
  String theme=getJsonString(body,"displayTheme");
  if(fm.isEmpty() && mute.isEmpty() && theme.isEmpty()){sendError(400,"No supported control provided");return;}
  if(!fm.isEmpty() && fm!="auto" && fm!="on" && fm!="off"){
    sendError(400,"Invalid fan mode");return;
  }
  if(!mute.isEmpty() && mute!="true" && mute!="false"){
    sendError(400,"Invalid mute value");return;
  }
  if(!theme.isEmpty() && theme!="light" && theme!="dark"){
    sendError(400,"Invalid display theme");return;
  }
  // Apply only after every supplied field is valid.
  if(fm=="auto")fanMode=FAN_AUTO;
  else if(fm=="on")fanMode=FAN_FORCE_ON;
  else if(fm=="off")fanMode=FAN_FORCE_OFF;
  if(mute=="true")soundEnabled=false;
  else if(mute=="false")soundEnabled=true;
  if(!theme.isEmpty()){
    applyDisplayTheme(theme);
    prefs.putString("theme",displayTheme);
  }
  fanUpdate();
  if(!soundEnabled){digitalWrite(BUZZER_PIN,LOW);beepState=false;}
  pageNeedsDraw=true;
  noCache();server.send(200,"application/json","{\"ok\":true}");
}
void connectSTA(){if(staSSID.isEmpty())return;lastWifiAttempt=millis();WiFi.begin(staSSID.c_str(),staPassword.c_str());Serial.println("[WIFI] Connecting to saved network...");}
void handleSetup(){if(!setupRequired){sendError(409,"Device setup is already complete");return;}String body=server.arg("plain");String key=getJsonString(body,"accessKey"),pass=getJsonString(body,"apPassword");if(key.length()<12||key.length()>64||pass.length()<8||pass.length()>63){sendError(400,"Access key must be 12-64 characters and AP password 8-63 characters");return;}adminKey=key;apPassword=pass;prefs.putString("admin",adminKey);prefs.putString("apPass",apPassword);setupRequired=false;noCache();server.send(200,"application/json","{\"ok\":true}");delay(300);WiFi.softAPdisconnect(false);WiFi.softAP(apSSID.c_str(),apPassword.c_str());pageNeedsDraw=true;}
void handleWiFi(){if(!authenticated())return;String body=server.arg("plain");if(body.length()>512){sendError(413,"Wi-Fi request too large");return;}String ssid=getJsonString(body,"ssid"),pass=getJsonString(body,"password");if(ssid.length()==0||ssid.length()>32||pass.length()>63){sendError(400,"Invalid SSID or password length");return;}staSSID=ssid;staPassword=pass;prefs.putString("ssid",staSSID);prefs.putString("pass",staPassword);noCache();server.send(200,"application/json","{\"ok\":true}");WiFi.disconnect(false,false);connectSTA();pageNeedsDraw=true;}
bool serveStaticFile(String path){
  if(path.isEmpty()||path=="/")path="/index.html";
  if(path.indexOf("..")>=0||path.indexOf('\\')>=0)return false;
  if(!LittleFS.exists(path))return false;
  File file=LittleFS.open(path,"r");if(!file)return false;
  String type="application/octet-stream";
  if(path.endsWith(".html"))type="text/html; charset=utf-8";
  else if(path.endsWith(".js"))type="text/javascript";
  else if(path.endsWith(".css"))type="text/css";
  else if(path.endsWith(".svg"))type="image/svg+xml";
  else if(path.endsWith(".png"))type="image/png";
  else if(path.endsWith(".ico"))type="image/x-icon";
  else if(path.endsWith(".json"))type="application/json";
  else if(path.endsWith(".woff2"))type="font/woff2";
  if(path=="/index.html")server.sendHeader("Cache-Control","no-cache");
  else server.sendHeader("Cache-Control","public, max-age=31536000, immutable");
  server.sendHeader("X-Content-Type-Options","nosniff");
  server.streamFile(file,type);file.close();return true;
}
void setupServer(){
  const char*keys[]={"X-AirWatch-Key"};server.collectHeaders(keys,1);
  server.on("/",HTTP_GET,[]{if(!serveStaticFile("/index.html"))server.send(503,"text/plain","AirWatch dashboard files are missing from LittleFS");});
  server.on("/api/setup",HTTP_POST,handleSetup);server.on("/api/status",HTTP_GET,handleStatus);server.on("/api/history",HTTP_GET,handleHistory);
  server.on("/api/control",HTTP_POST,handleControl);server.on("/api/wifi",HTTP_POST,handleWiFi);
  server.onNotFound([]{String path=server.uri();if(path.startsWith("/api/")){sendError(404,"API endpoint not found");return;}if(!serveStaticFile(path))server.send(404,"text/plain","File not found");});
  server.begin();
}
void initWiFi(){prefs.begin("airwatch",false);applyDisplayTheme(prefs.getString("theme","dark"));uint64_t mac=ESP.getEfuseMac();char suffix[9];snprintf(suffix,sizeof(suffix),"%08lX",(unsigned long)(mac&0xffffffffULL));apSSID="AirWatch-"+String(suffix).substring(4);apPassword=prefs.getString("apPass","");adminKey=prefs.getString("admin","");setupRequired=apPassword.isEmpty()||adminKey.isEmpty();staSSID=prefs.getString("ssid","");staPassword=prefs.getString("pass","");WiFi.mode(WIFI_AP_STA);WiFi.setHostname(HOSTNAME);WiFi.softAP(apSSID.c_str(),apPassword.isEmpty()?nullptr:apPassword.c_str());if(!staSSID.isEmpty())connectSTA();setupServer();configTime(8*3600,0,"pool.ntp.org","time.google.com");Serial.println("[WIFI] AP SSID: "+apSSID);Serial.println("[WIFI] AP IP: "+WiFi.softAPIP().toString());Serial.println("[WIFI] View TFT Page 3 for password and control key");}
void maintainWiFi(){if(!staSSID.isEmpty()&&WiFi.status()!=WL_CONNECTED&&millis()-lastWifiAttempt>20000UL)connectSTA();String sig=String(WiFi.status()==WL_CONNECTED?"1":"0")+staIP();if(sig!=lastWiFiSignature){lastWiFiSignature=sig;if(currentPage==PAGE_WIFI)pageNeedsDraw=true;Serial.println("[WIFI] Dashboard: "+currentURL());}}

void setup() {
  Serial.begin(115200);
  applyDisplayTheme("dark");
  delay(300);
  previousMillis32 = millis();

  pinMode(FAN_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(FAN_PIN, LOW);
  digitalWrite(BUZZER_PIN, LOW);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(MUTE_PIN, INPUT_PULLUP);

  // Hold the physical mute button while powering on for a silent boot.
  startupSoundAllowed = (digitalRead(MUTE_PIN) != LOW);

  pinMode(TFT_CS, OUTPUT);
  pinMode(TOUCH_CS, OUTPUT);
  pinMode(SD_CS, OUTPUT);
  deselectSPI();
  SPI.begin(SPI_SCK, SPI_MISO, SPI_MOSI);

  tft.begin();
  tft.setRotation(1);  // Landscape: 320 x 240
  startup();
  startupProgress(12, "DISPLAY READY", 1);

  touch.begin();
  startupProgress(28, "TOUCH READY");

  pixels.begin();
  pixels.setBrightness(80);
  pixels.clear();
  pixels.show();
  startupProgress(43, "STATUS LIGHT READY", 1);

  Wire.begin(PIN_SDA, PIN_SCL);
  Wire.setClock(100000);
  startupProgress(57, "SENSOR BUS READY");
  scd4x.begin(Wire, SCD41_I2C_ADDR_62);
  scd4x.stopPeriodicMeasurement();
  delay(500);
  sensorOK = (scd4x.startPeriodicMeasurement() == 0);
  Serial.println(sensorOK ? "[SENSOR] READY" : "[SENSOR] START FAILED");
  startupProgress(75, sensorOK ? "SCD41 ONLINE" : "CHECK SCD41 WIRING", sensorOK ? 1 : 0);

  if (LittleFS.begin(false)) {
    Serial.printf("[FS] LittleFS using %u of %u bytes\n", LittleFS.usedBytes(), LittleFS.totalBytes());
  } else {
    Serial.println("[FS] LittleFS mount failed; upload dist/ to the filesystem partition");
  }
  startupProgress(87, "STORAGE READY");

  initWiFi();
  startupProgress(100, "AIRWATCH READY", 2);
  delay(220);
  digitalWrite(BUZZER_PIN, LOW);
  pageNeedsDraw = true;
  Serial.println("[SYSTEM] AirWatch v3.3 modern landscape + startup sound ready");
}

void loop(){uint32_t now=millis();uptimeMs64+=(uint32_t)(now-previousMillis32);previousMillis32=now;server.handleClient();maintainWiFi();checkButtons();if(systemOn){checkSwipe();if(now-lastSensorPoll>=2000UL){lastSensorPoll=now;readSensor();}if(pageNeedsDraw)drawPage();if(now-lastDisplayUpdate>=1000UL){lastDisplayUpdate=now;if(currentPage==PAGE_HOME)updateHome();else if(currentPage==PAGE_CLOCK)updateClock();else if(currentPage==PAGE_TIME)updateTimeDate();}}handleBuzzer();delay(2);}
