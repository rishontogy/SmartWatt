import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { Progress } from "@/app/components/ui/progress";
import {
  Home, Zap, TrendingUp, Activity, ArrowLeft,
  Lightbulb, Tv, ChefHat, Fan, Smartphone, Monitor,
  Plus, PlugZap,
  BatteryCharging, ThermometerSun, IndianRupee,
  ShieldCheck, ShieldOff, WifiOff, Wifi, RefreshCw, AlertTriangle,
} from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { devicesAPI } from "@/app/lib/api";
import { toast } from "sonner";

const SERVER_PORT = 3001;
const RATE_PER_KWH = 8;

// The ESP32 device ID sent in /register?id=ESP32_M
const ESP_DEVICE_ID = "ESP32_M";

function getServerBase() {
  return `http://${window.location.hostname}:${SERVER_PORT}`;
}

const getDeviceIcon = (type: string) => {
  switch (type.toLowerCase()) {
    case "lighting": return Lightbulb;
    case "entertainment": return Tv;
    case "appliance": return ChefHat;
    case "fan": return Fan;
    case "charger": return Smartphone;
    case "computer": return Monitor;
    case "hvac": return ThermometerSun;
    case "master": return Cpu;
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
    case "hvac": return "bg-blue-100 text-blue-800";
    case "master": return "bg-red-100 text-red-800";
    default: return "bg-gray-100 text-gray-800";
  }
};

interface Device {
  id: string; name: string; type: string;
  consumption: number; isOn: boolean;
  isMaster: boolean; channel?: string;
  ip_address?: string;
}

interface ZoneLive {
  voltage: number; current: number;
  power: number; energy: number;
}

interface RelayUIState {
  ch1On: boolean; ch2On: boolean;
  guardActive: boolean; guardPhase: string;
  sending: boolean; espOnline: boolean;
  resolvedDeviceId: string | null;
  resolutionAttempted: boolean;
  stateKnown: boolean; // true once hardware or global toggle has set ch state
}

