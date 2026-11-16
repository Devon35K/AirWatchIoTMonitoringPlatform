export interface DeviceStatus {
  valid: boolean; co2: number; temperature: number; humidity: number; quality: string;
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
      throw new Error(data.error || `AirWatch request failed (${response.status})`);
    }
    return await response.json() as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw new Error("AirWatch request timed out");
    if (error instanceof TypeError) throw new Error("Cannot reach AirWatch device");
    throw error;
  } finally { window.clearTimeout(timer); }
}
export const getDeviceStatus = () => request<DeviceStatus>("/api/status", { cache: "no-store" });
export const getSensorHistory = () => request<SensorHistory>("/api/history", { cache: "no-store" });
async function control(body: object, key: string) {
  return request<{ ok: boolean }>("/api/control", { method: "POST", headers: { "Content-Type": "application/json", "X-AirWatch-Key": key }, body: JSON.stringify(body) });
}
export const setFanMode = (fanMode: DeviceStatus["fanMode"], key: string) => control({ fanMode }, key);
export const setBuzzerMuted = (muted: boolean, key: string) => control({ muted }, key);
export const saveWiFiCredentials = (ssid: string, password: string, key: string) =>
  request<{ ok: boolean }>("/api/wifi", { method: "POST", headers: { "Content-Type": "application/json", "X-AirWatch-Key": key }, body: JSON.stringify({ ssid, password }) });
