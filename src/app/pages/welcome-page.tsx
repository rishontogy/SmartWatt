import { Link } from "react-router";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { Zap, TrendingDown, Activity, Shield } from "lucide-react";
import { ImageWithFallback } from "@/app/components/figma/ImageWithFallback";

export function WelcomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-green-500 flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">SmartWatt</h1>
              <p className="text-xs text-muted-foreground">Smart Home Energy Optimizer</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Link to="/login">
              <Button variant="ghost">Login</Button>
            </Link>
            <Link to="/signin">
              <Button className="bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600">
                Sign Up
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-4">
        <div className="py-16 md:py-24 grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <div className="inline-block px-4 py-2 bg-blue-100 rounded-full text-blue-700 text-sm font-medium">
              AI-Powered Energy Management
            </div>
            <h2 className="text-4xl md:text-6xl font-bold text-foreground leading-tight">
              Optimize Your Home Energy With <span className="bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">SmartWatt</span>
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Monitor, analyze, and optimize electricity consumption at both household and room levels. 
              Reduce unnecessary power usage, minimize costs, and promote energy-efficient behavior with our advanced AI and IoT-based solution.
            </p>
            <div className="flex gap-4">
              <Link to="/signin">
                <Button size="lg" className="bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600">
                  Get Started Free
                </Button>
              </Link>
              <Link to="/dashboard">
                <Button size="lg" variant="outline">
                  View Dashboard Demo
                </Button>
              </Link>
            </div>
          </div>
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-green-500/20 rounded-3xl blur-3xl"></div>
            <ImageWithFallback
              src="https://images.unsplash.com/photo-1675130277336-23cb686f01c0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlbmVyZ3klMjBzdXN0YWluYWJsZSUyMHBvd2VyfGVufDF8fHx8MTc2OTE4MTY4M3ww&ixlib=rb-4.1.0&q=80&w=1080"
              alt="Energy Dashboard"
              className="relative rounded-2xl shadow-2xl w-full h-auto"
            />
          </div>
        </div>

        {/* Features Grid */}
        <div className="py-16 grid md:grid-cols-4 gap-6">
          <Card className="p-6 hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center mb-4">
              <Activity className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Real-Time Monitoring</h3>
            <p className="text-gray-600 text-sm">
              Track electricity consumption across your entire home in real-time with zone-wise insights.
            </p>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center mb-4">
              <TrendingDown className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Cost Reduction</h3>
            <p className="text-gray-600 text-sm">
              Identify peak-tariff hours and shift usage to low-cost periods to minimize electricity bills.
            </p>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center mb-4">
              <Zap className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="font-semibold text-lg mb-2">AI Appliance Detection</h3>
            <p className="text-gray-600 text-sm">
              Advanced AI recognizes appliance signatures and provides appliance-level consumption data.
            </p>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 rounded-lg bg-orange-100 flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-orange-600" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Smart Automation</h3>
            <p className="text-gray-600 text-sm">
              Automatically control appliances via relay modules for optimal energy efficiency.
            </p>
          </Card>
        </div>

        {/* Guidelines Section */}
        <div className="py-16">
          <h3 className="text-3xl font-bold text-center mb-12 text-foreground">How It Works</h3>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-blue-500 text-white text-2xl font-bold flex items-center justify-center mx-auto mb-4">
                1
              </div>
              <h4 className="font-semibold text-xl mb-2">Install Sensors</h4>
              <p className="text-muted-foreground">
                Place ESP32-based energy sensors at your distribution board and individual circuits.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-green-500 text-white text-2xl font-bold flex items-center justify-center mx-auto mb-4">
                2
              </div>
              <h4 className="font-semibold text-xl mb-2">Connect & Monitor</h4>
              <p className="text-muted-foreground">
                Link your devices via MQTT and start monitoring real-time consumption on your dashboard.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-purple-500 text-white text-2xl font-bold flex items-center justify-center mx-auto mb-4">
                3
              </div>
              <h4 className="font-semibold text-xl mb-2">Save Energy</h4>
              <p className="text-muted-foreground">
                Get AI-powered insights and recommendations to reduce consumption and lower bills.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white mt-16">
        <div className="container mx-auto px-4 py-12">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-green-500 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold">SmartWatt</span>
              </div>
              <p className="text-gray-400 text-sm">
                AI-powered smart home energy optimization for sustainable living.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li>Features</li>
                <li>Pricing</li>
                <li>Documentation</li>
                <li>API</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li>About</li>
                <li>Blog</li>
                <li>Careers</li>
                <li>Contact</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Contact</h4>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li>support@smartwatt.io</li>
                <li>+1 (555) 123-4567</li>
                <li>San Francisco, CA</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400 text-sm">
            <p>&copy; 2026 SmartWatt. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
