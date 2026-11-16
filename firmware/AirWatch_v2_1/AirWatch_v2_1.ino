/*
 AirWatch v2.1 MERGED — based on original AirWatch uploaded sketch
 Original GPIO assignments and original device functions retained.
 Added: Wi-Fi (AP + STA), QR Page 3, embedded local website,
 live history graphs, timestamps, and authenticated remote controls.
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

#define BG 0xF7DF       // Website background #F5F8FB
#define PANEL 0xFFFF    // Website surface #FFFFFF
#define PANEL2 0xE77E   // Website border #E6EDF3
#define CYAN 0x0B91     // Deep website cyan, legible on light surfaces
#define GREEN 0x262B    // Website green #22C55E
#define YELLOW 0xF4E1   // Website amber #F59E0B
#define ORANGE 0xFB82
#define RED 0xEA28      // Website red #EF4444
#define WHITE 0xFFFF
#define NAVY 0x1148     // Website text #102A43
#define GREY 0x6BD1     // Website muted text #687B8D
#define DARKGREY 0x532E

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

String apSSID,apPassword,adminKey,staSSID,staPassword;
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

void textAt(const String &s,int x,int y,uint8_t sz,uint16_t color){tft.setTextSize(sz);tft.setTextColor(color);tft.setCursor(x,y);tft.print(s);}
void centerAt(const String&s,int x,int y,uint8_t sz,uint16_t color){textAt(s,x-int(s.length())*3*sz,y,sz,color);}
void panel(int x,int y,int w,int h){tft.fillRoundRect(x,y,w,h,10,PANEL);tft.drawRoundRect(x,y,w,h,10,PANEL2);}
void header(const char*s){tft.fillRect(0,0,TFT_WIDTH,46,BG);textAt("AIRWATCH",12,6,2,CYAN);textAt(s,12,27,1,GREY);for(uint8_t i=0;i<4;i++)tft.fillCircle(180+i*12,14,2,currentPage==i?CYAN:PANEL2);tft.drawFastHLine(10,46,TFT_WIDTH-20,PANEL2);}
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

void startup(){tft.fillScreen(BG);panel(42,48,236,144);centerAt("AIRWATCH",160,76,3,CYAN);centerAt("SMART ENVIRONMENT",160,120,1,NAVY);centerAt("INITIALIZING...",160,157,1,GREY);}
void drawHome(){tft.fillScreen(BG);header("LIVE MONITOR");panel(12,57,150,158);panel(171,57,137,75);panel(171,140,137,75);textAt("CO2 CONCENTRATION",22,68,1,GREY);textAt("TEMPERATURE",182,68,1,GREY);textAt("HUMIDITY",182,151,1,GREY);textAt("FAN",20,222,1,GREY);textAt("LED",123,222,1,GREY);textAt("BUZZER",226,222,1,GREY);}
void updateHome(){
  tft.fillRect(20,91,134,74,PANEL);
  if(valid()){textAt(String(co2ppm),24,99,4,qualityColor(co2ppm));textAt(qualityName(co2ppm),24,145,1,qualityColor(co2ppm));}
  else{textAt("----",24,99,4,GREY);textAt(sensorOK?"WAITING":"NO SENSOR",24,145,1,GREY);}
  tft.fillRect(181,91,117,30,PANEL);textAt(valid()?String(temperatureC,1)+" C":"--.-",184,96,2,NAVY);
  tft.fillRect(181,174,117,30,PANEL);textAt(valid()?String(humidityRH,1)+"%":"--.-",184,179,2,NAVY);
  tft.fillRect(12,216,296,22,BG);textAt(fanOn?"FAN ON":"FAN OFF",20,222,1,fanOn?GREEN:GREY);textAt(valid()?(co2ppm>=2000?"RED":co2ppm>=800?"AMBER":"GREEN"):"--",123,222,1,valid()?qualityColor(co2ppm):GREY);textAt(!soundEnabled?"MUTED":buzzerActive?"ALARM":"IDLE",226,222,1,buzzerActive&&soundEnabled?RED:GREY);
}
void drawClock(){tft.fillScreen(BG);header("DEVICE UPTIME");panel(42,75,236,115);centerAt("SINCE POWER ON",160,91,1,GREY);}
void updateClock(){uint64_t secs=uptimeMs64/1000ULL;char buf[32];snprintf(buf,sizeof(buf),"%02llu:%02llu:%02llu",(unsigned long long)(secs/3600ULL),(unsigned long long)((secs/60ULL)%60ULL),(unsigned long long)(secs%60ULL));tft.fillRect(52,120,216,52,PANEL);centerAt(buf,160,132,3,CYAN);}
void drawTimeDate(){tft.fillScreen(BG);header("TIME & DATE");panel(32,70,256,130);centerAt("PHILIPPINE TIME",160,83,1,GREY);}
void updateTimeDate(){
  time_t now=time(nullptr);
  tft.fillRect(42,108,236,44,PANEL);
  tft.fillRect(42,159,236,28,PANEL);
  if(now<1700000000){centerAt("SYNCING TIME",160,119,2,YELLOW);centerAt("Connect to Wi-Fi",160,165,1,GREY);return;}
  struct tm localTime;
  localtime_r(&now,&localTime);
  char timeText[20],dateText[32];
  strftime(timeText,sizeof(timeText),"%I:%M:%S %p",&localTime);
  strftime(dateText,sizeof(dateText),"%A, %b %d, %Y",&localTime);
  centerAt(String(timeText),160,119,2,NAVY);
  centerAt(String(dateText),160,165,1,NAVY);
}
String staIP(){return WiFi.status()==WL_CONNECTED?WiFi.localIP().toString():"";}
String currentURL(){return String("http://")+(WiFi.status()==WL_CONNECTED?WiFi.localIP().toString():WiFi.softAPIP().toString())+"/";}
// ESP32 Arduino core provides the Espressif QR encoder through qrcode.h.
// This avoids the header-name collision with the separate Ricmoo QRCode library.
void drawQRModules(esp_qrcode_handle_t qr) {
  const int qrSize = esp_qrcode_get_size(qr);
  const int module = 2;
  const int quiet = 4;
  const int side = (qrSize + quiet * 2) * module;
  const int x0 = 14;
  const int y0 = 59;

  tft.fillRect(x0, y0, side, side, WHITE);
  tft.drawRoundRect(x0 - 1, y0 - 1, side + 2, side + 2, 3, PANEL2);
  for (int y = 0; y < qrSize; y++) {
    for (int x = 0; x < qrSize; x++) {
      if (esp_qrcode_get_module(qr, x, y)) {
        tft.fillRect(x0 + (x + quiet) * module, y0 + (y + quiet) * module, module, module, 0x0000);
      }
    }
  }
}

void drawQR(const String& url) {
  esp_qrcode_config_t config = {};
  config.display_func = drawQRModules;
  config.max_qrcode_version = 5;
  config.qrcode_ecc_level = ESP_QRCODE_ECC_LOW;
  const esp_err_t result = esp_qrcode_generate(&config, url.c_str());
  if (result != ESP_OK) centerAt("QR NOT AVAILABLE", 120, 151, 1, RED);
}
void drawWiFi(){tft.fillScreen(BG);header("WI-FI & QR");bool sta=WiFi.status()==WL_CONNECTED;String url=currentURL();drawQR(url);textAt("SCAN TO OPEN",25,222,1,CYAN);textAt(sta?"CONNECTED":"SETUP MODE",164,61,1,sta?GREEN:YELLOW);textAt(sta?"ROUTER IP:":"AP IP:",164,82,1,GREY);textAt(sta?staIP():WiFi.softAPIP().toString(),164,97,1,NAVY);textAt("SETUP NETWORK",164,122,1,GREY);textAt(apSSID,164,137,1,NAVY);textAt("PASSWORD",164,159,1,GREY);textAt(apPassword,164,174,1,NAVY);textAt("ACCESS KEY",164,196,1,GREY);textAt(adminKey,164,211,1,NAVY);}
void drawPage(){deselectSPI();if(currentPage==PAGE_HOME)drawHome();else if(currentPage==PAGE_CLOCK)drawClock();else if(currentPage==PAGE_WIFI)drawWiFi();else drawTimeDate();pageNeedsDraw=false;}
void changePage(int direction){int p=((int)currentPage+direction+4)%4;currentPage=(Page)p;pageNeedsDraw=true;touching=false;}
bool readTouch(int&sx,int&sy){digitalWrite(TFT_CS,HIGH);digitalWrite(SD_CS,HIGH);if(!touch.touched()){digitalWrite(TOUCH_CS,HIGH);return false;}TS_Point p=touch.getPoint();digitalWrite(TOUCH_CS,HIGH);int a=TOUCH_SWAP_XY?p.y:p.x,b=TOUCH_SWAP_XY?p.x:p.y;sx=map(a,TOUCH_X_MIN,TOUCH_X_MAX,0,TFT_WIDTH-1);sy=map(b,TOUCH_Y_MIN,TOUCH_Y_MAX,0,TFT_HEIGHT-1);if(TOUCH_INVERT_X)sx=TFT_WIDTH-1-sx;if(TOUCH_INVERT_Y)sy=TFT_HEIGHT-1-sy;sx=constrain(sx,0,TFT_WIDTH-1);sy=constrain(sy,0,TFT_HEIGHT-1);return true;}
void checkSwipe(){int x,y;unsigned long now=millis();if(readTouch(x,y)){if(!touching){touching=true;touchStartX=x;touchStartY=y;touchStartMs=now;}touchLastX=x;touchLastY=y;touchLastSeenMs=now;return;}if(touching&&now-touchLastSeenMs>TOUCH_RELEASE_MS){touching=false;int dx=touchLastX-touchStartX,dy=touchLastY-touchStartY;if(touchLastSeenMs-touchStartMs<=SWIPE_MAX_MS&&abs(dx)>=SWIPE_MIN_PX&&abs(dx)>abs(dy)*2)changePage(dx<0?1:-1);}}
void setSystem(bool enabled){systemOn=enabled;fanUpdate();ledUpdate();buzzerUpdate();if(!enabled){digitalWrite(BUZZER_PIN,LOW);beepState=false;deselectSPI();tft.fillScreen(BG);centerAt("AIRWATCH",160,90,3,CYAN);centerAt("SYSTEM OFF",160,140,2,GREY);}else pageNeedsDraw=true;}
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
bool authenticated(){String incoming=server.header("X-AirWatch-Key");if(incoming.length()==adminKey.length()&&incoming==adminKey)return true;sendError(403,"Incorrect device access key");return false;}
void handleStatus(){noCache();String out="{";out+="\"valid\":"+String(valid()?"true":"false");out+=",\"co2\":"+String(valid()?co2ppm:0);out+=",\"temperature\":"+String(valid()?temperatureC:0,1);out+=",\"humidity\":"+String(valid()?humidityRH:0,1);out+=",\"quality\":\""+(valid()?qualityName(co2ppm):"WAITING")+"\"";out+=",\"fanOn\":"+String(fanOn?"true":"false");out+=",\"fanMode\":\""+String(fanModeName())+"\"";out+=",\"muted\":"+String(soundEnabled?"false":"true");out+=",\"alarmActive\":"+String(buzzerActive?"true":"false");out+=",\"systemOn\":"+String(systemOn?"true":"false");out+=",\"uptimeSeconds\":"+String((unsigned long)(uptimeMs64/1000ULL));out+=",\"lastReadingUptime\":"+String((unsigned long)latestSampleMillis);uint32_t stamp=0;if(historySize)stamp=history[(historyHead+HISTORY_CAP-1)%HISTORY_CAP].epoch;out+=",\"lastReadingEpoch\":"+String(stamp);out+=",\"wifi\":{\"connected\":"+String(WiFi.status()==WL_CONNECTED?"true":"false");out+=",\"ssid\":\""+String(WiFi.status()==WL_CONNECTED?WiFi.SSID():"-")+"\"";out+=",\"ip\":\""+staIP()+"\"";out+=",\"apSSID\":\""+apSSID+"\"";out+=",\"apIP\":\""+WiFi.softAPIP().toString()+"\"}}";server.send(200,"application/json",out);}
void handleHistory(){noCache();server.setContentLength(CONTENT_LENGTH_UNKNOWN);server.send(200,"application/json","");server.sendContent("{\"samples\":[");for(size_t i=0;i<historySize;i++){const Sample&s=history[(historyHead+HISTORY_CAP-historySize+i)%HISTORY_CAP];String row=(i?",":"");row+="{\"uptime\":"+String(s.uptimeSec)+",\"epoch\":"+String(s.epoch)+",\"co2\":"+String(s.ppm)+",\"temp\":"+String(s.temp10/10.0f,1)+",\"hum\":"+String(s.rh10/10.0f,1)+"}";server.sendContent(row);}server.sendContent("]}");server.sendContent("");}
void handleControl(){
  if(!authenticated())return;
  String body=server.arg("plain");
  if(body.length()>512){sendError(413,"Command too large");return;}
  String fm=getJsonString(body,"fanMode");
  String mute=getJsonString(body,"muted");
  if(fm.isEmpty() && mute.isEmpty()){sendError(400,"No supported control provided");return;}
  if(!fm.isEmpty() && fm!="auto" && fm!="on" && fm!="off"){
    sendError(400,"Invalid fan mode");return;
  }
  if(!mute.isEmpty() && mute!="true" && mute!="false"){
    sendError(400,"Invalid mute value");return;
  }
  // Apply only after every supplied field is valid.
  if(fm=="auto")fanMode=FAN_AUTO;
  else if(fm=="on")fanMode=FAN_FORCE_ON;
  else if(fm=="off")fanMode=FAN_FORCE_OFF;
  if(mute=="true")soundEnabled=false;
  else if(mute=="false")soundEnabled=true;
  fanUpdate();
  if(!soundEnabled){digitalWrite(BUZZER_PIN,LOW);beepState=false;}
  pageNeedsDraw=true;
  noCache();server.send(200,"application/json","{\"ok\":true}");
}
void connectSTA(){if(staSSID.isEmpty())return;lastWifiAttempt=millis();WiFi.begin(staSSID.c_str(),staPassword.c_str());Serial.println("[WIFI] Connecting to saved network...");}
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
  server.on("/api/status",HTTP_GET,handleStatus);server.on("/api/history",HTTP_GET,handleHistory);
  server.on("/api/control",HTTP_POST,handleControl);server.on("/api/wifi",HTTP_POST,handleWiFi);
  server.onNotFound([]{String path=server.uri();if(path.startsWith("/api/")){sendError(404,"API endpoint not found");return;}if(!serveStaticFile(path))server.send(404,"text/plain","File not found");});
  server.begin();
}
void initWiFi(){prefs.begin("airwatch",false);uint64_t mac=ESP.getEfuseMac();char suffix[9];snprintf(suffix,sizeof(suffix),"%08lX",(unsigned long)(mac&0xffffffffULL));apSSID="AirWatch-"+String(suffix).substring(4);apPassword="AW"+String(suffix)+"!";adminKey=prefs.getString("admin","");if(adminKey.length()<12){char k[17];snprintf(k,sizeof(k),"%08lX%08lX",(unsigned long)esp_random(),(unsigned long)esp_random());adminKey=k;prefs.putString("admin",adminKey);}staSSID=prefs.getString("ssid","");staPassword=prefs.getString("pass","");WiFi.mode(WIFI_AP_STA);WiFi.setHostname(HOSTNAME);WiFi.softAP(apSSID.c_str(),apPassword.c_str());if(!staSSID.isEmpty())connectSTA();setupServer();configTime(8*3600,0,"pool.ntp.org","time.google.com");Serial.println("[WIFI] AP SSID: "+apSSID);Serial.println("[WIFI] AP IP: "+WiFi.softAPIP().toString());Serial.println("[WIFI] View TFT Page 3 for password and control key");}
void maintainWiFi(){if(!staSSID.isEmpty()&&WiFi.status()!=WL_CONNECTED&&millis()-lastWifiAttempt>20000UL)connectSTA();String sig=String(WiFi.status()==WL_CONNECTED?"1":"0")+staIP();if(sig!=lastWiFiSignature){lastWiFiSignature=sig;if(currentPage==PAGE_WIFI)pageNeedsDraw=true;Serial.println("[WIFI] Dashboard: "+currentURL());}}

void setup(){Serial.begin(115200);delay(300);previousMillis32=millis();pinMode(FAN_PIN,OUTPUT);pinMode(BUZZER_PIN,OUTPUT);digitalWrite(FAN_PIN,LOW);digitalWrite(BUZZER_PIN,LOW);pinMode(BUTTON_PIN,INPUT_PULLUP);pinMode(MUTE_PIN,INPUT_PULLUP);pinMode(TFT_CS,OUTPUT);pinMode(TOUCH_CS,OUTPUT);pinMode(SD_CS,OUTPUT);deselectSPI();SPI.begin(SPI_SCK,SPI_MISO,SPI_MOSI);tft.begin();tft.setRotation(3);startup();touch.begin();pixels.begin();pixels.setBrightness(80);pixels.clear();pixels.show();Wire.begin(PIN_SDA,PIN_SCL);Wire.setClock(100000);scd4x.begin(Wire,SCD41_I2C_ADDR_62);scd4x.stopPeriodicMeasurement();delay(500);sensorOK=(scd4x.startPeriodicMeasurement()==0);Serial.println(sensorOK?"[SENSOR] READY":"[SENSOR] START FAILED");centerAt(sensorOK?"SCD41 READY":"SCD41 ERROR",160,145,1,sensorOK?GREEN:RED);if(LittleFS.begin(false)){Serial.printf("[FS] LittleFS using %u of %u bytes\n",LittleFS.usedBytes(),LittleFS.totalBytes());}else Serial.println("[FS] LittleFS mount failed; upload dist/ to the filesystem partition");initWiFi();delay(350);pageNeedsDraw=true;Serial.println("[SYSTEM] AirWatch v2 ready");}
void loop(){uint32_t now=millis();uptimeMs64+=(uint32_t)(now-previousMillis32);previousMillis32=now;server.handleClient();maintainWiFi();checkButtons();if(systemOn){checkSwipe();if(now-lastSensorPoll>=1000UL){lastSensorPoll=now;readSensor();}if(pageNeedsDraw)drawPage();if(now-lastDisplayUpdate>=1000UL){lastDisplayUpdate=now;if(currentPage==PAGE_HOME)updateHome();else if(currentPage==PAGE_CLOCK)updateClock();else if(currentPage==PAGE_TIME)updateTimeDate();}}handleBuzzer();delay(2);}
