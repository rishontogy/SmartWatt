import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { Switch } from "@/app/components/ui/switch";
import { Progress } from "@/app/components/ui/progress";
import {
  Home,
  Zap,
  TrendingUp,
  TrendingDown,
  Activity,
  ArrowLeft,
  Lightbulb,
  Tv,
  ChefHat,
  Fan,
  Smartphone,
  Monitor,
  WashingMachine,
  Power,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

interface Device {
  id: string;
  name: string;
  type: string;
  consumption: number;
  isOn: boolean;
  description?: string;
}

interface ZoneData {
  name: string;
  consumption: number;
  status: 'High' | 'Medium' | 'Low';
  description: string;
  devices: Device[];
}

export function ZoneDetailsPage() {
  const navigate = useNavigate();
  const { zoneName } = useParams<{ zoneName: string }>();

  const [zoneData, setZoneData] = useState<ZoneData | null>(null);

  // Mock data - in real app this would come from API
  const mockZones: Record<string, ZoneData> = {
    "Living Room": {
      name: "Living Room",
      consumption: 2.8,
      status: "High",
      description: "Main entertainment and relaxation area",
      devices: [
        { id: "ac-1", name: "Air Conditioner", type: "HVAC", consumption: 320, isOn: true, description: "Central cooling system" },
        { id: "tv-1", name: "Smart TV", type: "Entertainment", consumption: 85, isOn: true, description: "55-inch LED TV" },
        { id: "lights-1", name: "LED Lights", type: "Lighting", consumption: 45, isOn: true, description: "Main ceiling lights" },
        { id: "fan-1", name: "Ceiling Fan", type: "Fan", consumption: 35, isOn: false, description: "5-blade ceiling fan" },
        { id: "sound-1", name: "Sound System", type: "Entertainment", consumption: 25, isOn: false, description: "Home theater speakers" },
      ],
    },
    "Kitchen": {
      name: "Kitchen",
      consumption: 1.5,
      status: "Medium",
      description: "Cooking and food preparation area",
      devices: [
        { id: "fridge-1", name: "Refrigerator", type: "Appliance", consumption: 120, isOn: true, description: "Double-door fridge" },
        { id: "microwave-1", name: "Microwave", type: "Appliance", consumption: 85, isOn: false, description: "1000W microwave oven" },
        { id: "coffee-1", name: "Coffee Maker", type: "Appliance", consumption: 45, isOn: true, description: "Automatic coffee machine" },
        { id: "lights-2", name: "LED Lights", type: "Lighting", consumption: 35, isOn: true, description: "Under-cabinet lighting" },
        { id: "toaster-1", name: "Toaster", type: "Appliance", consumption: 15, isOn: false, description: "4-slice toaster" },
      ],
    },
    "Bedroom": {
      name: "Bedroom",
      consumption: 0.6,
      status: "Low",
      description: "Sleeping and personal space",
      devices: [
        { id: "lights-3", name: "LED Lights", type: "Lighting", consumption: 25, isOn: true, description: "Bedside lamps" },
        { id: "fan-2", name: "Ceiling Fan", type: "Fan", consumption: 35, isOn: true, description: "Quiet ceiling fan" },
        { id: "charger-1", name: "Phone Charger", type: "Charger", consumption: 15, isOn: true, description: "Wireless charger" },
        { id: "monitor-1", name: "Computer Monitor", type: "Computer", consumption: 90, isOn: false, description: "27-inch monitor" },
        { id: "lamp-1", name: "Reading Lamp", type: "Lighting", consumption: 10, isOn: false, description: "LED reading light" },
      ],
    },
    "Bathroom": {
      name: "Bathroom",
      consumption: 0.3,
      status: "Low",
      description: "Hygiene and personal care area",
      devices: [
        { id: "lights-4", name: "LED Lights", type: "Lighting", consumption: 25, isOn: true, description: "Mirror lights" },
        { id: "fan-3", name: "Exhaust Fan", type: "Fan", consumption: 20, isOn: false, description: "Bathroom exhaust" },
        { id: "heater-1", name: "Water Heater", type: "Appliance", consumption: 150, isOn: false, description: "Electric water heater" },
      ],
    },
    "Dining Room": {
      name: "Dining Room",
      consumption: 0.4,
      status: "Low",
      description: "Eating and family gathering space",
      devices: [
        { id: "lights-5", name: "LED Lights", type: "Lighting", consumption: 40, isOn: false, description: "Chandelier lights" },
        { id: "charger-2", name: "Phone Charger", type: "Charger", consumption: 10, isOn: false, description: "Table charger" },
      ],
    },
    "Hallway": {
      name: "Hallway",
      consumption: 0.2,
      status: "Low",
      description: "Connecting spaces and corridors",
      devices: [
        { id: "lights-6", name: "LED Lights", type: "Lighting", consumption: 20, isOn: true, description: "Hallway strip lights" },
      ],
    },
  };

  useEffect(() => {
    if (zoneName && mockZones[zoneName]) {
      setZoneData(mockZones[zoneName]);
    }
  }, [zoneName]);

  const toggleDevice = (deviceId: string) => {
    if (!zoneData) return;

    setZoneData(prev => {
      if (!prev) return prev;

      const updatedDevices = prev.devices.map(device =>
        device.id === deviceId ? { ...device, isOn: !device.isOn } : device
      );

      // Recalculate total consumption
      const newConsumption = updatedDevices
        .filter(d => d.isOn)
        .reduce((sum, d) => sum + d.consumption, 0) / 1000; // Convert to kWh

      return {
        ...prev,
        devices: updatedDevices,
        consumption: newConsumption,
      };
    });
  };

  const toggleAllDevices = (turnOn: boolean) => {
    if (!zoneData) return;

    setZoneData(prev => {
      if (!prev) return prev;

      const updatedDevices = prev.devices.map(device => ({ ...device, isOn: turnOn }));

      // Recalculate total consumption
      const newConsumption = turnOn
        ? prev.devices.reduce((sum, d) => sum + d.consumption, 0) / 1000
        : 0;

      return {
        ...prev,
        devices: updatedDevices,
        consumption: newConsumption,
      };
    });
  };

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case "Lighting": return Lightbulb;
      case "Entertainment": return Tv;
      case "Appliance": return ChefHat;
      case "Fan": return Fan;
      case "Charger": return Smartphone;
      case "Computer": return Monitor;
      case "HVAC": return Fan;
      default: return Zap;
    }
  };

  const getDeviceTypeColor = (type: string) => {
    switch (type) {
      case "HVAC": return "bg-blue-100 text-blue-800";
      case "Entertainment": return "bg-purple-100 text-purple-800";
      case "Lighting": return "bg-yellow-100 text-yellow-800";
      case "Appliance": return "bg-green-100 text-green-800";
      case "Fan": return "bg-cyan-100 text-cyan-800";
      case "Computer": return "bg-indigo-100 text-indigo-800";
      case "Charger": return "bg-pink-100 text-pink-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "High": return "bg-red-100 text-red-800";
      case "Medium": return "bg-yellow-100 text-yellow-800";
      case "Low": return "bg-green-100 text-green-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  if (!zoneData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Home className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-600">Zone not found</p>
          <Button onClick={() => navigate('/dashboard/zones')} className="mt-4">
            Back to Zones
          </Button>
        </div>
      </div>
    );
  }

  // Sort devices by consumption (descending)
  const sortedDevices = [...zoneData.devices].sort((a, b) => b.consumption - a.consumption);

  const activeDevices = zoneData.devices.filter(d => d.isOn).length;
  const totalDevices = zoneData.devices.length;
  const totalConsumption = zoneData.devices
    .filter(d => d.isOn)
    .reduce((sum, d) => sum + d.consumption, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/zones')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-3">
          <Home className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{zoneData.name} Details</h1>
            <p className="text-gray-600">{zoneData.description}</p>
          </div>
        </div>
      </div>

      {/* Zone Stats */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Activity className="w-8 h-8 text-blue-600" />
            <div>
              <p className="text-2xl font-bold">{activeDevices}/{totalDevices}</p>
              <p className="text-sm text-gray-600">Active Devices</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Zap className="w-8 h-8 text-green-600" />
            <div>
              <p className="text-2xl font-bold">{totalConsumption}W</p>
              <p className="text-sm text-gray-600">Current Power</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-purple-600" />
            <div>
              <p className="text-2xl font-bold">{zoneData.consumption.toFixed(1)} kWh</p>
              <p className="text-sm text-gray-600">Today</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Badge className={getStatusColor(zoneData.status)}>
              {zoneData.status}
            </Badge>
            <div>
              <p className="text-lg font-bold">Status</p>
              <p className="text-sm text-gray-600">Consumption Level</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="p-6">
        <h3 className="text-xl font-semibold mb-4">Quick Actions</h3>
        <div className="flex gap-4">
          <Button
            variant="outline"
            onClick={() => toggleAllDevices(false)}
            className="flex items-center gap-2"
          >
            <Power className="w-4 h-4" />
            Turn All Off
          </Button>
          <Button
            variant="outline"
            onClick={() => toggleAllDevices(true)}
            className="flex items-center gap-2"
          >
            <Zap className="w-4 h-4" />
            Turn All On
          </Button>
        </div>
      </Card>

      {/* Devices List - Sorted by Consumption */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold">Devices (Sorted by Consumption)</h3>
          <Badge variant="secondary">
            {sortedDevices.length} devices
          </Badge>
        </div>

        <div className="space-y-4">
          {sortedDevices.map((device, index) => {
            const IconComponent = getDeviceIcon(device.type);
            const consumptionPercentage = (device.consumption / Math.max(...zoneData.devices.map(d => d.consumption))) * 100;

            return (
              <div key={device.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-500">#{index + 1}</span>
                      <div className={`p-2 rounded-full ${device.isOn ? "bg-green-100" : "bg-gray-100"}`}>
                        <IconComponent className={`w-5 h-5 ${device.isOn ? "text-green-600" : "text-gray-400"}`} />
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold text-lg">{device.name}</h4>
                      <p className="text-sm text-gray-600">{device.description}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className={getDeviceTypeColor(device.type)}>
                          {device.type}
                        </Badge>
                        <span className="text-sm font-medium">{device.consumption}W</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className={`w-3 h-3 rounded-full mx-auto mb-1 ${device.isOn ? "bg-green-400 animate-pulse" : "bg-gray-400"}`}></div>
                      <span className={`text-sm font-medium ${device.isOn ? "text-green-600" : "text-gray-500"}`}>
                        {device.isOn ? "ON" : "OFF"}
                      </span>
                    </div>
                    <Switch
                      checked={device.isOn}
                      onCheckedChange={() => toggleDevice(device.id)}
                    />
                  </div>
                </div>

                {/* Consumption Bar */}
                <div className="mt-3">
                  <div className="flex justify-between text-sm mb-1">
                    <span>Consumption Level</span>
                    <span>{consumptionPercentage.toFixed(0)}% of zone max</span>
                  </div>
                  <Progress value={consumptionPercentage} className="h-2" />
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}