export function ZoneDetailsPage() {
  const navigate = useNavigate();
  const { zoneName } = useParams<{ zoneName: string }>();

  const wsRef = useRef<WebSocket | null>(null);
  const reconnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const analyzerIdRef = useRef<string>('');

  const [devices, setDevices] = useState<Device[]>([]);
  const lastGlobalActionRef = useRef<number>(0);
  const [live, setLive] = useState<ZoneLive | null>(null);
  const [todayKwh, setTodayKwh] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");
  const [wsConnected, setWsConnected] = useState(false);

  const [relayUI, setRelayUI] = useState<RelayUIState>({
    ch1On: false, ch2On: false,
    guardActive: false, guardPhase: 'idle',
    sending: false, espOnline: false,
    resolvedDeviceId: null,
    resolutionAttempted: false,
    stateKnown: false,
  });

  const zoneDeviceIdsRef = useRef<string[]>([]);
  // Keep a ref mirror of resolvedDeviceId so WS handler & sendRelay can
  // read latest value without stale closure issues
  const resolvedDevIdRef = useRef<string | null>(null);

  // ─────────────────────────────────────────────────────────────────
  //  resolveRelayDeviceId
  //
  //  The root cause of "ESP32 not found":
  //    • Server's GET /api/devices filters by user_id
  //    • But /register?id=ESP32_M only does UPDATE devices SET ip_address
  //      — it does NOT set user_id
  //    • So if the device row was created without a user_id (or with a
  //      different user), it won't appear in the API response.
  //
  //  Fix: also check /debug/state which exposes the live espRegistry
  //  (no auth). If ESP32_M is there, we use it regardless.
  //  The relay endpoint's 404 guard is: WHERE id=? AND user_id=?
  //  So if ownership is truly wrong the server returns 404 and we
  //  surface a clear actionable message.
  // ─────────────────────────────────────────────────────────────────
  const resolveRelayDeviceId = useCallback(async (
    zoneDevs: Device[]
  ): Promise<string | null> => {
    const token = localStorage.getItem("token");
    const headers = { Authorization: `Bearer ${token ?? ""}` };
    const base = getServerBase();

    // 1. Prefer our intended ESP device if it's in the DB with an IP
    const targetDev = zoneDevs.find(d => d.id === ESP_DEVICE_ID && d.ip_address);
    if (targetDev) {
      console.log("[ESP RESOLVE] target device with IP:", targetDev.id);
      return targetDev.id;
    }

    // 2. Check user's own devices via authenticated API
    try {
      const res = await fetch(`${base}/api/devices`, { headers });
      if (res.ok) {
        const all: any[] = await res.json();
        console.log("[ESP RESOLVE] all user devices:", all.map(d => d.id));

        if (all.find(d => d.id === ESP_DEVICE_ID)) return ESP_DEVICE_ID;

        const withIp = all.find(d => d.ip_address);
        if (withIp) return withIp.id;

        const master = all.find(d => d.type === "master");
        if (master) return master.id;
      }
    } catch (e) {
      console.warn("[ESP RESOLVE] /api/devices failed:", e);
    }

    // 3. Fall back to the unauthenticated debug/state endpoint which
    //    exposes the server's live espRegistry (devices that called /register)
    try {
      const dbgRes = await fetch(`${base}/debug/state`);
      if (dbgRes.ok) {
        const dbg = await dbgRes.json();
        const registry: Record<string, { ip: string; online: boolean }> =
          dbg.espRegistry || {};
        console.log("[ESP RESOLVE] server registry keys:", Object.keys(registry));

        if (registry[ESP_DEVICE_ID]) return ESP_DEVICE_ID;

        // online device first, then any
        const onlineEntry = Object.entries(registry).find(([, v]) => v.online);
        if (onlineEntry) return onlineEntry[0];

        const anyEntry = Object.keys(registry)[0];
        if (anyEntry) return anyEntry;
      }
    } catch (e) {
      console.warn("[ESP RESOLVE] /debug/state failed:", e);
    }

    return null;
  }, []);

  // ── fetchRelayState ────────────────────────────────────────────
  const fetchRelayState = useCallback(async (deviceId: string) => {
    if (!deviceId) return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${getServerBase()}/api/devices/${deviceId}/relay`,
        { headers: { Authorization: `Bearer ${token ?? ""}` } }
      );
      if (!res.ok) return;
      const rd = await res.json();

      resolvedDevIdRef.current = deviceId;
      setRelayUI(prev => ({
        ...prev,
        espOnline: rd.online ?? prev.espOnline,
        // Invert states because relay module is active-LOW 
        // (true = HIGH = bulb OFF, false = LOW = bulb ON)
        ch1On: rd.esp?.ch1 != null ? !rd.esp.ch1 : prev.ch1On,
        ch2On: rd.esp?.ch2 != null ? !rd.esp.ch2 : prev.ch2On,
        guardActive: rd.guard?.active ?? prev.guardActive,
        guardPhase: rd.guard?.phase ?? prev.guardPhase,
        resolvedDeviceId: deviceId,
        stateKnown: true,
      }));
    } catch { /* silent */ }
  }, []);

  // ── sendRelayCommand ───────────────────────────────────────────
  const sendRelayCommand = useCallback(async (
    channel: 1 | 2,
    turnOn: boolean,
    guardEnabled: boolean
  ) => {
    const deviceId = resolvedDevIdRef.current;
    if (!deviceId) {
      toast.error("ESP32 not resolved yet — tap the refresh button");
      return;
    }

    setRelayUI(prev => ({ ...prev, sending: true }));
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${getServerBase()}/api/devices/${deviceId}/relay`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token ?? ""}`,
          },
          body: JSON.stringify({
            channel,
            // Invert outgoing payload for active-LOW relay
            state: turnOn ? "off" : "on",
            guardEnabled,
          }),
        }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 404) {
          toast.error(
            `Device "${deviceId}" not found in your account. ` +
            `Add it via Add Device or power-cycle the ESP32.`
          );
        } else if (res.status === 503) {
          toast.error("ESP32 offline — power cycle to reconnect");
        } else {
          toast.error(`Relay error: ${data.error || res.statusText}`);
        }
        setRelayUI(prev => ({ ...prev, sending: false }));
        return;
      }

      setRelayUI(prev => ({
        ...prev,
        ch1On: channel === 1 ? turnOn : prev.ch1On,
        ch2On: channel === 2 ? turnOn : prev.ch2On,
        guardActive: channel === 2 && !turnOn ? false : prev.guardActive,
        guardPhase: channel === 2 && !turnOn ? 'idle' : prev.guardPhase,
        sending: false,
        stateKnown: true,
      }));

      toast.success(
        channel === 1
          ? `Socket ${turnOn ? "ON" : "OFF"}`
          : turnOn ? "Bulb ON — guard watching" : "Bulb OFF"
      );
    } catch {
      toast.error("Failed to reach server");
      setRelayUI(prev => ({ ...prev, sending: false }));
    }
  }, []);

  // ── WebSocket ──────────────────────────────────────────────────
  const connectWS = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${window.location.hostname}:${SERVER_PORT}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsConnected(true);
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
        const isOur = (id: string) =>
          id === ESP_DEVICE_ID || id === resolvedDevIdRef.current;

        if (data.type === 'kill_switch') {
          // Clear sticky guard so hardware relay_state feedback isn't blocked
          lastGlobalActionRef.current = 0;
          if (data.state === 'OFF') {
            // Kill Power OFF → force Bulb/Socket OFF immediately
            setRelayUI(prev => ({
              ...prev,
              ch1On: false,
              ch2On: false,
              guardActive: false,
              guardPhase: 'idle',
              sending: false,
              stateKnown: true,
            }));
            setDevices(prev => prev.map(d => ({ ...d, isOn: false })));
          }
          // Kill Power ON (Main Power restored) → do NOT force Bulb/Socket ON.
          // Their state will naturally update via relay_state hardware feedback.
          return;
        }

        if (data.type === 'device_toggle') {
          const isOn = data.status === 'active';
          if (data.deviceId === 'all') {
            lastGlobalActionRef.current = Date.now();
            setRelayUI(prev => ({
              ...prev,
              ch1On: isOn,
              ch2On: isOn,
              sending: false,
              stateKnown: true,
            }));
            setDevices(prev => prev.map(d => ({ ...d, isOn: isOn })));
          } else {
            // Real-time update for individual devices (Active Devices count)
            setDevices(prev => prev.map(d => d.id === data.deviceId ? { ...d, isOn: isOn } : d));
          }
          return;
        }

        if (data.type === 'device_registered' && isOur(data.deviceId)) {
          resolvedDevIdRef.current = resolvedDevIdRef.current ?? data.deviceId;
          setRelayUI(prev => ({
            ...prev, espOnline: true,
            resolvedDeviceId: prev.resolvedDeviceId ?? data.deviceId,
          }));
          fetchRelayState(data.deviceId);
          return;
        }
        if (data.type === 'device_online' && isOur(data.deviceId)) { setRelayUI(p => ({ ...p, espOnline: true })); return; }
        if (data.type === 'device_offline' && isOur(data.deviceId)) { setRelayUI(p => ({ ...p, espOnline: false })); return; }

        if (data.type === 'relay_state' && isOur(data.deviceId)) {
          // Sticky state: ignore hardware feedback for 5s after a global action
          // to prevent state reversion from inconsistent hardware logic.
          if (Date.now() - lastGlobalActionRef.current < 5000) {
            console.log("[WS] Ignoring relay_state due to recent global action");
            return;
          }
          setRelayUI(prev => ({
            ...prev,
            // Invert WS incoming states because of active-LOW
            ch1On: data.channel === 1 ? data.state === 'off' : prev.ch1On,
            ch2On: data.channel === 2 ? data.state === 'off' : prev.ch2On,
            guardActive: data.channel === 2 && data.state === 'on' ? false : prev.guardActive,
            guardPhase: data.channel === 2 && data.state === 'on' ? 'idle' : prev.guardPhase,
            sending: false,
            stateKnown: true,
          }));
          if (data.reason === 'no_human_detected') toast.info("Bulb OFF — no human detected");
          return;
        }
        if (data.type === 'guard_update' && isOur(data.deviceId)) {
          setRelayUI(prev => ({ ...prev, guardActive: data.active, guardPhase: data.phase }));
          return;
        }

        // Energy — real-time update from WebSocket
        if (!zoneDeviceIdsRef.current.includes(data.device_id)) return;
        const num = (v: unknown) => { const p = parseFloat(String(v ?? '').replace(/[^0-9.-]/g, '')); return isNaN(p) ? 0 : p; };
        const v = num(data.voltage ?? data.V);
        const c = num(data.current ?? data.I ?? data.amp);
        let p = num(data.power ?? data.P ?? data.watt);
        const e = num(data.energy ?? data.E ?? data.kWh);
        if (!p && v && c) p = v * c;
        setLive({ voltage: v, current: c, power: p, energy: e });
        // Keep todayKwh real-time from WS if energy reading carries a cumulative value
        if (e > 0) setTodayKwh(parseFloat(e.toFixed(4)));
        setLastUpdated(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      } catch { /* ignore */ }
    };
  }, [fetchRelayState]);

  // ── fetchData ──────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!zoneName) return;
    try {
      const token = localStorage.getItem("token");
      const headers: HeadersInit = { Authorization: `Bearer ${token ?? ""}` };
      const base = getServerBase();

      const devicesData = await devicesAPI.getDevices().catch(() => []);
      const zoneDevs: Device[] = devicesData
        .filter((d: any) => d.zone === zoneName)
        .map((d: any) => ({
          id: d.id,
          name: d.name || d.id,
          type: d.type || "slave",
          consumption: d.power_rating || 0,
          isOn: d.status === "active",
          isMaster: d.type === "master",
          channel: d.channel || undefined,
          ip_address: d.ip_address || undefined,
        }));
      setDevices(zoneDevs);
      zoneDeviceIdsRef.current = zoneDevs.map(d => d.id);

      // Resolve ESP — only re-resolve if not yet found
      if (!resolvedDevIdRef.current) {
        const deviceId = await resolveRelayDeviceId(zoneDevs);
        if (deviceId) {
          resolvedDevIdRef.current = deviceId;
          setRelayUI(prev => ({
            ...prev,
            resolvedDeviceId: deviceId,
            resolutionAttempted: true,
          }));
          await fetchRelayState(deviceId);
        } else {
          setRelayUI(prev => ({ ...prev, resolutionAttempted: true }));
        }
      } else {
        await fetchRelayState(resolvedDevIdRef.current);
      }

      // Energy
      const analyzer =
        zoneDevs.find(d => d.id === analyzerIdRef.current) ||
        zoneDevs.find(d => d.type !== 'master') ||
        zoneDevs[0];
      analyzerIdRef.current = analyzer?.id || '';

      if (analyzer) {
        const [liveRes, todayRes] = await Promise.allSettled([
          fetch(`${base}/api/energy/device/${analyzer.id}`, { headers }).then(r => r.json()),
          fetch(`${base}/api/energy/today?device_id=${analyzer.id}`, { headers }).then(r => r.json()),
        ]);
        if (liveRes.status === "fulfilled" && liveRes.value && !live) {
          const l = liveRes.value;
          setLive({
            voltage: parseFloat(l.voltage ?? 0),
            current: parseFloat(l.current ?? 0),
            power: parseFloat(l.power ?? 0),
            energy: parseFloat(l.energy ?? 0),
          });
        }
        if (todayRes.status === "fulfilled" && todayRes.value?.total != null) {
          setTodayKwh(parseFloat(parseFloat(todayRes.value.total).toFixed(4)));
        }
      }

      setLastUpdated(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    } catch (e) {
      console.error("fetchData:", e);
    } finally {
      setIsLoading(false);
    }
  }, [zoneName, fetchRelayState, resolveRelayDeviceId]);

  useEffect(() => {
    fetchData();
    connectWS();
    const poll = setInterval(fetchData, 15000);
    return () => {
      clearInterval(poll);
      if (reconnTimer.current) clearTimeout(reconnTimer.current);
      wsRef.current?.close();
    };
  }, [fetchData, connectWS]);

  // ── Manual re-scan ─────────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    resolvedDevIdRef.current = null;
    setRelayUI(prev => ({ ...prev, resolvedDeviceId: null, resolutionAttempted: false }));
    await fetchData();
    toast.success("Re-scanned for ESP32");
  }, [fetchData]);

  // ── Derived ────────────────────────────────────────────────────
  const slaves = devices.filter(d => !d.isMaster);
  const activeSlaves = slaves.filter(d => d.isOn);
  const activeW = activeSlaves.reduce((s, d) => s + d.consumption, 0);
  const totalRatedW = slaves.reduce((s, d) => s + d.consumption, 0);
  const currentPower = live ? live.power : activeW;
  const loadPercent = totalRatedW > 0 ? Math.round((currentPower / totalRatedW) * 100) : 0;
  const relayDevice = devices.find(d => d.id === relayUI.resolvedDeviceId || d.id === ESP_DEVICE_ID);
  const relayDBOn = relayDevice?.isOn ?? false;
  // Use relayDBOn ONLY as initial state before hardware has been heard from.
  // Once stateKnown is true, trust relayUI exclusively to avoid stale DB overriding live state.
  const bulbActive = relayUI.stateKnown ? relayUI.ch2On : (relayUI.ch2On || relayDBOn);
  const socketActive = relayUI.stateKnown ? relayUI.ch1On : (relayUI.ch1On || relayDBOn);
  const todayCost = parseFloat((todayKwh * RATE_PER_KWH).toFixed(2));
  const maxW = Math.max(...slaves.map(d => d.consumption), 1);
  const consumptionStatus =
    currentPower > 2000 ? "High" : currentPower > 500 ? "Medium" : "Low";
  const statusColor =
    consumptionStatus === "High" ? "bg-red-100 text-red-700" :
      consumptionStatus === "Medium" ? "bg-yellow-100 text-yellow-700" :
        "bg-green-100 text-green-700";
  const guardLabel =
    relayUI.guardPhase === 'first_check' ? "1st scan…" :
      relayUI.guardPhase === 'second_check' ? "2nd scan…" :
        relayUI.guardPhase === 'armed' ? "Armed" : "";

  const relayDisabled = relayUI.sending || !relayUI.resolvedDeviceId;

  const espBadgeClass =
    !relayUI.resolvedDeviceId
      ? "bg-slate-100 text-slate-500 border-slate-200"
      : relayUI.espOnline
        ? "bg-green-50 text-green-700 border-green-200"
        : "bg-orange-50 text-orange-600 border-orange-200";

  const espBadgeLabel =
    !relayUI.resolvedDeviceId && !relayUI.resolutionAttempted
      ? "Searching…"
      : !relayUI.resolvedDeviceId
        ? "Not found"
        : relayUI.espOnline
          ? `Online · ${relayUI.resolvedDeviceId}`
          : `Offline · ${relayUI.resolvedDeviceId}`;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading zone details…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/zones")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <Home className="w-8 h-8 text-blue-600" />
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-bold">{zoneName}</h1>
          <p className="text-muted-foreground text-sm flex flex-wrap items-center gap-2">
            <span>Zone details • Updated {lastUpdated}</span>
            <span className="inline-flex items-center gap-1 text-xs font-medium">
              <span className={`w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'}`} />
              <span className={wsConnected ? 'text-green-600' : 'text-yellow-600'}>
                {wsConnected ? 'Live' : 'Polling'}
              </span>
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-medium">
              {relayUI.espOnline
                ? <><Wifi className="w-3 h-3 text-green-500" /><span className="text-green-600">ESP online</span></>
                : relayUI.resolvedDeviceId
                  ? <><WifiOff className="w-3 h-3 text-orange-400" /><span className="text-orange-500">ESP offline</span></>
                  : <><WifiOff className="w-3 h-3 text-slate-400" /><span className="text-slate-500">Searching ESP…</span></>
              }
            </span>
          </p>
        </div>
      </div>

      {/* ── Room Quick Controls ─────────────────────────────────── */}
      <Card className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100 shadow-sm">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-bold text-slate-800">Room Quick Controls</h2>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="bg-white/50 text-blue-700 border-blue-200">
              {zoneName}
            </Badge>
            <Button
              variant="ghost" size="icon"
              className="h-7 w-7 text-slate-500 hover:text-blue-600"
              onClick={handleRefresh}
              title="Re-scan for ESP32"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Badge variant="outline" className={espBadgeClass}>
              {espBadgeLabel}
            </Badge>
          </div>
        </div>

        {/* Warning: not found after resolution attempt */}
        {!relayUI.resolvedDeviceId && relayUI.resolutionAttempted && (
          <div className="mb-4 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold mb-1">ESP32 not found in your account</p>
              <p className="text-amber-700 text-xs mb-1">
                Device <code className="bg-amber-100 px-1 rounded font-mono">{ESP_DEVICE_ID}</code> is
                either not registered or not linked to your account. Try:
              </p>
              <ul className="text-amber-700 text-xs list-disc ml-4 space-y-0.5">
                <li>Power-cycle the ESP32 — it will auto-register on boot</li>
                <li>Go to <strong>Add Device</strong> and add ID <code className="bg-amber-100 px-1 rounded font-mono">{ESP_DEVICE_ID}</code></li>
                <li>Check that the ESP and this server are on the same network</li>
                <li>Tap the refresh <RefreshCw className="inline w-3 h-3" /> button above after power-cycling</li>
              </ul>
            </div>
          </div>
        )}

        {/* Warning: found but offline */}
        {relayUI.resolvedDeviceId && !relayUI.espOnline && (
          <div className="mb-4 flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-sm text-orange-700">
            <WifiOff className="w-4 h-4 shrink-0" />
            <span>
              ESP32 appears offline. Relay commands may still be queued.
              Power-cycle the device to force re-registration.
            </span>
          </div>
        )}

        {/* Control buttons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* Bulb — ch=2, guarded */}
          <Button
            variant="outline"
            disabled={relayDisabled}
            className={`h-28 flex flex-col gap-1 rounded-2xl border-2 transition-all hover:shadow-md active:scale-95 relative
              ${bulbActive ? "bg-yellow-50 border-yellow-300" : "bg-white/50 border-slate-200"}
              ${relayDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
            onClick={() => sendRelayCommand(2, !relayUI.ch2On, !relayUI.ch2On)}
          >
            {relayUI.guardActive && (
              <span className="absolute top-2 right-2 flex items-center gap-1 text-[10px] font-semibold text-purple-700 bg-purple-100 rounded-full px-1.5 py-0.5">
                <ShieldCheck className="w-3 h-3 animate-pulse" /> {guardLabel}
              </span>
            )}
            <Lightbulb className={`w-8 h-8 ${bulbActive ? "text-yellow-500 fill-yellow-400" : "text-slate-400"}`} />
            <span className="font-bold text-sm">Main Bulb</span>
            <span className="text-[10px] text-muted-foreground uppercase font-semibold">
              {relayUI.sending ? "Sending…" : bulbActive ? "ON" : "Off"}
            </span>
            {!relayUI.guardActive && (
              <span className="flex items-center gap-1 text-[10px] text-purple-400 mt-0.5">
                <ShieldOff className="w-3 h-3" /> guard on next ON
              </span>
            )}
          </Button>

          {/* Socket — ch=1 */}
          <Button
            variant="outline"
            disabled={relayDisabled}
            className={`h-28 flex flex-col gap-2 rounded-2xl border-2 transition-all hover:shadow-md active:scale-95
              ${socketActive ? "bg-blue-50 border-blue-200" : "bg-white/50 border-slate-200"}
              ${relayDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
            onClick={() => sendRelayCommand(1, !relayUI.ch1On, false)}
          >
            <PlugZap className={`w-8 h-8 ${socketActive ? "text-blue-500" : "text-slate-400"}`} />
            <div className="text-center">
              <span className="block font-bold text-sm">Power Socket</span>
              <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                {relayUI.sending ? "Sending…" : socketActive ? "Powered" : "Standby"}
              </span>
            </div>
          </Button>

          {/* Add switch */}
          <Button
            variant="outline"
            className="h-28 flex flex-col gap-2 rounded-2xl border-2 border-dashed bg-slate-50/50 hover:bg-slate-50 hover:border-blue-300 transition-all active:scale-95"
            onClick={() => navigate("/dashboard/add-device", { state: { zone: zoneName } })}
          >
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
              <Plus className="w-6 h-6" />
            </div>
            <div className="text-center">
              <span className="block font-bold text-sm">Add Switch</span>
              <span className="text-[10px] text-muted-foreground uppercase font-semibold">New Control</span>
            </div>
          </Button>
        </div>

        {/* Guard strip */}
        {relayUI.guardActive && (
          <div className="mt-4 flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-xl px-4 py-2 text-sm text-purple-800">
            <ShieldCheck className="w-4 h-4 shrink-0 animate-pulse" />
            <span>
              Human detection guard <strong>active</strong> on Bulb.
              {relayUI.guardPhase === 'first_check' && " Camera scanning — 1st check…"}
              {relayUI.guardPhase === 'second_check' && " No human found — 2nd check in 15s…"}
              {relayUI.guardPhase === 'armed' && " First scan fires in 30s."}
            </span>
          </div>
        )}

        {relayUI.resolvedDeviceId && (
          <p className="mt-3 text-[10px] text-slate-400 font-mono">
            Relay target: {relayUI.resolvedDeviceId}
          </p>
        )}
      </Card>

      {/* ── Zone Stats ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Activity className="w-8 h-8 text-blue-600 shrink-0" />
            <div>
              <p className="text-2xl font-bold">{activeSlaves.length}/{slaves.length}</p>
              <p className="text-sm text-muted-foreground">Active Devices</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Zap className="w-8 h-8 text-green-600 shrink-0" />
            <div>
              <p className="text-2xl font-bold">{live ? live.power.toFixed(1) : activeW} W</p>
              <p className="text-sm text-muted-foreground">Current Load</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-purple-600 shrink-0" />
            <div>
              <p className="text-2xl font-bold">{todayKwh.toFixed(3)}</p>
              <p className="text-sm text-muted-foreground">Today (kWh)</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <IndianRupee className="w-8 h-8 text-orange-500 shrink-0" />
            <div>
              <p className="text-2xl font-bold">₹{todayCost}</p>
              <p className="text-sm text-muted-foreground">Today's Cost</p>
            </div>
          </div>
        </Card>
      </div>

      {/* ── Load Bar ───────────────────────────────────────────── */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <BatteryCharging className="w-5 h-5 text-blue-500" />
            <span className="font-semibold">Zone Load</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={statusColor}>{consumptionStatus}</Badge>
            <span className="text-sm font-medium text-muted-foreground">
              {currentPower.toFixed(1)} W / {totalRatedW} W rated
            </span>
          </div>
        </div>
        <Progress value={loadPercent} className="h-3" />
        <p className="text-xs text-muted-foreground mt-1">{loadPercent}% of rated capacity</p>
      </Card>



    </div>
  );
}