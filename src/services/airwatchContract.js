/** Runtime guards for the frontend's documented AirWatch v1 response shape. */
export function parseDeviceStatus(value) {
  if (!isRecord(value)) throw new Error("Invalid AirWatch status response");
  const wifi = value.wifi;
  if (
    typeof value.setupRequired !== "boolean" ||
    typeof value.valid !== "boolean" ||
    !isFiniteNumber(value.co2) ||
    !isFiniteNumber(value.temperature) ||
    !isFiniteNumber(value.humidity) ||
    typeof value.quality !== "string" ||
    !["light", "dark"].includes(value.displayTheme) ||
    typeof value.fanOn !== "boolean" ||
    !["auto", "on", "off"].includes(value.fanMode) ||
    typeof value.muted !== "boolean" ||
    typeof value.alarmActive !== "boolean" ||
    typeof value.systemOn !== "boolean" ||
    !isFiniteNumber(value.uptimeSeconds) ||
    !isFiniteNumber(value.lastReadingUptime) ||
    !isFiniteNumber(value.lastReadingEpoch) ||
    !isRecord(wifi) ||
    typeof wifi.connected !== "boolean" ||
    ![wifi.ssid, wifi.ip, wifi.apSSID, wifi.apIP].every((item) => typeof item === "string")
  ) {
    throw new Error("Invalid AirWatch status response");
  }
  return value;
}

export function parseSensorHistory(value) {
  if (!isRecord(value) || !Array.isArray(value.samples)) {
    throw new Error("Invalid AirWatch history response");
  }
  for (const sample of value.samples) {
    if (
      !isRecord(sample) ||
      ![sample.uptime, sample.epoch, sample.co2, sample.temp, sample.hum].every(isFiniteNumber)
    ) {
      throw new Error("Invalid AirWatch history response");
    }
  }
  return value;
}

export function parseMutationResult(value) {
  if (!isRecord(value) || value.ok !== true) {
    throw new Error("Invalid AirWatch command response");
  }
  return value;
}

export function apiErrorMessage(payload, status) {
  if (isRecord(payload) && typeof payload.error === "string" && payload.error.length > 0) return payload.error;
  return `AirWatch request failed (${status})`;
}

export function normalizeApiError(error) {
  if (error instanceof Error && error.name === "AbortError") return new Error("AirWatch request timed out");
  if (error instanceof TypeError) return new Error("Cannot reach AirWatch device");
  return error instanceof Error ? error : new Error("AirWatch is unavailable");
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}
