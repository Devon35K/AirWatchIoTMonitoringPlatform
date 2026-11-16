# AirWatch — VS Code / Copilot Agent Implementation Brief

You are the senior embedded systems and full-stack engineer working **inside the existing repository** `AirWatchIoTMonitoringPlatform`. Implement, do not merely propose, changes. Preserve working functionality and make small reviewable commits/diffs. Do not delete the React dashboard or rewrite the firmware from scratch.

## Mandatory source inspection

1. Read `AGENTS.md`, `README.md`, `package.json`, `vite.config.ts`, the complete `src/` tree, and `firmware/AirWatch.ino` first.
2. Locate and read `Docs/AirWatch_ Wireless Air Tracking & CO₂ Handling — An IoT-Based Indoor Air Quality and Safety Monitoring Device.pdf` (including **page 10 visual schematic** and the component and pin/power tables on pages 11–14). Search for the PDF under `Docs/` if its punctuation differs. If unreadable, report the limitation clearly rather than pretending to inspect it.
3. Confirm the *actual* GPIO constants and JSON responses in the sketch and the frontend's types/API client before coding. Create a source-to-implementation checklist and record any mismatches.
4. Read `Docs/SCHEMATIC.md` when present; this is a transcription of the proposal, **not an electrical certification**. Respect hardware version differences.

## Objective

Deliver a dependable AirWatch ESP32-S3 N16R8 Arduino firmware + React/Vite dashboard matching the project: SCD41 CO₂ / temperature / humidity readings, ILI9341 320×240 landscape TFT, XPT2046 touchscreen, buttons, WS2812B status LED, fan via transistor, buzzer via transistor, AP+STA Wi-Fi, LittleFS-hosted dashboard, authenticated remote control, history visualization, diagnostics, and reproducible setup. Keep local display and alarms functional without the network. Optional cloud telemetry must be clearly separated from the base local implementation.

## Baseline hardware mapping from proposal (verify against sketch, do not silently rewire)

| Function | GPIO |
|---|---:|
| Button 1 (active-low) | 1 |
| Button 2 / mute (active-low) | 2 |
| SCD41 SDA | 4 |
| SCD41 SCL | 5 |
| Fan switching transistor base via resistor | 6 |
| Buzzer switching transistor base via resistor | 7 |
| TFT CS | 10 |
| Shared SPI MOSI: TFT SDI, touch T_DIN, SD MOSI | 11 |
| Shared SPI SCK: TFT SCK, touch T_CLK, SD SCK | 12 |
| Shared SPI MISO: TFT SDO, touch T_DO, SD MISO | 13 |
| TFT DC | 14 |
| Touch CS | 16 |
| SD CS | 17 |
| WS2812B DIN through series resistor | 18 |
| TFT RESET | 21 |

Proposal power chain: 18650 -> TP4056 charging/protection module -> switch -> MT3608 boost adjusted to 5.0 V -> compatible ESP32 5V input + suitable 5V loads. ESP32 3V3 powers only verified 3.3V-compatible inputs. Never power motor, fan, buzzer, or 5V LED strip directly from a GPIO. Check *actual* breakout pin ratings and presence of battery protection; stop and document unsafe or ambiguous wiring rather than approving it. An unprotected TP4056 charging-only module is insufficient for battery discharge protection. Add common ground and flyback diode across the fan with correct polarity; confirm driver resistor and transistor current rating. The diagram depicts several components absent from the original budget; keep actual build BOM up to date.

**Hardware variants:** Some earlier AirWatch sketches used alternative TFT SPI pins (MOSI 41/SCLK 42/CS 47/DC 21/RST 14). The uploaded proposal and current GitHub sketch use 11/12/10/14/21 respectively. Never combine the two pinouts. If physical wiring differs, introduce one explicit board-profile configuration and document it. Use the wired hardware profile as the build default only after verifying it with the user/hardware.

## Firmware work

