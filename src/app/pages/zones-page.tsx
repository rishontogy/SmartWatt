import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
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
} from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Zone {
  name: string;
  consumption: number;
  status: 'High' | 'Medium' | 'Low';
  devices: Array<{
    id: string;
    name: string;
    type: string;
    consumption: number;
    isOn: boolean;
  }>;
  description: string;
}

export function ZonesPage() {
  const navigate = useNavigate();

  // Mock data - in real app this would come from API
  const zones: Zone[] = [
    {
      name: "Living Room",
      consumption: 2.8,
      status: "High",
      description: "Main entertainment and relaxation area",
      devices: [
        { id: "ac-1", name: "Air Conditioner", type: "HVAC", consumption: 320, isOn: true },
        { id: "tv-1", name: "Smart TV", type: "Entertainment", consumption: 85, isOn: true },
        { id: "lights-1", name: "LED Lights", type: "Lighting", consumption: 45, isOn: true },
        { id: "fan-1", name: "Ceiling Fan", type: "Fan", consumption: 35, isOn: false },
      ],
    },
    {
      name: "Kitchen",
      consumption: 1.5,
      status: "Medium",
      description: "Cooking and food preparation area",
      devices: [
        { id: "fridge-1", name: "Refrigerator", type: "Appliance", consumption: 120, isOn: true },
        { id: "microwave-1", name: "Microwave", type: "Appliance", consumption: 85, isOn: false },
        { id: "coffee-1", name: "Coffee Maker", type: "Appliance", consumption: 45, isOn: true },
        { id: "lights-2", name: "LED Lights", type: "Lighting", consumption: 35, isOn: true },
      ],
    },
    {
      name: "Bedroom",
      consumption: 0.6,
      status: "Low",
      description: "Sleeping and personal space",
      devices: [
        { id: "lights-3", name: "LED Lights", type: "Lighting", consumption: 25, isOn: true },
        { id: "fan-2", name: "Ceiling Fan", type: "Fan", consumption: 35, isOn: true },
        { id: "charger-1", name: "Phone Charger", type: "Charger", consumption: 15, isOn: true },
        { id: "monitor-1", name: "Computer Monitor", type: "Computer", consumption: 90, isOn: false },
      ],
    },
    {
      name: "Bathroom",
      consumption: 0.3,
      status: "Low",
      description: "Hygiene and personal care area",
      devices: [
        { id: "lights-4", name: "LED Lights", type: "Lighting", consumption: 25, isOn: true },
        { id: "fan-3", name: "Exhaust Fan", type: "Fan", consumption: 20, isOn: false },
      ],
    },
    {
      name: "Dining Room",
      consumption: 0.4,
      status: "Low",
      description: "Eating and family gathering space",
      devices: [
        { id: "lights-5", name: "LED Lights", type: "Lighting", consumption: 40, isOn: false },
      ],
    },
    {
      name: "Hallway",
      consumption: 0.2,
      status: "Low",
      description: "Connecting spaces and corridors",
      devices: [
        { id: "lights-6", name: "LED Lights", type: "Lighting", consumption: 20, isOn: true },
      ],
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "High": return "bg-red-100 text-red-800";
      case "Medium": return "bg-yellow-100 text-yellow-800";
      case "Low": return "bg-green-100 text-green-800";
      default: return "bg-gray-100 text-gray-800";
    }
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

  const totalConsumption = zones.reduce((sum, zone) => sum + zone.consumption, 0);
  const activeZones = zones.filter(zone => zone.devices.some(d => d.isOn)).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Zone Management</h1>
          <p className="text-muted-foreground">Monitor and control energy consumption by zone</p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Home className="w-8 h-8 text-blue-600" />
            <div>
              <p className="text-2xl font-bold">{zones.length}</p>
              <p className="text-sm text-muted-foreground">Total Zones</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Activity className="w-8 h-8 text-green-600" />
            <div>
              <p className="text-2xl font-bold">{activeZones}</p>
              <p className="text-sm text-muted-foreground">Active Zones</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Zap className="w-8 h-8 text-purple-600" />
            <div>
              <p className="text-2xl font-bold">{totalConsumption.toFixed(1)} kWh</p>
              <p className="text-sm text-muted-foreground">Total Today</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-orange-600" />
            <div>
              <p className="text-2xl font-bold">12%</p>
              <p className="text-sm text-muted-foreground">vs Yesterday</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Zones Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {zones.map((zone) => (
          <Card key={zone.name} className="p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Home className="w-6 h-6 text-blue-600" />
                <div>
                  <h3 className="text-lg font-semibold">{zone.name}</h3>
                  <p className="text-sm text-muted-foreground">{zone.description}</p>
                </div>
              </div>
              <Badge className={getStatusColor(zone.status)}>
                {zone.status}
              </Badge>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">Today's Consumption</span>
                  <span className="text-lg font-bold">{zone.consumption} kWh</span>
                </div>
                <Progress
                  value={zone.status === 'High' ? 80 : zone.status === 'Medium' ? 50 : 20}
                  className="h-2"
                />
              </div>

              <div>
                <h4 className="font-medium mb-3">Devices ({zone.devices.filter(d => d.isOn).length}/{zone.devices.length} active)</h4>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {zone.devices.map((device) => {
                    const IconComponent = getDeviceIcon(device.type);
                    return (
                      <div key={device.id} className="flex items-center justify-between p-2 bg-muted rounded-lg">
                        <div className="flex items-center gap-2">
                          <div className={`p-1 rounded-full ${device.isOn ? "bg-green-100 dark:bg-green-900" : "bg-muted"}`}>
                            <IconComponent className={`w-3 h-3 ${device.isOn ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`} />
                          </div>
                          <span className="text-sm font-medium">{device.name}</span>
                          <Badge variant="secondary" className={`text-xs ${getDeviceTypeColor(device.type)}`}>
                            {device.type}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{device.consumption}W</span>
                          <div className={`w-2 h-2 rounded-full ${device.isOn ? "bg-green-400 animate-pulse" : "bg-muted-foreground"}`}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2">
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => navigate(`/dashboard/zones/${encodeURIComponent(zone.name)}`)}
                >
                  View Details
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}