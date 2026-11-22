# AirWatch Bluetooth contract

## Transport

The ESP32 firmware communicates with the Android APK over Bluetooth Low Energy (BLE) only. It does not expose a Wi-Fi AP/STA connection, HTTP API, or LittleFS dashboard. The service and characteristic UUIDs must match between the sketch and `android/app/src/main/java/com/devon35k/airwatch/AirWatchBluetoothPlugin.java`.

| Purpose | UUID | Properties |
|---|---|---|
| AirWatch service | `4fafc201-1fb5-459e-8fcc-c5c9c331914b` | Advertise |
| Status | `beb5483e-36e1-4688-b7f5-ea07361b26a8` | Read + notify |
| Control | `e6d2c0aa-0a6f-4f42-9f6d-4a3b7b4a1002` | Write |

The device advertises as `AirWatch-XXXX`. The APK scans for that name/service, connects, requests an increased ATT MTU, enables status notifications, and publishes each received JSON object to the React app. Notifications use indexed BLE fragments that the Android plugin reassembles, so status transfer also works when a phone keeps the default ATT MTU. Status notifications are sent every two seconds; sensor measurements are sampled every two seconds.

Each notification fragment is `A:` + a two-digit hex sequence number + a two-digit hex zero-based fragment index + a two-digit hex fragment count + `:` + up to 11 bytes of JSON. The app combines fragments in order and publishes the JSON only after the complete message arrives.

## Status message

The status characteristic contains one complete UTF-8 JSON object with the fields below:

| Field | Type | Meaning |
|---|---|---|
| `setupRequired` | boolean | Always `false`; no Wi-Fi setup step exists |
| `valid` | boolean | Whether the SCD41 reading is usable |
| `co2`, `temperature`, `humidity` | finite number | Latest values; display only when `valid` is true |
| `quality` | string | Project indicator band, not medical/regulatory advice |
| `displayTheme` | `light` or `dark` | Current TFT theme |
| `fanOn`, `muted`, `alarmActive`, `systemOn` | boolean | Output and device state |
| `fanMode` | `auto`, `on`, or `off` | Requested fan mode |
| `uptimeSeconds`, `lastReadingUptime`, `lastReadingEpoch` | finite number | Uptime in seconds, sample uptime in milliseconds, and UTC epoch of the latest sample (zero until phone sync) |
| `wifi` | object | Compatibility-only: all fields empty and `connected` is false |

When no usable reading is available, `valid` is false, numeric readings are zero placeholders, and `quality` is `WAITING`. The frontend must not show those placeholders as measurements. The Android app builds its in-memory chart history from notifications; firmware samples and app history are not durable across restarts or app-data removal.

## Control writes

Write a UTF-8 JSON object to the control characteristic:

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
{"unixTime":1795363200}
```

The APK sends the phone's UTC epoch seconds after connecting. The firmware uses it to set the clock and displays Philippine Standard Time (UTC+8). Supported values are `fanMode: auto|on|off`, `muted: true|false`, `displayTheme: light|dark`, and `unixTime` from 2023 through 2100. Invalid or empty commands are rejected by firmware. After a successful write, the device notifies the updated status. Theme selection is saved in NVS; fan mode and mute state return to their defaults after reboot.

BLE access is not paired or authenticated in this prototype. A nearby BLE client may read device status and send controls; use the device only in a trusted environment.
