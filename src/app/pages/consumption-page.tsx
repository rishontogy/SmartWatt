import { Card } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Progress } from "@/app/components/ui/progress";
import {
  Zap,
  TrendingUp,
  TrendingDown,
  Activity,
  Wifi,
  DollarSign,
  Clock,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// Mock live data for last 5 minutes
const liveData = [
  { time: "5m ago", power: 520 },
  { time: "4m ago", power: 545 },
  { time: "3m ago", power: 530 },
  { time: "2m ago", power: 568 },
  { time: "1m ago", power: 555 },
  { time: "Now", power: 563 },
];

export function ConsumptionPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Current Electricity Consumption</h1>
          <p className="text-gray-600">Real-time power monitoring and analysis</p>
        </div>
        <Badge className="bg-green-500">
          <div className="w-2 h-2 rounded-full bg-white mr-2 animate-pulse"></div>
          Live
        </Badge>
      </div>

      {/* Main Real-Time Reading */}
      <Card className="p-8 bg-gradient-to-br from-blue-500 to-green-500 text-white">
        <div className="grid md:grid-cols-4 gap-8">
          <div>
            <p className="text-blue-100 text-sm mb-2">Real-Time Current</p>
            <p className="text-5xl font-bold">2.45 A</p>
          </div>
          <div>
            <p className="text-blue-100 text-sm mb-2">Voltage</p>
            <p className="text-5xl font-bold">230 V</p>
          </div>
          <div>
            <p className="text-blue-100 text-sm mb-2">Real-Time Power</p>
            <p className="text-5xl font-bold">563 W</p>
          </div>
          <div>
            <p className="text-blue-100 text-sm mb-2">Today's Energy</p>
            <p className="text-5xl font-bold">12.4 kWh</p>
          </div>
        </div>

        <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/20">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            <span className="text-sm">Status: Device ON</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            <span className="text-sm">Updated: 3 seconds ago</span>
          </div>
          <div className="flex items-center gap-2">
            <Wifi className="w-5 h-5" />
            <span className="text-sm">ESP32 Online</span>
          </div>
        </div>
      </Card>

      {/* Live Graph */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold">Live Power Usage</h2>
            <p className="text-sm text-gray-600">Last 5 minutes</p>
          </div>
          <Badge variant="outline">Real-time</Badge>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={liveData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" />
            <YAxis />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="power"
              stroke="#3b82f6"
              strokeWidth={3}
              dot={{ fill: "#3b82f6", r: 4 }}
              name="Power (W)"
            />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Detailed Metrics */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-6">Detailed Metrics</h2>
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600">Current (A)</span>
                <span className="text-2xl font-bold">2.45 A</span>
              </div>
              <Progress value={82} className="h-2" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600">Voltage (V)</span>
                <span className="text-2xl font-bold">230 V</span>
              </div>
              <Progress value={100} className="h-2" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600">Power (W)</span>
                <span className="text-2xl font-bold">563 W</span>
              </div>
              <Progress value={56} className="h-2" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600">Energy Today (kWh)</span>
                <span className="text-2xl font-bold">12.4 kWh</span>
              </div>
              <Progress value={62} className="h-2" />
            </div>
          </div>
        </Card>

        {/* Cost & Comparison */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-6">Cost & Comparison</h2>
          <div className="space-y-6">
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-5 h-5 text-green-600" />
                <span className="text-sm text-gray-600">Estimated Cost Today</span>
              </div>
              <p className="text-3xl font-bold text-green-600">₹99.20</p>
              <p className="text-sm text-gray-600 mt-1">@ ₹8 per unit</p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <span className="text-gray-600">vs Yesterday</span>
                <div className="flex items-center gap-2 text-red-600">
                  <TrendingUp className="w-4 h-4" />
                  <span className="font-semibold">+12%</span>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <span className="text-gray-600">vs Last Week Avg</span>
                <div className="flex items-center gap-2 text-green-600">
                  <TrendingDown className="w-4 h-4" />
                  <span className="font-semibold">-8%</span>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <span className="text-gray-600">vs Last Month Avg</span>
                <div className="flex items-center gap-2 text-green-600">
                  <TrendingDown className="w-4 h-4" />
                  <span className="font-semibold">-15%</span>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Device Health & Status */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-6">Device Health Status</h2>
        <div className="grid md:grid-cols-4 gap-4">
          <div className="p-4 border rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm">Sensor Connected</span>
              <Badge className="bg-green-500">Active</Badge>
            </div>
            <p className="font-semibold">ACS712 Current Sensor</p>
          </div>

          <div className="p-4 border rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm">ESP32 Status</span>
              <Badge className="bg-green-500">Online</Badge>
            </div>
            <p className="font-semibold">ESP32-001</p>
          </div>

          <div className="p-4 border rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm">MQTT Connected</span>
              <Badge className="bg-green-500">Connected</Badge>
            </div>
            <p className="font-semibold">Broker Active</p>
          </div>

          <div className="p-4 border rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm">API Status</span>
              <Badge className="bg-green-500">Online</Badge>
            </div>
            <p className="font-semibold">Backend Connected</p>
          </div>
        </div>
      </Card>

      {/* Appliance Detection (AI) */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <Activity className="w-6 h-6 text-purple-600" />
          <div>
            <h2 className="text-xl font-semibold">AI-Based Appliance Detection</h2>
            <p className="text-sm text-gray-600">Currently active appliances</p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <div className="p-4 border-l-4 border-l-blue-500 bg-blue-50 rounded-lg">
            <h4 className="font-semibold mb-1">Air Conditioner</h4>
            <p className="text-sm text-gray-600 mb-2">Living Room</p>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-blue-600">380 W</span>
              <Badge variant="outline">High Load</Badge>
            </div>
          </div>

          <div className="p-4 border-l-4 border-l-green-500 bg-green-50 rounded-lg">
            <h4 className="font-semibold mb-1">Refrigerator</h4>
            <p className="text-sm text-gray-600 mb-2">Kitchen</p>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-green-600">120 W</span>
              <Badge variant="outline">Continuous</Badge>
            </div>
          </div>

          <div className="p-4 border-l-4 border-l-purple-500 bg-purple-50 rounded-lg">
            <h4 className="font-semibold mb-1">LED Lights</h4>
            <p className="text-sm text-gray-600 mb-2">Multiple Rooms</p>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-purple-600">63 W</span>
              <Badge variant="outline">Low Load</Badge>
            </div>
          </div>
        </div>
      </Card>

      {/* Peak Time Recommendations */}
      <Card className="p-6 border-l-4 border-l-orange-500 bg-orange-50">
        <div className="flex items-start gap-4">
          <Activity className="w-6 h-6 text-orange-600 mt-1" />
          <div className="flex-1">
            <h3 className="font-semibold text-orange-900 mb-2">Peak-Time Recommendation</h3>
            <p className="text-orange-800 mb-4">
              You are currently using high-power appliances during peak tariff hours (6 PM - 10 PM).
              Consider shifting AC usage to off-peak hours to save ₹45/day.
            </p>
            <div className="flex gap-3">
              <Badge className="bg-orange-600">Peak Hours Active</Badge>
              <Badge variant="outline">Potential Savings: ₹1,350/month</Badge>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
