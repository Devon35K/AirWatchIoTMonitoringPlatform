import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { getDeviceStatus, getSensorHistory, type DeviceStatus, type HistorySample } from "../services/airwatchApi";
function useAirWatchPolling() {
  const [status, setStatus] = useState<DeviceStatus | null>(null);
  const [samples, setSamples] = useState<HistorySample[]>([]);
  const [error, setError] = useState("");
  const [lastSuccess, setLastSuccess] = useState<number | null>(null);
  const [accessKey, setAccessKey] = useState("");
  const refresh = useCallback(async () => {
    try {
      const [nextStatus, history] = await Promise.all([getDeviceStatus(), getSensorHistory()]);
      setStatus(nextStatus); setSamples(history.samples ?? []); setLastSuccess(Date.now()); setError("");
    } catch (e) { setStatus(null); setError(e instanceof Error ? e.message : "AirWatch is unavailable"); }
  }, []);
  useEffect(() => {
    let active = true;
    let timer = 0;
    const poll = async () => {
      await refresh();
      if (active) timer = window.setTimeout(() => void poll(), 4000);
    };
    void poll();
    return () => { active = false; window.clearTimeout(timer); };
  }, [refresh]);
  return { status, samples, error, lastSuccess, refresh, connected: !!status && !error, accessKey, setAccessKey };
}

type AirWatchData = ReturnType<typeof useAirWatchPolling>;
const AirWatchContext = createContext<AirWatchData | null>(null);
export function AirWatchProvider({ children }: { children: ReactNode }) {
  const value = useAirWatchPolling();
  return <AirWatchContext.Provider value={value}>{children}</AirWatchContext.Provider>;
}
export function useAirWatch() {
  const value = useContext(AirWatchContext);
  if (!value) throw new Error("useAirWatch must be used inside AirWatchProvider");
  return value;
}
