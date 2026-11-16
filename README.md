# AirWatch IoT Monitoring Platform

React/Vite dashboard for the AirWatch ESP32-S3 firmware API.

## Development

Install the dependencies with `pnpm install`. Set `AIRWATCH_DEVICE_URL` to the device address reachable from the development computer (default `http://192.168.4.1`) and run `pnpm dev`. Vite proxies `/api/*` to the ESP32 to avoid browser CORS restrictions. The browser must have network access to the ESP32 access point or the same LAN.

Production uses relative asset URLs and `/api/*` requests, so it can be hosted at the ESP32 root or another local web server. `VITE_AIRWATCH_API_URL` may set an API base at build time when the API host is same-origin or explicitly supports CORS; leave it unset for same-origin hosting. The access key is entered by the user, held in shared in-memory state for the current tab, and sent only in the required request header. Do not put it in a Vite environment variable.

## ESP32 API contract

- `GET /api/status`
- `GET /api/history`
- `POST /api/control` with `X-AirWatch-Key` and `{"fanMode":"auto|on|off"}` or `{"muted":true|false}`
- `POST /api/wifi` with `X-AirWatch-Key` and `{"ssid":"…","password":"…"}`

History timestamps use Unix epoch seconds when supplied; otherwise the UI labels samples by device uptime. The dashboard does not synthesize sensor measurements when the API is unavailable.

## Serving the dashboard from ESP32 LittleFS

The workspace copy at `firmware/AirWatch_v2_1/AirWatch_v2_1.ino` replaces the pasted sketch’s embedded HTML response with LittleFS static-file serving and preserves its sensor, display, Wi-Fi, and authenticated `/api/*` handlers. It reports LittleFS used and total bytes at startup. Build the dashboard, then upload the contents of `dist/` to the LittleFS filesystem partition using the ESP32 Arduino LittleFS upload tool for your installed core.

The latest production build is about 340 KB uncompressed. Reserve at least 1 MB for LittleFS to allow for filesystem overhead and future assets. The N16R8’s 16 MB flash does not determine filesystem capacity by itself: choose a partition layout compatible with app and OTA needs, then verify the reported total/used bytes at boot. The sketch compiled successfully with the installed Arduino CLI for the generic ESP32-S3 Dev Module (79% of that profile app partition, 16% of RAM). It has not been flashed or hardware-tested.

The device-generated QR URL must point to the ESP32 root URL after LittleFS serving is enabled. Vite emits relative JS/CSS paths for hosting at that root. If LittleFS capacity is insufficient, serve the same `dist/` from a local computer or router and configure a same-origin reverse proxy for `/api/*`.

## Hardware and security notes

This is a trusted-local-network HTTP prototype. The access key is visible on TFT Page 3 and HTTP does not encrypt it. Do not expose the ESP32 directly to the public internet. Use an authenticated backend or gateway for remote access. The firmware changes retain the sketch’s GPIO assignments, sensor thresholds, display pages, and hardware driver stages.

Hardware validation still requires the actual ESP32-S3, SCD41, fan driver, buzzer driver, display, and network. This workspace cannot verify physical behavior.
