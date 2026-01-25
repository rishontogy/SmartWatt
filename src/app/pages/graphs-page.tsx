import { Card } from "@/app/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp, Activity, BarChart3 } from "lucide-react";

// Mock data for real-time power usage (last 10 minutes)
const realTimeData = [
  { time: "10:00", power: 420, current: 1.8 },
  { time: "10:01", power: 450, current: 2.0 },
  { time: "10:02", power: 480, current: 2.1 },
  { time: "10:03", power: 520, current: 2.3 },
  { time: "10:04", power: 490, current: 2.1 },
  { time: "10:05", power: 530, current: 2.3 },
  { time: "10:06", power: 560, current: 2.4 },
  { time: "10:07", power: 540, current: 2.3 },
  { time: "10:08", power: 580, current: 2.5 },
  { time: "10:09", power: 563, current: 2.45 },
];

// Mock data for daily energy consumption
const dailyData = [
  { day: "Mon", energy: 15.2, cost: 121.6 },
  { day: "Tue", energy: 13.8, cost: 110.4 },
  { day: "Wed", energy: 16.5, cost: 132.0 },
  { day: "Thu", energy: 14.2, cost: 113.6 },
  { day: "Fri", energy: 12.8, cost: 102.4 },
  { day: "Sat", energy: 18.3, cost: 146.4 },
  { day: "Sun", energy: 17.6, cost: 140.8 },
];

// Mock data for hourly consumption today
const hourlyData = [
  { hour: "00:00", energy: 0.3, motion: 0 },
  { hour: "02:00", energy: 0.2, motion: 0 },
  { hour: "04:00", energy: 0.2, motion: 0 },
  { hour: "06:00", energy: 0.4, motion: 1 },
  { hour: "08:00", energy: 1.2, motion: 3 },
  { hour: "10:00", energy: 1.8, motion: 5 },
  { hour: "12:00", energy: 2.1, motion: 6 },
  { hour: "14:00", energy: 1.9, motion: 4 },
  { hour: "16:00", energy: 1.6, motion: 3 },
  { hour: "18:00", energy: 2.3, motion: 7 },
  { hour: "20:00", energy: 1.4, motion: 4 },
  { hour: "22:00", energy: 0.8, motion: 2 },
];

// Mock data for zone-wise consumption
const zoneData = [
  { zone: "Living Room", energy: 4.5, percentage: 36 },
  { zone: "Kitchen", energy: 3.2, percentage: 26 },
  { zone: "Bedroom", energy: 2.1, percentage: 17 },
  { zone: "Bathroom", energy: 1.5, percentage: 12 },
  { zone: "Other", energy: 1.1, percentage: 9 },
];

// Mock data for monthly trend
const monthlyData = [
  { month: "Jan", energy: 420, cost: 3360 },
  { month: "Feb", energy: 380, cost: 3040 },
  { month: "Mar", energy: 410, cost: 3280 },
  { month: "Apr", energy: 390, cost: 3120 },
  { month: "May", energy: 450, cost: 3600 },
  { month: "Jun", energy: 480, cost: 3840 },
];

