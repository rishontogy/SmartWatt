// import { projectId, publicAnonKey } from 'utils/supabase/info';
// import { createClient } from '@supabase/supabase-js';

// const API_BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-9e22c472`;

// Create Supabase client for frontend auth
// export const supabase = createClient(
//   `https://${projectId}.supabase.co`,
//   publicAnonKey
// );

// Mock supabase client
export const supabase = {
  from: (table: string) => ({
    select: (columns?: string) => ({
      eq: (column: string, value: any) => ({
        single: () => Promise.resolve({ data: null, error: null }),
      }),
      single: () => Promise.resolve({ data: null, error: null }),
    }),
    insert: (data: any) => ({
      select: () => ({
        single: () => Promise.resolve({ data: null, error: null }),
      }),
    }),
    update: (data: any) => ({
      eq: (column: string, value: any) => Promise.resolve({ error: null }),
    }),
  }),
};

// Helper function for authenticated API calls (not used in mock)
async function apiCall(endpoint: string, options: RequestInit = {}) {
  // Mock API call
  console.log('Mock API call:', endpoint, options);
  return { success: true };
}

// Session management
let currentUser: any = null;
let currentSession: any = null;

// Password hashing utility (simple for demo - use bcrypt in production)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'smartwatt_salt_2024');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const hashedInput = await hashPassword(password);
  return hashedInput === hash;
}

// Generate session token
function generateSessionToken(): string {
  return crypto.randomUUID() + '-' + Date.now();
}

// Auth API - Custom implementation with users table
// Auth API - Mock implementation
export const authAPI = {
  async signUp(email: string, password: string, name: string) {
    // Mock sign up
    const mockUser = {
      id: 'mock-user-id',
      email,
      full_name: name,
      is_verified: true,
      is_active: true,
      login_attempts: 0,
      locked_until: null,
      last_login: new Date(),
    };
    const mockSession = {
      user: mockUser,
      session_token: generateSessionToken(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
    currentUser = mockUser;
    currentSession = mockSession;
    return { user: mockUser, session: mockSession };
  },

  async login(email: string, password: string) {
    // Mock login - accept any email/password
    const mockUser = {
      id: 'mock-user-id',
      email,
      full_name: 'Mock User',
      is_verified: true,
      is_active: true,
      login_attempts: 0,
      locked_until: null,
      last_login: new Date(),
    };
    const mockSession = {
      user: mockUser,
      session_token: generateSessionToken(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
    currentUser = mockUser;
    currentSession = mockSession;
    return { user: mockUser, session: mockSession };
  },

  async logout() {
    currentUser = null;
    currentSession = null;
    console.log('Logged out successfully');
  },

  async getSession() {
    return currentSession;
  },

  async getUser() {
    return currentUser;
  },

  isAuthenticated() {
    return currentUser !== null && currentSession !== null;
  },

  getCurrentUser() {
    return currentUser;
  },

  getCurrentSession() {
    return currentSession;
  },
};

// Profile API
export const profileAPI = {
  async getProfile() {
    // Mock profile data
    return {
      name: 'John Doe',
      email: 'john.doe@example.com',
      devices: 4,
      totalConsumption: 342,
    };
  },

  async updateProfile(updates: Record<string, unknown>) {
    // Mock update
    console.log('Mock update profile:', updates);
    return { success: true };
  },
};

// Energy API
export const energyAPI = {
  async getCurrentReading() {
    // Mock current reading
    return {
      current: 2.45,
      voltage: 230,
      power: 563,
      energy: 12.4,
    };
  },

  async getHistory(period: 'day' | 'week' | 'month' = 'day') {
    // Mock history data
    return [
      { time: '00:00', power: 120 },
      { time: '06:00', power: 450 },
      { time: '12:00', power: 680 },
      { time: '18:00', power: 720 },
      { time: '23:59', power: 320 },
    ];
  },

  async submitReading(reading: Record<string, unknown>) {
    // Mock submit
    console.log('Mock submit reading:', reading);
    return { success: true };
  },
};

// Devices API
export const devicesAPI = {
  async getDevices() {
    // Mock devices
    return [
      { id: 'ESP32-001', zone: 'Living Room', status: 'online' },
      { id: 'ESP32-002', zone: 'Kitchen', status: 'online' },
      { id: 'ESP32-003', zone: 'Bedroom', status: 'online' },
      { id: 'ESP32-004', zone: 'Main Board', status: 'online' },
    ];
  },

  async saveDevice(device: Record<string, unknown>) {
    // Mock save
    console.log('Mock save device:', device);
    return { success: true };
  },

  async deleteDevice(id: string) {
    // Mock delete
    console.log('Mock delete device:', id);
    return { success: true };
  },
};

// Zones API
export const zonesAPI = {
  async getZones() {
    // Mock zones
    return [
      { name: 'Living Room', consumption: 4.5 },
      { name: 'Kitchen', consumption: 3.2 },
      { name: 'Bedroom', consumption: 2.1 },
      { name: 'Bathroom', consumption: 1.5 },
    ];
  },

  async updateZones(zones: unknown[]) {
    // Mock update
    console.log('Mock update zones:', zones);
    return { success: true };
  },
};

// Billing API
export const billingAPI = {
  async getBilling() {
    // Mock billing data
    return {
      currentMonth: 2736,
      lastMonth: 3600,
      savings: 840,
      tariff: 8,
    };
  },

  async updateBilling(billingData: Record<string, unknown>) {
    // Mock update
    console.log('Mock update billing:', billingData);
    return { success: true };
  },
};

// Analytics API
export const analyticsAPI = {
  async getConsumptionAnalytics(period: 'week' | 'month' = 'week') {
    // Mock analytics
    return {
      total: 2100,
      average: 300,
      peak: 720,
      zones: [
        { name: 'Living Room', percentage: 36 },
        { name: 'Kitchen', percentage: 26 },
        { name: 'Bedroom', percentage: 17 },
        { name: 'Other', percentage: 21 },
      ],
    };
  },
};