1. create me a new skecth thath aligh with this website style and make the design modern and refactor only when needed. Keep Arduino framework and the existing library ecosystem: `Wire`, `SPI`, `WiFi`, `WebServer`, `LittleFS`, `Preferences`, `Adafruit_GFX`, `Adafruit_ILI9341`, `XPT2046_Touchscreen`, `Adafruit_NeoPixel`, `SensirionI2cScd4x`, and QR encoding as actually supported by the chosen ESP32 core. Pin compatible library versions and document installations.
2. Initialize each peripheral safely with explicit success/failure diagnostics. On missing SCD41, show SENSOR ERROR, expose stale/unavailable status via API, and continue serving the UI without inventing values. Respect SCD41 acquisition cadence and avoid blocking its periodic measurements. Protect startup from repeated crashes if LittleFS isn't mounted.
3. Keep green/amber/red visual status configurable, and separate project ventilation **indicators** from regulatory or medical exposure limits. Preserve defaults from the existing sketch (fan on at >=30°C and off <=28°C; CO₂ buzzer on >=2000 ppm and clear <=1800 ppm) until approved changes. Reflect these in docs, UI and API; never label them universally safe exposure standards.
4. Implement fan modes `auto`, `on`, `off` with correct hysteresis for auto. Implement mute without preventing visible alerts. Drive outputs only through transistor/driver stages. Ensure alarm isn't accidentally latched or continuously toggled due to invalid readings.
5. Keep responsive 320x240 landscape screens for readings/status, clock, Wi-Fi/QR and time information if implemented already. Preserve touchscreen calibration and buttons and avoid full-screen redraw flicker. Show access credentials carefully; consider a time-limited credential reveal rather than continuously displaying the API key.
6. Keep AP+STA: unique AP name, protected AP credentials, NVS persistence, STA reconnect/backoff, clear visible connection state, AP access when router is down. Avoid storing secrets in source or `VITE_` variables. Regenerate/reset credentials only via authorized physical or authenticated flows.
7. Preserve LittleFS `dist/` serving at ESP32 `/` and ensure all Vite assets use relative paths. Document partitioning: N16R8 flash size 16MB does not itself guarantee 1MB+ LittleFS. Avoid unconditional formatting of LittleFS.
8. Maintain `/api/status`, `/api/history`, `POST /api/control`, `POST /api/wifi` and header `X-AirWatch-Key`, unless the frontend is migrated atomically with tests. Use valid JSON parsing, proper status codes, request-body size limits, no sensitive data in GET responses, and bounded history. Implement a versioned, documented JSON schema. Distinguish epoch from device-uptime timestamps. History may be RAM-only; say so.
9. Document that HTTP + access key is trusted-LAN only. Do not port-forward/expose the ESP32 to the internet. For genuine remote/cloud access, design an opt-in HTTPS/MQTT gateway/backend with credentials outside firmware source; don't claim cloud exists without implementing it.
10. Include serial logs at 115200 with prefixed diagnostics; log boot, sensor availability, filesystem size, AP/STA status, HTTP errors, memory and reconnect. Do not print passwords or control keys unnecessarily.

## Frontend work

- Use existing React/Vite/Tailwind components and styling. Don't replace them with generic new UI.
- Display live CO₂ ppm, °C and %RH, sensor freshness, local connection state, alarm/fan modes, signal/uptime, and chronological history; if data unavailable, show offline or not-available **never simulated numbers**.
- Implement authenticated fan `auto/on/off`, mute/unmute, and Wi-Fi setup with loading, error, success states. Never persist the secret in `localStorage` by default or leak it in query strings; keep the existing in-memory convention.
- Centralize types/API client and validate response shape. Poll at a reasonable rate and clean up subscriptions. Handle ESP32 reboot, stale history, timezone and network disconnect gracefully.
- Ensure `pnpm build` (or package-manager documented in repo) creates `dist/` deployable at device root.

## Documentation deliverables

- Update root `README.md` with overview, honest implementation status, architecture, exact supported board, BOM, firmware and dashboard setup, flash/filesystem upload, API examples, troubleshooting, safety and limitations.
- Create/update `Docs/SCHEMATIC.md` with exact documented GPIO mapping, power chain, drivers, electrical cautions, component checklist, and a clear **unverified hardware wiring** warning.
- Add `Docs/API.md` with actual request/response examples copied from inspected code, not guessed.
- Add `Docs/TEST_PLAN.md` with actionable test cases and columns for expected result, observed result, pass/fail and evidence.
- Add `firmware/README.md` with Arduino board/flash/PSRAM/partition selections after verifying what the existing sketch requires, dependencies and upload steps.
- Fix typos and version drift between proposal (2.8-inch screen and page-10 schematic), working physical board and GitHub source without falsifying the project's original requirements.

## Verification and acceptance

1. Save a baseline git status and do not delete uncommitted user changes.
2. Inspect real API JSON produced by firmware (or clearly mark hardware unavailable). Add lightweight contract tests for frontend clients/mocks and error/empty/offline states.
3. Run dependency install and `pnpm build`; report exact output and warnings.
4. Run Arduino CLI compile with the correct ESP32-S3 board profile and pinned dependencies if CLI/toolchain is available. If not available, do not claim compilation success: give copy/paste commands for local verification.
5. Produce a verification matrix: SCD41, TFT/touch, fan, buzzer, NeoPixel, buttons, AP, STA, LittleFS, API auth, history, dashboard, power; label *hardware not tested* where applicable.
6. Supply complete changed-file list, concise diff summary, build instructions, known blockers, and recommended first physical tests. Avoid assuming a charging/protection module is safe without its exact model and protection IC verified.

## Execution order

Start with repository audit and existing JSON/pin definitions; next firmware correctness and safety; then frontend compatibility; then documentation; finally tests and build checks. **Make the actual edits directly in the open VS Code workspace.** Do not stop at a suggested plan unless blocked by unavailable files or a safety-critical unknown. Do not invent measurements or claim hardware was verified from source inspection alone.
