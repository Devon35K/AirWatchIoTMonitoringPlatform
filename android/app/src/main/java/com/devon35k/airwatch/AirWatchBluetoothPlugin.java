package com.devon35k.airwatch;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCallback;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattDescriptor;
import android.bluetooth.BluetoothGattService;
import android.bluetooth.BluetoothManager;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanResult;
import android.bluetooth.le.ScanSettings;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@CapacitorPlugin(name = "AirWatchBluetooth")
public class AirWatchBluetoothPlugin extends Plugin {
    private static final String TAG = "AirWatchBluetooth";
    private static final String SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
    private static final String STATUS_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a8";
    private static final String CONTROL_UUID = "e6d2c0aa-0a6f-4f42-9f6d-4a3b7b4a1002";

    private BluetoothAdapter adapter;
    private BluetoothLeScanner scanner;
    private volatile boolean scanActive;
    private BluetoothGatt gatt;
    private BluetoothGattCharacteristic statusCharacteristic;
    private BluetoothGattCharacteristic controlCharacteristic;
    private final List<String> foundAddresses = new ArrayList<>();
    private static final UUID CCCD_UUID = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb");
    private PluginCall pendingConnectCall;
    private JSObject pendingConnected;
    private PluginCall pendingControlCall;
    private final StringBuilder statusFragments = new StringBuilder();
    private int fragmentSequence = -1;
    private int fragmentCount;
    private int nextFragment;

