import type { DeviceStatus, HistorySample } from "./airwatchApi";
import { requireSupabase } from "./supabase";

export async function uploadAirWatchReading(deviceId: string, status: DeviceStatus) {
  if (!status.valid) return;

  const { error } = await requireSupabase().from("airwatch_readings").insert({
    device_id: deviceId,
    valid: status.valid,
    co2: status.co2,
    temperature: status.temperature,
    humidity: status.humidity,
    quality: status.quality,
    display_theme: status.displayTheme,
    fan_on: status.fanOn,
    fan_mode: status.fanMode,
    muted: status.muted,
    alarm_active: status.alarmActive,
    system_on: status.systemOn,
    uptime_seconds: status.uptimeSeconds,
    last_reading_uptime: status.lastReadingUptime,
    last_reading_epoch: status.lastReadingEpoch,
  });
  if (error) throw new Error(`Cloud upload failed: ${error.message}`);
}

export async function getCloudSnapshot(): Promise<{
  status: DeviceStatus | null;
  samples: HistorySample[];
}> {
  const { data, error } = await requireSupabase()
    .from("airwatch_readings")
    .select("*")
    .order("observed_at", { ascending: false })
    .limit(360);
  if (error) throw new Error(`Could not load cloud readings: ${error.message}`);

  const rows = data ?? [];
  const toEpoch = (row: (typeof rows)[number]) =>
    row.last_reading_epoch || Math.floor(Date.parse(row.observed_at) / 1000);
  const samples = rows.slice().reverse().map((row): HistorySample => ({
    uptime: row.uptime_seconds,
    epoch: toEpoch(row),
    co2: row.co2,
    temp: row.temperature,
    hum: row.humidity,
  }));
  const latest = rows[0];
  if (!latest) return { status: null, samples };

  return {
    status: {
      setupRequired: false,
      valid: latest.valid,
      co2: latest.co2,
      temperature: latest.temperature,
      humidity: latest.humidity,
      quality: latest.quality,
      displayTheme: latest.display_theme,
      fanOn: latest.fan_on,
      fanMode: latest.fan_mode,
      muted: latest.muted,
      alarmActive: latest.alarm_active,
      systemOn: latest.system_on,
      uptimeSeconds: latest.uptime_seconds,
      lastReadingUptime: latest.last_reading_uptime,
      lastReadingEpoch: toEpoch(latest),
      wifi: { connected: false, ssid: "", ip: "", apSSID: "", apIP: "" },
    },
    samples,
  };
}
