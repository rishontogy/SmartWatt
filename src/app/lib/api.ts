import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { createClient } from '@supabase/supabase-js';

// Create Supabase client for frontend auth
export const supabase = createClient(
  `https://${projectId}.supabase.co`,
  publicAnonKey
);

// Helper function for authenticated API calls (not used in mock)
async function apiCall(endpoint: string, options: RequestInit = {}) {
  // Mock API call
  console.log('Mock API call:', endpoint, options);
  return { success: true };
}

// Auth API - Supabase implementation
export const authAPI = {
  async signUp(email: string, password: string, name: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name }
      }
    });
    if (error) throw error;

    return { user: data.user, session: data.session };
  },

  async login(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) throw error;

    return { user: data.user, session: data.session };
  },

  async logout() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  },

  async getUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    return data.user;
  },

  isAuthenticated() {
    return !!supabase.auth.getUser();
  },

  getCurrentUser() {
    return supabase.auth.getUser();
  },

  getCurrentSession() {
    return supabase.auth.getSession();
  },
};

// Profile API
export const profileAPI = {
  async getProfile() {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .single();

    if (error) {
      // If profile doesn't exist, return null and we'll handle it in the UI
      if (error.code === 'PGRST116') { // No rows returned
        return null;
      }
      throw error;
    }
    return data;
  },

  async createOrUpdateProfile(profileData: Record<string, unknown>) {
    const { data, error } = await supabase
      .from('profiles')
      .upsert(profileData)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateProfile(updates: Record<string, unknown>) {
    const { error } = await supabase
      .from('profiles')
      .update(updates);
    if (error) throw error;
  },
};

// Energy API
export const energyAPI = {
  async getCurrentReading() {
    // For current reading, perhaps get latest from readings
    const { data, error } = await supabase
      .from('energy_readings')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();
    if (error) throw error;
    return {
      current: data.current,
      voltage: data.voltage,
      power: data.power,
      energy: data.energy,
    };
  },

  async getHistory(period: 'day' | 'week' | 'month' = 'day') {
    // Mock for now, but can query based on period
    const { data, error } = await supabase
      .from('energy_readings')
      .select('timestamp, power')
      .order('timestamp', { ascending: false })
      .limit(5);
    if (error) throw error;
    return data.map((d: any) => ({
      time: new Date(d.timestamp).toLocaleTimeString(),
      power: d.power
    }));
  },

  async submitReading(reading: Record<string, unknown>) {
    const { error } = await supabase
      .from('energy_readings')
      .insert(reading);
    if (error) throw error;
  },
};

// Devices API
export const devicesAPI = {
  async getDevices() {
    const { data, error } = await supabase
      .from('devices')
      .select('*');
    if (error) throw error;
    return data;
  },

  async saveDevice(device: Record<string, unknown>) {
    const { data, error } = await supabase
      .from('devices')
      .insert(device)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteDevice(id: string) {
    const { error } = await supabase
      .from('devices')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};

// Zones API
export const zonesAPI = {
  async getZones() {
    const { data, error } = await supabase
      .from('zones')
      .select('*');
    if (error) throw error;
    return data;
  },

  async updateZones(zones: unknown[]) {
    // Assuming zones is array of updates
    for (const zone of zones) {
      const { error } = await supabase
        .from('zones')
        .upsert(zone as any);
      if (error) throw error;
    }
  },
};

// Billing API
export const billingAPI = {
  async getBilling() {
    // Get current month billing
    const now = new Date();
    const { data, error } = await supabase
      .from('billing')
      .select('*')
      .eq('month', now.getMonth() + 1)
      .eq('year', now.getFullYear())
      .single();
    if (error && error.code !== 'PGRST116') throw error; // PGRST116 is no rows
    if (data) {
      return {
        currentMonth: data.amount,
        lastMonth: 0, // TODO: calculate
        savings: data.savings,
        tariff: data.tariff,
      };
    }
    return {
      currentMonth: 0,
      lastMonth: 0,
      savings: 0,
      tariff: 8,
    };
  },

  async updateBilling(billingData: Record<string, unknown>) {
    const { error } = await supabase
      .from('billing')
      .insert(billingData);
    if (error) throw error;
  },
};

// Analytics API
export const analyticsAPI = {
  async getConsumptionAnalytics(period: 'week' | 'month' = 'week') {
    // Aggregate from readings and zones
    const { data: readings, error: readingsError } = await supabase
      .from('energy_readings')
      .select('power, zone');
    if (readingsError) throw readingsError;

    const { data: zones, error: zonesError } = await supabase
      .from('zones')
      .select('name, consumption');
    if (zonesError) throw zonesError;

    const total = readings.reduce((sum, r) => sum + r.power, 0);
    const average = total / readings.length || 0;
    const peak = Math.max(...readings.map(r => r.power), 0);

    const zoneConsumption = zones.map(z => ({
      name: z.name,
      percentage: (z.consumption / total) * 100 || 0
    }));

    return {
      total,
      average,
      peak,
      zones: zoneConsumption,
    };
  },
};
