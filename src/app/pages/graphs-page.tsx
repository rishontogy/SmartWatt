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
  Cell,
} from "recharts";
import {
  TrendingUp, Activity, BarChart3, Zap,
  IndianRupee, Calendar, Wifi, WifiOff, RefreshCw,
} from "lucide-react";
import { DailyEnergyAnalysis } from "@/app/components/DailyEnergyAnalysis";
import { energyAPI, devicesAPI, zonesAPI } from "@/app/lib/api";
import { useState, useEffect, useRef } from "react";

const SERVER_PORT = 3001;
const RATE_PER_KWH = 8;
const ZONE_COLORS = [
  "#3b82f6", "#8b5cf6", "#10b981", "#f97316",
  "#ec4899", "#06b6d4", "#f59e0b", "#6366f1",
];

function getServerBase() { return `http://${window.location.hostname}:${SERVER_PORT}`; }
function rupees(kwh: number) { return (kwh * RATE_PER_KWH).toFixed(2); }
function fmt2(n: number) { return parseFloat(n.toFixed(3)); }

type WsStatus = "connecting" | "connected" | "disconnected";

// ─── helpers ─────────────────────────────────────────────────────────────────
function parseNum(v: any, fallback = 0) {
  const n = parseFloat(v);
  return isFinite(n) ? n : fallback;
}

