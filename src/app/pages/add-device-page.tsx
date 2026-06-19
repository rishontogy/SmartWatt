import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { Badge } from "@/app/components/ui/badge";
import {
  Zap,
  Plus,
  X,
  Lightbulb,
  Tv,
  ChefHat,
  Fan,
  Smartphone,
  Monitor,
  Home,
  ArrowLeft,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { devicesAPI, zonesAPI } from "@/app/lib/api";
import { toast } from "sonner";

interface Device {
  id: string;
  name: string;
  zone: string;
  type: string;
  consumption: number;
  icon: string;
}

const deviceTypes = [
  { value: "lighting", label: "Lighting", icon: Lightbulb },
  { value: "entertainment", label: "Entertainment", icon: Tv },
  { value: "appliance", label: "Appliance", icon: ChefHat },
  { value: "fan", label: "Fan", icon: Fan },
  { value: "charger", label: "Charger", icon: Smartphone },
  { value: "computer", label: "Computer", icon: Monitor },
  { value: "other", label: "Other", icon: Zap },
];

export function AddDevicePage() {
  const navigate = useNavigate();
  const [devices, setDevices] = useState<Device[]>([]);
  const [zones, setZones] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [devicesData, zonesData] = await Promise.all([
          devicesAPI.getDevices(),
          zonesAPI.getZones()
        ]);
        setDevices(devicesData);
        setZones(zonesData.map((z: any) => z.name));
      } catch (error) {
        console.error("Failed to fetch data:", error);
        toast.error("Failed to load data");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const [newDevice, setNewDevice] = useState({
    name: '',
    zone: '',
    type: '',
    consumption: '',
  });

  const getDeviceIcon = (type: string) => {
    const deviceType = deviceTypes.find(dt => dt.value === type);
    return deviceType?.icon || Zap;
  };

  const addDevice = async () => {
    if (!newDevice.name || !newDevice.zone || !newDevice.type || !newDevice.consumption) {
      toast.error('Please fill all fields');
      return;
    }

    try {
      const deviceData = {
        id: Date.now().toString(),
        zone: newDevice.zone,
        name: newDevice.name,
        type: newDevice.type,
        consumption: parseInt(newDevice.consumption),
        icon: newDevice.type,
      };

      await devicesAPI.saveDevice(deviceData);
      setDevices([...devices, deviceData]);
      toast.success('Device added successfully');

      // Reset form
      setNewDevice({
        name: '',
        zone: '',
        type: '',
        consumption: '',
      });
    } catch (error) {
      console.error("Failed to add device:", error);
      toast.error("Failed to add device");
    }
  };

  const removeDevice = async (id: string) => {
    try {
      await devicesAPI.deleteDevice(id);
      setDevices(devices.filter(d => d.id !== id));
      toast.success('Device removed successfully');
    } catch (error) {
      console.error("Failed to remove device:", error);
      toast.error("Failed to remove device");
    }
  };

  const getDeviceTypeLabel = (type: string) => {
    return deviceTypes.find(dt => dt.value === type)?.label || type;
  };

  const getDeviceTypeColor = (type: string) => {
    switch (type) {
      case "lighting": return "bg-yellow-100 text-yellow-800";
      case "entertainment": return "bg-purple-100 text-purple-800";
      case "appliance": return "bg-green-100 text-green-800";
      case "fan": return "bg-cyan-100 text-cyan-800";
      case "charger": return "bg-pink-100 text-pink-800";
      case "computer": return "bg-indigo-100 text-indigo-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  if (loading) {
    return <div className="space-y-6">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Add Devices</h1>
          <p className="text-gray-600">Add and manage your smart home devices</p>
        </div>
      </div>

      {/* Add Device Form */}
      <Card className="p-6">
        <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Plus className="w-5 h-5" />
          Add New Device
        </h3>

        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div>
            <Label htmlFor="device-name">Device Name</Label>
            <Input
              id="device-name"
              placeholder="e.g., Living Room Light"
              value={newDevice.name}
              onChange={(e) => setNewDevice({...newDevice, name: e.target.value})}
            />
          </div>

          <div>
            <Label htmlFor="device-zone">Zone</Label>
            <Select value={newDevice.zone} onValueChange={(value) => setNewDevice({...newDevice, zone: value})}>
              <SelectTrigger>
                <SelectValue placeholder="Select zone" />
              </SelectTrigger>
              <SelectContent>
                {zones.map((zone) => (
                  <SelectItem key={zone} value={zone}>
                    {zone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="device-type">Device Type</Label>
            <Select value={newDevice.type} onValueChange={(value) => setNewDevice({...newDevice, type: value})}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {deviceTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <div className="flex items-center gap-2">
                      <type.icon className="w-4 h-4" />
                      {type.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="device-consumption">Power Consumption (Watts)</Label>
            <Input
              id="device-consumption"
              type="number"
              placeholder="e.g., 60"
              value={newDevice.consumption}
              onChange={(e) => setNewDevice({...newDevice, consumption: e.target.value})}
            />
          </div>
        </div>

        <Button onClick={addDevice} className="w-full">
          <Plus className="w-4 h-4 mr-2" />
          Add Device
        </Button>
      </Card>

      {/* Device List */}
      <Card className="p-6">
        <h3 className="text-xl font-semibold mb-4">Your Devices ({devices.length})</h3>

        {devices.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Home className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>No devices added yet</p>
            <p className="text-sm">Add your first device above</p>
          </div>
        ) : (
          <div className="space-y-3">
            {devices.map((device) => {
              const IconComponent = getDeviceIcon(device.type);
              return (
                <div key={device.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-blue-100 rounded-full">
                      <IconComponent className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-medium">{device.name}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary">{device.zone}</Badge>
                        <Badge variant="secondary" className={getDeviceTypeColor(device.type)}>
                          {getDeviceTypeLabel(device.type)}
                        </Badge>
                        <span className="text-sm text-gray-600">{device.consumption}W</span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeDevice(device.id)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}