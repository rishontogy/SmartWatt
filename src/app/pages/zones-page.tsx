import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { Progress } from "@/app/components/ui/progress";
import {
  Home, Zap, TrendingUp, Activity, ArrowLeft,
  Lightbulb, Tv, ChefHat, Fan, Smartphone, Monitor,
  BedDouble, UtensilsCrossed, Sofa, Bath,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useRef, useCallback } from "react";
import { devicesAPI, zonesAPI } from "@/app/lib/api";

const SERVER_PORT = 3001;
const MASTER_DEVICE_ID = "ESP32_MAIN"; // master ESP id — excluded from room breakdown

function getServerBase() {
  return `http://${window.location.hostname}:${SERVER_PORT}`;
}

function getWsUrl() {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.hostname}:${SERVER_PORT}`;
}

interface DeviceInfo {
  id: string;
  name: string;
  type: string;
  consumption: number;
  isOn: boolean;
  isMaster: boolean;
}

interface ZoneInfo {
  name: string;
  todayKwh: number;
  currentW: number;
  status: "High" | "Medium" | "Low";
  devices: DeviceInfo[];
}

interface MasterStats {
  voltage: number;
  current: number;
  power: number;
  todayKwh: number;
}

export function ZonesPage() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const navigate = useNavigate();
  const [zones, setZones] = useState<ZoneInfo[]>([]);
  const [master, setMaster] = useState<MasterStats>({
    voltage: 0, current: 0, power: 0, todayKwh: 0,
  });
  const [totalCurrentW, setTotalCurrentW] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  const fetchData = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const headers: HeadersInit = { Authorization: `Bearer ${token}` };
      const base = getServerBase();

      const [zonesData, devicesData, todayRes, energyRes] = await Promise.allSettled([
        zonesAPI.getZones(),
        devicesAPI.getDevices(),
        fetch(`${base}/api/energy/today`, { headers }).then(r => r.json()),
        fetch(`${base}/api/energy/current`, { headers }).then(r => r.json()),
      ]);

      // ── Master ESP energy (top overview) ──
      let masterTodayKwh = 0;
      let masterVoltage = 0;
      let masterCurrent = 0;
      let masterPower = 0;

      if (todayRes.status === "fulfilled" && todayRes.value?.total != null) {
        masterTodayKwh = parseFloat(todayRes.value.total) || 0;
      }
      if (energyRes.status === "fulfilled" && energyRes.value) {
        const e = energyRes.value as Record<string, number>;
        masterVoltage = e.voltage || 0;
        masterCurrent = e.current || 0;
        masterPower = e.power || 0;
        if (masterPower === 0 && masterVoltage > 0 && masterCurrent > 0) {
          masterPower = masterVoltage * masterCurrent;
        }
      }

      setMaster({
        voltage: Math.round(masterVoltage),
        current: parseFloat(masterCurrent.toFixed(3)),
        power: Math.round(masterPower),
        todayKwh: parseFloat(masterTodayKwh.toFixed(4)),
      });

      // ── Build zone map — EXCLUDE master ESP ──
      const zonesMap = new Map<string, ZoneInfo>();

      if (zonesData.status === "fulfilled") {
        zonesData.value.forEach((z: any) => {
          zonesMap.set(z.name, {
            name: z.name,
            todayKwh: 0,
            currentW: 0,
            status: "Low",
            devices: [],
          });
        });
      }

      if (devicesData.status === "fulfilled") {
        devicesData.value.forEach((d: any) => {
          // Skip master ESP from room breakdown entirely
          if (d.id === MASTER_DEVICE_ID || d.type === "master") return;

          const zoneName = d.zone || "Unknown";
          if (!zonesMap.has(zoneName)) {
            zonesMap.set(zoneName, {
              name: zoneName,
              todayKwh: 0,
              currentW: 0,
              status: "Low",
              devices: [],
            });
          }
          zonesMap.get(zoneName)!.devices.push({
            id: d.id,
            name: d.name || d.id,
            type: d.type || "slave",
            consumption: d.power_rating || 0,
            isOn: d.status === "active",
            isMaster: false,
          });
        });
      }

      // ── Calculate per-zone watts and distribute today's kWh proportionally ──
      const allZones = Array.from(zonesMap.values());

      const totalRoomW = allZones.reduce((sum, z) =>
        sum + z.devices.filter(d => d.isOn).reduce((s, d) => s + d.consumption, 0), 0
      );
      setTotalCurrentW(totalRoomW);

      const enriched = allZones.map(z => {
        const zoneActiveW = z.devices
          .filter(d => d.isOn)
          .reduce((s, d) => s + d.consumption, 0);

        // Proportional share of master today's kWh
        const proportion = totalRoomW > 0 ? zoneActiveW / totalRoomW : 0;
        const zoneTodayKwh = parseFloat((masterTodayKwh * proportion).toFixed(4));

        let status: "High" | "Medium" | "Low" = "Low";
        if (zoneActiveW > 2000) status = "High";
        else if (zoneActiveW > 500) status = "Medium";

        return { ...z, todayKwh: zoneTodayKwh, currentW: zoneActiveW, status };
      });

      // Ensure "Living Room" exists in the filtered results for demonstration/ease
      if (!enriched.some(z => z.name.toLowerCase() === "living room")) {
        enriched.push({
          name: "Living Room",
          todayKwh: 0,
          currentW: 0,
          status: "Low",
          devices: []
        });
      }

      setZones(enriched.sort((a, b) => b.currentW - a.currentW));
      setLastUpdated(
        new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      );
    } catch (e) {
      console.error("ZonesPage fetchData error:", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── WebSocket ──────────────────────────────────────────────
  const connectWS = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      if (reconnTimer.current) { clearTimeout(reconnTimer.current); reconnTimer.current = null; }
    };
    ws.onclose = () => { reconnTimer.current = setTimeout(connectWS, 3000); };
    ws.onerror = () => ws.close();

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === "device_toggle" || data.type === "kill_switch") {
          fetchData();
          return;
        }

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

        setMaster(prev => {
          const newMaster = { ...prev };
          let updated = false;
          if (v != null) { newMaster.voltage = Math.round(v); updated = true; }
          if (c != null) { newMaster.current = parseFloat(c.toFixed(3)); updated = true; }
          if (p != null) { newMaster.power = Math.round(p); updated = true; }
          if (e != null) { newMaster.todayKwh = parseFloat(e.toFixed(4)); updated = true; }
          return updated ? newMaster : prev;
        });
      } catch { /* ignore */ }
    };
  }, [fetchData]);

  useEffect(() => {
    fetchData();
    connectWS();
    const interval = setInterval(fetchData, 10000);
    return () => {
      clearInterval(interval);
      if (reconnTimer.current) clearTimeout(reconnTimer.current);
      wsRef.current?.close();
    };
  }, [fetchData, connectWS]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "High": return "bg-red-100 text-red-800 border-red-200";
      case "Medium": return "bg-yellow-100 text-yellow-800 border-yellow-200";
      default: return "bg-green-100 text-green-800 border-green-200";
    }
  };

  const getStatusBorder = (status: string) => {
    switch (status) {
      case "High": return "border-l-red-500";
      case "Medium": return "border-l-yellow-500";
      default: return "border-l-green-500";
    }
  };

  const getZoneIcon = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes("bed")) return BedDouble;
    if (n.includes("kitchen")) return UtensilsCrossed;
    if (n.includes("living")) return Sofa;
    if (n.includes("bath")) return Bath;
    if (n.includes("dining")) return UtensilsCrossed;
    return Home;
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

  const totalDevices = zones.reduce((s, z) => s + z.devices.length, 0);
  const activeDevices = zones.reduce((s, z) => s + z.devices.filter(d => d.isOn).length, 0);
  const activeZones = zones.filter(z => z.devices.some(d => d.isOn)).length;
  const highZones = zones.filter(z => z.status === "High").length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading zones...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-foreground">Zone Management</h1>
          <p className="text-muted-foreground">
            Master ESP energy • Room breakdown below • Updated {lastUpdated || "now"}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData}>
          Refresh
        </Button>
      </div>

      {/* ═══ MAIN OVERVIEW — data from Master ESP only ═══ */}
      <Card className="p-6 bg-gradient-to-br from-blue-600 via-blue-700 to-green-600 text-white shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold">Whole Home Overview</h2>
            <p className="text-blue-100 text-sm">
              Live from Master ESP (ESP32_MAIN) • Real-time meter reading
            </p>
          </div>
          <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center">
            <Zap className="w-7 h-7 text-white" />
          </div>
        </div>

        {/* Master ESP live readings */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white/15 rounded-xl p-4 text-center">
            <p className="text-blue-100 text-xs mb-1">Today's Energy</p>
            <p className="text-3xl font-bold">{master.todayKwh.toFixed(3)}</p>
            <p className="text-blue-200 text-xs">kWh</p>
          </div>
          <div className="bg-white/15 rounded-xl p-4 text-center">
            <p className="text-blue-100 text-xs mb-1">Live Power</p>
            <p className="text-3xl font-bold">{master.power}</p>
            <p className="text-blue-200 text-xs">Watts</p>
          </div>
          <div className="bg-white/15 rounded-xl p-4 text-center">
            <p className="text-blue-100 text-xs mb-1">Voltage</p>
            <p className="text-3xl font-bold">{master.voltage}</p>
            <p className="text-blue-200 text-xs">V</p>
          </div>
          <div className="bg-white/15 rounded-xl p-4 text-center">
            <p className="text-blue-100 text-xs mb-1">Current</p>
            <p className="text-3xl font-bold">{master.current}</p>
            <p className="text-blue-200 text-xs">A</p>
          </div>
        </div>

        {/* Zone energy distribution bar */}
        {zones.length > 0 && (
          <div>
            <p className="text-blue-100 text-sm mb-3 font-medium">
              Estimated Distribution by Room (based on device ratings)
            </p>
            <div className="flex rounded-full overflow-hidden h-4 gap-0.5">
              {zones.filter(z => z.todayKwh > 0).map((zone, i) => {
                const pct = master.todayKwh > 0
                  ? (zone.todayKwh / master.todayKwh) * 100
                  : 100 / zones.length;
                const colors = [
                  "bg-yellow-400", "bg-pink-400", "bg-cyan-400",
                  "bg-orange-400", "bg-purple-400", "bg-emerald-400",
                ];
                return (
                  <div
                    key={zone.name}
                    className={`${colors[i % colors.length]} transition-all`}
                    style={{ width: `${pct}%` }}
                    title={`${zone.name}: ${zone.todayKwh} kWh`}
                  />
                );
              })}
              {zones.every(z => z.todayKwh === 0) && (
                <div className="bg-white/30 w-full rounded-full" />
              )}
            </div>
            <div className="flex flex-wrap gap-3 mt-3">
              {zones.map((zone, i) => {
                const colors = [
                  "bg-yellow-400", "bg-pink-400", "bg-cyan-400",
                  "bg-orange-400", "bg-purple-400", "bg-emerald-400",
                ];
                return (
                  <div key={zone.name} className="flex items-center gap-1.5">
                    <div className={`w-2.5 h-2.5 rounded-full ${colors[i % colors.length]}`} />
                    <span className="text-blue-100 text-xs">
                      {zone.name} — {zone.todayKwh.toFixed(3)} kWh
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {highZones > 0 && (
          <div className="mt-4 bg-red-500/30 border border-red-400/50 rounded-lg px-4 py-2 flex items-center gap-2">
            <Activity className="w-4 h-4 text-red-200" />
            <p className="text-red-100 text-sm font-medium">
              {highZones} zone{highZones > 1 ? "s" : ""} with high power usage
            </p>
          </div>
        )}
      </Card>

      {/* ═══ QUICK STATS ROW ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 border-l-4 border-l-blue-500">
          <div className="flex items-center gap-3">
            <Home className="w-7 h-7 text-blue-600" />
            <div>
              <p className="text-2xl font-bold">{zones.length}</p>
              <p className="text-xs text-muted-foreground">Total Rooms</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 border-l-4 border-l-green-500">
          <div className="flex items-center gap-3">
            <Activity className="w-7 h-7 text-green-600" />
            <div>
              <p className="text-2xl font-bold">{activeZones}</p>
              <p className="text-xs text-muted-foreground">Active Rooms</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 border-l-4 border-l-purple-500">
          <div className="flex items-center gap-3">
            <Zap className="w-7 h-7 text-purple-600" />
            <div>
              <p className="text-2xl font-bold">{activeDevices}/{totalDevices}</p>
              <p className="text-xs text-muted-foreground">Active Devices</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 border-l-4 border-l-orange-500">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-7 h-7 text-orange-600" />
            <div>
              <p className="text-2xl font-bold">{totalCurrentW}W</p>
              <p className="text-xs text-muted-foreground">Room Load</p>
            </div>
          </div>
        </Card>
      </div>

      {/* ═══ ROOM BREAKDOWN — master ESP excluded ═══ */}
      <div>
        <h2 className="text-xl font-bold mb-1 text-foreground">Room Breakdown</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Energy estimated proportionally from master meter reading
        </p>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {zones.map((zone) => {
            const ZoneIcon = getZoneIcon(zone.name);
            const activeCount = zone.devices.filter(d => d.isOn).length;
            const progressVal = zone.status === "High" ? 85
              : zone.status === "Medium" ? 50 : 20;

            return (
              <Card
                key={zone.name}
                className={`p-5 border-l-4 ${getStatusBorder(zone.status)} hover:shadow-lg transition-all`}
              >
                {/* Room header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${activeCount > 0 ? "bg-blue-100" : "bg-muted"
                      }`}>
                      <ZoneIcon className={`w-5 h-5 ${activeCount > 0 ? "text-blue-600" : "text-muted-foreground"
                        }`} />
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground">{zone.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        {activeCount}/{zone.devices.length} devices active
                      </p>
                    </div>
                  </div>
                  <Badge className={`text-xs ${getStatusColor(zone.status)}`}>
                    {zone.status}
                  </Badge>
                </div>

                {/* Energy stats */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-muted/40 rounded-lg p-3 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Today's Energy</p>
                    <p className="text-xl font-bold text-foreground">
                      {zone.todayKwh.toFixed(3)}
                    </p>
                    <p className="text-xs text-muted-foreground">kWh</p>
                  </div>
                  <div className="bg-muted/40 rounded-lg p-3 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Device Load</p>
                    <p className="text-xl font-bold text-foreground">
                      {zone.currentW}
                    </p>
                    <p className="text-xs text-muted-foreground">Watts</p>
                  </div>
                </div>

                {/* Usage bar */}
                <div className="mb-4">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Usage level</span>
                    <span>{zone.status}</span>
                  </div>
                  <Progress
                    value={progressVal}
                    className={`h-2 ${zone.status === "High" ? "[&>div]:bg-red-500"
                        : zone.status === "Medium" ? "[&>div]:bg-yellow-500"
                          : "[&>div]:bg-green-500"
                      }`}
                  />
                </div>

                {/* Devices */}
                <div className="mb-4">
                  <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                    Devices
                  </p>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {zone.devices.length === 0 && (
                      <p className="text-xs text-muted-foreground italic">
                        No devices in this zone
                      </p>
                    )}
                    {zone.devices.map((device) => {
                      const Icon = getDeviceIcon(device.type);
                      return (
                        <div
                          key={device.id}
                          className={`flex items-center justify-between p-2 rounded-lg ${device.isOn
                              ? "bg-green-50 dark:bg-green-950/30"
                              : "bg-muted/30"
                            }`}
                        >
                          <div className="flex items-center gap-2">
                            <div className={`p-1 rounded-full ${device.isOn ? "bg-green-100" : "bg-muted"
                              }`}>
                              <Icon className={`w-3 h-3 ${device.isOn ? "text-green-600" : "text-muted-foreground"
                                }`} />
                            </div>
                            <span className="text-xs font-medium">{device.name}</span>
                            <Badge
                              variant="secondary"
                              className={`text-[10px] py-0 px-1 ${getDeviceTypeColor(device.type)}`}
                            >
                              {device.type}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-muted-foreground">
                              {device.consumption}W
                            </span>
                            <div className={`w-2 h-2 rounded-full ${device.isOn ? "bg-green-400 animate-pulse" : "bg-gray-300"
                              }`} />
                            <span className={`text-[10px] font-semibold ${device.isOn ? "text-green-600" : "text-gray-400"
                              }`}>
                              {device.isOn ? "ON" : "OFF"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() =>
                    navigate(`/dashboard/zones/${encodeURIComponent(zone.name)}`)
                  }
                >
                  View Details →
                </Button>
              </Card>
            );
          })}

          {zones.length === 0 && (
            <div className="col-span-3 text-center py-12 text-muted-foreground">
              <Home className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No room zones found</p>
              <p className="text-sm">
                Add room devices (non-master) with zone names to see breakdown
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}