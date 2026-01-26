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
  Phone,
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
import { profileAPI } from "@/app/lib/api";
import { toast } from "sonner";

export function ProfilePage() {
  const { theme, toggleTheme } = useTheme();
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    full_name: '',
    email: ''
  });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        let data = await profileAPI.getProfile();

        // If profile doesn't exist, create it
        if (!data && user) {
          data = await profileAPI.createOrUpdateProfile({
            id: user.id,
            full_name: user.user_metadata?.full_name || '',
            email: user.email,
            is_verified: user.email_confirmed_at ? true : false
          });
        }

        setProfile(data);
        setEditForm({
          full_name: data?.full_name || '',
          email: data?.email || user?.email || ''
        });
      } catch (error) {
        console.error("Failed to fetch profile:", error);
        toast.error("Failed to load profile");
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
            <Badge>{profile?.is_verified ? 'Verified' : 'Unverified'}</Badge>
            <p className="text-sm text-muted-foreground">User ID: {user.id}</p>
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
              <span className="font-mono text-sm">{user.id}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Account Created</Label>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span>{user.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown'}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Last Login</Label>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span>{profile?.last_login ? new Date(profile.last_login).toLocaleString() : 'Never'}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Verification Status</Label>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-muted-foreground" />
              <Badge variant={profile?.is_verified ? 'default' : 'secondary'}>
                {profile?.is_verified ? 'Verified' : 'Unverified'}
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

      {/* Connected Devices */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Connected Devices</h2>
        <div className="space-y-4">
          {[
            { id: "ESP32-001", zone: "Living Room", status: "online", lastSeen: "2 sec ago" },
            { id: "ESP32-002", zone: "Kitchen", status: "online", lastSeen: "5 sec ago" },
            { id: "ESP32-003", zone: "Bedroom", status: "online", lastSeen: "3 sec ago" },
            { id: "ESP32-004", zone: "Main Board", status: "online", lastSeen: "1 sec ago" },
          ].map((device) => (
            <div key={device.id} className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${device.status === "online" ? "bg-green-100" : "bg-gray-100"}`}>
                  <Wifi className={`w-5 h-5 ${device.status === "online" ? "text-green-600" : "text-gray-400"}`} />
                </div>
                <div>
                  <h4 className="font-semibold">{device.id}</h4>
                  <p className="text-sm text-gray-600">{device.zone}</p>
                </div>
              </div>
              <div className="text-right">
                <Badge variant={device.status === "online" ? "default" : "secondary"}>
                  {device.status}
                </Badge>
                <p className="text-xs text-gray-500 mt-1">Last seen: {device.lastSeen}</p>
              </div>
            </div>
          ))}
        </div>
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
