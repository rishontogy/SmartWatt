import { Outlet, Link, useLocation } from "react-router";
import { Zap, Home, User, BarChart3, Bolt, FileText, Menu, X, Settings, MapPin, Sun, Moon, Power } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/app/contexts/auth-context";
import { useTheme } from "../contexts/theme-context";
import { toast } from "sonner";

const SERVER_PORT = 3001;

function getServerBase() {
  return `http://${window.location.hostname}:${SERVER_PORT}`;
}

export function DashboardLayout() {
  const location = useLocation();
  const { signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // killState synced from WS broadcast — single source of truth
  const [powerActive, setPowerActive] = useState(true);
  const [powerLoading, setPowerLoading] = useState(false);
  const powerLoadingRef = useRef(false);

  // Sync with WS so sidebar button reflects same state as homepage
  useEffect(() => {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${proto}//${window.location.hostname}:${SERVER_PORT}`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "kill_switch") {
          setPowerActive(data.state !== "OFF");
          powerLoadingRef.current = false;
          setPowerLoading(false);
        }
      } catch { }
    };

    // Fetch current state on mount
    const token = localStorage.getItem("token");
    fetch(`${getServerBase()}/api/devices`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(async (devices) => {
        if (Array.isArray(devices) && devices.length > 0) {
          const firstId = devices[0].id;
          const stateRes = await fetch(
            `${getServerBase()}/api/control/state?id=${firstId}`,
            { headers: { Authorization: `Bearer ${token}` } }
          ).then(r => r.json()).catch(() => ({ state: "ON" }));
          setPowerActive(stateRes.state !== "OFF");
        }
      })
      .catch(() => { });

    return () => ws.close();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut();
      toast.success("Logged out successfully");
    } catch {
      toast.error("Failed to logout");
    }
  };

  const handlePowerToggle = async () => {
    if (powerLoadingRef.current) return;

    const newState = !powerActive;
    // Optimistic update
    setPowerActive(newState);
    powerLoadingRef.current = true;
    setPowerLoading(true);

    try {
      const token = localStorage.getItem("token");
      const endpoint = newState ? "/api/control/on" : "/api/control/kill";
      const res = await fetch(`${getServerBase()}${endpoint}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      const data = await res.json();

      if (!data.ok) {
        setPowerActive(!newState); // revert
        toast.error("Failed to toggle power");
      } else {
        toast[newState ? "success" : "error"](
          newState ? "⚡ Power Restored! Devices online." : "💀 Kill Switch! All devices off."
        );
      }
    } catch {
      setPowerActive(!newState); // revert
      toast.error("Failed to toggle power");
    } finally {
      powerLoadingRef.current = false;
      setPowerLoading(false);
    }
  };

  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: Home },
    { name: "Device Control", href: "/dashboard/devices", icon: Zap },
    { name: "Zones", href: "/dashboard/zones", icon: MapPin },
    { name: "Profile", href: "/dashboard/profile", icon: User },
    { name: "Graphs", href: "/dashboard/graphs", icon: BarChart3 },
    { name: "Consumption", href: "/dashboard/consumption", icon: Bolt },
    { name: "Bill", href: "/dashboard/bill", icon: FileText },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 bg-card border-b border-border z-50 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-green-500 flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-lg text-foreground">SmartWatt</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)}>
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
      </div>

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-card border-r border-border transform transition-transform duration-200 lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"
          } pt-16 lg:pt-0`}
      >
        <div className="p-6 border-b border-border hidden lg:flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-green-500 flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-foreground">SmartWatt</h1>
            <p className="text-xs text-muted-foreground">Energy Optimizer</p>
          </div>
        </div>

        <nav className="p-4 space-y-2">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive
                    ? "bg-gradient-to-r from-blue-500 to-green-500 text-white"
                    : "text-foreground hover:bg-accent hover:text-accent-foreground"
                  }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-4 left-4 right-4 space-y-2">
          {/* Kill Switch Button — synced with homepage */}
          <Button
            variant={powerActive ? "destructive" : "default"}
            className={`w-full font-bold ${powerActive
                ? "bg-red-600 hover:bg-red-700 text-white"
                : "bg-green-600 hover:bg-green-700 text-white"
              }`}
            onClick={handlePowerToggle}
            disabled={powerLoading}
          >
            <Power className="w-4 h-4 mr-2" />
            {powerLoading
              ? "Updating..."
              : powerActive
                ? "Kill Power (OFF)"
                : "Main Power (ON)"}
          </Button>

          <Button variant="outline" className="w-full" onClick={toggleTheme}>
            {theme === "light"
              ? <Moon className="w-4 h-4 mr-2" />
              : <Sun className="w-4 h-4 mr-2" />}
            {theme === "light" ? "Dark Mode" : "Light Mode"}
          </Button>

          <Button variant="outline" className="w-full" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="lg:ml-64 pt-16 lg:pt-0">
        <div className="p-4 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}