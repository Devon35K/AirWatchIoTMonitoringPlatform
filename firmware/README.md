# AirWatch ESP32-S3 firmware

`AirWatch.ino` now contains the sketch supplied in the conversation, extended with the local HTTP API, AP + STA Wi-Fi, bounded RAM history, LittleFS dashboard serving, NVS credentials, stale-sensor handling, and a third TFT network/credential page. The physical wiring is still **unverified**; GPIO values are the values in the supplied sketch, not electrical certification.

## Hardware profile gate

The supplied sketch maps SCD41 SDA/SCL 4/5; fan/buzzer 6/7; TFT CS/DC/RST 10/14/21; SPI MOSI/SCK/MISO 11/12/13; touch/SD CS 16/17; NeoPixel 18; buttons 1/2. The alternative older TFT mapping is different. Verify actual wiring against the specific board and modules before power-up. In particular, verify battery protection, the ESP32 5V input, driver current ratings, flyback diode, and display/touch logic levels.

## Reproducible compile/upload

### Target Arduino IDE profile

- Board: **ESP32S3 Dev Module** (from the supplied sketch; verify exact module/board)
- Flash: 16 MB
- PSRAM: OPI PSRAM (for N16R8)
- Partition: choose a scheme with app space and at least 1 MB LittleFS; exact menu name depends on installed ESP32 core
- USB CDC On Boot: choose to match the selected upload/serial method
- Serial monitor: 115200 baud

The environment had no Arduino CLI, so this source has not been compiled here. Exact dependency targets are recorded in [`libraries.txt`](libraries.txt). Install with Arduino CLI:

```powershell
arduino-cli core install esp32:esp32@3.3.2
arduino-cli lib install "Adafruit GFX Library@1.13.0"
arduino-cli lib install "Adafruit BusIO@1.17.4"
arduino-cli lib install "Adafruit ILI9341@1.7.0"
arduino-cli lib install "XPT2046_Touchscreen@1.4"
arduino-cli lib install "Adafruit NeoPixel@1.15.5"
arduino-cli lib install "Sensirion Core@0.7.3"
arduino-cli lib install "Sensirion I2C SCD4x@1.1.0"
arduino-cli lib install "ArduinoJson@7.4.2"
```

Compile for the supplied sketch's board profile (adjust the serial upload step to the actual port):

```powershell
arduino-cli compile --fqbn "esp32:esp32:esp32s3:FlashSize=16M,PSRAM=opi" firmware
arduino-cli upload -p COMx --fqbn "esp32:esp32:esp32s3:FlashSize=16M,PSRAM=opi" firmware
arduino-cli monitor -p COMx -c baudrate=115200
```

These are pinned dependency targets, not a verified compile matrix. Confirm the installed core offers these exact FQBN menu option names. `LittleFS.begin(false)` deliberately does not format on mount failure. Choose a partition layout with enough application space and at least 1 MB for LittleFS; the exact menu option varies by core. Upload the contents of root `dist/` to LittleFS using a filesystem uploader compatible with the selected core.

### Local API and credential setup

The board starts a protected `AirWatch-<MAC suffix>` setup AP and keeps the AP available if the router is absent. First-boot AP password and API key are generated into NVS. On the TFT, swipe to **LOCAL ACCESS**, then hold the system button for three seconds to reveal credentials for 30 seconds. Do not post those credentials or send them over public HTTP. The API key is sent in `X-AirWatch-Key`; mutating endpoints require it.

STA credentials are saved in NVS through the authenticated `/api/wifi` request. History is RAM-only, capped at 60 samples, and clears on reboot. Epoch remains zero until a clock is added; uptime values are seconds except `lastReadingUptime`, which is milliseconds for compatibility with the dashboard's age calculation.

The local control indicators retain the supplied defaults: automatic fan on at 30°C and off at 28°C; CO₂ buzzer on at 2000 ppm and clear at or below 1800 ppm. These are project ventilation indicators, not universal exposure or medical limits. Muting silences the buzzer but leaves the visible CO₂ and LED indicators active.

The dashboard's top-bar theme button updates both the website and TFT through authenticated `POST /api/control` with `{"displayTheme":"dark"}` or `{"displayTheme":"light"}`. The device reports the current theme in `/api/status` and saves it in NVS, so it remains selected after reboot.

### Local dashboard

From the project root, build with `npm run build`, then upload the files inside `dist/` to the device's LittleFS root. To run the Vite dashboard from a computer on the device AP/LAN, set `AIRWATCH_DEVICE_URL=http://192.168.4.1` before `npm run dev`; Vite proxies `/api/*` to the device.

### Render hosting

`render.yaml` deploys the React/Vite frontend as a Render Static Site. It hosts the website over HTTPS but does **not** provide remote device connectivity. The ESP32 remains reachable on its local AP/LAN. Do not port-forward it or expose its HTTP API to the internet. Online telemetry/control requires a separately implemented authenticated HTTPS gateway or MQTT backend; none is included here.

For current dashboard build and contract checks, see the root README and `../Docs/API.md`.
