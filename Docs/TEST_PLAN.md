# AirWatch verification plan

The firmware now uses BLE for APK communication; Wi-Fi, HTTP, and LittleFS are not part of this device build. BLE discovery, connection, and live status transfer were verified with the attached phone on 2026-11-22. The latest firmware clock change still requires compilation/upload; other hardware tests remain unverified. “Not run” is not a pass.



| Test | Expected result | Observed result | Pass/fail | Evidence |
|---|---|---|---|---|
| Contract parser: unavailable status | `valid: false` is accepted and UI shows placeholders | Automated fixture test | Pass if test succeeds | `node --test src/services/airwatchContract.test.js` |
| Contract parser: malformed status | Missing fields and NaN are rejected | Automated fixture test | Pass if test succeeds | Same command |
| Contract parser: empty/malformed history | Empty list accepted; malformed sample rejected | Automated fixture test | Pass if test succeeds | Same command |
| Dashboard production build | Vite emits relative-path deployable `dist/` | Passed locally; Vite config loader warning | Pass | Build output 2026-11-16 |
| SCD41 | Detect sensor, honor periodic cadence, show unavailable without fabricated values | Hardware not tested | Not run | Serial log and sensor comparison |
| TFT and touch | Correct orientation, readable screens, calibrated touch, no repeated full-screen flicker | Hardware not tested; profile unverified | Not run | Photos/video and touch calibration notes |
| Fan | Driver-only switching; auto on at >=30°C/off at <=28°C; manual modes respected | Hardware not tested | Not run | Controlled temperature and driver measurements |
| Buzzer | CO₂ alarm on at >=2000 ppm/off at <=1800 ppm; mute suppresses sound only | Hardware not tested | Not run | Sensor simulation/controlled input and observation |
| NeoPixel | Status colors follow configured project indicator | Hardware not tested; count/logic level unknown | Not run | Photos and supply/logic measurements |
| Buttons | Active-low input and mute/action behavior work | Hardware not tested | Not run | Video and serial logs |
| BLE advertising and scan | ESP32 advertises AirWatch service/name; Android APK discovers it | Phone discovered `AirWatch-DB1C` | Pass | Android BLE scan log |
| BLE connection and notifications | APK connects, subscribes, parses JSON status, and receives repeated updates | Phone received repeated valid sensor JSON (latest observed: 593 ppm, 29.1°C, 90.2% RH) | Pass | Android GATT/status logs |
| BLE controls | Fan, mute, and theme writes apply and are reflected in the next notification | Hardware not tested | Not run | Before/after TFT and app status |
| BLE clock sync | Phone sends UTC time on connection; TFT shows Philippine time and status epoch becomes nonzero | Firmware change not yet compiled/uploaded | Not run | Compare TFT clock with phone (UTC+8) |
| Supabase account privacy | Signed-in user can read/insert own rows; another account cannot access them | Requires a configured Supabase project | Not run | Verify RLS with two test accounts |
| BLE-to-cloud relay | Signed-in APK uploads valid readings; signed-in website shows that account's latest values/history | Requires Supabase credentials and project setup | Not run | Compare app status with Supabase row and website |
| Website APK download | Website button downloads the current debug APK | Requires APK copied to `public/downloads/airwatch.apk` | Not run | Download and install on Android |
| BLE-only operation | Sensor/status communication works with Wi-Fi disabled; firmware does not start AP/STA or HTTP | Hardware not tested | Not run | Serial log and Android connection test |
| AP / STA / LittleFS / HTTP API | Removed; not part of the BLE-only firmware | Not applicable | N/A | See `Docs/API.md` |
| History | App chart accumulates chronological samples from live notifications; clears when app data resets | Device integration not tested | Not run | App capture before/after restart |
| Dashboard | APK live data, offline/error/empty states, controls and history work | Contract tests cover response validation/error mapping; device integration not tested | Partial | Test/build logs and phone capture |
| Theme synchronization | APK theme toggle updates TFT and survives ESP32 reboot | Requires hardware and BLE connection | Not run | Before/after screen photos and app status |
| Power | Rails, polarity, protection, current capacity and thermal behavior verified for exact modules | Hardware not tested; exact parts unknown | Not run | BOM/part photos and multimeter/current records |

## Recommended first physical tests

1. Identify the exact ESP32-S3 module, sensor/display breakouts, fan current, transistor, diode, charger/protection module and boost converter. Photograph labels and inspect board documentation.
2. With all loads disconnected, verify protection, polarity and converter output with a meter. Do not connect the battery chain until the charging/protection and power path are understood.
3. Bring up the ESP32 over USB with outputs physically disconnected; verify serial boot and board/partition settings.
4. Test I²C sensor, display, touch, buttons, and LED individually before connecting the fan/buzzer driver loads.
5. Test each driver stage under current-limited conditions, then BLE/peripherals together and finally battery operation while watching for brownouts and heating.
6. Install the APK, allow Bluetooth permissions, connect to the advertised AirWatch device, confirm sensor notifications update repeatedly, and test controls while observing the TFT.
