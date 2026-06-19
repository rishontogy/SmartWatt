import { Card } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Progress } from "@/app/components/ui/progress";
import { Zap, TrendingUp, TrendingDown, Activity, Wifi, DollarSign, Clock } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import { useState, useEffect, useRef, useCallback } from "react";

const SERVER_PORT = 3001;

function getServerBase() {
  return `http://${window.location.hostname}:${SERVER_PORT}`;
}
function getWsUrl() {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.hostname}:${SERVER_PORT}`;
}

export function ConsumptionPage() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [liveData, setLiveData] = useState<any[]>([]);
  const [currentPower, setCurrentPower] = useState(0);
  const [currentAmp, setCurrentAmp] = useState(0);
  const [currentVoltage, setCurrentVoltage] = useState(0);
  const [currentEnergy, setCurrentEnergy] = useState<string>('0');
  const [wsConnected, setWsConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>('--');

  // ─── WebSocket with auto-reconnect ───
  const connectWS = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      setWsConnected(true);
      console.log('✅ Consumption WS connected');
      if (reconnTimer.current) { clearTimeout(reconnTimer.current); reconnTimer.current = null; }
    };

    ws.onclose = () => {
      setWsConnected(false);
      reconnTimer.current = setTimeout(connectWS, 3000);
    };

    ws.onerror = () => ws.close();

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Ignore non-energy messages
        if (data.type && !['energy', undefined].includes(data.type)) return;

        const num = (val: any) => {
          if (val == null) return undefined;
          const p = parseFloat(String(val).replace(/[^0-9.-]/g, ''));
          return isNaN(p) ? undefined : p;
        };

        let v = num(data.voltage ?? data.Voltage ?? data.V);
        let c = num(data.current ?? data.Current ?? data.I ?? data.amp);
        let p = num(data.power ?? data.Power ?? data.P ?? data.watt);
        let e = num(data.energy ?? data.Energy ?? data.E ?? data.kWh);

        if ((p === 0 || p == null) && v && c && v > 0 && c > 0) p = v * c;

        if (v != null) setCurrentVoltage(Math.round(v));
        if (c != null) setCurrentAmp(parseFloat(c.toFixed(3)));
        if (p != null) {
          setCurrentPower(Math.round(p));
          setLiveData(prev => [
            ...prev.slice(-19),
            {
              time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              power: Math.round(p!)
            }
          ]);
        }
        if (e != null) setCurrentEnergy(e.toFixed(4));
        setLastUpdated(new Date().toLocaleTimeString());
      } catch { }
    };
  }, []);

  // ─── HTTP polling fallback ───
  const fetchLive = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const base = getServerBase();

      const [histRes, curRes, todayRes] = await Promise.allSettled([
        fetch(`${base}/api/energy/history?period=day`, { headers }).then(r => r.json()),
        fetch(`${base}/api/energy/current`, { headers }).then(r => r.json()),
        fetch(`${base}/api/energy/today`, { headers }).then(r => r.json()),
      ]);

      if (histRes.status === 'fulfilled' && Array.isArray(histRes.value) && histRes.value.length > 0) {
        setLiveData(histRes.value.slice().reverse());
      }

      if (curRes.status === 'fulfilled' && curRes.value) {
        const r = curRes.value;
        let p = r.power || 0;
        let v = r.voltage || 0;
        let c = r.current || 0;
        if (p === 0 && v > 0 && c > 0) p = v * c;
        if (p) setCurrentPower(Math.round(p));
        if (v) setCurrentVoltage(Math.round(v));
        if (c) setCurrentAmp(parseFloat(c));
        setLastUpdated(new Date().toLocaleTimeString());
      }

      if (todayRes.status === 'fulfilled' && todayRes.value?.total != null) {
        setCurrentEnergy(parseFloat(todayRes.value.total).toFixed(4));
      }
    } catch (e) { console.error('fetchLive error:', e); }
  }, []);

  useEffect(() => {
    fetchLive();
    connectWS();

    const pollInterval = setInterval(fetchLive, 5000);

    return () => {
      clearInterval(pollInterval);
      if (reconnTimer.current) clearTimeout(reconnTimer.current);
      wsRef.current?.close();
    };
  }, [fetchLive, connectWS]);

  const estimatedCost = (Number(currentEnergy) * 8).toFixed(2);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Current Electricity Consumption</h1>
          <p className="text-gray-600">Real-time power monitoring and analysis</p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'}`} />
          <Badge className={wsConnected ? 'bg-green-500' : 'bg-yellow-500'}>
            {wsConnected ? '🟢 Live' : '🟡 Polling'}
          </Badge>
        </div>
      </div>

      {/* Main readings */}
      <Card className="p-8 bg-gradient-to-br from-blue-500 to-green-500 text-white">
        <div className="grid md:grid-cols-4 gap-8">
          <div>
            <p className="text-blue-100 text-sm mb-2">Real-Time Current</p>
            <p className="text-5xl font-bold">{Number(currentAmp).toFixed(3)}<span className="text-2xl ml-1">A</span></p>
          </div>
          <div>
            <p className="text-blue-100 text-sm mb-2">Voltage</p>
            <p className="text-5xl font-bold">{currentVoltage}<span className="text-2xl ml-1">V</span></p>
          </div>
          <div>
            <p className="text-blue-100 text-sm mb-2">Real-Time Power</p>
            <p className="text-5xl font-bold">{currentPower}<span className="text-2xl ml-1">W</span></p>
          </div>
          <div>
            <p className="text-blue-100 text-sm mb-2">Today's Energy</p>
            <p className="text-5xl font-bold">{currentEnergy}<span className="text-xl ml-1">kWh</span></p>
          </div>
        </div>
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/20">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            <span className="text-sm">Status: {currentPower > 0 ? 'Device ON' : 'Standby'}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            <span className="text-sm">Updated: {lastUpdated}</span>
          </div>
          <div className="flex items-center gap-2">
            <Wifi className="w-5 h-5" />
            <span className="text-sm">{wsConnected ? 'WebSocket Live' : 'HTTP Polling'}</span>
          </div>
        </div>
      </Card>

      {/* Live graph */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold">Live Power Usage</h2>
            <p className="text-sm text-gray-600">Last 20 readings</p>
          </div>
          <Badge variant="outline">Real-time</Badge>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={liveData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" tick={{ fontSize: 11 }} />
            <YAxis />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="power"
              stroke="#3b82f6"
              strokeWidth={3}
              dot={{ fill: '#3b82f6', r: 3 }}
              name="Power (W)"
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Detailed metrics */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-6">Detailed Metrics</h2>
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600">Current (A)</span>
                <span className="text-2xl font-bold">{currentAmp} A</span>
              </div>
              <Progress value={Math.min((currentAmp / 10) * 100, 100)} className="h-2" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600">Voltage (V)</span>
                <span className="text-2xl font-bold">{currentVoltage} V</span>
              </div>
              <Progress value={Math.min((currentVoltage / 250) * 100, 100)} className="h-2" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600">Power (W)</span>
                <span className="text-2xl font-bold">{currentPower} W</span>
              </div>
              <Progress value={Math.min((currentPower / 3000) * 100, 100)} className="h-2" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600">Energy Today (kWh)</span>
                <span className="text-2xl font-bold">{currentEnergy} kWh</span>
              </div>
              <Progress value={Math.min((Number(currentEnergy) / 20) * 100, 100)} className="h-2" />
            </div>
          </div>
        </Card>

        {/* Cost */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-6">Cost & Comparison</h2>
          <div className="space-y-6">
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-5 h-5 text-green-600" />
                <span className="text-sm text-gray-600">Estimated Cost Today</span>
              </div>
              <p className="text-3xl font-bold text-green-600">₹{estimatedCost}</p>
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
            </div>
          </div>
        </Card>
      </div>

      {/* Device health */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-6">Device Health Status</h2>
        <div className="grid md:grid-cols-4 gap-4">
          <div className="p-4 border rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm">Sensor</span>
              <Badge className={currentPower > 0 ? 'bg-green-500' : 'bg-gray-400'}>
                {currentPower > 0 ? 'Active' : 'Idle'}
              </Badge>
            </div>
            <p className="font-semibold">Current Sensor</p>
          </div>
          <div className="p-4 border rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm">ESP32 Status</span>
              <Badge className="bg-green-500">Online</Badge>
            </div>
            <p className="font-semibold">Master ESP32</p>
          </div>
          <div className="p-4 border rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm">WebSocket</span>
              <Badge className={wsConnected ? 'bg-green-500' : 'bg-yellow-500'}>
                {wsConnected ? 'Connected' : 'Polling'}
              </Badge>
            </div>
            <p className="font-semibold">Live Data Bridge</p>
          </div>
          <div className="p-4 border rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm">API Status</span>
              <Badge className="bg-green-500">Online</Badge>
            </div>
            <p className="font-semibold">Port {SERVER_PORT}</p>
          </div>
        </div>
      </Card>

      {/* Peak time recommendation */}
      <Card className="p-6 border-l-4 border-l-orange-500 bg-orange-50">
        <div className="flex items-start gap-4">
          <Activity className="w-6 h-6 text-orange-600 mt-1" />
          <div className="flex-1">
            <h3 className="font-semibold text-orange-900 mb-2">Peak-Time Recommendation</h3>
            <p className="text-orange-800 mb-4">
              Consider shifting high-power appliance usage to off-peak hours (before 6 PM or after 10 PM)
              to reduce your electricity bill.
            </p>
            <div className="flex gap-3">
              <Badge className="bg-orange-600">Peak Hours: 6PM–10PM</Badge>
              <Badge variant="outline">Estimated savings: ₹1,350/month</Badge>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}