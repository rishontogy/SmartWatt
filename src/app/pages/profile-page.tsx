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

export function ProfilePage() {
  const { theme, toggleTheme } = useTheme();
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-foreground">Profile Settings</h1>

      {/* User Information Card */}
      <Card className="p-6">
        <div className="flex items-start justify-between mb-6">
          <h2 className="text-xl font-semibold">User Information</h2>
          <Button variant="outline" size="sm">
            <Edit className="w-4 h-4 mr-2" />
            Edit Profile
          </Button>
        </div>

        <div className="flex items-center gap-6 mb-6">
          <Avatar className="w-24 h-24">
            <AvatarImage src="https://github.com/shadcn.png" />
            <AvatarFallback>JD</AvatarFallback>
          </Avatar>
          <div className="space-y-2">
            <h3 className="text-2xl font-bold">John Doe</h3>
            <Badge>Admin</Badge>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              <Input id="fullName" value="John Doe" readOnly />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <Input id="email" value="john.doe@smartwatt.io" readOnly />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-muted-foreground" />
              <Input id="phone" value="+1 (555) 123-4567" readOnly />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="joined">Member Since</Label>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <Input id="joined" value="January 15, 2024" readOnly />
            </div>
          </div>
        </div>

        <Separator className="my-6" />

        <div className="space-y-4">
          <h3 className="font-semibold">Account Details</h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Username</p>
              <p className="font-semibold">john_doe</p>
            </div>
            <div>
              <p className="text-muted-foreground">Last Login</p>
              <p className="font-semibold">Today at 10:30 AM</p>
            </div>
          </div>
          <Button variant="outline" size="sm">
            Change Password
          </Button>
        </div>
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
        <Button variant="destructive" className="w-full md:w-auto">
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </Button>
      </Card>
    </div>
  );
}