export function GraphsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Energy Analytics</h1>
      </div>

      <Tabs defaultValue="realtime" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="realtime">Real-Time</TabsTrigger>
          <TabsTrigger value="daily">Daily</TabsTrigger>
          <TabsTrigger value="zones">Zones</TabsTrigger>
          <TabsTrigger value="monthly">Monthly</TabsTrigger>
        </TabsList>

        {/* Real-Time Tab */}
        <TabsContent value="realtime" className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <Activity className="w-6 h-6 text-blue-600" />
              <div>
                <h2 className="text-xl font-semibold">Real-Time Power Usage</h2>
                <p className="text-sm text-gray-600">Last 10 minutes</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={400}>
              <AreaChart data={realTimeData}>
                <defs>
                  <linearGradient id="colorPower" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="power"
                  stroke="#3b82f6"
                  fillOpacity={1}
                  fill="url(#colorPower)"
                  name="Power (W)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <TrendingUp className="w-6 h-6 text-green-600" />
              <div>
                <h2 className="text-xl font-semibold">Current vs Time</h2>
                <p className="text-sm text-gray-600">Live current consumption</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={realTimeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="current" stroke="#10b981" strokeWidth={2} name="Current (A)" />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </TabsContent>

        {/* Daily Tab */}
        <TabsContent value="daily" className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <BarChart3 className="w-6 h-6 text-purple-600" />
              <div>
                <h2 className="text-xl font-semibold">Daily Energy Consumption</h2>
                <p className="text-sm text-gray-600">Last 7 days</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="energy" fill="#8b5cf6" name="Energy (kWh)" />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <Activity className="w-6 h-6 text-blue-600" />
              <div>
                <h2 className="text-xl font-semibold">Hourly Consumption Today</h2>
                <p className="text-sm text-gray-600">Energy usage by hour</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="energy" fill="#3b82f6" name="Energy (kWh)" />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <Activity className="w-6 h-6 text-orange-600" />
              <div>
                <h2 className="text-xl font-semibold">PIR Motion Activity</h2>
                <p className="text-sm text-gray-600">Motion detections by hour</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={hourlyData}>
                <defs>
                  <linearGradient id="colorMotion" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="motion"
                  stroke="#f97316"
                  fillOpacity={1}
                  fill="url(#colorMotion)"
                  name="Motion Events"
                />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </TabsContent>

        {/* Zones Tab */}
        <TabsContent value="zones" className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <BarChart3 className="w-6 h-6 text-blue-600" />
              <div>
                <h2 className="text-xl font-semibold">Zone-wise Energy Distribution</h2>
                <p className="text-sm text-gray-600">Today's consumption by zone</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={zoneData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="zone" type="category" width={100} />
                <Tooltip />
                <Legend />
                <Bar dataKey="energy" fill="#3b82f6" name="Energy (kWh)" />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <div className="grid md:grid-cols-5 gap-4">
            {zoneData.map((zone, index) => (
              <Card key={index} className="p-4">
                <h3 className="font-medium text-sm mb-2">{zone.zone}</h3>
                <p className="text-2xl font-bold text-gray-900">{zone.energy} kWh</p>
                <p className="text-sm text-gray-600 mt-1">{zone.percentage}% of total</p>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Monthly Tab */}
        <TabsContent value="monthly" className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <TrendingUp className="w-6 h-6 text-green-600" />
              <div>
                <h2 className="text-xl font-semibold">Monthly Energy Trend</h2>
                <p className="text-sm text-gray-600">Last 6 months</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="energy" stroke="#10b981" strokeWidth={2} name="Energy (kWh)" />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <Activity className="w-6 h-6 text-blue-600" />
              <div>
                <h2 className="text-xl font-semibold">Monthly Cost vs Energy</h2>
                <p className="text-sm text-gray-600">Comparative analysis</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="energy" fill="#3b82f6" name="Energy (kWh)" />
                <Bar yAxisId="right" dataKey="cost" fill="#10b981" name="Cost (₹)" />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <div className="grid md:grid-cols-3 gap-6">
            <Card className="p-6">
              <h3 className="text-sm text-gray-600 mb-2">Average Monthly</h3>
              <p className="text-3xl font-bold text-gray-900">418 kWh</p>
              <p className="text-sm text-green-600 mt-2">↓ 5% vs last quarter</p>
            </Card>
            <Card className="p-6">
              <h3 className="text-sm text-gray-600 mb-2">Total This Year</h3>
              <p className="text-3xl font-bold text-gray-900">2,510 kWh</p>
              <p className="text-sm text-blue-600 mt-2">6 months tracked</p>
            </Card>
            <Card className="p-6">
              <h3 className="text-sm text-gray-600 mb-2">Cost Savings</h3>
              <p className="text-3xl font-bold text-green-600">₹840</p>
              <p className="text-sm text-gray-600 mt-2">vs last 6 months</p>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
