import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Switch } from "@/app/components/ui/switch";
import { Badge } from "@/app/components/ui/badge";
import { Progress } from "@/app/components/ui/progress";
import {
  Zap,
  TrendingUp,
  TrendingDown,
  Activity,
  Bell,
  Power,
  WifiOff,
  DollarSign,
  BarChart3,
  Plus,
  Lightbulb,
  Tv,
  ChefHat,
  Fan,
  Smartphone,
  Monitor,
} from "lucide-react";
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";

interface UserDevice {
  id: string;
  name: string;
  zone: string;
  type: string;
  consumption: number;
  icon: string;
  isOn?: boolean;
}

export function HomePage() {
  const navigate = useNavigate();
  const [deviceOn, setDeviceOn] = useState(true);
  const [userDevices, setUserDevices] = useState<UserDevice[]>([]);

  const currentTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const currentDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Load user devices from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('userDevices');
    if (saved) {
      const devices = JSON.parse(saved);
      // Initialize isOn state for devices
      const devicesWithState = devices.map((device: UserDevice) => ({
        ...device,
        isOn: deviceOn, // All devices follow the main toggle
      }));
      setUserDevices(devicesWithState);
    }
  }, []);

  // Update device states when main toggle changes
  useEffect(() => {
    setUserDevices(prevDevices =>
      prevDevices.map(device => ({ ...device, isOn: deviceOn }))
    );
  }, [deviceOn]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
  };

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case "lighting": return Lightbulb;
      case "entertainment": return Tv;
      case "appliance": return ChefHat;
      case "fan": return Fan;
      case "charger": return Smartphone;
      case "computer": return Monitor;
      default: return Zap;
    }
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

  const getDeviceTypeLabel = (type: string) => {
    switch (type) {
      case "lighting": return "Lighting";
      case "entertainment": return "Entertainment";
      case "appliance": return "Appliance";
      case "fan": return "Fan";
      case "charger": return "Charger";
      case "computer": return "Computer";
      default: return type;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{getGreeting()}, User</h1>
          <p className="text-gray-600">
            {currentDate} • {currentTime}
          </p>
        </div>
      </div>

      {/* Notifications / Alerts */}
      <div className="grid gap-4">
        <Card className="p-4 border-l-4 border-l-yellow-500 bg-yellow-50">
          <div className="flex items-start gap-3">
            <Bell className="w-5 h-5 text-yellow-600 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-yellow-900">High Power Usage Detected</h4>
              <p className="text-sm text-yellow-800">Air Conditioner in Living Room is running during peak hours</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-l-green-500 bg-green-50">
          <div className="flex items-start gap-3">
            <Activity className="w-5 h-5 text-green-600 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-green-900">All Systems Online</h4>
              <p className="text-sm text-green-800">All ESP32 devices connected • Last sync: 3 seconds ago</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Real-Time Power Consumption - Main Highlight */}
      <Card className="p-6 bg-gradient-to-br from-blue-500 to-green-500 text-white">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Real-Time Power Consumption</h2>
          <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
            Live
          </Badge>
        </div>

        <div className="grid md:grid-cols-4 gap-6 mb-6">
          <div>
            <p className="text-blue-100 text-sm mb-1">Current</p>
            <p className="text-4xl font-bold">2.45 A</p>
          </div>
          <div>
            <p className="text-blue-100 text-sm mb-1">Voltage</p>
            <p className="text-4xl font-bold">230 V</p>
          </div>
          <div>
            <p className="text-blue-100 text-sm mb-1">Power</p>
            <p className="text-4xl font-bold">563 W</p>
          </div>
          <div>
            <p className="text-blue-100 text-sm mb-1">Today's Energy</p>
            <p className="text-4xl font-bold">12.4 kWh</p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
            <span className="text-sm">Updated: 2 seconds ago</span>
          </div>
          <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
            <Power className="w-3 h-3 mr-1" />
            Device Online
          </Badge>
        </div>
      </Card>

      {/* Device Control Section */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold">Quick Device Control</h3>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/dashboard/add-device')}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/dashboard/devices')}
            >
              View All
            </Button>
          </div>
        </div>

        {/* Main Device */}
        <div className="flex items-center justify-between p-4 border rounded-lg mb-4">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${deviceOn ? "bg-green-100 dark:bg-green-900" : "bg-muted"}`}>
              <Zap className={`w-6 h-6 ${deviceOn ? "text-green-600" : "text-gray-400"}`} />
            </div>
            <div>
              <h4 className="font-semibold">All Devices</h4>
              <p className="text-sm text-gray-600">
                Status: {deviceOn ? <span className="text-green-600 font-medium">ON</span> : <span className="text-gray-500">OFF</span>}
                {userDevices.length > 0 && ` • ${userDevices.length} device${userDevices.length > 1 ? 's' : ''}`}
              </p>
            </div>
          </div>
          <Switch checked={deviceOn} onCheckedChange={setDeviceOn} />
        </div>

        {/* User Added Devices */}
        {userDevices.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-gray-700 mb-3">Your Devices:</h4>
            <div className="grid gap-2 max-h-48 overflow-y-auto">
              {userDevices.slice(0, 5).map((device) => {
                const IconComponent = getDeviceIcon(device.type);
                return (
                  <div key={device.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`p-1.5 rounded-full ${device.isOn ? "bg-green-100 dark:bg-green-900" : "bg-muted"}`}>
                        <IconComponent className={`w-4 h-4 ${device.isOn ? "text-green-600" : "text-gray-400"}`} />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{device.name}</p>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs py-0 px-1">
                            {device.zone}
                          </Badge>
                          <Badge variant="secondary" className={`text-xs py-0 px-1 ${getDeviceTypeColor(device.type)}`}>
                            {getDeviceTypeLabel(device.type)}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-600">{device.consumption}W</span>
                      <div className={`w-2 h-2 rounded-full ${device.isOn ? "bg-green-400" : "bg-muted-foreground"}`}></div>
                    </div>
                  </div>
                );
              })}
              {userDevices.length > 5 && (
                <div className="text-center py-2 text-sm text-gray-500">
                  +{userDevices.length - 5} more devices
                </div>
              )}
            </div>
          </div>
        )}

        {userDevices.length === 0 && (
          <div className="text-center py-6 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
            <Plus className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">No devices added yet</p>
            <p className="text-xs">Click "Add" to add your first device</p>
          </div>
        )}
      </Card>

      {/* Widgets */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* Energy Consumption Widget */}
        <Link to="/dashboard/consumption">
          <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Energy Consumption</h3>
              <Activity className="w-5 h-5 text-blue-600" />
            </div>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">Today</span>
                  <span className="font-semibold">12.4 kWh</span>
                </div>
                <Progress value={65} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">This Month</span>
                  <span className="font-semibold">342 kWh</span>
                </div>
                <Progress value={45} className="h-2" />
              </div>
              <div className="flex items-center gap-2 text-sm text-green-600 mt-2">
                <TrendingDown className="w-4 h-4" />
                <span>12% lower than last month</span>
              </div>
            </div>
          </Card>
        </Link>

        {/* Electricity Bill Widget */}
        <Link to="/dashboard/bill">
          <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Electricity Bill</h3>
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-gray-600 text-sm mb-1">Estimated This Month</p>
                <p className="text-3xl font-bold text-foreground">₹2,736</p>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Today</span>
                  <span className="font-semibold">₹99.20</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Yesterday</span>
                  <span className="font-semibold">₹87.60</span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-red-600 mt-2">
                <TrendingUp className="w-4 h-4" />
                <span>8% higher than yesterday</span>
              </div>
            </div>
          </Card>
        </Link>

        {/* Quick Stats Widget */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Quick Stats</h3>
            <BarChart3 className="w-5 h-5 text-purple-600" />
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <span className="text-sm text-gray-700">Devices Online</span>
              <span className="text-xl font-bold text-blue-600">4/4</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <span className="text-sm text-gray-700">Active Zones</span>
              <span className="text-xl font-bold text-green-600">3</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
              <span className="text-sm text-gray-700">Avg Power</span>
              <span className="text-xl font-bold text-purple-600">485W</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Zone-wise consumption preview */}
      <Link to="/dashboard/zones">
        <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer">
          <h3 className="text-xl font-semibold mb-4">Zone-wise Consumption</h3>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium">Living Room</h4>
                <Badge variant="secondary">High</Badge>
              </div>
              <p className="text-2xl font-bold text-foreground">2.8 kWh</p>
              <p className="text-sm text-gray-600 mt-1">Air Conditioner, TV</p>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium">Kitchen</h4>
                <Badge variant="secondary">Medium</Badge>
              </div>
              <p className="text-2xl font-bold text-foreground">1.5 kWh</p>
              <p className="text-sm text-gray-600 mt-1">Refrigerator, Microwave</p>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium">Bedroom</h4>
                <Badge variant="secondary">Low</Badge>
              </div>
              <p className="text-2xl font-bold text-foreground">0.6 kWh</p>
              <p className="text-sm text-gray-600 mt-1">Lights, Fan</p>
            </div>
          </div>
        </Card>
      </Link>
    </div>
  );
}
