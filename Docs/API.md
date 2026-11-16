# AirWatch API contract status

## Source status

The sketch now implements these handlers in `firmware/AirWatch.ino`. The JSON field names below are copied from the firmware serializer and the frontend runtime contract. The firmware has **not** been compiled or exercised on hardware here. Test fixtures remain contract fixtures, not captured device responses.

## Version 1 responses

`GET /api/status` returns schema version 1 and these fields:

| Field | Type | Meaning in current client |
|---|---|---|
| `valid` | boolean | Whether a usable current sensor measurement exists |
| `co2`, `temperature`, `humidity` | finite number | Latest values; the UI must display them only when `valid` is true |
| `quality` | string | Device-provided project indicator label |
| `displayTheme` | `light` or `dark` | Active TFT palette, persisted by the device |
| `fanOn`, `muted`, `alarmActive`, `systemOn` | boolean | Output and device state |
| `fanMode` | `auto`, `on`, or `off` | Requested fan mode |
| `uptimeSeconds`, `lastReadingUptime`, `lastReadingEpoch` | finite number | Device uptime in seconds; last-reading uptime in milliseconds; epoch seconds or `0` when clock is unset |
| `wifi` | object | `connected` boolean and `ssid`, `ip`, `apSSID`, `apIP` strings |

When there is no fresh sensor reading, the serializer returns `valid: false`, zero numeric readings, and `quality: "unavailable"`. The dashboard must gate values on `valid`; the zeros are placeholders required by its current numeric type and are not measurements. A reading becomes stale after 15 seconds. The `quality` strings are project indicator bands, not medical or regulatory classifications.

`GET /api/history` returns `{ "samples": [...] }`. Each sample contains numeric `uptime` (seconds), `epoch` (currently always zero), `co2`, `temp`, and `hum`. Empty samples are valid. It retains at most 60 samples in RAM and clears after reboot.

Mutations return `{ "ok": true }` on success and JSON `{ "error": "..." }` on failure. Implemented statuses include 400 invalid JSON/body, 401 missing or incorrect key, 413 body too large, and 404 unknown API route. The UI sends these JSON bodies:

```json
{"fanMode":"auto"}
```

```json
{"muted":true}
```

```json
{"displayTheme":"dark"}
```

```json
{"ssid":"YOUR_SSID","password":"YOUR_PASSWORD"}
```

The fan, mute, and display-theme payloads go to `POST /api/control`; the Wi-Fi payload goes to `POST /api/wifi`. Both require `X-AirWatch-Key` and `Content-Type: application/json`. Bodies over 256 bytes are rejected. The SSID must be 1–32 characters and the password at most 63 characters. Wi-Fi settings and the TFT theme persist in NVS. The generated AP password and key are revealed on the TFT Network page after a three-second physical button hold and remain visible for 30 seconds.

## Client behavior

The runtime client rejects malformed success JSON, surfaces a JSON `error` when supplied on non-2xx responses, times out after 4.5 seconds, and reports unreachable devices as `Cannot reach AirWatch device`. Polling is sequential at four-second intervals. The access key remains React memory state and is not written to local storage or a URL.

The device API is plain HTTP. Treat it as trusted-LAN only; do not port-forward it or expose it to the internet. Render hosts the static frontend only. A secure cloud gateway is not implemented.
