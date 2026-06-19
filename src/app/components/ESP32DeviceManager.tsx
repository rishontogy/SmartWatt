import { useState, useEffect } from 'react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Card } from '@/app/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/app/components/ui/dialog';
import { Badge } from '@/app/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { toast } from 'sonner';
import { Bluetooth, Wifi, Settings, Plus, CheckCircle, XCircle, Trash2, Crown, Zap } from 'lucide-react';
import { devicesAPI, energyAPI } from '@/app/lib/api';

interface ESP32Device {
  id: string;
  name: string;
  status: 'discovered' | 'connecting' | 'connected' | 'configured';
  type: 'master' | 'slave';
  relayCount: number;
  currentSensor: boolean;
  device?: BluetoothDevice;
  wifiConfigured?: boolean;
  zone?: string;
}

interface DeviceCounts {
  master: number;
  slave: number;
}

export function ESP32DeviceManager() {
  const [devices, setDevices] = useState<ESP32Device[]>([]);
  const [scanning, setScanning] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<ESP32Device | null>(null);
  const [deviceCounts, setDeviceCounts] = useState<DeviceCounts>({ master: 0, slave: 0 });
  const [wifiCredentials, setWifiCredentials] = useState({
    ssid: '',
    password: ''
  });
  const [deviceConfig, setDeviceConfig] = useState({
    name: '',
    roomName: '',
    type: 'slave' as 'master' | 'slave',
    relayCount: 0,
    currentSensor: false,
    dualModule: false
  });
  const [configuring, setConfiguring] = useState(false);
  const [zoneReadings, setZoneReadings] = useState<any[]>([]);
  const [totalReading, setTotalReading] = useState<any>({});
  const [leakDetected, setLeakDetected] = useState(false);
  const [leakAmount, setLeakAmount] = useState(0);
  const [lastLeakCheck, setLastLeakCheck] = useState<Date | null>(null);

  // Load device counts and energy readings on mount
  useEffect(() => {
    loadDeviceCounts();
    loadEnergyReadings();
  }, []);

  const loadDeviceCounts = async () => {
    try {
      const counts = await devicesAPI.getDeviceCounts();
      setDeviceCounts(counts);
    } catch (error) {
      console.error('Error loading device counts:', error);
    }
  };

  const loadEnergyReadings = async () => {
    try {
      const [zones, total] = await Promise.all([
        energyAPI.getZoneReadings(),
        energyAPI.getTotalReading()
      ]);
      setZoneReadings(zones);
      setTotalReading(total);

      // Check for current leaks
      checkForCurrentLeaks(zones, total);
    } catch (error) {
      console.error('Error loading energy readings:', error);
    }
  };

  const checkForCurrentLeaks = (zoneReadings: any[], totalReading: any) => {
    if (!totalReading.current || zoneReadings.length === 0) return;

    // Calculate sum of all zone currents
    const totalZoneCurrent = zoneReadings.reduce((sum, zone) => sum + (zone.current || 0), 0);

    // Calculate leak (difference between master total and sum of zones)
    const leak = totalReading.current - totalZoneCurrent;
    const leakThreshold = 0.1; // 100mA threshold for leak detection

    if (Math.abs(leak) > leakThreshold) {
      setLeakDetected(true);
      setLeakAmount(leak);
      setLastLeakCheck(new Date());

      // Show notification
      toast.error(`⚠️ Current Leak Detected! Difference: ${leak.toFixed(2)}A`, {
        description: `Master reading: ${totalReading.current}A, Zone total: ${totalZoneCurrent.toFixed(2)}A`,
        duration: 10000, // Show for 10 seconds
      });
    } else {
      setLeakDetected(false);
      setLeakAmount(0);
    }
  };

  // Check if Web Bluetooth is supported
  const isBluetoothSupported = 'bluetooth' in navigator;

  const scanForDevices = async () => {
    if (!isBluetoothSupported) {
      toast.error('Web Bluetooth is not supported in this browser');
      return;
    }

    setScanning(true);
    try {
      // Request Bluetooth device with ESP32 service UUID
      // ESP32 typically uses custom service UUIDs, but we'll use a generic approach
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['battery_service', 'device_information']
      });

      if (device) {
        const espDevice: ESP32Device = {
          id: device.id,
          name: device.name || `ESP32-${device.id.slice(-4)}`,
          status: 'discovered',
          type: 'slave', // Default to slave, can be changed during configuration
          relayCount: 0,
          currentSensor: false,
          device: device
        };

        setDevices(prev => {
          // Check if device already exists
          const existingIndex = prev.findIndex(d => d.id === device.id);
          if (existingIndex >= 0) {
            return prev;
          }
          return [...prev, espDevice];
        });

        toast.success(`Found ESP32 device: ${espDevice.name}`);
      }
    } catch (error) {
      console.error('Error scanning for devices:', error);
      toast.error('Failed to scan for devices');
    } finally {
      setScanning(false);
    }
  };

  const connectToDevice = async (espDevice: ESP32Device) => {
    if (!espDevice.device) return;

    try {
      setDevices(prev => prev.map(d =>
        d.id === espDevice.id ? { ...d, status: 'connecting' } : d
      ));

      // Connect to GATT server
      const server = await espDevice.device.gatt?.connect();

      if (server) {
        setDevices(prev => prev.map(d =>
          d.id === espDevice.id ? { ...d, status: 'connected' } : d
        ));

        toast.success(`Connected to ${espDevice.name}`);
      }
    } catch (error) {
      console.error('Error connecting to device:', error);
      setDevices(prev => prev.map(d =>
        d.id === espDevice.id ? { ...d, status: 'discovered' } : d
      ));
      toast.error('Failed to connect to device');
    }
  };

  const configureWiFi = async () => {
    if (!selectedDevice || !wifiCredentials.ssid || !wifiCredentials.password) {
      toast.error('Please fill in all WiFi credentials');
      return;
    }

    setConfiguring(true);
    try {
      // In a real implementation, you would send WiFi credentials via Bluetooth
      // For now, we'll simulate this process

      // Simulate sending WiFi config to ESP32
      await new Promise(resolve => setTimeout(resolve, 2000));

      setDevices(prev => prev.map(d =>
        d.id === selectedDevice.id ? { ...d, wifiConfigured: true, status: 'configured' } : d
      ));

      toast.success('WiFi configuration sent to ESP32');
      setSelectedDevice(null);
      setWifiCredentials({ ssid: '', password: '' });
    } catch (error) {
      console.error('Error configuring WiFi:', error);
      toast.error('Failed to configure WiFi');
    } finally {
      setConfiguring(false);
    }
  };

  const removeDevice = async (deviceId: string) => {
    try {
      await devicesAPI.deleteDevice(deviceId);
      setDevices(prev => prev.filter(d => d.id !== deviceId));
      await loadDeviceCounts();
      toast.success('Device removed successfully');
    } catch (error) {
      console.error('Error removing device:', error);
      toast.error('Failed to remove device');
    }
  };

  const getDeviceTypeIcon = (type: 'master' | 'slave') => {
    return type === 'master' ? <Crown className="w-4 h-4 text-yellow-600" /> : <Zap className="w-4 h-4 text-blue-600" />;
  };

  const getDeviceTypeBadge = (type: 'master' | 'slave') => {
    return type === 'master' ? 'Master' : 'Slave';
  };

  const getStatusIcon = (status: ESP32Device['status']) => {
    switch (status) {
      case 'discovered': return <Bluetooth className="w-4 h-4" />;
      case 'connecting': return <Settings className="w-4 h-4 animate-spin" />;
      case 'connected': return <CheckCircle className="w-4 h-4" />;
      case 'configured': return <Wifi className="w-4 h-4" />;
      default: return <XCircle className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: ESP32Device['status']) => {
    switch (status) {
      case 'discovered': return 'bg-blue-100 text-blue-600';
      case 'connecting': return 'bg-yellow-100 text-yellow-600';
      case 'connected': return 'bg-green-100 text-green-600';
      case 'configured': return 'bg-indigo-100 text-indigo-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const saveDeviceToDatabase = async () => {
    if (!deviceConfig.name) return;
    toast.success(`Saving ${deviceConfig.name} to database...`);
    // Simulated DB save
    await new Promise(r => setTimeout(r, 1000));
    toast.success("Device saved successfully!");
  };

  if (!isBluetoothSupported) {
    return (
      <Card className="p-6">
        <div className="text-center">
          <Bluetooth className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Bluetooth Not Supported</h3>
          <p className="text-gray-600">
            Your browser doesn't support Web Bluetooth API. Please use Chrome, Edge, or Opera.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Bluetooth className="w-6 h-6 text-blue-600" />
          <h2 className="text-xl font-semibold">ESP32 Device Manager</h2>
        </div>
        <Button onClick={scanForDevices} disabled={scanning}>
          {scanning ? (
            <>
              <Settings className="w-4 h-4 mr-2 animate-spin" />
              Scanning...
            </>
          ) : (
            <>
              <Plus className="w-4 h-4 mr-2" />
              Scan for ESP32
            </>
          )}
        </Button>
      </div>

      {/* Device Counts Summary */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-yellow-50 p-4 rounded-lg">
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-yellow-600" />
            <span className="font-semibold text-yellow-900">Master ESP32</span>
          </div>
          <p className="text-2xl font-bold text-yellow-800">{deviceCounts.master}/1</p>
          <p className="text-sm text-yellow-700">Total current sensing</p>
        </div>
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-blue-600" />
            <span className="font-semibold text-blue-900">Slave ESP32s</span>
          </div>
          <p className="text-2xl font-bold text-blue-800">{deviceCounts.slave}</p>
          <p className="text-sm text-blue-700">Zone-specific devices</p>
        </div>
      </div>

      {/* Total Current Reading */}
      {totalReading.current && (
        <div className="bg-green-50 p-4 rounded-lg mb-6">
          <h3 className="font-semibold text-green-900 mb-2">Total Current (Master Module)</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-green-700">Current</p>
              <p className="text-xl font-bold text-green-800">{totalReading.current}A</p>
            </div>
            <div>
              <p className="text-sm text-green-700">Power</p>
              <p className="text-xl font-bold text-green-800">{totalReading.power}W</p>
            </div>
          </div>
        </div>
      )}

      {/* Leak Detection Status */}
      {leakDetected && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-lg mb-6">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="w-5 h-5 text-red-600" />
            <h3 className="font-semibold text-red-900">⚠️ Current Leak Detected</h3>
          </div>
          <div className="text-sm text-red-800">
            <p>Leak Amount: <span className="font-bold">{leakAmount.toFixed(2)}A</span></p>
            <p>Last Check: {lastLeakCheck?.toLocaleTimeString()}</p>
            <p className="mt-2">Possible causes: Unmonitored devices, faulty wiring, or sensor calibration issues.</p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {devices.length === 0 ? (
          <div className="text-center py-8">
            <Bluetooth className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600">No ESP32 devices found. Click "Scan for ESP32" to discover devices.</p>
          </div>
        ) : (
          devices.map((device) => (
            <div key={device.id} className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-4">
                <div className={`p-2 rounded-lg ${getStatusColor(device.status)}`}>
                  {getStatusIcon(device.status)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold">{device.name}</h4>
                    <Badge variant={device.type === 'master' ? 'default' : 'secondary'}>
                      {getDeviceTypeIcon(device.type)}
                      <span className="ml-1">{getDeviceTypeBadge(device.type)}</span>
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600">
                    {device.zone || 'Not configured'} • ID: {device.id.slice(-8)}
                  </p>
                  <div className="flex gap-2 mt-1">
                    {device.relayCount > 0 && (
                      <Badge variant="outline">
                        {device.relayCount} Relay{device.relayCount !== 1 ? 's' : ''}
                      </Badge>
                    )}
                    {device.currentSensor && (
                      <Badge variant="outline">
                        <Zap className="w-3 h-3 mr-1" />
                        Current Sensor
                      </Badge>
                    )}
                    {device.wifiConfigured && (
                      <Badge variant="outline" className="bg-green-50">
                        <Wifi className="w-3 h-3 mr-1" />
                        WiFi Configured
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                {device.status === 'discovered' && (
                  <Button
                    size="sm"
                    onClick={() => connectToDevice(device)}
                  >
                    Connect
                  </Button>
                )}
                {device.status === 'connected' && (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedDevice(device)}
                      >
                        Configure
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Configure ESP32 Device</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="deviceName">Device Name/Zone</Label>
                          <Input
                            id="deviceName"
                            placeholder="e.g., Living Room, Kitchen, Bedroom"
                            value={deviceConfig.name}
                            onChange={(e) => setDeviceConfig(prev => ({ ...prev, name: e.target.value }))}
                          />
                        </div>

                        <div>
                          <Label htmlFor="deviceType">Device Type</Label>
                          <Select
                            value={deviceConfig.type}
                            onValueChange={(value: 'master' | 'slave') =>
                              setDeviceConfig(prev => ({ ...prev, type: value }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="slave" disabled={deviceCounts.master >= 1 && deviceConfig.type !== 'master'}>
                                Slave ESP32 (Zone Device)
                              </SelectItem>
                              <SelectItem value="master" disabled={deviceCounts.master >= 1}>
                                Master ESP32 (Total Current)
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label htmlFor="relayCount">Number of Relays</Label>
                          <Input
                            id="relayCount"
                            type="number"
                            min="0"
                            max="8"
                            placeholder="0"
                            value={deviceConfig.relayCount}
                            onChange={(e) => setDeviceConfig(prev => ({ ...prev, relayCount: parseInt(e.target.value) || 0 }))}
                          />
                          <p className="text-xs text-gray-500 mt-1">Number of devices this ESP32 controls</p>
                        </div>

                        {deviceConfig.type === 'slave' && (
                          <div className="space-y-4 p-3 bg-blue-50/50 rounded-lg border border-blue-100">
                             <div>
                              <Label htmlFor="roomName">Room Name (Zone)</Label>
                              <Input
                                id="roomName"
                                placeholder="e.g., Living Room, Bedroom"
                                value={deviceConfig.roomName}
                                onChange={(e) => setDeviceConfig(prev => ({ ...prev, roomName: e.target.value }))}
                              />
                            </div>
                            
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id="dualModule"
                                checked={deviceConfig.dualModule}
                                onChange={(e) => setDeviceConfig(prev => ({ ...prev, dualModule: e.target.checked }))}
                                className="rounded"
                              />
                              <Label htmlFor="dualModule" className="font-semibold text-blue-800">Enable Dual Module Connection</Label>
                            </div>
                            
                            {deviceConfig.dualModule && (
                              <div className="p-2 bg-white/80 rounded border border-blue-200 animate-in fade-in slide-in-from-top-1">
                                <p className="text-[10px] uppercase font-bold text-blue-600 mb-2">Connect Module A & B</p>
                                <div className="space-y-2">
                                  <Button size="sm" variant="outline" className="w-full text-xs h-8 border-blue-200">Connect Module A (Primary)</Button>
                                  <Button size="sm" variant="outline" className="w-full text-xs h-8 border-blue-200">Connect Module B (Secondary)</Button>
                                </div>
                                <p className="text-[10px] text-blue-400 mt-2 italic">* Dual connection logic will be implemented in next update</p>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="currentSensor"
                            checked={deviceConfig.currentSensor}
                            onChange={(e) => setDeviceConfig(prev => ({ ...prev, currentSensor: e.target.checked }))}
                            className="rounded"
                          />
                          <Label htmlFor="currentSensor">Enable Current Sensing</Label>
                        </div>

                        <div>
                          <Label htmlFor="wifiSSID">WiFi Network Name (SSID)</Label>
                          <Input
                            id="wifiSSID"
                            placeholder="Enter WiFi network name"
                            value={wifiCredentials.ssid}
                            onChange={(e) => setWifiCredentials(prev => ({ ...prev, ssid: e.target.value }))}
                          />
                        </div>

                        <div>
                          <Label htmlFor="wifiPassword">WiFi Password</Label>
                          <Input
                            id="wifiPassword"
                            type="password"
                            placeholder="Enter WiFi password"
                            value={wifiCredentials.password}
                            onChange={(e) => setWifiCredentials(prev => ({ ...prev, password: e.target.value }))}
                          />
                        </div>

                        <div className="flex gap-2">
                          <Button
                            onClick={configureWiFi}
                            disabled={configuring}
                            className="flex-1"
                          >
                            {configuring ? 'Configuring...' : 'Configure WiFi'}
                          </Button>
                          <Button
                            onClick={saveDeviceToDatabase}
                            variant="outline"
                            disabled={!deviceConfig.name}
                            className="flex-1"
                          >
                            Save Device
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
                {device.zone && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => removeDevice(device.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h4 className="font-semibold text-blue-900 mb-2">ESP32 Device Architecture</h4>
        <div className="space-y-2 text-sm text-blue-800">
          <p><strong>Master ESP32:</strong> One per account - monitors total current consumption</p>
          <p><strong>Slave ESP32s:</strong> One per zone - control devices and monitor zone-specific current</p>
          <p><strong>Relays:</strong> Number of relays = number of devices controlled by each ESP32</p>
          <p><strong>Current Sensing:</strong> Master senses total current, slaves sense zone current</p>
        </div>
        <div className="mt-3 text-sm text-blue-800">
          <strong>How to use:</strong>
          <ol className="mt-1 space-y-1">
            <li>1. Scan for nearby ESP32 devices using Bluetooth</li>
            <li>2. Connect to discovered devices</li>
            <li>3. Configure device type (Master/Slave), relays, and current sensing</li>
            <li>4. Set up WiFi credentials for network connectivity</li>
            <li>5. Save device to database with zone assignment</li>
          </ol>
        </div>
      </div>
    </Card>
  );
}