import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Switch } from "@/app/components/ui/switch";
import { Badge } from "@/app/components/ui/badge";
import {
  Zap, Power, Home, Lightbulb, Tv, ChefHat,
  Fan, Smartphone, Monitor, BedDouble, UtensilsCrossed,
  Sofa, Bath, Activity,
} from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { devicesAPI, zonesAPI, energyAPI } from "@/app/lib/api";

const SERVER_PORT = 3001;
function getServerBase() {
  return `http://${window.location.hostname}:${SERVER_PORT}`;
}

function getWsUrl() {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.hostname}:${SERVER_PORT}`;
}

const iconMap: Record<string, any> = {
  Zap, Power, Home, Lightbulb, Tv, ChefHat, Fan, Smartphone, Monitor,
};
const getIcon = (name: string) => iconMap[name] || Zap;

const getZoneIcon = (name: string) => {
  const n = name.toLowerCase();
  if (n.includes("bed")) return BedDouble;
  if (n.includes("kitchen")) return UtensilsCrossed;
  if (n.includes("living")) return Sofa;
  if (n.includes("bath")) return Bath;
  if (n.includes("dining")) return UtensilsCrossed;
  return Home;
};

const getDeviceTypeColor = (type: string) => {
  switch (type.toLowerCase()) {
    case "lighting": return "bg-yellow-100 text-yellow-800";
    case "entertainment": return "bg-purple-100 text-purple-800";
    case "appliance": return "bg-green-100 text-green-800";
    case "fan": return "bg-cyan-100 text-cyan-800";
    case "charger": return "bg-pink-100 text-pink-800";
    case "computer": return "bg-indigo-100 text-indigo-800";
    case "hvac": return "bg-blue-100 text-blue-800";
    default: return "bg-gray-100 text-gray-800";
  }
};

interface Device {
  id: string;
  name: string;
  zone: string;
  type: string;
  consumption: number;
  isOn: boolean;
  isMaster: boolean;
  icon: any;
}

interface Zone {
  name: string;
  currentW: number;
  todayKwh: number;
  devices: Device[];
}

export function DeviceControlPage() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [zones, setZones] = useState<Zone[]>([]);
  const [totalTodayKwh, setTotalTodayKwh] = useState(0);
  const [totalCurrentW, setTotalCurrentW] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [lrStats, setLrStats] = useState({ power: 0, daily_energy: 0, voltage: 0, current: 0 });

  // ─── Fetch devices + today energy ───
  const fetchData = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const headers: HeadersInit = { Authorization: `Bearer ${token}` };
      const base = getServerBase();

      const [zonesData, devicesData, todayRes, curRes, lrRes] = await Promise.allSettled([
        zonesAPI.getZones(),
        devicesAPI.getDevices(),
        fetch(`${base}/api/energy/today`, { headers }).then(r => r.json()),
        fetch(`${base}/api/energy/current`, { headers }).then(r => r.json()),
        energyAPI.getDeviceStats("LR_ROOM_ANALYZER"),
      ]);

      if (lrRes.status === "fulfilled" && lrRes.value) {
        setLrStats({
          power: lrRes.value.power || 0,
          daily_energy: lrRes.value.daily_energy || 0,
          voltage: lrRes.value.voltage || 0,
          current: lrRes.value.current || 0
        });
      }

      // Build zone map — exclude master devices from room controls
      const zonesMap = new Map<string, Zone>();

      if (zonesData.status === "fulfilled") {
        zonesData.value.forEach((z: any) => {
          // Only add zones with a real name (not blank or "unknown")
          if (!z.name || z.name.trim() === "" || z.name.toLowerCase() === "unknown") return;
          zonesMap.set(z.name, {
            name: z.name,
            currentW: 0,
            todayKwh: 0,
            devices: [],
          });
        });
      }

      if (devicesData.status === "fulfilled") {
        devicesData.value.forEach((d: any) => {
          // Skip devices with no zone, blank zone, or "unknown" zone
          const zoneName = d.zone && d.zone.trim() !== "" ? d.zone.trim() : null;
          if (!zoneName || zoneName.toLowerCase() === "unknown") return;

          if (!zonesMap.has(zoneName)) {
            zonesMap.set(zoneName, {
              name: zoneName,
              currentW: 0,
              todayKwh: 0,
              devices: [],
            });
          }
          zonesMap.get(zoneName)!.devices.push({
            id: d.id,
            name: d.name || d.id,
            zone: zoneName,
            type: d.type || "slave",
            consumption: d.power_rating || 0,
            isOn: d.status === "active",
            isMaster: d.type === "master",
            icon: getIcon(d.icon_name),
          });
        });
      }

      // Today's total energy
      let todayTotal = 0;
      if (todayRes.status === "fulfilled" && todayRes.value?.total != null) {
        todayTotal = parseFloat(todayRes.value.total) || 0;
      }
      setTotalTodayKwh(parseFloat(todayTotal.toFixed(4)));

      // Build enriched zones — slaves only for display/toggle
      const allZones = Array.from(zonesMap.values()).map(z => {
        // Slave devices only for room control
        const slaveDevices = z.devices.filter(d => !d.isMaster);
        const currentW = slaveDevices
          .filter(d => d.isOn)
          .reduce((s, d) => s + d.consumption, 0);
        return { ...z, devices: slaveDevices, currentW };
      });

      // Distribute today's energy proportionally by active wattage
      const totalActiveW = allZones.reduce((s, z) => s + z.currentW, 0);

      let realCurrentW = totalActiveW;
      if (curRes.status === "fulfilled" && curRes.value) {
        const r = curRes.value as Record<string, number>;
        let p = r.power || 0;
        if (p === 0 && r.voltage > 0 && r.current > 0) p = r.voltage * r.current;
        if (p > 0 || r.voltage != null) realCurrentW = Math.round(p);
      }
      setTotalCurrentW(realCurrentW);

      const enriched = allZones.map(z => {
        const proportion = totalActiveW > 0 ? z.currentW / totalActiveW : 0;
        const todayKwh = parseFloat((todayTotal * proportion).toFixed(4));
        return { ...z, todayKwh };
      });

      setZones(enriched.sort((a, b) => b.currentW - a.currentW));
      setLastUpdated(new Date().toLocaleTimeString([], {
        hour: "2-digit", minute: "2-digit",
      }));
    } catch (e) {
      console.error("DeviceControlPage fetchData:", e);
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

        if ((p === 0 || p == null) && v !== undefined && c !== undefined) {
          p = v * c;
        }

        if (p !== undefined) setTotalCurrentW(Math.round(p));
        if (e !== undefined) setTotalTodayKwh(parseFloat(e.toFixed(4)));

        // Specific handling for Living Room real-time updates
        if (d.device_id === "LR_ROOM_ANALYZER") {
          setLrStats({
            power: p ?? 0,
            daily_energy: e ?? 0,
            voltage: v ?? 0,
            current: c ?? 0
          });
        }
      } catch { /* ignore */ }
    };
  }, [fetchData]);

  useEffect(() => {
    fetchData();
    connectWS();
    const interval = setInterval(fetchData, 5000); // Polling every 5s as fallback
    return () => {
      clearInterval(interval);
      if (reconnTimer.current) clearTimeout(reconnTimer.current);
      wsRef.current?.close();
    };
  }, [fetchData, connectWS]);

  // ─── Toggle single device ───
  const toggleDevice = async (zoneName: string, deviceId: string) => {
    const zone = zones.find(z => z.name === zoneName);
    const device = zone?.devices.find(d => d.id === deviceId);
    if (!device) return;

    const newStatus = device.isOn ? "inactive" : "active";

    // Optimistic update
    setZones(prev => prev.map(z =>
      z.name !== zoneName ? z : {
        ...z,
        devices: z.devices.map(d =>
          d.id !== deviceId ? d : { ...d, isOn: !d.isOn }
        ),
        currentW: z.devices
          .map(d => d.id === deviceId ? { ...d, isOn: !d.isOn } : d)
          .filter(d => d.isOn)
          .reduce((s, d) => s + d.consumption, 0),
      }
    ));

    try {
      await devicesAPI.toggleDevice(deviceId, newStatus);
    } catch {
      fetchData(); // rollback
    }
  };

  // ─── Toggle all devices in zone (slaves only) ───
  const toggleZone = async (zoneName: string, turnOn: boolean) => {
    const zone = zones.find(z => z.name === zoneName);
    if (!zone) return;

    // Optimistic update
    setZones(prev => prev.map(z =>
      z.name !== zoneName ? z : {
        ...z,
        devices: z.devices.map(d => ({ ...d, isOn: turnOn })),
        currentW: turnOn
          ? z.devices.reduce((s, d) => s + d.consumption, 0)
          : 0,
      }
    ));

    try {
      await Promise.all(
        zone.devices.map(d =>
          devicesAPI.toggleDevice(d.id, turnOn ? "active" : "inactive")
        )
      );
    } catch {
      fetchData();
    }
  };

  // ─── Turn ALL devices ON including master relay ───
  const turnAllOn = async () => {
    if (actionLoading) return;
    setActionLoading(true);

    // Optimistic Update
    setZones(prev => prev.map(z => ({
      ...z,
      devices: z.devices.map(d => ({ ...d, isOn: true })),
      currentW: z.devices.reduce((s, d) => s + d.consumption, 0),
    })));

    try {
      const token = localStorage.getItem("token");
      const resp = await fetch(`${getServerBase()}/api/devices/turn-all-on`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      if (!resp.ok) throw new Error("Failed to turn all on");
    } catch (e) {
      console.error("Turn All On Error:", e);
      fetchData(); // Rollback on error
    } finally {
      setTimeout(() => setActionLoading(false), 800); // Small delay to show state
    }
  };

  // ─── Turn ALL devices OFF including master relay ───
  const turnAllOff = async () => {
    if (actionLoading) return;
    setActionLoading(true);

    // Optimistic
    setZones(prev => prev.map(z => ({
      ...z,
      devices: z.devices.map(d => ({ ...d, isOn: false })),
      currentW: 0,
    })));

    try {
      const token = localStorage.getItem("token");
      // Use dedicated endpoint — does NOT trigger kill switch sidebar
      const resp = await fetch(`${getServerBase()}/api/devices/turn-all-off`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      if (!resp.ok) throw new Error("Failed to turn all off");
    } catch {
      fetchData();
    } finally {
      setActionLoading(false);
    }
  };

  const totalDevicesOn = zones.reduce((s, z) => s + z.devices.filter(d => d.isOn).length, 0);
  const totalDevices = zones.reduce((s, z) => s + z.devices.length, 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading devices...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Device Control</h1>
          <p className="text-muted-foreground">
            Room-by-room device management • Updated {lastUpdated}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData}>
          Refresh
        </Button>
      </div>

      {/* ═══ TODAY'S ENERGY BANNER ═══ */}
      <Card className="p-6 bg-gradient-to-br from-slate-800 to-slate-900 text-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-200">Today's Usage Summary</h2>
            <p className="text-slate-400 text-sm">All rooms combined</p>
          </div>
          <Activity className="w-8 h-8 text-blue-400" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <p className="text-slate-400 text-xs mb-1">Today's Energy</p>
            <p className="text-2xl font-bold text-blue-300">{totalTodayKwh.toFixed(3)}</p>
            <p className="text-slate-400 text-xs">kWh</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <p className="text-slate-400 text-xs mb-1">Current Load</p>
            <p className="text-2xl font-bold text-green-300">{totalCurrentW}</p>
            <p className="text-slate-400 text-xs">Watts</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <p className="text-slate-400 text-xs mb-1">Devices ON</p>
            <p className="text-2xl font-bold text-yellow-300">
              {totalDevicesOn}/{totalDevices}
            </p>
            <p className="text-slate-400 text-xs">Devices</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <p className="text-slate-400 text-xs mb-1">Active Rooms</p>
            <p className="text-2xl font-bold text-purple-300">
              {zones.filter(z => z.currentW > 0).length}/{zones.length}
            </p>
            <p className="text-slate-400 text-xs">Rooms</p>
          </div>
        </div>
      </Card>

      {/* ═══ QUICK ACTIONS ═══ */}
      <Card className="p-5">
        <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          <Button
            variant={totalDevicesOn === 0 && totalDevices > 0 ? "default" : "outline"}
            onClick={turnAllOff}
            disabled={actionLoading}
            className={`flex items-center gap-2 ${totalDevicesOn === 0 && totalDevices > 0 ? "bg-red-600 hover:bg-red-700 text-white border-red-600" : "text-red-600 border-red-200"}`}
          >
            <Power className="w-4 h-4" />
            {actionLoading ? "Working..." : "Turn All OFF"}
          </Button>
          <Button
            variant={totalDevicesOn === totalDevices && totalDevices > 0 ? "default" : "outline"}
            className={`flex items-center gap-2 ${totalDevicesOn === totalDevices && totalDevices > 0 ? "bg-green-600 hover:bg-green-700 text-white border-green-600" : "text-green-600 border-green-200"}`}
            onClick={turnAllOn}
            disabled={actionLoading}
          >
            <Zap className="w-4 h-4" />
            {actionLoading ? "Working..." : "Turn All ON"}
          </Button>
          <p className="text-xs text-muted-foreground self-center ml-2">
            "Turn All OFF" cuts the master relay — stops all current flow
          </p>
        </div>
      </Card>

      {/* ═══ ROOM ZONE CARDS ═══ */}
      <div className="space-y-5">
        {zones.map((zone) => {
          const ZoneIcon = getZoneIcon(zone.name);
          const activeCount = zone.devices.filter(d => d.isOn).length;
          const allOn = activeCount === zone.devices.length && zone.devices.length > 0;
          const allOff = activeCount === 0;

          return (
            <Card key={zone.name} className="p-5 border-l-4 border-l-blue-500">

              {/* Zone header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center ${activeCount > 0 ? "bg-blue-100" : "bg-muted"
                    }`}>
                    <ZoneIcon className={`w-5 h-5 ${activeCount > 0 ? "text-blue-600" : "text-muted-foreground"
                      }`} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">{zone.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {activeCount}/{zone.devices.length} devices on
                    </p>
                  </div>
                </div>

                {/* Zone energy + controls */}
                <div className="flex items-center gap-4">
                  {/* Energy stats */}
                  <div className="text-right hidden sm:block">
                    <div className="flex items-center gap-3">
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Today</p>
                        <p className="text-base font-bold text-blue-600">
                          {(zone.name === "Living Room" ? Math.max(0, lrStats.daily_energy) : zone.todayKwh).toFixed(3)} kWh
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Now</p>
                        <p className="text-base font-bold text-green-600">
                          {zone.name === "Living Room" ? lrStats.power.toFixed(1) : zone.currentW}W
                        </p>
                      </div>
                    </div>
                  </div>
                  {/* Zone toggle buttons */}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={allOff ? "outline" : "ghost"}
                      className={allOff ? "border-red-300 text-red-600" : ""}
                      onClick={() => toggleZone(zone.name, false)}
                    >
                      All Off
                    </Button>
                    <Button
                      size="sm"
                      variant={allOn ? "outline" : "ghost"}
                      className={allOn ? "border-green-300 text-green-600" : ""}
                      onClick={() => toggleZone(zone.name, true)}
                    >
                      All On
                    </Button>
                  </div>
                </div>
              </div>

              {/* Mobile energy stats */}
              <div className="flex gap-4 mb-4 sm:hidden">
                <div className="bg-blue-50 rounded-lg px-3 py-2 flex-1 text-center">
                  <p className="text-xs text-muted-foreground">Today</p>
                  <p className="font-bold text-blue-600">{(zone.name === "Living Room" ? Math.max(0, lrStats.daily_energy) : zone.todayKwh).toFixed(3)} kWh</p>
                </div>
                <div className="bg-green-50 rounded-lg px-3 py-2 flex-1 text-center">
                  <p className="text-xs text-muted-foreground">Current</p>
                  <p className="font-bold text-green-600">{zone.name === "Living Room" ? lrStats.power.toFixed(1) : zone.currentW}W</p>
                </div>
              </div>



              {/* Device grid — slave devices only */}
              {zone.devices.length === 0 ? (
                <p className="text-sm text-muted-foreground italic text-center py-4">
                  No slave devices in this room
                </p>
              ) : (
                <div className="grid md:grid-cols-2 gap-3">
                  {zone.devices.map((device) => {
                    const IconComponent = device.icon;
                    return (
                      <div
                        key={device.id}
                        className={`p-4 border rounded-xl transition-all ${device.isOn
                          ? "border-green-200 bg-green-50 dark:bg-green-950/20"
                          : "border-gray-200 bg-gray-50 dark:bg-muted/30"
                          }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-full ${device.isOn ? "bg-green-100" : "bg-gray-100"
                              }`}>
                              <IconComponent className={`w-4 h-4 ${device.isOn ? "text-green-600" : "text-gray-400"
                                }`} />
                            </div>
                            <div>
                              <h4 className="font-semibold text-sm">{device.name}</h4>
                              <Badge
                                variant="secondary"
                                className={`text-[10px] py-0 ${getDeviceTypeColor(device.type)}`}
                              >
                                {device.type}
                              </Badge>
                            </div>
                          </div>
                          <Switch
                            checked={device.isOn}
                            onCheckedChange={() => toggleDevice(zone.name, device.id)}
                          />
                        </div>

                        <div className="flex items-center justify-between text-sm mt-2">
                          <span className={`font-medium ${device.isOn ? "text-green-700" : "text-gray-400"
                            }`}>
                            {device.isOn ? `${device.consumption}W` : "Off"}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <div className={`w-2 h-2 rounded-full ${device.isOn ? "bg-green-400 animate-pulse" : "bg-gray-300"
                              }`} />
                            <span className={`text-xs font-medium ${device.isOn ? "text-green-600" : "text-gray-400"
                              }`}>
                              {device.isOn ? "Active" : "Inactive"}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          );
        })}

        {zones.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Home className="w-14 h-14 mx-auto mb-4 opacity-20" />
            <p className="font-semibold text-lg">No rooms found</p>
            <p className="text-sm">Add devices with zones assigned to see room controls</p>
          </div>
        )}
      </div>
    </div>
  );
}