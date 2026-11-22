import test from "node:test";
import assert from "node:assert/strict";
import { apiErrorMessage, normalizeApiError, parseDeviceStatus, parseMutationResult, parseSensorHistory } from "./airwatchContract.js";

// Fixtures encode the frontend's expected contract. They are not captured hardware responses.
const status = {
  setupRequired: false,
  valid: false, co2: 0, temperature: 0, humidity: 0, quality: "unavailable", displayTheme: "light",
  fanOn: false, fanMode: "auto", muted: false, alarmActive: false, systemOn: true,
  uptimeSeconds: 12, lastReadingUptime: 0, lastReadingEpoch: 0,
  wifi: { connected: false, ssid: "", ip: "", apSSID: "", apIP: "" },
};

test("accepts explicit unavailable status without treating it as a sensor reading", () => {
  assert.equal(parseDeviceStatus(status).valid, false);
});

test("rejects incomplete and non-finite status payloads", () => {
  assert.throws(() => parseDeviceStatus({ ...status, wifi: undefined }), /Invalid AirWatch status/);
  assert.throws(() => parseDeviceStatus({ ...status, co2: Number.NaN }), /Invalid AirWatch status/);
  assert.throws(() => parseDeviceStatus({ ...status, displayTheme: "sepia" }), /Invalid AirWatch status/);
  assert.equal(parseDeviceStatus({ ...status, displayTheme: "dark" }).displayTheme, "dark");
});

test("accepts an empty history and valid chronological sample fields", () => {
  assert.deepEqual(parseSensorHistory({ samples: [] }).samples, []);
  assert.equal(parseSensorHistory({ samples: [{ uptime: 4, epoch: 0, co2: 700, temp: 22, hum: 45 }] }).samples.length, 1);
});

test("rejects malformed history and failed mutation results", () => {
  assert.throws(() => parseSensorHistory({ samples: [{ uptime: 1 }] }), /Invalid AirWatch history/);
  assert.throws(() => parseSensorHistory({ samples: null }), /Invalid AirWatch history/);
  assert.throws(() => parseMutationResult({ ok: false }), /Invalid AirWatch command/);
  assert.equal(parseMutationResult({ ok: true }).ok, true);
});

test("maps HTTP, offline, and timeout failures to useful client messages", () => {
  assert.equal(apiErrorMessage({ error: "Unauthorized" }, 401), "Unauthorized");
  assert.equal(apiErrorMessage({}, 503), "AirWatch request failed (503)");
  assert.equal(normalizeApiError(new TypeError("fetch failed")).message, "Cannot reach AirWatch device");
  const abort = new Error("aborted");
  abort.name = "AbortError";
  assert.equal(normalizeApiError(abort).message, "AirWatch request timed out");
});
