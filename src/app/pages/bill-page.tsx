import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Badge } from "@/app/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/components/ui/table";
import {
  FileText,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Download,
  Calendar,
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useState } from "react";

// Mock daily cost data
const dailyCostData = [
  { date: "Jan 17", cost: 87.6 },
  { date: "Jan 18", cost: 92.4 },
  { date: "Jan 19", cost: 95.2 },
  { date: "Jan 20", cost: 88.8 },
  { date: "Jan 21", cost: 91.2 },
  { date: "Jan 22", cost: 103.6 },
  { date: "Jan 23", cost: 99.2 },
];

// Mock monthly trend data
const monthlyTrendData = [
  { month: "Aug", energy: 420, cost: 3360 },
  { month: "Sep", energy: 390, cost: 3120 },
  { month: "Oct", energy: 410, cost: 3280 },
  { month: "Nov", energy: 385, cost: 3080 },
  { month: "Dec", energy: 450, cost: 3600 },
  { month: "Jan", energy: 342, cost: 2736 },
];

export function BillPage() {
  const [tariffRate, setTariffRate] = useState(8);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Electricity Bill</h1>
          <p className="text-gray-600">Track your energy costs and savings</p>
        </div>
        <Button className="gap-2">
          <Download className="w-4 h-4" />
          Download Report
        </Button>
      </div>

      {/* Tariff Settings */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <DollarSign className="w-6 h-6 text-green-600" />
          <h2 className="text-xl font-semibold">Electricity Tariff</h2>
        </div>
        <div className="flex items-end gap-4">
          <div className="flex-1 max-w-xs">
            <Label htmlFor="tariff">Rate per Unit (₹/kWh)</Label>
            <Input
              id="tariff"
              type="number"
              value={tariffRate}
              onChange={(e) => setTariffRate(Number(e.target.value))}
              className="mt-2"
            />
          </div>
          <Button>Update Rate</Button>
        </div>
        <p className="text-sm text-gray-600 mt-2">
          Default tariff: ₹8 per unit (common in India). Adjust based on your location.
        </p>
      </Card>

      {/* Current Month Summary */}
      <Card className="p-6 bg-gradient-to-br from-blue-500 to-green-500 text-white">
        <div className="flex items-center gap-3 mb-6">
          <FileText className="w-8 h-8" />
          <div>
            <h2 className="text-2xl font-bold">Current Month Bill</h2>
            <p className="text-blue-100">January 2026</p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div>
            <p className="text-blue-100 text-sm mb-2">Total Energy Consumed</p>
            <p className="text-4xl font-bold">342 kWh</p>
          </div>
          <div>
            <p className="text-blue-100 text-sm mb-2">Estimated Cost</p>
            <p className="text-4xl font-bold">₹2,736</p>
          </div>
          <div>
            <p className="text-blue-100 text-sm mb-2">Days Tracked</p>
            <p className="text-4xl font-bold">23 days</p>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-6 pt-6 border-t border-white/20">
          <TrendingDown className="w-5 h-5" />
          <span className="text-sm">15% lower than last month • Saving ₹840</span>
        </div>
      </Card>

      {/* Bill Summary Table */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Bill Summary / Breakdown</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Duration</TableHead>
              <TableHead className="text-right">Energy (kWh)</TableHead>
              <TableHead className="text-right">Cost (₹)</TableHead>
              <TableHead className="text-right">Trend</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">Today</TableCell>
              <TableCell className="text-right">12.4</TableCell>
              <TableCell className="text-right">₹99.20</TableCell>
              <TableCell className="text-right">
                <Badge variant="outline" className="text-red-600">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  +12%
                </Badge>
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Yesterday</TableCell>
              <TableCell className="text-right">10.95</TableCell>
              <TableCell className="text-right">₹87.60</TableCell>
              <TableCell className="text-right">
                <Badge variant="outline" className="text-green-600">
                  <TrendingDown className="w-3 h-3 mr-1" />
                  -5%
                </Badge>
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">This Week</TableCell>
              <TableCell className="text-right">78.6</TableCell>
              <TableCell className="text-right">₹628.80</TableCell>
              <TableCell className="text-right">
                <Badge variant="outline" className="text-green-600">
                  <TrendingDown className="w-3 h-3 mr-1" />
                  -8%
                </Badge>
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">This Month</TableCell>
              <TableCell className="text-right">342</TableCell>
              <TableCell className="text-right">₹2,736</TableCell>
              <TableCell className="text-right">
                <Badge variant="outline" className="text-green-600">
                  <TrendingDown className="w-3 h-3 mr-1" />
                  -15%
                </Badge>
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Last Month</TableCell>
              <TableCell className="text-right">450</TableCell>
              <TableCell className="text-right">₹3,600</TableCell>
              <TableCell className="text-right">-</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Daily Cost Graph */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <Calendar className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-semibold">Daily Cost (Last 7 Days)</h2>
              <p className="text-sm text-gray-600">Cost per day breakdown</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dailyCostData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="cost" fill="#3b82f6" name="Cost (₹)" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Cost vs Energy */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <TrendingUp className="w-6 h-6 text-green-600" />
            <div>
              <h2 className="text-xl font-semibold">Cost vs Energy</h2>
              <p className="text-sm text-gray-600">Comparative analysis</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyTrendData}>
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
      </div>

      {/* Monthly Cost Trend */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <FileText className="w-6 h-6 text-purple-600" />
          <div>
            <h2 className="text-xl font-semibold">Monthly Cost Trend</h2>
            <p className="text-sm text-gray-600">Last 6 months comparison</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={monthlyTrendData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="cost"
              stroke="#10b981"
              strokeWidth={3}
              name="Cost (₹)"
            />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* Savings & Insights */}
      <div className="grid md:grid-cols-3 gap-6">
        <Card className="p-6 border-l-4 border-l-green-500 bg-green-50">
          <div className="flex items-center gap-3 mb-3">
            <TrendingDown className="w-6 h-6 text-green-600" />
            <h3 className="font-semibold text-green-900">Monthly Savings</h3>
          </div>
          <p className="text-4xl font-bold text-green-600 mb-2">₹840</p>
          <p className="text-sm text-green-800">vs last month</p>
        </Card>

        <Card className="p-6 border-l-4 border-l-blue-500 bg-blue-50">
          <div className="flex items-center gap-3 mb-3">
            <DollarSign className="w-6 h-6 text-blue-600" />
            <h3 className="font-semibold text-blue-900">Average Daily Cost</h3>
          </div>
          <p className="text-4xl font-bold text-blue-600 mb-2">₹119</p>
          <p className="text-sm text-blue-800">This month</p>
        </Card>

        <Card className="p-6 border-l-4 border-l-purple-500 bg-purple-50">
          <div className="flex items-center gap-3 mb-3">
            <TrendingUp className="w-6 h-6 text-purple-600" />
            <h3 className="font-semibold text-purple-900">Peak Day Cost</h3>
          </div>
          <p className="text-4xl font-bold text-purple-600 mb-2">₹142</p>
          <p className="text-sm text-purple-800">Jan 22, 2026</p>
        </Card>
      </div>

      {/* Recommendations */}
      <Card className="p-6 border-l-4 border-l-orange-500 bg-orange-50">
        <div className="flex items-start gap-4">
          <FileText className="w-6 h-6 text-orange-600 mt-1" />
          <div className="flex-1">
            <h3 className="font-semibold text-orange-900 mb-3">Cost Optimization Recommendations</h3>
            <ul className="space-y-2 text-orange-800">
              <li className="flex items-start gap-2">
                <span className="text-orange-600">•</span>
                <span>Shift AC usage from 6-10 PM (peak hours) to save ₹45/day</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-600">•</span>
                <span>Enable auto-off for unused lights to save ₹12/day</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-600">•</span>
                <span>Washing machine usage in off-peak hours can save ₹8/day</span>
              </li>
            </ul>
            <div className="flex gap-3 mt-4">
              <Badge className="bg-orange-600">Potential Monthly Savings: ₹1,950</Badge>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
