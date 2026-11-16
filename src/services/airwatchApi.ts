import { apiErrorMessage, normalizeApiError, parseDeviceStatus, parseMutationResult, parseSensorHistory } from "./airwatchContract.js";

export interface DeviceStatus {
  setupRequired: boolean;
  valid: boolean; co2: number; temperature: number; humidity: number; quality: string;
  displayTheme: "light" | "dark";
  fanOn: boolean; fanMode: "auto" | "on" | "off"; muted: boolean; alarmActive: boolean;
  systemOn: boolean; uptimeSeconds: number; lastReadingUptime: number; lastReadingEpoch: number;
  wifi: { connected: boolean; ssid: string; ip: string; apSSID: string; apIP: string };
}
export interface HistorySample { uptime: number; epoch: number; co2: number; temp: number; hum: number }
export interface SensorHistory { samples: HistorySample[] }
const timeoutMs = 4500;
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${import.meta.env.VITE_AIRWATCH_API_URL ?? ""}${path}`, {
      ...init, signal: controller.signal, headers: { Accept: "application/json", ...init?.headers },
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(apiErrorMessage(data, response.status));
    }
    const data: unknown = await response.json();
    if (path === "/api/status") return parseDeviceStatus(data) as T;
    if (path === "/api/history") return parseSensorHistory(data) as T;
    if (path === "/api/control" || path === "/api/wifi") return parseMutationResult(data) as T;
    return data as T;
  } catch (error) {
    throw normalizeApiError(error);
  } finally { window.clearTimeout(timer); }
}
export const getDeviceStatus = () => request<DeviceStatus>("/api/status", { cache: "no-store" });
export const completeDeviceSetup = (accessKey: string, apPassword: string) =>
  request<{ ok: boolean }>("/api/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accessKey, apPassword }) });
export const getSensorHistory = () => request<SensorHistory>("/api/history", { cache: "no-store" });
async function control(body: object, key: string) {
  return request<{ ok: boolean }>("/api/control", { method: "POST", headers: { "Content-Type": "application/json", "X-AirWatch-Key": key }, body: JSON.stringify(body) });
}
export const setFanMode = (fanMode: DeviceStatus["fanMode"], key: string) => control({ fanMode }, key);
export const setBuzzerMuted = (muted: boolean, key: string) => control({ muted }, key);
export const setDisplayTheme = (displayTheme: DeviceStatus["displayTheme"], key: string) => control({ displayTheme }, key);
export const saveWiFiCredentials = (ssid: string, password: string, key: string) =>
  request<{ ok: boolean }>("/api/wifi", { method: "POST", headers: { "Content-Type": "application/json", "X-AirWatch-Key": key }, body: JSON.stringify({ ssid, password }) });
