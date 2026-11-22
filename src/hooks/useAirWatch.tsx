import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Capacitor } from "@capacitor/core";
import { getDeviceStatus, getSensorHistory, type DeviceStatus, type HistorySample } from "../services/airwatchApi";
import { getCloudSnapshot, uploadAirWatchReading } from "../services/airwatchCloud";
import { bluetooth, type BluetoothDeviceInfo } from "../services/airwatchBluetooth";
import { useCloudAccount } from "./useCloudAccount";
import { supabaseConfigured } from "../services/supabase";
function useAirWatchPolling() {
  const { user } = useCloudAccount();
  const [status, setStatus] = useState<DeviceStatus | null>(null);
  const [samples, setSamples] = useState<HistorySample[]>([]);
  const [error, setError] = useState("");
  const [cloudSyncError, setCloudSyncError] = useState("");
  const [lastSuccess, setLastSuccess] = useState<number | null>(null);
  const [accessKey, setAccessKey] = useState("");
  const [bluetoothConnected, setBluetoothConnected] = useState(false);
  const [bluetoothDevice, setBluetoothDevice] = useState<BluetoothDeviceInfo | null>(null);
  const cloudUserRef = useRef(user);
  cloudUserRef.current = user;
  const refresh = useCallback(async () => {
    if (Capacitor.isNativePlatform()) {
      if (!bluetoothConnected) {
        setStatus(null);
        setError("Scanning for an AirWatch device over Bluetooth...");
        return;
      }
      return;
    }
    if (supabaseConfigured) {
      if (!cloudUserRef.current) {
        setStatus(null);
        setSamples([]);
        setError("Sign in to view your private cloud readings.");
        return;
      }
      try {
        const snapshot = await getCloudSnapshot();
        setStatus(snapshot.status);
        setSamples(snapshot.samples);
        setLastSuccess(snapshot.status ? Date.now() : null);
        setError(snapshot.status ? "" : "No cloud readings yet. Connect the APK to your device while signed in.");
      } catch (e) {
        setStatus(null);
        setError(e instanceof Error ? e.message : "Could not load cloud readings");
      }
      return;
    }
    try {
      const [nextStatus, history] = await Promise.all([getDeviceStatus(), getSensorHistory()]);
      setStatus(nextStatus); setSamples(history.samples ?? []); setLastSuccess(Date.now()); setError("");
    } catch (e) { setStatus(null); setError(e instanceof Error ? e.message : "AirWatch is unavailable"); }
  }, [bluetoothConnected]);
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  useEffect(() => {
    let active = true;
    let timer = 0;
    let scanTimer = 0;
    let connecting = false;
    let scanRunning = false;
    let bleConnected = false;
    let phoneClockSynced = false;
    let phoneClockSyncInFlight = false;
    let lastPhoneClockSyncAt = 0;
    let activeDeviceName = "AirWatch";
    let lastCloudUploadAt = 0;
    let cloudUploadInFlight = false;
    const listeners: Array<{ remove(): Promise<void> }> = [];
    if (Capacitor.isNativePlatform()) {
      void bluetooth.onStatus((nextStatus) => {
        if (!active) return;
        setStatus(nextStatus);
        setLastSuccess(Date.now());
        setError("");
        const now = Date.now();
        const phoneEpochSeconds = Math.floor(now / 1000);
        if (nextStatus.lastReadingEpoch > 0 && Math.abs(nextStatus.lastReadingEpoch - phoneEpochSeconds) <= 15) {
          phoneClockSynced = true;
        }
        if (bleConnected && !phoneClockSynced && !phoneClockSyncInFlight && now - lastPhoneClockSyncAt >= 5000) {
          phoneClockSyncInFlight = true;
          lastPhoneClockSyncAt = now;
          void bluetooth.setControl({ unixTime: phoneEpochSeconds })
            .then(() => {
              phoneClockSyncInFlight = false;
            })
            .catch((e) => {
              phoneClockSyncInFlight = false;
              if (active) setError(e instanceof Error ? `Could not sync device time: ${e.message}` : "Could not sync device time");
            });
        }
        if (
          supabaseConfigured &&
          cloudUserRef.current &&
          nextStatus.valid &&
          !cloudUploadInFlight &&
          now - lastCloudUploadAt >= 30000
        ) {
          lastCloudUploadAt = now;
          cloudUploadInFlight = true;
          void uploadAirWatchReading(activeDeviceName, nextStatus)
            .then(() => {
              if (active) setCloudSyncError("");
            })
            .catch((e: unknown) => {
              console.error("AirWatch cloud upload failed", e);
              if (active) setCloudSyncError(e instanceof Error ? e.message : "Could not upload readings to the cloud");
            })
            .finally(() => {
              cloudUploadInFlight = false;
            });
        }
        if (nextStatus.valid) {
          setSamples((current) => [
            ...current.slice(-359),
            {
              uptime: nextStatus.uptimeSeconds,
              epoch: nextStatus.lastReadingEpoch ?? 0,
              co2: nextStatus.co2,
              temp: nextStatus.temperature,
              hum: nextStatus.humidity,
            },
          ]);
        }
      }).then((listener) => listeners.push(listener));
      void bluetooth.onConnectionState((state) => {
        if (!active) return;
        setBluetoothConnected(!!state.connected);
        bleConnected = !!state.connected;
        connecting = false;
        if (!bleConnected) {
          phoneClockSynced = false;
          phoneClockSyncInFlight = false;
          lastPhoneClockSyncAt = 0;
        }
        if (state.reason) setError(state.reason);
        if (!state.connected) {
          scanRunning = false;
          setBluetoothDevice(null);
          scanTimer = window.setTimeout(() => void startAutoScan(), 2500);
        }
      }).then((listener) => listeners.push(listener));
      void bluetooth.onScanFinished(() => {
        scanRunning = false;
        if (active && !bleConnected && !connecting) {
          scanTimer = window.setTimeout(() => void startAutoScan(), 1500);
        }
      }).then((listener) => listeners.push(listener));
      void bluetooth.onScanFailed(({ errorCode }) => {
        scanRunning = false;
        if (!active) return;
        setError(`Bluetooth scan failed (code ${errorCode}); retrying...`);
        scanTimer = window.setTimeout(() => void startAutoScan(), 3000);
      }).then((listener) => listeners.push(listener));
      void bluetooth.onDeviceFound((device) => {
        if (!active || !device.name.startsWith("AirWatch")) return;
        activeDeviceName = device.name;
        setBluetoothDevice((current) => current ?? device);
        if (bleConnected || connecting) return;
        connecting = true;
        scanRunning = false;
        void bluetooth.connect(device.address)
          .then(() => {
            if (!active) return;
            bleConnected = true;
            connecting = false;
            setBluetoothDevice(device);
            setBluetoothConnected(true);
            setError("");
          })
          .catch((e) => {
            connecting = false;
            scanRunning = false;
            if (active) {
              setError(e instanceof Error ? e.message : "Could not connect over Bluetooth");
              scanTimer = window.setTimeout(() => void startAutoScan(), 2500);
            }
          });
      }).then((listener) => listeners.push(listener));
    }
    const startAutoScan = async () => {
      if (!active || !Capacitor.isNativePlatform() || scanRunning || bleConnected || connecting) return;
      scanRunning = true;
      try {
        const state = await bluetooth.isSupported();
        if (!state.supported) {
          scanRunning = false;
          setError("This phone does not support Bluetooth Low Energy");
          return;
        }
        if (!state.enabled) {
          scanRunning = false;
          setError("Turn on Bluetooth to connect automatically");
          scanTimer = window.setTimeout(() => void startAutoScan(), 5000);
          return;
        }
        await bluetooth.scan();
      } catch (e) {
        scanRunning = false;
        setError(e instanceof Error ? e.message : "Bluetooth scan unavailable");
        scanTimer = window.setTimeout(() => void startAutoScan(), 5000);
      }
    };
    const poll = async () => {
      await refreshRef.current();
      if (active) timer = window.setTimeout(() => void poll(), Capacitor.isNativePlatform() ? 4000 : 15000);
    };
    if (Capacitor.isNativePlatform()) void startAutoScan();
    void poll();
    return () => {
      active = false;
      window.clearTimeout(timer);
      window.clearTimeout(scanTimer);
      listeners.forEach((listener) => void listener.remove());
      if (Capacitor.isNativePlatform()) void bluetooth.stopScan();
    };
  }, []);
  return {
    status,
    samples,
    error,
    cloudSyncError,
    lastSuccess,
    refresh,
    connected: !!status && !error,
    bluetoothConnected,
    bluetoothDevice,
    accessKey,
    setAccessKey,
  };
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
