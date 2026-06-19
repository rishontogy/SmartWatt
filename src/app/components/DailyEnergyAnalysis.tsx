import { useState, useEffect } from 'react';
import { Card } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Badge } from '@/app/components/ui/badge';
import { CalendarDays, TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { energyAPI } from '@/app/lib/api';

interface DailyAnalysisData {
  date: string;
  totalCurrent: number;
  totalPower: number;
  totalEnergy: number;
  zones: {
    name: string;
    current: number;
    power: number;
    energy: number;
  }[];
  leakDetected: boolean;
  leakAmount: number;
}

export function DailyEnergyAnalysis() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [analysisData, setAnalysisData] = useState<DailyAnalysisData | null>(null);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('day');

  useEffect(() => {
    loadDailyAnalysis();
    
    // Auto-refresh every 30s if today is selected
    const today = new Date().toISOString().split('T')[0];
    let intervalId: ReturnType<typeof setInterval> | null = null;
    
    if (selectedDate === today) {
      intervalId = setInterval(() => {
        loadDailyAnalysis(true); // pass true to indicate a silent background refresh
      }, 30000);
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [selectedDate, period]);

  const loadDailyAnalysis = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const analysis = await energyAPI.getDailyAnalysis(selectedDate, period);

      // Process the analysis data
      const processedData: DailyAnalysisData = {
        date: selectedDate,
        totalCurrent: analysis.total.avg_current || 0,
        totalPower: analysis.total.avg_power || 0,
        totalEnergy: analysis.total.total_energy || 0,
        zones: analysis.zones.map((zone: any) => ({
          name: zone.zone_name,
          current: zone.avg_current || 0,
          power: zone.avg_power || 0,
          energy: zone.total_energy || 0
        })),
        leakDetected: false, // Will be calculated separately
        leakAmount: 0
      };

      // Check for leaks
      const totalZoneCurrent = processedData.zones.reduce((sum, zone) => sum + zone.current, 0);
      const leakAmount = processedData.totalCurrent - totalZoneCurrent;
      processedData.leakDetected = Math.abs(leakAmount) > 0.1;
      processedData.leakAmount = leakAmount;

      setAnalysisData(processedData);
    } catch (error) {
      console.error('Error loading daily analysis:', error);
      // Fallback to mock data if API fails
      setAnalysisData(null);
    } finally {
      setLoading(false);
    }
  };

  const getTrendIcon = (value: number) => {
    if (value > 0) return <TrendingUp className="w-4 h-4 text-green-600" />;
    if (value < 0) return <TrendingDown className="w-4 h-4 text-red-600" />;
    return <Activity className="w-4 h-4 text-gray-600" />;
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <CalendarDays className="w-6 h-6 text-blue-600" />
          <h2 className="text-xl font-semibold">Daily Energy Analysis</h2>
        </div>
        <div className="flex gap-2">
          <Select value={period} onValueChange={(value: 'day' | 'week' | 'month') => setPeriod(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Daily</SelectItem>
              <SelectItem value="week">Weekly</SelectItem>
              <SelectItem value="month">Monthly</SelectItem>
            </SelectContent>
          </Select>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 border rounded-md"
          />
          <Button onClick={loadDailyAnalysis} variant="outline">
            Refresh
          </Button>
        </div>
      </div>

      {analysisData && (
        <div className="space-y-6">
          {/* Overall Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-700">Average Current</p>
                  <p className="text-2xl font-bold text-blue-800">{analysisData.totalCurrent.toFixed(2)}A</p>
                </div>
                {getTrendIcon(analysisData.totalCurrent)}
              </div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-700">Average Power</p>
                  <p className="text-2xl font-bold text-green-800">{analysisData.totalPower.toFixed(2)}W</p>
                </div>
                {getTrendIcon(analysisData.totalPower)}
              </div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-purple-700">Total Energy</p>
                  <p className="text-2xl font-bold text-purple-800">{analysisData.totalEnergy.toFixed(2)}kWh</p>
                </div>
                {getTrendIcon(analysisData.totalEnergy)}
              </div>
            </div>
          </div>

          {/* Leak Detection Alert */}
          {analysisData.leakDetected && (
            <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-5 h-5 text-red-600" />
                <h3 className="font-semibold text-red-900">Current Leak Detected</h3>
              </div>
              <p className="text-sm text-red-800">
                Leak Amount: <span className="font-bold">{analysisData.leakAmount.toFixed(2)}A</span>
              </p>
            </div>
          )}

          {/* Zone Breakdown */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Zone Breakdown</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {analysisData.zones.map((zone, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold">{zone.name}</h4>
                    <Badge variant="outline">{zone.current.toFixed(2)}A</Badge>
                  </div>
                  <div className="space-y-1 text-sm text-gray-600">
                    <p>Power: {zone.power.toFixed(2)}W</p>
                    <p>Energy: {zone.energy.toFixed(2)}kWh</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Analysis Insights */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold mb-2">Analysis Insights</h3>
            <ul className="text-sm text-gray-700 space-y-1">
              <li>• Total zones monitored: {analysisData.zones.length}</li>
              <li>• Peak current zone: {analysisData.zones.reduce((max, zone) => zone.current > max.current ? zone : max, analysisData.zones[0])?.name || 'N/A'}</li>
              <li>• Energy efficiency: {analysisData.totalEnergy > 0 ? 'Good' : 'No data available'}</li>
              {analysisData.leakDetected && (
                <li className="text-red-600">• ⚠️ Current leak detected - investigate wiring</li>
              )}
            </ul>
          </div>
        </div>
      )}

      {!analysisData && !loading && (
        <div className="text-center py-8">
          <CalendarDays className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600">No data available for the selected period</p>
        </div>
      )}
    </Card>
  );
}