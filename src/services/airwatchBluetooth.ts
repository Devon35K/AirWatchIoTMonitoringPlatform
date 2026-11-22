import { registerPlugin } from "@capacitor/core";
import type { DeviceStatus } from "./airwatchApi";

export interface BluetoothDeviceInfo {
  name: string;
  address: string;
  rssi: number;
}

interface AirWatchBluetoothPlugin {
  isSupported(): Promise<{ supported: boolean; enabled: boolean }>;
  scan(): Promise<void>;
  stopScan(): Promise<void>;
  connect(options: { address: string }): Promise<{ connected: boolean; name?: string }>;
  getStatus(): Promise<void>;
  setControl(options: { json: string }): Promise<void>;
  disconnect(): Promise<void>;
  addListener(eventName: "deviceFound", listenerFunc: (device: BluetoothDeviceInfo) => void): Promise<{ remove(): Promise<void> }>;
  addListener(eventName: "connectionState", listenerFunc: (state: { connected?: boolean; reason?: string }) => void): Promise<{ remove(): Promise<void> }>;
  addListener(eventName: "status", listenerFunc: (value: { json: string }) => Promise<void> | void): Promise<{ remove(): Promise<void> }>;
  addListener(eventName: "scanFinished", listenerFunc: () => void): Promise<{ remove(): Promise<void> }>;
  addListener(eventName: "scanFailed", listenerFunc: (error: { errorCode: number }) => void): Promise<{ remove(): Promise<void> }>;
}

const AirWatchBluetooth = registerPlugin<AirWatchBluetoothPlugin>("AirWatchBluetooth");

export const bluetooth = {
  isSupported: () => AirWatchBluetooth.isSupported(),
  scan: () => AirWatchBluetooth.scan(),
  stopScan: () => AirWatchBluetooth.stopScan(),
  connect: (address: string) => AirWatchBluetooth.connect({ address }),
  getStatus: () => AirWatchBluetooth.getStatus(),
  setControl: (command: object) =>
    AirWatchBluetooth.setControl({ json: JSON.stringify(command) }),
  disconnect: () => AirWatchBluetooth.disconnect(),
  onDeviceFound: (listener: (device: BluetoothDeviceInfo) => void) =>
    AirWatchBluetooth.addListener("deviceFound", listener),
  onConnectionState: (listener: (state: { connected?: boolean; reason?: string }) => void) =>
    AirWatchBluetooth.addListener("connectionState", listener),
  onStatus: (listener: (status: DeviceStatus) => void) =>
    AirWatchBluetooth.addListener("status", async (value) => {
      try {
        listener(JSON.parse(value.json) as DeviceStatus);
      } catch (error) {
        console.error("Invalid AirWatch BLE status notification", error);
      }
    }),
  onScanFinished: (listener: () => void) =>
    AirWatchBluetooth.addListener("scanFinished", listener),
  onScanFailed: (listener: (error: { errorCode: number }) => void) =>
    AirWatchBluetooth.addListener("scanFailed", listener),
};