    @Override
    public void load() {
        BluetoothManager manager = (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
        if (manager != null) adapter = manager.getAdapter();
    }

    private boolean missingPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return getContext().checkSelfPermission(Manifest.permission.BLUETOOTH_SCAN) != PackageManager.PERMISSION_GRANTED
                || getContext().checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED;
        }
        return getContext().checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED;
    }

    @PluginMethod
    public void isSupported(PluginCall call) {
        JSObject result = new JSObject();
        result.put("supported", getContext().getPackageManager().hasSystemFeature(PackageManager.FEATURE_BLUETOOTH_LE));
        result.put("enabled", adapter != null && adapter.isEnabled());
        call.resolve(result);
    }

    @PluginMethod
    public void scan(PluginCall call) {
        if (adapter == null) {
            call.reject("Bluetooth is not available on this device");
            return;
        }
        if (!adapter.isEnabled()) {
            call.reject("Turn on Bluetooth first");
            return;
        }
        if (missingPermissions()) {
            String[] permissions;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                permissions = new String[]{Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT};
            } else {
                permissions = new String[]{Manifest.permission.ACCESS_FINE_LOCATION};
            }
            getActivity().requestPermissions(permissions, 1001);
            call.reject("Bluetooth permission requested. Tap Scan again after allowing permission.");
            return;
        }

        if (scanActive) {
            call.resolve();
            return;
        }
        scanner = adapter.getBluetoothLeScanner();
        if (scanner == null) {
            call.reject("Bluetooth Low Energy scanner unavailable");
            return;
        }
        Log.i(TAG, "Starting AirWatch BLE scan");
        foundAddresses.clear();
        ScanSettings scanSettings = new ScanSettings.Builder()
            .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
            .build();
        scanner.startScan(null, scanSettings, scanCallback);
        scanActive = true;
        getActivity().runOnUiThread(() -> getActivity().findViewById(android.R.id.content).postDelayed(() -> {
            stopScanner();
            notifyListeners("scanFinished", new JSObject());
        }, 12000));
        call.resolve();
    }

    private final ScanCallback scanCallback = new ScanCallback() {
        @Override
        public void onScanResult(int callbackType, ScanResult result) {
            BluetoothDevice device = result.getDevice();
            String name = device.getName();
            if (name == null) name = "";
            if (result.getScanRecord() != null
                && result.getScanRecord().getDeviceName() != null
                && name.isEmpty()) {
                name = result.getScanRecord().getDeviceName();
            }
            boolean hasAirWatchService = false;
            if (result.getScanRecord() != null
                && result.getScanRecord().getServiceUuids() != null) {
                for (android.os.ParcelUuid uuid : result.getScanRecord().getServiceUuids()) {
                    if (uuid.getUuid().equals(UUID.fromString(SERVICE_UUID))) {
                        hasAirWatchService = true;
                        break;
                    }
                }
            }
            if (name.isEmpty() && hasAirWatchService) {
                name = "AirWatch-" + device.getAddress().replace(":", "").substring(8);
            }
            Log.i(TAG, "Scan result: name=" + name + " address=" + device.getAddress() + " service=" + hasAirWatchService);
            if (!name.startsWith("AirWatch") && !foundAddresses.contains(device.getAddress())) {
                foundAddresses.add(device.getAddress());
            }
            if (name.startsWith("AirWatch")) {
                JSObject found = new JSObject();
                found.put("name", name);
                found.put("address", device.getAddress());
                found.put("rssi", result.getRssi());
                notifyListeners("deviceFound", found);
            }
        }

        @Override
        public void onScanFailed(int errorCode) {
            scanActive = false;
            Log.e(TAG, "AirWatch BLE scan failed with error " + errorCode);
            JSObject failure = new JSObject();
            failure.put("errorCode", errorCode);
            notifyListeners("scanFailed", failure);
        }
    };

    private void stopScanner() {
        if (scanner != null && scanActive) {
            scanner.stopScan(scanCallback);
            scanActive = false;
        }
    }

    @PluginMethod
    public void stopScan(PluginCall call) {
        stopScanner();
        call.resolve();
    }

    @PluginMethod
    public void connect(PluginCall call) {
        if (adapter == null) {
            call.reject("Bluetooth is unavailable");
            return;
        }
        if (missingPermissions()) {
            call.reject("Bluetooth permission is required");
            return;
        }
        String address = call.getString("address");
        if (address == null || address.isEmpty()) {
            call.reject("Device address is required");
            return;
        }
        stopScanner();
        BluetoothDevice device;
        try {
            device = adapter.getRemoteDevice(address);
        } catch (IllegalArgumentException error) {
            call.reject("Invalid Bluetooth address");
            return;
        }
        if (pendingConnectCall != null) {
            pendingConnectCall.reject("AirWatch Bluetooth connection was replaced");
            pendingConnectCall = null;
            pendingConnected = null;
        }
        if (gatt != null) gatt.close();
        pendingConnectCall = call;
        gatt = device.connectGatt(getContext(), false, new BluetoothGattCallback() {
            @Override
            public void onConnectionStateChange(BluetoothGatt bluetoothGatt, int status, int newState) {
                if (newState == android.bluetooth.BluetoothProfile.STATE_CONNECTED) {
                    if (status != BluetoothGatt.GATT_SUCCESS) {
                        Log.e(TAG, "GATT connection failed with status " + status);
                        failPendingConnection("Could not connect to AirWatch over Bluetooth");
                        return;
                    }
                    Log.i(TAG, "GATT connected; discovering AirWatch services");
                    bluetoothGatt.discoverServices();
                } else if (newState == android.bluetooth.BluetoothProfile.STATE_DISCONNECTED) {
                    Log.w(TAG, "GATT disconnected with status " + status);
                    failPendingConnection("AirWatch Bluetooth connection was lost");
                    if (pendingControlCall != null) {
                        pendingControlCall.reject("AirWatch Bluetooth connection was lost");
                        pendingControlCall = null;
                    }
                    JSObject disconnected = new JSObject();
                    disconnected.put("reason", "Bluetooth device disconnected");
                    notifyListeners("connectionState", disconnected);
                }
            }

            @Override
            public void onServicesDiscovered(BluetoothGatt bluetoothGatt, int status) {
                if (status != BluetoothGatt.GATT_SUCCESS) {
                    Log.e(TAG, "GATT service discovery failed with status " + status);
                    failPendingConnection("Could not discover AirWatch Bluetooth services");
                    return;
                }
                BluetoothGattService service = bluetoothGatt.getService(UUID.fromString(SERVICE_UUID));
                if (service == null) {
                    failPendingConnection("AirWatch BLE service was not found");
                    return;
                }
                statusCharacteristic = service.getCharacteristic(UUID.fromString(STATUS_UUID));
                controlCharacteristic = service.getCharacteristic(UUID.fromString(CONTROL_UUID));
                if (statusCharacteristic == null) {
                    failPendingConnection("AirWatch status characteristic was not found");
                    return;
                }
                Log.i(TAG, "AirWatch GATT services discovered");
                JSObject connected = new JSObject();
                connected.put("connected", true);
                connected.put("name", device.getName());
                connected.put("address", address);
                pendingConnectCall = call;
                pendingConnected = connected;
                subscribeToStatus(bluetoothGatt, call, connected);
            }

            @Override
            public void onMtuChanged(BluetoothGatt bluetoothGatt, int mtu, int status) {
                enableStatusNotifications(bluetoothGatt);
            }

            @Override
            public void onDescriptorWrite(BluetoothGatt bluetoothGatt, BluetoothGattDescriptor descriptor, int status) {
                if (status == BluetoothGatt.GATT_SUCCESS
                    && CCCD_UUID.equals(descriptor.getUuid())) {
                    Log.i(TAG, "Subscribed to AirWatch status notifications");
                    if (!bluetoothGatt.readCharacteristic(statusCharacteristic)) {
                        Log.w(TAG, "Could not start initial AirWatch status read");
                    }
                    completePendingConnection();
                } else if (pendingConnectCall != null) {
                    pendingConnectCall.reject("Could not subscribe to AirWatch sensor notifications");
                    pendingConnectCall = null;
                    pendingConnected = null;
                }
            }

            @Override
            public void onCharacteristicRead(BluetoothGatt bluetoothGatt, BluetoothGattCharacteristic characteristic, int status) {
                if (status == BluetoothGatt.GATT_SUCCESS) {
                    publishCharacteristic(characteristic, characteristic.getValue());
                } else {
                    Log.w(TAG, "AirWatch status read failed with GATT status " + status);
                }
            }

            @Override
            public void onCharacteristicRead(
                BluetoothGatt bluetoothGatt,
                BluetoothGattCharacteristic characteristic,
                byte[] value,
                int status
            ) {
                if (status == BluetoothGatt.GATT_SUCCESS) {
                    publishCharacteristic(characteristic, value);
                } else {
                    Log.w(TAG, "AirWatch status read failed with GATT status " + status);
                }
            }

            @Override
            public void onCharacteristicChanged(BluetoothGatt bluetoothGatt, BluetoothGattCharacteristic characteristic) {
                publishCharacteristic(characteristic, characteristic.getValue());
            }

            @Override
            public void onCharacteristicChanged(
                BluetoothGatt bluetoothGatt,
                BluetoothGattCharacteristic characteristic,
                byte[] value
            ) {
                publishCharacteristic(characteristic, value);
            }

            @Override
            public void onCharacteristicWrite(BluetoothGatt bluetoothGatt, BluetoothGattCharacteristic characteristic, int status) {
                if (characteristic == controlCharacteristic && pendingControlCall != null) {
                    if (status == BluetoothGatt.GATT_SUCCESS) pendingControlCall.resolve();
                    else pendingControlCall.reject("AirWatch did not accept the Bluetooth command");
                    pendingControlCall = null;
                }
            }
        });
        if (gatt == null) failPendingConnection("Could not start AirWatch Bluetooth connection");
    }

    private void subscribeToStatus(BluetoothGatt bluetoothGatt, PluginCall call, JSObject connected) {
        pendingConnectCall = call;
        pendingConnected = connected;
        if (!bluetoothGatt.requestMtu(512)) enableStatusNotifications(bluetoothGatt);
    }

    private void enableStatusNotifications(BluetoothGatt bluetoothGatt) {
        if (statusCharacteristic == null || pendingConnectCall == null) return;
        if (!bluetoothGatt.setCharacteristicNotification(statusCharacteristic, true)) {
            pendingConnectCall.reject("Could not enable AirWatch sensor notifications");
            pendingConnectCall = null;
            pendingConnected = null;
            return;
        }
        BluetoothGattDescriptor descriptor = statusCharacteristic.getDescriptor(CCCD_UUID);
        if (descriptor == null) {
            bluetoothGatt.readCharacteristic(statusCharacteristic);
            completePendingConnection();
            return;
        }
        descriptor.setValue(BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE);
        if (!bluetoothGatt.writeDescriptor(descriptor)) {
            pendingConnectCall.reject("Could not subscribe to AirWatch sensor notifications");
            pendingConnectCall = null;
            pendingConnected = null;
        }
    }

    private void completePendingConnection() {
        if (pendingConnectCall == null) return;
        pendingConnectCall.resolve(pendingConnected);
        notifyListeners("connectionState", pendingConnected);
        pendingConnectCall = null;
        pendingConnected = null;
    }

    private void failPendingConnection(String reason) {
        if (pendingConnectCall == null) return;
        pendingConnectCall.reject(reason);
        pendingConnectCall = null;
        pendingConnected = null;
    }

    private void publishCharacteristic(BluetoothGattCharacteristic characteristic, byte[] bytes) {
        if (characteristic != statusCharacteristic) return;
        if (bytes == null || bytes.length == 0) return;
        String value = new String(bytes, StandardCharsets.UTF_8);
        if (value.startsWith("{")) {
            clearStatusFragments();
            publishStatusJson(value);
            return;
        }
        if (value.length() < 9 || !value.startsWith("A:") || value.charAt(8) != ':') return;
        try {
            int sequence = Integer.parseInt(value.substring(2, 4), 16);
            int index = Integer.parseInt(value.substring(4, 6), 16);
            int count = Integer.parseInt(value.substring(6, 8), 16);
            if (count == 0 || index >= count) {
                clearStatusFragments();
                return;
            }
            if (index == 0) {
                statusFragments.setLength(0);
                fragmentSequence = sequence;
                fragmentCount = count;
                nextFragment = 0;
            }
            if (sequence != fragmentSequence || count != fragmentCount || index != nextFragment) {
                clearStatusFragments();
                return;
            }
            statusFragments.append(value.substring(9));
            nextFragment++;
            if (nextFragment == fragmentCount) {
                publishStatusJson(statusFragments.toString());
                clearStatusFragments();
            }
        } catch (NumberFormatException error) {
            Log.w(TAG, "Ignoring malformed AirWatch status fragment", error);
            clearStatusFragments();
        }
    }

    private void publishStatusJson(String json) {
        Log.i(TAG, "Received AirWatch status (" + json.length() + " characters)");
        JSObject status = new JSObject();
        status.put("json", json);
        notifyListeners("status", status);
    }

    private void clearStatusFragments() {
        statusFragments.setLength(0);
        fragmentSequence = -1;
        fragmentCount = 0;
        nextFragment = 0;
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        if (gatt == null || statusCharacteristic == null) {
            call.reject("No AirWatch BLE device is connected");
            return;
        }
        if (gatt.readCharacteristic(statusCharacteristic)) call.resolve();
        else call.reject("Could not read AirWatch status");
    }

    @PluginMethod
    public void setControl(PluginCall call) {
        if (controlCharacteristic == null || gatt == null) {
            call.reject("No AirWatch Bluetooth device is connected");
            return;
        }
        if (pendingControlCall != null) {
            call.reject("Another AirWatch Bluetooth command is still being sent");
            return;
        }
        String json = call.getString("json", "");
        if (json.isEmpty()) {
            call.reject("Bluetooth command is empty");
            return;
        }
        controlCharacteristic.setValue(json.getBytes(StandardCharsets.UTF_8));
        pendingControlCall = call;
        if (!gatt.writeCharacteristic(controlCharacteristic)) {
            pendingControlCall = null;
            call.reject("Could not send AirWatch command over Bluetooth");
        }
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        if (gatt != null) {
            gatt.disconnect();
            gatt.close();
            gatt = null;
        }
        statusCharacteristic = null;
        controlCharacteristic = null;
        call.resolve();
    }

}