export function GraphsPage() {
  // ── state ──────────────────────────────────────────────────────────────────
  const [realTimeData, setRealTimeData] = useState<any[]>([]);
  const [rtLoading,    setRtLoading]    = useState(true);

  const [liveMetrics,  setLiveMetrics]  = useState<{
    power: number; current: number; voltage: number; energy: number
  } | null>(null);
  const [lastUpdated,  setLastUpdated]  = useState<Date | null>(null);

  const [dailyData,    setDailyData]    = useState<any[]>([]);
  const [hourlyData,   setHourlyData]   = useState<any[]>([]);
  const [dailyLoading, setDailyLoading] = useState(true);

  const [zoneData,     setZoneData]     = useState<any[]>([]);
  const [zonesLoading, setZonesLoading] = useState(true);

  const [monthlyData,  setMonthlyData]  = useState<any[]>([]);
  const [monthlyStats, setMonthlyStats] = useState({ avg: 0, total: 0, savings: 0 });
  const [monthlyLoading, setMonthlyLoading] = useState(true);

  const [wsStatus,     setWsStatus]     = useState<WsStatus>("connecting");

  // ── refs (stable, never re-create the effect) ──────────────────────────────
  const wsRef             = useRef<WebSocket | null>(null);
  const reconnectTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dailyDebounce     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const zoneDebounce      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const monthlyDebounce   = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Keep the latest fetch functions in refs so the WS onmessage can call them
  // without ever being recreated (avoids the reconnect-loop bug).
  const fetch7DayRef      = useRef<() => Promise<void>>();
  const fetchZonesRef     = useRef<() => Promise<void>>();
  const fetchMonthlyRef   = useRef<() => Promise<void>>();
  // Hourly real-time tracking: tracking energy deltas per clock-hour across devices
  const hourlyTrackRef    = useRef<{
    currentHour: string;
    lastEnergyByDevice: Record<string, number>;
  }>({ currentHour: "", lastEnergyByDevice: {} });
  const [currentHourLabel, setCurrentHourLabel] = useState("");

  // Zone real-time tracking: latest measurement per device_id, aggregated by zone
  const liveDeviceEnergyRef = useRef<Map<string, {
    zone: string; power: number; energy: number; ts: number;
  }>>(new Map());
  // Which zones currently have live WS data (drives the pulsing dot)
  const [liveZoneSet, setLiveZoneSet] = useState<Set<string>>(new Set());
  const [zoneLastSeen, setZoneLastSeen] = useState<Record<string, Date>>({});

  // ── FETCHERS ───────────────────────────────────────────────────────────────
  async function fetchRealTime(initial = false) {
    if (initial) setRtLoading(true);
    try {
      const data = await energyAPI.getHistory("day");
      if (data && data.length > 0) {
        const formatted = [...data].reverse().map((d: any) => ({
          time: new Date(d.timestamp || d.time).toLocaleTimeString([], {
            hour: "2-digit", minute: "2-digit", second: "2-digit",
          }),
          power:   fmt2(parseNum(d.power)),
          current: fmt2(d.current ? parseNum(d.current) : parseNum(d.power) / 230),
          voltage: fmt2(d.voltage ? parseNum(d.voltage) : 230),
          _ts: new Date(d.timestamp || d.time).getTime(),
        }));
        setRealTimeData(prev => prev.length === 0 ? formatted : prev);
      }
    } catch { /* */ }
    finally { if (initial) setRtLoading(false); }
  }

  async function fetch7Day(initial = false) {
    if (initial) setDailyLoading(true);
    try {
      const token = localStorage.getItem("token");
      const base  = getServerBase();
      let weekRaw: any[] = [];

      try {
        const res = await fetch(`${base}/api/energy/history?period=week`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) weekRaw = await res.json();
      } catch { /* */ }
      if (!weekRaw.length) {
        try { weekRaw = await energyAPI.getHistory("week"); } catch { /* */ }
      }

      if (weekRaw.length > 0) {
        const dayMap = new Map<string, number>();
        weekRaw.forEach((d: any) => {
          const label = new Date(d.timestamp || d.time || d.date)
            .toLocaleDateString("en-IN", { weekday: "short" });
          dayMap.set(label, (dayMap.get(label) || 0) + parseNum(d.energy !== undefined ? d.energy : d.kwh));
        });
        setDailyData(Array.from(dayMap.entries()).map(([day, energy]) => ({
          day, energy: fmt2(energy), cost: parseFloat(rupees(energy)),
        })));
      }

      const dayRaw = await energyAPI.getHistory("day");
      if (dayRaw && dayRaw.length > 0) {
        const hourMap = new Map<string, number>();
        dayRaw.forEach((d: any) => {
          const dateObj = new Date(d.timestamp || d.time);
          const hour = `${dateObj.getHours().toString().padStart(2, '0')}:00`;
          const kwh = parseNum(d.energy !== undefined ? d.energy : (d.kwh !== undefined ? d.kwh : (d.power ? d.power / 1000 / 12 : 0)));
          hourMap.set(hour, (hourMap.get(hour) || 0) + kwh);
        });
        setHourlyData(
          Array.from(hourMap.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([hour, energy]) => ({ hour, energy: fmt2(energy) }))
        );
      }
    } catch { /* */ }
    finally { if (initial) setDailyLoading(false); }
  }

  async function fetchZones(initial = false) {
    if (initial) setZonesLoading(true);
    try {
      const token = localStorage.getItem("token");
      const base  = getServerBase();
      const [, devicesRes, todayRes] = await Promise.allSettled([
        zonesAPI.getZones(),
        devicesAPI.getDevices(),
        fetch(`${base}/api/energy/today`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then(r => r.json()),
      ]);

      const todayTotal = todayRes.status === "fulfilled"
        ? parseNum(todayRes.value?.total) : 0;

      if (devicesRes.status === "fulfilled") {
        const wattMap = new Map<string, number>();
        devicesRes.value.forEach((d: any) => {
          const zone = d.zone && d.zone.toLowerCase() !== "unknown" ? d.zone : null;
          if (!zone || d.type === "master") return;
          const w = d.status === "active" ? (d.power_rating || 0) : 0;
          wattMap.set(zone, (wattMap.get(zone) || 0) + w);
        });
        const totalW = Array.from(wattMap.values()).reduce((s, v) => s + v, 0);
        setZoneData(prev => {
          const zonePowerMap  = new Map<string, number>();
          const zoneEnergyMap = new Map<string, number>();
          liveDeviceEnergyRef.current.forEach(r => {
            zonePowerMap.set(r.zone, (zonePowerMap.get(r.zone) || 0) + r.power);
            zoneEnergyMap.set(r.zone, (zoneEnergyMap.get(r.zone) || 0) + r.energy);
          });
          const totalLiveW = Array.from(zonePowerMap.values()).reduce((s, v) => s + v, 0);

          const merged = Array.from(wattMap.entries()).map(([zone, watts]) => {
            const liveWatts = zonePowerMap.get(zone);
            const liveEnergy = zoneEnergyMap.get(zone);

            if (liveWatts !== undefined) {
              const percentage = totalLiveW > 0 ? Math.round((liveWatts / totalLiveW) * 100) : (totalW > 0 ? Math.round((watts / totalW) * 100) : 0);
              return {
                zone,
                watts: liveWatts,
                energy: fmt2(liveEnergy || 0),
                percentage,
                cost: parseFloat(rupees(liveEnergy || 0)),
                live: true
              };
            }

            const proportion = totalW > 0 ? watts / totalW : 0;
            const energy = fmt2(todayTotal * proportion);
            const percentage = totalW > 0 ? Math.round((watts / totalW) * 100) : 0;
            return { zone, watts, energy, percentage, cost: parseFloat(rupees(energy)) };
          });

          // Add live zones missing from static DB
          for (const [lz, lw] of zonePowerMap.entries()) {
            if (!wattMap.has(lz)) {
              const le = zoneEnergyMap.get(lz) || 0;
              const percentage = totalLiveW > 0 ? Math.round((lw / totalLiveW) * 100) : 0;
              merged.push({ zone: lz, watts: lw, energy: fmt2(le), percentage, cost: parseFloat(rupees(le)), live: true });
            }
          }

          return merged.sort((a, b) => b.watts - a.watts);
        });
      }
    } catch { /* */ }
    finally { if (initial) setZonesLoading(false); }
  }

  async function fetchMonthly(initial = false) {
    if (initial) setMonthlyLoading(true);
    try {
      const token = localStorage.getItem("token");
      const base  = getServerBase();
      let monthRaw: any[] = [];
      try {
        const res = await fetch(`${base}/api/energy/history?period=month`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) monthRaw = await res.json();
      } catch { /* */ }
      if (!monthRaw.length) {
        try { monthRaw = await energyAPI.getHistory("month"); } catch { /* */ }
      }

      if (monthRaw.length > 0) {
        const monthMap = new Map<string, number>();
        monthRaw.forEach((d: any) => {
          const label = new Date(d.timestamp || d.time || d.date)
            .toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
          monthMap.set(label, (monthMap.get(label) || 0) + parseNum(d.energy !== undefined ? d.energy : d.kwh));
        });
        const built = Array.from(monthMap.entries()).slice(-6)
          .map(([month, energy]) => ({ month, energy: fmt2(energy), cost: parseFloat(rupees(energy)) }));
        setMonthlyData(built);

        const energies = built.map(m => m.energy);
        const total  = fmt2(energies.reduce((s, v) => s + v, 0));
        const avg    = fmt2(total / energies.length);
        const half   = Math.floor(energies.length / 2);
        const fh     = energies.slice(0, half).reduce((s, v) => s + v, 0);
        const sh     = energies.slice(half).reduce((s, v) => s + v, 0);
        const savings = fmt2(Math.max(0, fh - sh) * RATE_PER_KWH);
        setMonthlyStats({ avg, total, savings });
      }
    } catch { /* */ }
    finally { if (initial) setMonthlyLoading(false); }
  }

  // Keep refs current on every render
  fetch7DayRef.current    = () => fetch7Day(false);
  fetchZonesRef.current   = () => fetchZones(false);
  fetchMonthlyRef.current = () => fetchMonthly(false);

  // ── debounce helpers (called from stable WS onmessage) ────────────────────
  function debouncedDaily() {
    if (dailyDebounce.current) clearTimeout(dailyDebounce.current);
    dailyDebounce.current = setTimeout(() => fetch7DayRef.current?.(), 5000);
  }
  function debouncedZone() {
    if (zoneDebounce.current) clearTimeout(zoneDebounce.current);
    zoneDebounce.current = setTimeout(() => fetchZonesRef.current?.(), 3000);
  }
  function debouncedMonthly() {
    if (monthlyDebounce.current) clearTimeout(monthlyDebounce.current);
    monthlyDebounce.current = setTimeout(() => fetchMonthlyRef.current?.(), 10000);
  }

  // ── WEBSOCKET (single stable mount, never torn down unless unmount) ────────
  function openWS() {
    if (wsRef.current && wsRef.current.readyState <= WebSocket.OPEN) return;

    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(`${proto}//${window.location.hostname}:${SERVER_PORT}`);
    wsRef.current = socket;
    setWsStatus("connecting");

    socket.onopen = () => {
      setWsStatus("connected");
      if (reconnectTimer.current) { clearTimeout(reconnectTimer.current); reconnectTimer.current = null; }
    };

    socket.onerror = () => setWsStatus("disconnected");

    socket.onclose = () => {
      setWsStatus("disconnected");
      wsRef.current = null;
      reconnectTimer.current = setTimeout(openWS, 3000);
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string);

        // ── energy readings → update real-time chart & live metrics ──
        if (
          data.type === "energy_reading" ||
          data.power  !== undefined ||
          data.current !== undefined
        ) {
          const ts  = data.timestamp ? new Date(data.timestamp).getTime() : Date.now();
          const point = {
            time:    new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
            power:   fmt2(parseNum(data.power)),
            current: fmt2(parseNum(data.current)),
            voltage: fmt2(parseNum(data.voltage, 230)),
            _ts: ts,
          };

          setRealTimeData(prev => {
            if (prev.length > 0 && prev[prev.length - 1]._ts === ts) return prev;
            return [...prev, point].slice(-120);
          });
          setLiveMetrics({
            power:   point.power,
            current: point.current,
            voltage: point.voltage,
            energy:  fmt2(parseNum(data.energy)),
          });
          setLastUpdated(new Date());
          setRtLoading(false);

          // ── Real-time hourly consumption update ──────────────────────────
          const nowHourDate  = new Date(ts);
          const nowHour      = `${nowHourDate.getHours().toString().padStart(2, '0')}:00`;
          const totalEnergy  = parseNum(data.energy);
          const deviceIdKey  = typeof data.device_id === 'string' ? data.device_id : 'unknown';
          const track        = hourlyTrackRef.current;

          if (track.currentHour !== nowHour) {
            track.currentHour = nowHour;
          }

          let lastDevEnergy = track.lastEnergyByDevice[deviceIdKey];
          let delta = 0;

          if (lastDevEnergy !== undefined) {
             delta = totalEnergy - lastDevEnergy;
             if (delta < 0) {
               // Handle ESP reset at midnight or reboot
               if (lastDevEnergy - totalEnergy > 0.5) {
                 track.lastEnergyByDevice[deviceIdKey] = totalEnergy;
               }
               delta = 0;
             } else if (delta > 0) {
               track.lastEnergyByDevice[deviceIdKey] = totalEnergy;
             }
          } else {
             // First reading for this device since the page loaded.
             // Assume its accumulated energy is already in fetch7Day, so no delta yet.
             track.lastEnergyByDevice[deviceIdKey] = totalEnergy;
          }

          setCurrentHourLabel(nowHour);

          if (delta > 0) {
            setHourlyData(prev => {
              const updated = [...prev];
              const idx = updated.findIndex(h => h.hour === nowHour);
              if (idx >= 0) {
                updated[idx] = { ...updated[idx], energy: fmt2(parseNum(updated[idx].energy) + delta), live: true };
              } else {
                updated.push({ hour: nowHour, energy: fmt2(delta), live: true });
                updated.sort((a, b) => a.hour.localeCompare(b.hour));
              }
              return updated;
            });
          }
          // ──────────────────────────────────────────────────────────────────

          // ── Real-time zone update (if this reading has a zone) ────────────
          // Room ESPs post to /api/energy/room-reading which broadcasts {zone, device_id, power, energy}.
          // Aggregate the latest per-device reading into zone totals instantly.
          if (data.zone && data.device_id) {
            const devId   = String(data.device_id);
            const zoneName = String(data.zone);
            const devPower  = parseNum(data.power);
            const devEnergy = parseNum(data.energy);

            // Update this device's record
            liveDeviceEnergyRef.current.set(devId, {
              zone: zoneName, power: devPower, energy: devEnergy, ts,
            });

            // Aggregate all live devices by zone
            const zonePowerMap  = new Map<string, number>();
            const zoneEnergyMap = new Map<string, number>();
            liveDeviceEnergyRef.current.forEach(r => {
              zonePowerMap.set(r.zone,  (zonePowerMap.get(r.zone)  || 0) + r.power);
              zoneEnergyMap.set(r.zone, (zoneEnergyMap.get(r.zone) || 0) + r.energy);
            });

            const totalLiveW = Array.from(zonePowerMap.values()).reduce((s, v) => s + v, 0);

            setZoneData(prev => {
              const zoneMap = new Map(prev.map(z => [z.zone, z]));
              
              for (const [zName, livePower] of zonePowerMap.entries()) {
                const liveEnergy = zoneEnergyMap.get(zName) || 0;
                const prevZ = zoneMap.get(zName);
                zoneMap.set(zName, {
                  ...(prevZ || { zone: zName }),
                  watts: livePower,
                  energy: fmt2(liveEnergy),
                  percentage: totalLiveW > 0 ? Math.round((livePower / totalLiveW) * 100) : (prevZ?.percentage || 0),
                  cost: parseFloat(rupees(liveEnergy)),
                  live: true,
                });
              }
              
              return Array.from(zoneMap.values()).sort((a, b) => (b.watts ?? 0) - (a.watts ?? 0));
            });

            // Mark zone as live and record last-seen time
            setLiveZoneSet(prev => { const n = new Set(prev); n.add(zoneName); return n; });
            setZoneLastSeen(prev => ({ ...prev, [zoneName]: new Date() }));
          }
          // ──────────────────────────────────────────────────────────────────

          // Trigger slower tabs to refresh (debounced)
          debouncedDaily();
          debouncedMonthly();
        }

        // ── device state changes → refresh zones ──
        if (data.type === "device_toggle" || data.type === "kill_switch") {
          debouncedZone();
        }
      } catch { /* ignore parse errors */ }
    };
  }

  // ── LIFECYCLE — single mount, stable deps [] ───────────────────────────────
  useEffect(() => {
    // Initial data loads
    fetchRealTime(true);
    fetch7Day(true);
    fetchZones(true);
    fetchMonthly(true);

    // Open WebSocket once
    openWS();

    // Fallback polling (safety net — WS handles real-time)
    const dayInt  = setInterval(() => fetch7DayRef.current?.(),    60_000);
    const zoneInt = setInterval(() => fetchZonesRef.current?.(),   30_000);
    const monInt  = setInterval(() => fetchMonthlyRef.current?.(), 120_000);

    return () => {
      clearInterval(dayInt);
      clearInterval(zoneInt);
      clearInterval(monInt);
      if (dailyDebounce.current)   clearTimeout(dailyDebounce.current);
      if (zoneDebounce.current)    clearTimeout(zoneDebounce.current);
      if (monthlyDebounce.current) clearTimeout(monthlyDebounce.current);
      if (reconnectTimer.current)  clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.onclose = null; // suppress reconnect on unmount
        wsRef.current.close();
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── RENDER HELPERS ─────────────────────────────────────────────────────────
  const LoadingSpinner = () => (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const EmptyState = ({ label }: { label: string }) => (
    <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-2">
      <BarChart3 className="w-10 h-10 opacity-20" />
      <p className="text-sm">{label}</p>
    </div>
  );

  const WsIndicator = () => (
    <span className="flex items-center gap-1.5 text-xs font-medium select-none">
      {wsStatus === "connected" ? (
        <><Wifi className="w-3.5 h-3.5 text-green-500" /><span className="text-green-600">Live</span><span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" /></>
      ) : wsStatus === "connecting" ? (
        <><RefreshCw className="w-3.5 h-3.5 text-yellow-500 animate-spin" /><span className="text-yellow-600">Connecting…</span></>
      ) : (
        <><WifiOff className="w-3.5 h-3.5 text-red-500" /><span className="text-red-500">Reconnecting…</span></>
      )}
    </span>
  );

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Energy Analytics</h1>
          <p className="text-muted-foreground text-sm">
            Live data from your smart meter
            {lastUpdated && (
              <span className="ml-2 text-xs opacity-60">
                · Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <WsIndicator />
      </div>

      {/* Live Metrics Bar */}
      {liveMetrics && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Power",         value: `${liveMetrics.power} W`,    color: "text-blue-600",   bg: "bg-blue-50   dark:bg-blue-950/30",   icon: <Zap          className="w-4 h-4 text-blue-500"   /> },
            { label: "Current",       value: `${liveMetrics.current} A`,  color: "text-green-600",  bg: "bg-green-50  dark:bg-green-950/30",  icon: <Activity     className="w-4 h-4 text-green-500"  /> },
            { label: "Voltage",       value: `${liveMetrics.voltage} V`,  color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-950/30", icon: <TrendingUp   className="w-4 h-4 text-purple-500" /> },
            { label: "Today's Energy",value: `${liveMetrics.energy} kWh`, color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-950/30", icon: <IndianRupee  className="w-4 h-4 text-orange-500" /> },
          ].map((m, i) => (
            <Card key={i} className={`p-3 ${m.bg} border-0 transition-all duration-300`}>
              <div className="flex items-center gap-2 mb-1">{m.icon}<span className="text-xs text-muted-foreground">{m.label}</span></div>
              <p className={`text-xl font-bold ${m.color}`}>{m.value}</p>
            </Card>
          ))}
        </div>
      )}

      <Tabs defaultValue="realtime" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="realtime" className="flex items-center gap-1.5">
            Real-Time
            {wsStatus === "connected" && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />}
          </TabsTrigger>
          <TabsTrigger value="daily">Daily</TabsTrigger>
          <TabsTrigger value="zones">Zones</TabsTrigger>
          <TabsTrigger value="monthly">Monthly</TabsTrigger>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
        </TabsList>

        {/* ══ REAL-TIME ══════════════════════════════════════════════════════ */}
        <TabsContent value="realtime" className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <Activity className="w-6 h-6 text-blue-600" />
              <div>
                <h2 className="text-xl font-semibold">Real-Time Power Usage</h2>
                <p className="text-sm text-muted-foreground">Live readings from ESP32</p>
              </div>
              <div className="ml-auto"><WsIndicator /></div>
            </div>
            {rtLoading ? <LoadingSpinner /> : realTimeData.length === 0 ? (
              <EmptyState label="Waiting for live data from device…" />
            ) : (
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={realTimeData}>
                  <defs>
                    <linearGradient id="colorPower" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} minTickGap={50} interval="preserveStart" />
                  <YAxis unit="W" tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,.1)" }} formatter={(v: any) => [`${v} W`, "Power"]} />
                  <Legend iconType="circle" />
                  <Area type="monotone" dataKey="power" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorPower)" name="Power (W)" dot={false} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <TrendingUp className="w-6 h-6 text-green-600" />
              <div>
                <h2 className="text-xl font-semibold">Current vs Time</h2>
                <p className="text-sm text-muted-foreground">Live current draw (A)</p>
              </div>
            </div>
            {rtLoading ? <LoadingSpinner /> : realTimeData.length === 0 ? (
              <EmptyState label="Waiting for live data from device…" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={realTimeData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.2} />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} minTickGap={50} interval="preserveStart" />
                  <YAxis unit="A" tick={{ fontSize: 11 }} domain={["auto", "auto"]} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,.1)" }} formatter={(v: any) => [`${v} A`, "Current"]} />
                  <Legend iconType="circle" />
                  <Line type="monotone" dataKey="current" stroke="#10b981" strokeWidth={3} name="Current (A)" dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* Voltage chart — only when device actually sends voltage */}
          {realTimeData.length > 0 && realTimeData.some(d => d.voltage && d.voltage !== 230) && (
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <Zap className="w-6 h-6 text-purple-600" />
                <div>
                  <h2 className="text-xl font-semibold">Voltage vs Time</h2>
                  <p className="text-sm text-muted-foreground">Live voltage reading (V)</p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={realTimeData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.2} />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} minTickGap={50} interval="preserveStart" />
                  <YAxis unit="V" tick={{ fontSize: 11 }} domain={["auto", "auto"]} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,.1)" }} formatter={(v: any) => [`${v} V`, "Voltage"]} />
                  <Line type="monotone" dataKey="voltage" stroke="#8b5cf6" strokeWidth={2.5} name="Voltage (V)" dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          )}
        </TabsContent>

        {/* ══ DAILY ══════════════════════════════════════════════════════════ */}
        <TabsContent value="daily" className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <BarChart3 className="w-6 h-6 text-purple-600" />
              <div>
                <h2 className="text-xl font-semibold">Daily Energy Consumption</h2>
                <p className="text-sm text-muted-foreground">Last 7 days</p>
              </div>
            </div>
            {dailyLoading ? <LoadingSpinner /> : dailyData.length === 0 ? (
              <EmptyState label="No weekly data available" />
            ) : (
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis yAxisId="left"  unit=" kWh" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="right" orientation="right" unit=" ₹" tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: any, name: string) => name === "Cost (₹)" ? [`₹${v}`, name] : [`${v} kWh`, name]} />
                  <Legend />
                  <Bar yAxisId="left"  dataKey="energy" fill="#8b5cf6" name="Energy (kWh)" radius={[4,4,0,0]} />
                  <Bar yAxisId="right" dataKey="cost"   fill="#c4b5fd" name="Cost (₹)"     radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <Activity className="w-6 h-6 text-blue-600" />
              <div>
                <h2 className="text-xl font-semibold">Hourly Consumption Today</h2>
                <p className="text-sm text-muted-foreground">Energy usage by hour (kWh)</p>
              </div>
              {/* Live badge — shown when WS is feeding real-time hourly data */}
              {currentHourLabel && wsStatus === "connected" && (
                <span className="ml-auto flex items-center gap-1.5 text-xs font-medium">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span className="text-amber-600">Updating {currentHourLabel}</span>
                </span>
              )}
            </div>
            {dailyLoading && hourlyData.length === 0 ? <LoadingSpinner /> : hourlyData.length === 0 ? (
              <EmptyState label="No hourly data available" />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={hourlyData} barCategoryGap="20%">
                    <defs>
                      <linearGradient id="barLive" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor="#f59e0b" stopOpacity={1} />
                        <stop offset="100%" stopColor="#f97316" stopOpacity={0.8} />
                      </linearGradient>
                      <linearGradient id="barPast" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor="#3b82f6" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.4} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.3} />
                    <XAxis dataKey="hour" tick={{ fontSize: 10 }} minTickGap={4} />
                    <YAxis unit=" kWh" tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,.1)" }}
                      formatter={(v: any, _name: string, props: any) => [
                        `${v} kWh${props.payload?.live ? "  ⚡ live" : ""}`,
                        "Energy",
                      ]}
                    />
                    <Bar dataKey="energy" name="Energy (kWh)" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                      {hourlyData.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={entry.hour === currentHourLabel ? "url(#barLive)" : "url(#barPast)"}
                          opacity={entry.hour === currentHourLabel ? 1 : 0.8}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                {/* Current-hour callout */}
                {currentHourLabel && hourlyData.find(h => h.hour === currentHourLabel) && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block" />
                    <span>
                      Current hour (<b>{currentHourLabel}</b>):{" "}
                      <b className="text-amber-600">
                        {hourlyData.find(h => h.hour === currentHourLabel)?.energy ?? 0} kWh
                      </b>{" "}
                      — updates every reading
                    </span>
                  </div>
                )}
              </>
            )}
          </Card>

          {!dailyLoading && dailyData.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Today's Energy", value: `${dailyData[dailyData.length-1]?.energy ?? 0} kWh`, icon: <Zap          className="w-5 h-5 text-blue-500"   />, sub: "Live reading" },
                { label: "Today's Cost",   value: `₹${dailyData[dailyData.length-1]?.cost   ?? 0}`,    icon: <IndianRupee  className="w-5 h-5 text-green-500"  />, sub: `@ ₹${RATE_PER_KWH}/kWh` },
                { label: "Week Average",   value: `${fmt2(dailyData.reduce((s,d)=>s+d.energy,0)/dailyData.length)} kWh`, icon: <Activity  className="w-5 h-5 text-purple-500" />, sub: "Per day" },
                { label: "Week Total",     value: `${fmt2(dailyData.reduce((s,d)=>s+d.energy,0))} kWh`, icon: <Calendar   className="w-5 h-5 text-orange-500"  />, sub: "Last 7 days" },
              ].map((c,i) => (
                <Card key={i} className="p-4">
                  <div className="flex items-center gap-2 mb-2">{c.icon}<p className="text-xs text-muted-foreground">{c.label}</p></div>
                  <p className="text-2xl font-bold">{c.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{c.sub}</p>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ══ ZONES ══════════════════════════════════════════════════════════ */}
        <TabsContent value="zones" className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <BarChart3 className="w-6 h-6 text-blue-600" />
              <div>
                <h2 className="text-xl font-semibold">Zone-wise Energy Distribution</h2>
                <p className="text-sm text-muted-foreground">Today's consumption by room</p>
              </div>
              <div className="ml-auto"><WsIndicator /></div>
            </div>
            {zonesLoading ? <LoadingSpinner /> : zoneData.length === 0 ? (
              <EmptyState label="No zone data — assign zones to devices first" />
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(300, zoneData.length * 60)}>
                <BarChart data={zoneData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" unit=" kWh" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="zone" type="category" width={110} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: any, name: string) => name === "Cost (₹)" ? [`₹${v}`, name] : [`${v} kWh`, name]} />
                  <Legend />
                  <Bar dataKey="energy" name="Energy (kWh)" radius={[0,4,4,0]}>
                    {zoneData.map((_, i) => <Cell key={i} fill={ZONE_COLORS[i % ZONE_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>

          {!zonesLoading && zoneData.length > 0 && (
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <Zap className="w-6 h-6 text-yellow-500" />
                <div>
                  <h2 className="text-xl font-semibold">Live Power by Room</h2>
                  <p className="text-sm text-muted-foreground">
                    {liveZoneSet.size > 0 ? "Actual measured wattage from room sensors" : "Active wattage (estimated from device ratings)"}
                  </p>
                </div>
                {liveZoneSet.size > 0 && (
                  <span className="ml-auto flex items-center gap-1.5 text-xs font-medium">
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-green-600">Live sensor data</span>
                  </span>
                )}
              </div>
              <ResponsiveContainer width="100%" height={Math.max(300, zoneData.length * 60)}>
                <BarChart data={zoneData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" unit=" W" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="zone" type="category" width={110} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: any) => [`${v} W`, "Power"]} />
                  <Bar dataKey="watts" name="Power (W)" radius={[0,4,4,0]}>
                    {zoneData.map((_, i) => <Cell key={i} fill={ZONE_COLORS[i % ZONE_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          {!zonesLoading && zoneData.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {zoneData.map((zone, i) => {
                const isLive = liveZoneSet.has(zone.zone);
                const lastSeen = zoneLastSeen[zone.zone];
                return (
                  <Card key={i} className="p-4 border-l-4" style={{ borderLeftColor: ZONE_COLORS[i % ZONE_COLORS.length] }}>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-sm truncate">{zone.zone}</h3>
                      {isLive ? (
                        <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                          Live
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground opacity-50">Estimated</span>
                      )}
                    </div>
                    <div className="space-y-1">
                      {[
                        ["Energy", `${zone.energy} kWh`, ""],
                        ["Power",  `${zone.watts} W`,    "text-yellow-600"],
                        ["Cost",   `₹${zone.cost}`,      "text-green-600"],
                        ["Share",  `${zone.percentage}%`, "text-blue-600"],
                      ].map(([label, val, cls]) => (
                        <div key={label} className="flex justify-between items-center">
                          <span className="text-xs text-muted-foreground">{label}</span>
                          <span className={`font-bold text-sm ${cls}`}>{val}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${zone.percentage}%`, backgroundColor: ZONE_COLORS[i % ZONE_COLORS.length] }} />
                    </div>
                    {isLive && lastSeen && (
                      <p className="mt-2 text-xs text-muted-foreground opacity-60">
                        Updated {lastSeen.toLocaleTimeString()}
                      </p>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ══ MONTHLY ════════════════════════════════════════════════════════ */}
        <TabsContent value="monthly" className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <TrendingUp className="w-6 h-6 text-green-600" />
              <div>
                <h2 className="text-xl font-semibold">Monthly Energy Trend</h2>
                <p className="text-sm text-muted-foreground">Last 6 months</p>
              </div>
            </div>
            {monthlyLoading ? <LoadingSpinner /> : monthlyData.length === 0 ? (
              <EmptyState label="No monthly data available yet" />
            ) : (
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis unit=" kWh" tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: any) => [`${v} kWh`, "Energy"]} />
                  <Legend />
                  <Line type="monotone" dataKey="energy" stroke="#10b981" strokeWidth={2.5} name="Energy (kWh)" dot={{ r: 5 }} activeDot={{ r: 7 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Card>

          {!monthlyLoading && monthlyData.length > 0 && (
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <IndianRupee className="w-6 h-6 text-blue-600" />
                <div>
                  <h2 className="text-xl font-semibold">Monthly Cost vs Energy</h2>
                  <p className="text-sm text-muted-foreground">Comparative view</p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis yAxisId="left"  unit=" kWh" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="right" orientation="right" unit=" ₹" tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: any, name: string) => name === "Cost (₹)" ? [`₹${v}`, name] : [`${v} kWh`, name]} />
                  <Legend />
                  <Bar yAxisId="left"  dataKey="energy" fill="#3b82f6" name="Energy (kWh)" radius={[4,4,0,0]} />
                  <Bar yAxisId="right" dataKey="cost"   fill="#10b981" name="Cost (₹)"     radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { label: "Average Monthly", value: `${monthlyStats.avg} kWh`,      icon: <Activity    className="w-4 h-4 text-blue-500"  />, sub: "Per month (last 6)",   cls: "" },
              { label: "Total Tracked",   value: `${monthlyStats.total} kWh`,     icon: <Zap        className="w-4 h-4 text-purple-500"/>, sub: "6 months combined",     cls: "" },
              { label: "Cost Savings",    value: `₹${monthlyStats.savings}`,      icon: <IndianRupee className="w-4 h-4 text-green-500"/>, sub: "vs previous period",    cls: "text-green-600" },
            ].map((s, i) => (
              <Card key={i} className="p-6">
                <div className="flex items-center gap-2 mb-2">{s.icon}<h3 className="text-sm text-muted-foreground">{s.label}</h3></div>
                <p className={`text-3xl font-bold ${s.cls}`}>{monthlyLoading ? "—" : s.value}</p>
                <p className="text-sm text-muted-foreground mt-2">{s.sub}</p>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ══ ANALYSIS ═══════════════════════════════════════════════════════ */}
        <TabsContent value="analysis" className="space-y-6">
          <DailyEnergyAnalysis />
        </TabsContent>
      </Tabs>
    </div>
  );
}