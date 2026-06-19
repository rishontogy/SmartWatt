import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Switch } from "@/app/components/ui/switch";
import { Badge } from "@/app/components/ui/badge";
import {
  Zap, Plus, Lightbulb, Tv, ChefHat,
  Fan, Smartphone, Monitor,
} from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/app/contexts/auth-context";

const SERVER_PORT = 3001;

interface UserDevice {
  id: string;
  name: string;
  zone: string;
  type: string;
  consumption: number;
  icon: string;
  isOn?: boolean;
}

function getServerBase() {
  return `http://${window.location.hostname}:${SERVER_PORT}`;
}

function getWsUrl() {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.hostname}:${SERVER_PORT}`;
}

export function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [killState, setKillState] = useState<"ON" | "OFF">("ON");
  const [killLoading, setKillLoading] = useState(false);
  const killLoadingRef = useRef(false);
  const lastActionRef = useRef<number>(0);

  const [userDevices, setUserDevices] = useState<UserDevice[]>([]);
  const [currentPower, setCurrentPower] = useState(0);
  const [currentAmp, setCurrentAmp] = useState(0);
  const [currentVoltage, setCurrentVoltage] = useState(0);
  const [currentEnergy, setCurrentEnergy] = useState("0");
  const [latestImage, setLatestImage] = useState<string | null>(null);
  const [isGuardActive, setIsGuardActive] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);

  const deviceOn = killState === "ON";

  const currentTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const currentDate = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const syncDeviceState = useCallback(
    (devices: UserDevice[], state: "ON" | "OFF") =>
      devices.map(d => ({ ...d, isOn: state === "ON" })),
    []
  );

  // ── WebSocket ──────────────────────────────────────────────
  const connectWS = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      setWsConnected(true);
      if (reconnTimer.current) { clearTimeout(reconnTimer.current); reconnTimer.current = null; }
    };
    ws.onclose = () => { setWsConnected(false); reconnTimer.current = setTimeout(connectWS, 3000); };
    ws.onerror = () => ws.close();

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // ✅ Kill switch broadcast — only update if not mid-toggle
        if (data.type === "kill_switch") {
          const newState: "ON" | "OFF" = data.state === "OFF" ? "OFF" : "ON";
          if (!killLoadingRef.current) {
            setKillState(newState);
            setUserDevices(prev => syncDeviceState(prev, newState));
          }
          return;
        }

        if (data.type === "device_toggle") {
          setUserDevices(prev =>
            prev.map(d => d.id === data.deviceId ? { ...d, isOn: data.status === "active" } : d)
          );
          return;
        }

        if (data.type === "new_image") {
          setLatestImage(`${getServerBase()}${data.url}?t=${Date.now()}`);
          return;
        }

        if (data.type === "detection_result" || data.type === "relay_update" || data.type === "guard_update") return;

        // Energy readings
        const num = (val: unknown): number | undefined => {
          if (val == null) return undefined;
          const p = parseFloat(String(val).replace(/[^0-9.-]/g, ""));
          return isNaN(p) ? undefined : p;
        };
        const d = data as Record<string, unknown>;
        const v = num(d.voltage ?? d.Voltage ?? d.V);
        const c = num(d.current ?? d.Current ?? d.I ?? d.amp);
        let p = num(d.power ?? d.Power ?? d.P ?? d.watt);
        const e = num(d.energy ?? d.Energy ?? d.E ?? d.kWh);
        if ((p === 0 || p == null) && v && c && v > 0 && c > 0) p = v * c;
        if (v != null) setCurrentVoltage(Math.round(v));
        if (c != null) setCurrentAmp(parseFloat(c.toFixed(2)));
        if (p != null) setCurrentPower(Math.round(p));
        if (e != null) setCurrentEnergy(e.toFixed(4));
      } catch { /* ignore */ }
    };
  }, [syncDeviceState]);

  // ── Fetch all data ─────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      const base = getServerBase();

      const [devRes, curRes, todayRes] = await Promise.allSettled([
        fetch(`${base}/api/devices`, { headers }).then(r => r.json()),
        fetch(`${base}/api/energy/current`, { headers }).then(r => r.json()),
        fetch(`${base}/api/energy/today`, { headers }).then(r => r.json()),
      ]);

      if (devRes.status === "fulfilled" && Array.isArray(devRes.value)) {
        const devices: UserDevice[] = devRes.value.map((d: Record<string, unknown>) => ({
          id: String(d.id ?? ""),
          name: String(d.name ?? d.id ?? ""),
          zone: String(d.zone ?? "Unknown"),
          type: String(d.type ?? "slave"),
          consumption: Number(d.power_rating ?? 0),
          icon: String(d.icon_name ?? "Zap"),
          isOn: d.status === "active",
        }));

        const msSinceAction = Date.now() - lastActionRef.current;
        if (!killLoadingRef.current && msSinceAction > 5000) {
          const firstId = String(devRes.value[0]?.id ?? "");
          if (firstId) {
            const stateRes = await fetch(`${base}/api/control/state?id=${firstId}`, { headers })
              .then(r => r.json()).catch(() => ({ state: "ON" }));
            const realState: "ON" | "OFF" = String(stateRes.state).toUpperCase() === "OFF" ? "OFF" : "ON";
            setKillState(realState);
            setUserDevices(syncDeviceState(devices, realState));
          } else {
            setUserDevices(devices);
          }
        } else {
          setUserDevices(prev =>
            devices.map(d => { const ex = prev.find(p => p.id === d.id); return ex ? { ...d, isOn: ex.isOn } : d; })
          );
        }
      }

      if (curRes.status === "fulfilled" && curRes.value) {
        const r = curRes.value as Record<string, number>;
        let p = r.power || 0;
        const v = r.voltage || 0;
        const c = r.current || 0;
        if (p === 0 && v > 0 && c > 0) p = v * c;
        setCurrentPower(Math.round(p));
        setCurrentVoltage(Math.round(v));
        setCurrentAmp(parseFloat(String(c)));
      }

      if (todayRes.status === "fulfilled" && (todayRes.value as Record<string, unknown>)?.total != null) {
        setCurrentEnergy(parseFloat(String((todayRes.value as Record<string, unknown>).total)).toFixed(4));
      }
    } catch (e) { console.error("fetchAll error:", e); }
  }, [syncDeviceState]);

  const fetchLatestImage = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const r = await fetch(`${getServerBase()}/api/latest-image`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await r.json() as { url?: string };
      if (data.url) setLatestImage(`${getServerBase()}${data.url}?t=${Date.now()}`);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchAll();
    fetchLatestImage();
    connectWS();
    const pollInterval = setInterval(fetchAll, 10000);
    const imageInterval = setInterval(fetchLatestImage, 15000);
    return () => {
      clearInterval(pollInterval);
      clearInterval(imageInterval);
      if (reconnTimer.current) clearTimeout(reconnTimer.current);
      wsRef.current?.close();
    };
  }, [fetchAll, fetchLatestImage, connectWS]);

  // ── Kill switch ────────────────────────────────────────────
  const handleKillSwitch = async (turnOn: boolean) => {
    if (killLoadingRef.current) return;

    // ✅ Optimistic update instantly
    const newState: "ON" | "OFF" = turnOn ? "ON" : "OFF";
    setKillState(newState);
    setUserDevices(prev => syncDeviceState(prev, newState));

    killLoadingRef.current = true;
    setKillLoading(true);
    lastActionRef.current = Date.now();

    try {
      const token = localStorage.getItem("token");
      const endpoint = turnOn ? "/api/control/on" : "/api/control/kill";
      const res = await fetch(`${getServerBase()}${endpoint}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { ok: boolean };
      if (!data.ok) throw new Error("Server returned ok:false");
    } catch (e) {
      console.error("Kill switch error:", e);
      // ✅ Revert on failure
      const revertState: "ON" | "OFF" = turnOn ? "OFF" : "ON";
      setKillState(revertState);
      setUserDevices(prev => syncDeviceState(prev, revertState));
    } finally {
      killLoadingRef.current = false;
      setKillLoading(false);
    }
  };

  // ── Guard toggle ───────────────────────────────────────────
  const toggleGuard = async (enabled: boolean) => {
    try {
      const token = localStorage.getItem("token");
      const deviceId = userDevices[0]?.id || "ESP32_M";
      const endpoint = enabled ? "start-guard" : "stop-guard";
      const res = await fetch(`${getServerBase()}/api/${endpoint}?device_id=${deviceId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json() as { ok: boolean };
      if (data.ok) setIsGuardActive(enabled);
    } catch (e) { console.error("Guard toggle error:", e); }
  };

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good Morning";
    if (h < 18) return "Good Afternoon";
    return "Good Evening";
  };

  const getDeviceIcon = (type: string) => {
    switch (type.toLowerCase()) {
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
    switch (type.toLowerCase()) {
      case "lighting": return "bg-yellow-100 text-yellow-800";
      case "entertainment": return "bg-purple-100 text-purple-800";
      case "appliance": return "bg-green-100 text-green-800";
      case "fan": return "bg-cyan-100 text-cyan-800";
      case "charger": return "bg-pink-100 text-pink-800";
      case "computer": return "bg-indigo-100 text-indigo-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            {getGreeting()}, {user?.name ? user.name.split(" ")[0] : "User"}
          </h1>
          <p className="text-gray-600">{currentDate} • {currentTime}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${wsConnected ? "bg-green-400 animate-pulse" : "bg-red-400"}`} />
          <span className="text-xs text-gray-500">{wsConnected ? "Live" : "Offline"}</span>
        </div>
      </div>

      {/* Camera + Guard */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Camera Feed */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Camera Feed</h3>
            <Badge variant={isGuardActive ? "default" : "secondary"}>
              {isGuardActive ? "🔴 Guard Active" : "Guard Off"}
            </Badge>
          </div>
          <div className="bg-black rounded-lg overflow-hidden aspect-video flex items-center justify-center">
            {latestImage ? (
              <img src={latestImage} alt="Camera" className="w-full h-full object-contain" />
            ) : (
              <p className="text-gray-400 text-sm">No image yet</p>
            )}
          </div>
          <div className="flex items-center justify-between mt-3">
            <span className="text-sm text-gray-600">
              {isGuardActive ? "Monitoring for humans..." : "Guard inactive"}
            </span>
            <Switch checked={isGuardActive} onCheckedChange={toggleGuard} />
          </div>
        </Card>

        {/* Kill Switch Card */}
        <Card className="p-4 flex flex-col justify-between">
          <div>
            <h3 className="font-semibold mb-1">Master Power</h3>
            <p className="text-sm text-gray-500 mb-4">
              Controls all devices in your home
            </p>
          </div>
          <div className="flex flex-col items-center gap-4">
            {/* Big visual indicator */}
            <div className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 ${deviceOn ? "bg-green-100 shadow-lg shadow-green-200" : "bg-red-100 shadow-lg shadow-red-200"
              }`}>
              <Zap className={`w-12 h-12 transition-colors duration-300 ${deviceOn ? "text-green-500" : "text-red-400"
                }`} />
            </div>
            <div className="text-center">
              <p className={`text-2xl font-bold ${deviceOn ? "text-green-600" : "text-red-500"}`}>
                {killLoading ? "Updating..." : deviceOn ? "POWER ON" : "POWER OFF"}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {deviceOn ? "Current flowing to all devices" : "All devices disconnected"}
              </p>
            </div>
            <Switch
              checked={deviceOn}
              onCheckedChange={handleKillSwitch}
              disabled={killLoading}
              className="scale-150"
            />
          </div>
        </Card>
      </div>

      {/* Real-Time Power */}
      <Card className="p-6 bg-gradient-to-br from-blue-500 to-green-500 text-white">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Real-Time Power Consumption</h2>
          <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
            {wsConnected ? "🟢 Live" : "🔴 Polling"}
          </Badge>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <p className="text-blue-100 text-sm mb-1">Current</p>
            <p className="text-3xl font-bold">{killState === "OFF" ? "0.00" : currentAmp} A</p>
          </div>
          <div>
            <p className="text-blue-100 text-sm mb-1">Voltage</p>
            <p className="text-3xl font-bold">{currentVoltage} V</p>
          </div>
          <div>
            <p className="text-blue-100 text-sm mb-1">Power</p>
            <p className="text-3xl font-bold">{killState === "OFF" ? "0" : currentPower} W</p>
          </div>
          <div>
            <p className="text-blue-100 text-sm mb-1">Today's Energy</p>
            <p className="text-3xl font-bold">{currentEnergy} kWh</p>
          </div>
        </div>
      </Card>

      {/* Device List */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold">Quick Device Control</h3>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/dashboard/add-device")}>
              <Plus className="w-4 h-4 mr-1" /> Add
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/dashboard/devices")}>
              View All
            </Button>
          </div>
        </div>

        {/* Master toggle row */}
        <div className="flex items-center justify-between p-4 border rounded-lg mb-4 bg-muted/30">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${deviceOn ? "bg-green-100" : "bg-red-100"
              }`}>
              <Zap className={`w-6 h-6 ${deviceOn ? "text-green-600" : "text-red-500"}`} />
            </div>
            <div>
              <h4 className="font-semibold">Master Toggle</h4>
              <p className="text-sm text-gray-600">
                {killLoading
                  ? "Sending command..."
                  : deviceOn
                    ? "Current is flowing to all devices"
                    : "Current stopped — all devices off"}
              </p>
            </div>
          </div>
          <Switch
            checked={deviceOn}
            onCheckedChange={handleKillSwitch}
            disabled={killLoading}
          />
        </div>

        {/* Device list */}
        <div className="grid gap-2">
          {userDevices.slice(0, 6).map(device => {
            const Icon = getDeviceIcon(device.type);
            return (
              <div key={device.id} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`p-1.5 rounded-full ${device.isOn ? "bg-green-100" : "bg-red-100"}`}>
                    <Icon className={`w-4 h-4 ${device.isOn ? "text-green-600" : "text-red-500"}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{device.name}</p>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px] py-0">{device.zone}</Badge>
                      <Badge variant="secondary" className={`text-[10px] py-0 ${getDeviceTypeColor(device.type)}`}>
                        {device.type}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-600">{device.consumption}W</span>
                  <div className={`w-2 h-2 rounded-full ${device.isOn ? "bg-green-400 animate-pulse" : "bg-red-400"}`} />
                  <span className={`text-xs font-medium ${device.isOn ? "text-green-600" : "text-red-500"}`}>
                    {device.isOn ? "ON" : "OFF"}
                  </span>
                </div>
              </div>
            );
          })}
          {userDevices.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">No devices registered yet</p>
          )}
        </div>
      </Card>
    </div>
  );
}