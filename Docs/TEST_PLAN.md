# AirWatch verification plan

The user-supplied firmware now has local API and LittleFS changes, but Arduino compilation and physical tests remain unverified. “Not run” is not a pass.



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
| AP | Setup dashboard reachable when router is unavailable; protected credentials | Hardware not tested; firmware absent | Not run | Connection record |
| STA | Connect/reconnect with backoff and AP retained | Hardware not tested; firmware absent | Not run | Serial log and router client record |
| LittleFS | Mount without formatting; serve `dist/` from `/` with selected partition | Hardware not tested; partition unknown | Not run | Boot log, partition table, browser capture |
| API auth | Mutations reject absent/wrong key and accept authorized valid bodies | Hardware not tested; actual handlers unknown | Not run | HTTP request/response capture with secrets redacted |
| History | Chronological bounded samples; epoch seconds distinct from uptime; reset behavior documented | Hardware not tested; firmware absent | Not run | API capture before/after reboot |
| Dashboard | Live data, offline/error/empty states, controls and history work | Contract tests cover response validation/error mapping; device integration not tested | Partial | Test/build logs and browser capture |
| Theme synchronization | Website dark/light toggle updates TFT immediately and survives reboot | Requires hardware and authenticated local API | Not run | Before/after screen photos and API status |
| Power | Rails, polarity, protection, current capacity and thermal behavior verified for exact modules | Hardware not tested; exact parts unknown | Not run | BOM/part photos and multimeter/current records |

## Recommended first physical tests

1. Identify the exact ESP32-S3 module, sensor/display breakouts, fan current, transistor, diode, charger/protection module and boost converter. Photograph labels and inspect board documentation.
2. With all loads disconnected, verify protection, polarity and converter output with a meter. Do not connect the battery chain until the charging/protection and power path are understood.
3. Bring up the ESP32 over USB with outputs physically disconnected; verify serial boot and board/partition settings.
4. Test I²C sensor, display, touch, buttons, and LED individually before connecting the fan/buzzer driver loads.
5. Test each driver stage under current-limited conditions, then Wi-Fi/peripherals together and finally battery operation while watching for brownouts and heating.
