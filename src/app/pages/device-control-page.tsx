import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Switch } from "@/app/components/ui/switch";
import { Badge } from "@/app/components/ui/badge";
import { Progress } from "@/app/components/ui/progress";
import {
  Zap,
  Power,
  Home,
  Lightbulb,
  Tv,
  ChefHat,
  Fan,
  Wifi,
  Smartphone,
  Monitor,
  WashingMachine,
} from "lucide-react";
import { useState } from "react";

interface Device {
  id: string;
  name: string;
  zone: string;
  type: string;
  consumption: number;
  isOn: boolean;
  icon: any;
}

interface Zone {
  name: string;
  totalConsumption: number;
  devices: Device[];
}

export function DeviceControlPage() {
  // Mock data - in real app this would come from API
  const [zones, setZones] = useState<Zone[]>([
    {
      name: "Living Room",
      totalConsumption: 485,
      devices: [
        {
          id: "ac-1",
          name: "Air Conditioner",
          zone: "Living Room",
          type: "HVAC",
          consumption: 320,
          isOn: true,
          icon: Fan,
        },
        {
          id: "tv-1",
          name: "Smart TV",
          zone: "Living Room",
          type: "Entertainment",
          consumption: 85,
          isOn: true,
          icon: Tv,
        },
        {
          id: "lights-1",
          name: "LED Lights",
          zone: "Living Room",
          type: "Lighting",
          consumption: 45,
          isOn: true,
          icon: Lightbulb,
        },
        {
          id: "fan-1",
          name: "Ceiling Fan",
          zone: "Living Room",
          type: "Fan",
          consumption: 35,
          isOn: false,
          icon: Fan,
        },
      ],
    },
    {
      name: "Kitchen",
      totalConsumption: 285,
      devices: [
        {
          id: "fridge-1",
          name: "Refrigerator",
          zone: "Kitchen",
          type: "Appliance",
          consumption: 120,
          isOn: true,
          icon: ChefHat,
        },
        {
          id: "microwave-1",
          name: "Microwave",
          zone: "Kitchen",
          type: "Appliance",
          consumption: 85,
          isOn: false,
          icon: ChefHat,
        },
        {
          id: "coffee-1",
          name: "Coffee Maker",
          zone: "Kitchen",
          type: "Appliance",
          consumption: 45,
          isOn: true,
          icon: ChefHat,
        },
        {
          id: "lights-2",
          name: "LED Lights",
          zone: "Kitchen",
          type: "Lighting",
          consumption: 35,
          isOn: true,
          icon: Lightbulb,
        },
      ],
    },
    {
      name: "Bedroom",
      totalConsumption: 165,
      devices: [
        {
          id: "lights-3",
          name: "LED Lights",
          zone: "Bedroom",
          type: "Lighting",
          consumption: 25,
          isOn: true,
          icon: Lightbulb,
        },
        {
          id: "fan-2",
          name: "Ceiling Fan",
          zone: "Bedroom",
          type: "Fan",
          consumption: 35,
          isOn: true,
          icon: Fan,
        },
        {
          id: "charger-1",
          name: "Phone Charger",
          zone: "Bedroom",
          type: "Charger",
          consumption: 15,
          isOn: true,
          icon: Smartphone,
        },
        {
          id: "monitor-1",
          name: "Computer Monitor",
          zone: "Bedroom",
          type: "Computer",
          consumption: 90,
          isOn: false,
          icon: Monitor,
        },
      ],
    },
    {
      name: "Bathroom",
      totalConsumption: 45,
      devices: [
        {
          id: "lights-4",
          name: "LED Lights",
          zone: "Bathroom",
          type: "Lighting",
          consumption: 25,
          isOn: true,
          icon: Lightbulb,
        },
        {
          id: "fan-3",
          name: "Exhaust Fan",
          zone: "Bathroom",
          type: "Fan",
          consumption: 20,
          isOn: false,
          icon: Fan,
        },
      ],
    },
  ]);

  const toggleDevice = (zoneIndex: number, deviceIndex: number) => {
    setZones(prevZones => {
      const newZones = [...prevZones];
      const device = newZones[zoneIndex].devices[deviceIndex];
      device.isOn = !device.isOn;

      // Recalculate zone total consumption
      newZones[zoneIndex].totalConsumption = newZones[zoneIndex].devices
        .filter(d => d.isOn)
        .reduce((sum, d) => sum + d.consumption, 0);

      return newZones;
    });
  };

  const toggleAllInZone = (zoneIndex: number, turnOn: boolean) => {
    setZones(prevZones => {
      const newZones = [...prevZones];
      newZones[zoneIndex].devices.forEach(device => {
        device.isOn = turnOn;
      });

      // Recalculate zone total consumption
      newZones[zoneIndex].totalConsumption = turnOn
        ? newZones[zoneIndex].devices.reduce((sum, d) => sum + d.consumption, 0)
        : 0;

      return newZones;
    });
  };

  // Sort zones by total consumption (descending)
  const sortedZones = [...zones].sort((a, b) => b.totalConsumption - a.totalConsumption);

  const totalConsumption = zones.reduce((sum, zone) => sum + zone.totalConsumption, 0);
  const totalDevicesOn = zones.reduce((sum, zone) =>
    sum + zone.devices.filter(d => d.isOn).length, 0
  );

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Device Control</h1>
          <p className="text-muted-foreground">Manage and monitor your smart home devices</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">{totalConsumption}W</p>
            <p className="text-sm text-muted-foreground">Total Power</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{totalDevicesOn}</p>
            <p className="text-sm text-muted-foreground">Devices ON</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <Card className="p-6">
        <h3 className="text-xl font-semibold mb-4">Quick Actions</h3>
        <div className="flex gap-4">
          <Button
            variant="outline"
            onClick={() => zones.forEach((_, i) => toggleAllInZone(i, false))}
            className="flex items-center gap-2"
          >
            <Power className="w-4 h-4" />
            Turn All Off
          </Button>
          <Button
            variant="outline"
            onClick={() => zones.forEach((_, i) => toggleAllInZone(i, true))}
            className="flex items-center gap-2"
          >
            <Zap className="w-4 h-4" />
            Turn All On
          </Button>
        </div>
      </Card>

      {/* Zones */}
      <div className="space-y-6">
        {sortedZones.map((zone, zoneIndex) => (
          <Card key={zone.name} className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Home className="w-6 h-6 text-blue-600" />
                <div>
                  <h3 className="text-xl font-semibold">{zone.name}</h3>
                  <p className="text-muted-foreground">{zone.totalConsumption}W • {zone.devices.filter(d => d.isOn).length}/{zone.devices.length} devices on</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => toggleAllInZone(zones.findIndex(z => z.name === zone.name), false)}
                >
                  All Off
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => toggleAllInZone(zones.findIndex(z => z.name === zone.name), true)}
                >
                  All On
                </Button>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {zone.devices.map((device, deviceIndex) => {
                const IconComponent = device.icon;
                return (
                  <div
                    key={device.id}
                    className={`p-4 border rounded-lg transition-all ${
                      device.isOn
                        ? "border-green-200 bg-green-50"
                        : "border-gray-200 bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${
                          device.isOn ? "bg-green-100" : "bg-gray-100"
                        }`}>
                          <IconComponent className={`w-5 h-5 ${
                            device.isOn ? "text-green-600" : "text-gray-400"
                          }`} />
                        </div>
                        <div>
                          <h4 className="font-medium">{device.name}</h4>
                          <Badge variant="secondary" className={getDeviceTypeColor(device.type)}>
                            {device.type}
                          </Badge>
                        </div>
                      </div>
                      <Switch
                        checked={device.isOn}
                        onCheckedChange={() => toggleDevice(
                          zones.findIndex(z => z.name === zone.name),
                          deviceIndex
                        )}
                      />
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">
                        {device.isOn ? `${device.consumption}W` : "Off"}
                      </span>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          device.isOn ? "bg-green-400 animate-pulse" : "bg-gray-400"
                        }`}></div>
                        <span className={device.isOn ? "text-green-600" : "text-gray-500"}>
                          {device.isOn ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}