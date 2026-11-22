# AirWatch ESP32-S3 firmware

The firmware uses **Bluetooth Low Energy only** for phone communication. It does not start Wi-Fi, host an HTTP API, or serve the dashboard from LittleFS. The Android APK scans for `AirWatch-XXXX`, connects, subscribes to JSON status notifications, writes fan/mute/theme commands, and synchronizes the device clock over BLE. Firmware and physical wiring have not yet been verified on hardware.

## BLE protocol

| Purpose | UUID | Properties |
|---|---|---|
| AirWatch service | `4fafc201-1fb5-459e-8fcc-c5c9c331914b` | Advertised |
| Status | `beb5483e-36e1-4688-b7f5-ea07361b26a8` | Read, notify |
| Control | `e6d2c0aa-0a6f-4f42-9f6d-4a3b7b4a1002` | Write |

The status characteristic sends the app's documented JSON status shape every two seconds, with new readings sampled every two seconds. Notifications use short indexed fragments so the full JSON transfers even when the phone negotiates the default BLE MTU. The Android plugin reassembles the fragments before passing JSON to the app. History is collected by the app from received live readings; it is not stored on the phone after app data is cleared. Control writes accept `{"fanMode":"auto"}`, `{"muted":true}`, `{"displayTheme":"dark"}`, and `{"unixTime":<UTC epoch seconds>}` (plus supported values). The APK syncs the phone time after connecting; the TFT displays Philippine Standard Time (UTC+8). Theme changes persist in NVS. Bluetooth commands do not use an access key or pairing; keep the device in a trusted, nearby environment.

The JSON retains an empty `wifi` object for compatibility with the current app status contract. All values in it are empty/false. `lastReadingEpoch` is zero until the phone sets the device clock over BLE.

The supplied JPEG logo is embedded in the sketch as a compact 64×64 monochrome bitmap and drawn on the TFT header and startup screen. No JPEG decoder or filesystem asset is required.

## Hardware profile gate

The sketch maps SCD41 SDA/SCL 4/5; fan/buzzer 6/7; TFT CS/DC/RST 10/14/21; SPI MOSI/SCK/MISO 11/12/13; touch/SD CS 16/17; NeoPixel 18; buttons 1/2. Verify actual wiring against the specific board and modules before power-up. Verify battery protection, ESP32 input voltage, driver current ratings, flyback diode, and display/touch logic levels.

## Compile and upload

Target **ESP32S3 Dev Module** (verify the exact board), 16 MB flash, OPI PSRAM for N16R8, and USB CDC settings matching the upload method. No LittleFS partition is required. Serial monitor: 115200 baud.

The environment had no Arduino CLI, so this source has not been compiled here. Dependency targets are listed in [`libraries.txt`](libraries.txt). Install the ESP32 core and libraries, then compile/upload (adjust `COMx`):

```powershell
arduino-cli core install esp32:esp32@3.3.2
arduino-cli lib install "Adafruit GFX Library@1.13.0"
arduino-cli lib install "Adafruit BusIO@1.17.4"
arduino-cli lib install "Adafruit ILI9341@1.7.0"
arduino-cli lib install "XPT2046_Touchscreen@1.4"
arduino-cli lib install "Adafruit NeoPixel@1.15.5"
arduino-cli lib install "Sensirion Core@0.7.3"
arduino-cli lib install "Sensirion I2C SCD4x@1.1.0"
arduino-cli compile --fqbn "esp32:esp32:esp32s3:FlashSize=16M,PSRAM=opi" firmware
arduino-cli upload -p COMx --fqbn "esp32:esp32:esp32s3:FlashSize=16M,PSRAM=opi" firmware
arduino-cli monitor -p COMx -c baudrate=115200
```

Confirm the installed ESP32 core offers the specified board-menu options. This is a dependency target, not a verified compile matrix.

The local control indicators retain their defaults: automatic fan on at 30°C and off at 28°C; CO₂ buzzer on at 2000 ppm and clear at or below 1800 ppm. These are project ventilation indicators, not universal exposure or medical limits. Muting silences the buzzer but leaves visible CO₂ and LED indicators active.

Build the Android APK from the project root using `npm run build:apk`; install it on a BLE-capable Android phone, grant requested Bluetooth permissions, enable Bluetooth, and open the app. Use the TFT Bluetooth page for scan/connect guidance. No router, AP, internet connection, or LittleFS upload is part of device communication.

For the complete BLE contract and hardware verification steps, see [`../Docs/API.md`](../Docs/API.md) and [`../Docs/TEST_PLAN.md`](../Docs/TEST_PLAN.md).
