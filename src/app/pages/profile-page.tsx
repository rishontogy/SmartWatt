import { useState, useEffect } from "react";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Switch } from "@/app/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar";
import { Badge } from "@/app/components/ui/badge";
import { Separator } from "@/app/components/ui/separator";
import {
  User,
  Mail,
  Calendar,
  Shield,
  Bell,
  Moon,
  Wifi,
  LogOut,
  Edit,
  HelpCircle,
  FileText,
} from "lucide-react";
import { useTheme } from "@/app/contexts/theme-context";
import { useAuth } from "@/app/contexts/auth-context";
import { profileAPI, devicesAPI, zonesAPI } from "@/app/lib/api";
import { toast } from "sonner";

export function ProfilePage() {
  const { theme, toggleTheme } = useTheme();
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [devices, setDevices] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  const [zoneEspStatus, setZoneEspStatus] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    full_name: '',
    email: ''
  });

  // ESP32 Modal State
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [deviceForm, setDeviceForm] = useState({
    ssid: '',
    password: '',
    type: 'slave',
    zone: ''
  });
  const [provisioningStatus, setProvisioningStatus] = useState<string>('');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        let data = await profileAPI.getProfile();

        // If profile doesn't exist, create it
        if (!data && user) {
          data = await profileAPI.createOrUpdateProfile({
            id: user.id,
            full_name: user.name || '',
            email: user.email,
            is_verified: true // Assume verified if logged in for this implementation
          });
        }

        setProfile(data);
        setEditForm({
          full_name: data?.full_name || '',
          email: data?.email || user?.email || ''
        });

        // Fetch devices and zones
        const [userDevices, userZones] = await Promise.all([
          devicesAPI.getDevices(),
          zonesAPI.getZones()
        ]);
        
        setDevices(userDevices);
        setZones(userZones);

        // Initialize switch states based on device status in each zone
        const initialStatus: Record<string, boolean> = {};
        userZones.forEach((z: any) => {
          const deviceInZone = userDevices.find((d: any) => d.zone === z.name);
          initialStatus[z.name] = deviceInZone ? deviceInZone.status === 'active' : false;
        });
        setZoneEspStatus(initialStatus);

      } catch (error) {
        console.error("Failed to fetch profile/devices/zones:", error);
        toast.error("Failed to load profile data");
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchProfile();
    } else {
      setLoading(false);
    }
  }, [user]);

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success("Signed out successfully");
    } catch (error) {
      toast.error("Failed to sign out");
    }
  };

  const handleSaveProfile = async () => {
    try {
      await profileAPI.updateProfile({
        full_name: editForm.full_name,
        email: editForm.email
      });
      setProfile({ ...profile, ...editForm });
      setIsEditing(false);
      toast.success("Profile updated successfully");
    } catch (error) {
      console.error("Failed to update profile:", error);
      toast.error("Failed to update profile");
    }
  };

  const handleToggleZoneESP = async (zoneName: string, checked: boolean) => {
    try {
      const deviceInZone = devices.find(d => d.zone === zoneName);
      if (!deviceInZone) {
        toast.error(`No ESP32 device found for zone: ${zoneName}`);
        return;
      }

      const newStatus = checked ? 'active' : 'inactive';
      await devicesAPI.toggleDevice(deviceInZone.id, newStatus);
      
      setZoneEspStatus(prev => ({ ...prev, [zoneName]: checked }));
      toast.success(`ESP32 in ${zoneName} turned ${newStatus}`);
    } catch (error) {
      console.error("Toggle failed:", error);
      toast.error("Failed to toggle device");
    }
  };

  const handleRemoveDevice = async (deviceId: string) => {
    try {
      await devicesAPI.deleteDevice(deviceId);
      setDevices(devices.filter(d => d.id !== deviceId));
      toast.success("Device removed successfully");
    } catch (error) {
      console.error("Failed to remove device:", error);
      toast.error("Failed to remove device");
    }
  };

  const handleProvisionESP32 = async () => {
    if (!deviceForm.ssid || !deviceForm.password || (deviceForm.type === 'slave' && !deviceForm.zone)) {
      toast.error("Please fill in all required fields.");
      return;
    }

    try {
      setProvisioningStatus('Requesting Bluetooth Device...');
      console.log('Requesting Bluetooth device...');

      // This requires HTTPS or localhost
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['4fafc201-1fb5-459e-8fcc-c5c9c331914b'] // Example typical UART service UUID
      });

      setProvisioningStatus('Connecting to GATT Server...');
      const server = await device.gatt.connect();

      setProvisioningStatus('Getting Service...');
      const service = await server.getPrimaryService('4fafc201-1fb5-459e-8fcc-c5c9c331914b');

      setProvisioningStatus('Getting Characteristic...');
      const characteristic = await service.getCharacteristic('beb5483e-36e1-4688-b7f5-ea07361b26a8'); // Example Rx characteristic

      setProvisioningStatus('Sending configuration...');
      const config = {
        ssid: deviceForm.ssid,
        pass: deviceForm.password,
        userId: user.id,
        type: deviceForm.type,
        zone: deviceForm.zone
      };

      const encoder = new TextEncoder();
      await characteristic.writeValue(encoder.encode(JSON.stringify(config)));

      setProvisioningStatus('Configuration sent! Awaiting connected status...');
      toast.success("Configuration sent to ESP32! Please allow it a moment to connect to WiFi and register.");

      // Close modal and try to refresh devices after a delay
      setTimeout(async () => {
        const updatedDevices = await devicesAPI.getDevices();
        setDevices(updatedDevices);
        setShowDeviceModal(false);
        setProvisioningStatus('');
        setDeviceForm({ ssid: '', password: '', type: 'slave', zone: '' });
      }, 5000);

    } catch (error: any) {
      console.error('Bluetooth Provisioning failed', error);
      toast.error(`Provisioning failed: ${error.message}`);
      setProvisioningStatus('');
    }
  };

  if (loading) {
    return <div className="max-w-6xl mx-auto space-y-6">Loading...</div>;
  }

  if (!user) {
    return <div className="max-w-6xl mx-auto space-y-6">Please log in to view your profile.</div>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-foreground">Profile Settings</h1>

      {/* User Information Card */}
      <Card className="p-6">
        <div className="flex items-start justify-between mb-6">
          <h2 className="text-xl font-semibold">User Information</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditing(!isEditing)}
          >
            <Edit className="w-4 h-4 mr-2" />
            {isEditing ? 'Cancel' : 'Edit Profile'}
          </Button>
        </div>

        <div className="flex items-center gap-6 mb-6">
          <Avatar className="w-24 h-24">
            <AvatarImage src={profile?.avatar_url} />
            <AvatarFallback>{profile?.full_name?.charAt(0) || user.email?.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="space-y-2">
            <h3 className="text-2xl font-bold">{profile?.full_name || user.email}</h3>
            <Badge variant={profile?.status === 'verified' ? 'default' : 'secondary'}>
              {profile?.status === 'verified' ? 'Verified' : 'Unverified'}
            </Badge>
            <p className="text-sm text-muted-foreground">User ID: {profile?.user_id || user?.id}</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            {isEditing ? (
              <Input
                id="fullName"
                value={editForm.full_name}
                onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
              />
            ) : (
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                <span>{profile?.full_name || 'Not set'}</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            {isEditing ? (
              <Input
                id="email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              />
            ) : (
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <span>{profile?.email || user.email}</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>User ID</Label>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-muted-foreground" />
              <span className="font-mono text-sm">{profile?.user_id || user.id}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Account Created</Label>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span>{profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : 'Unknown'}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Last Login</Label>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span>{profile?.core_last_login || profile?.last_login ? new Date(profile?.core_last_login || profile?.last_login).toLocaleString() : 'Never'}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Verification Status</Label>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-muted-foreground" />
              <Badge variant={profile?.status === 'verified' ? 'default' : 'secondary'}>
                {profile?.status === 'verified' ? 'Verified' : 'Unverified'}
              </Badge>
            </div>
          </div>
        </div>

        {isEditing && (
          <div className="flex gap-2 mt-6">
            <Button onClick={handleSaveProfile}>Save Changes</Button>
            <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
          </div>
        )}
      </Card>

      {/* Energy Usage Summary */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Energy Usage Summary</h2>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-gray-700 mb-1">Total Consumed Today</p>
            <p className="text-3xl font-bold text-blue-600">12.4 kWh</p>
          </div>
          <div className="p-4 bg-green-50 rounded-lg">
            <p className="text-sm text-gray-700 mb-1">Devices Currently ON</p>
            <p className="text-3xl font-bold text-green-600">3</p>
          </div>
          <div className="p-4 bg-purple-50 rounded-lg">
            <p className="text-sm text-gray-700 mb-1">Last Activity</p>
            <p className="text-lg font-bold text-purple-600">2 sec ago</p>
            <p className="text-xs text-gray-600">Motion detected</p>
          </div>
        </div>
      </Card>

      {/* Device Management */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Device Management</h2>
          <Button onClick={() => setShowDeviceModal(true)} size="sm">
            <Wifi className="w-4 h-4 mr-2" />
            Add New ESP32
          </Button>
        </div>

        {devices.length === 0 ? (
          <p className="text-gray-500 italic">No ESP32 devices paired yet.</p>
        ) : (
          <div className="space-y-4">
            {devices.map((device) => (
              <div key={device.id} className="flex items-center justify-between border-b pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{device.id}</span>
                    <Badge variant={device.type === 'master' ? 'default' : 'secondary'}>
                      {device.type.toUpperCase()}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-500">
                    Zone: {device.zone || 'Global (Master)'} • Status: {device.status}
                  </p>
                </div>
                <Button variant="destructive" size="sm" onClick={() => handleRemoveDevice(device.id)}>
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Provisioning Modal */}
      {showDeviceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="p-6 w-full max-w-md bg-white">
            <h2 className="text-2xl font-bold mb-4">Add ESP32 Device</h2>
            <p className="text-sm text-gray-600 mb-6">
              Enter your WiFi details so we can provision the ESP32 via Bluetooth.
            </p>
            
            <div className="space-y-4 mb-6">
              <div>
                <Label htmlFor="ssid">WiFi SSID</Label>
                <Input
                  id="ssid"
                  placeholder="Network Name"
                  value={deviceForm.ssid}
                  onChange={(e) => setDeviceForm({ ...deviceForm, ssid: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="password">WiFi Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Network Password"
                  value={deviceForm.password}
                  onChange={(e) => setDeviceForm({ ...deviceForm, password: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="type">Device Type</Label>
                <select
                  id="type"
                  className="w-full mt-1 p-2 border rounded-md"
                  value={deviceForm.type}
                  onChange={(e) => setDeviceForm({ ...deviceForm, type: e.target.value })}
                >
                  <option value="slave">Slave (Zone Module)</option>
                  <option value="master">Master (Main Line Module)</option>
                </select>
              </div>
              {deviceForm.type === 'slave' && (
                <div>
                  <Label htmlFor="zone">Zone Name</Label>
                  <Input
                    id="zone"
                    placeholder="e.g., Living Room"
                    value={deviceForm.zone}
                    onChange={(e) => setDeviceForm({ ...deviceForm, zone: e.target.value })}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    A new zone will be automatically created if it doesn't exist.
                  </p>
                </div>
              )}
            </div>

            {provisioningStatus && (
              <p className="text-sm text-blue-600 mb-4 animate-pulse">
                {provisioningStatus}
              </p>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowDeviceModal(false)} disabled={!!provisioningStatus}>
                Cancel
              </Button>
              <Button onClick={handleProvisionESP32} disabled={!!provisioningStatus}>
                <Wifi className="w-4 h-4 mr-2" />
                Connect via Bluetooth
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Preferences / Settings */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Preferences</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Moon className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Dark Mode</p>
                <p className="text-sm text-muted-foreground">Enable dark theme</p>
              </div>
            </div>
            <Switch
              checked={theme === 'dark'}
              onCheckedChange={toggleTheme}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Notifications</p>
                <p className="text-sm text-muted-foreground">Receive alerts and updates</p>
              </div>
            </div>
            <Switch defaultChecked />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-gray-600" />
              <div>
                <p className="font-medium">Motion Detection Alerts</p>
                <p className="text-sm text-gray-600">Get notified on PIR sensor activity</p>
              </div>
            </div>
            <Switch defaultChecked />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-gray-600" />
              <div>
                <p className="font-medium">Power Usage Alerts</p>
                <p className="text-sm text-gray-600">Alert on high consumption</p>
              </div>
            </div>
            <Switch defaultChecked />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Wifi className="w-5 h-5 text-gray-600" />
              <div>
                <p className="font-medium">Auto-Bulb ON/OFF Mode</p>
                <p className="text-sm text-gray-600">Automatic control based on motion</p>
              </div>
            </div>
            <Switch />
          </div>

          {/* Dynamic Zone ESP Switches */}
          {zones.map((zone) => (
            <div key={zone.id}>
              <Separator />
              <div className="flex items-center justify-between py-4">
                <div className="flex items-center gap-3">
                  <Wifi className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="font-medium">{zone.name} ESP32 Control</p>
                    <p className="text-sm text-muted-foreground">Toggle power for this zone's module</p>
                  </div>
                </div>
                <Switch 
                  checked={zoneEspStatus[zone.name] || false}
                  onCheckedChange={(checked) => handleToggleZoneESP(zone.name, checked)}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Security Settings */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-6 h-6 text-blue-600" />
          <h2 className="text-xl font-semibold">Security Settings</h2>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Two-Step Verification</p>
              <p className="text-sm text-gray-600">Add an extra layer of security</p>
            </div>
            <Button variant="outline" size="sm">
              Enable
            </Button>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Logout from All Devices</p>
              <p className="text-sm text-gray-600">Sign out from all active sessions</p>
            </div>
            <Button variant="outline" size="sm">
              <LogOut className="w-4 h-4 mr-2" />
              Logout All
            </Button>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">API Key</p>
              <p className="text-sm text-gray-600">For third-party integrations</p>
            </div>
            <Button variant="outline" size="sm">
              Generate Key
            </Button>
          </div>
        </div>
      </Card>

      {/* Support Section */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Support</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <Button variant="outline" className="justify-start">
            <HelpCircle className="w-4 h-4 mr-2" />
            Help / FAQ
          </Button>
          <Button variant="outline" className="justify-start">
            <Mail className="w-4 h-4 mr-2" />
            Contact Support
          </Button>
          <Button variant="outline" className="justify-start">
            <FileText className="w-4 h-4 mr-2" />
            Documentation
          </Button>
        </div>
      </Card>

      {/* Logout */}
      <Card className="p-6">
        <Button variant="destructive" className="w-full md:w-auto" onClick={handleSignOut}>
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </Button>
      </Card>
    </div>
  );
}
