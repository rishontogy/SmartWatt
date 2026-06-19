const prot = window.location.protocol;
const API_BASE_DATA = `${prot}//${window.location.hostname}:3001/api`;

// Helper function for API calls
async function apiCall(endpoint: string, options: RequestInit = {}): Promise<any> {
  const token = localStorage.getItem('token');
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  // Route everything directly to 3002 (DATA)
  const baseUrl = API_BASE_DATA;

  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'API call failed');
  }

  return response.json();
}

// Auth API
export const authAPI = {
  async signUp(email: string, password: string, name: string) {
    const result = await apiCall('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
    localStorage.setItem('token', result.token);
    return { user: result.user, session: { access_token: result.token, user: result.user } };
  },

  async login(email: string, password: string) {
    const result = await apiCall('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    localStorage.setItem('token', result.token);
    return { user: result.user, session: { access_token: result.token, user: result.user } };
  },

  async logout() {
    localStorage.removeItem('token');
  },

  async getSession() {
    const token = localStorage.getItem('token');
    if (!token) return null;

    try {
      // Decode token to get user info (simple implementation)
      const payload = JSON.parse(atob(token.split('.')[1]));
      return { access_token: token, user: { id: payload.id, email: payload.email } };
    } catch {
      localStorage.removeItem('token');
      return null;
    }
  },

  async getUser() {
    const session = await this.getSession();
    return session?.user || null;
  },

  isAuthenticated() {
    return !!localStorage.getItem('token');
  },

  getCurrentUser() {
    return this.getUser();
  },

  getCurrentSession() {
    return this.getSession();
  },
};

// Profile API
export const profileAPI = {
  async getProfile() {
    return await apiCall('/profile');
  },

  async createOrUpdateProfile(profileData: Record<string, unknown>) {
    return await apiCall('/profile', {
      method: 'POST',
      body: JSON.stringify(profileData),
    });
  },

  async updateProfile(updates: Record<string, unknown>) {
    return await apiCall('/profile', {
      method: 'POST',
      body: JSON.stringify(updates),
    });
  },
};

// Energy API
export const energyAPI = {
  async getCurrentReading() {
    const data = await apiCall('/energy/current');
    return {
      current: data.current,
      voltage: data.voltage,
      power: data.power,
      energy: data.energy,
    };
  },

  async getHistory(period: 'day' | 'week' | 'month' = 'day') {
    return await apiCall(`/energy/history?period=${period}`);
  },

  async getDeviceStats(id: string) {
    return await apiCall(`/energy/device-stats/${id}`);
  },

  async submitReading(reading: Record<string, unknown>) {
    return await apiCall('/energy/reading', {
      method: 'POST',
      body: JSON.stringify(reading),
    });
  },

  async getZoneReadings() {
    return await apiCall('/energy/zones');
  },

  async getTotalReading() {
    const data = await apiCall('/energy/total');
    return {
      current: data.current,
      voltage: data.voltage,
      power: data.power,
      energy: data.energy,
      timestamp: data.timestamp,
    };
  },

  async getTodayEnergy() {
    return await apiCall('/energy/today');
  },

  async getDailyAnalysis(date: string, period: 'day' | 'week' | 'month' = 'day') {
    return await apiCall(`/energy/analysis?date=${date}&period=${period}`);
  },
};

// Devices API
export const devicesAPI = {
  async getDevices() {
    return await apiCall('/devices');
  },

  async saveDevice(device: Record<string, unknown>) {
    return await apiCall('/devices', {
      method: 'POST',
      body: JSON.stringify(device),
    });
  },

  async updateDevice(id: string, updates: Record<string, unknown>) {
    return await apiCall(`/devices/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  async toggleDevice(id: string, status: 'active' | 'inactive') {
    return await apiCall(`/devices/${id}/toggle`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  },

  async deleteDevice(id: string) {
    return await apiCall(`/devices/${id}`, {
      method: 'DELETE',
    });
  },

  async getDeviceCounts() {
    return await apiCall('/devices/counts');
  },
};
// controlAPI.js
export const controlAPI = {
  killSwitch: () => apiCall('/control/kill', { method: 'POST', body: JSON.stringify({}) }),
  powerOn: () => apiCall('/control/on', { method: 'POST', body: JSON.stringify({}) }),
};
// Zones API
export const zonesAPI = {
  async getZones() {
    return await apiCall('/zones');
  },

  async updateZones(zones: unknown[]) {
    // Assuming zones is array of updates
    for (const zone of zones) {
      await apiCall('/zones', {
        method: 'POST',
        body: JSON.stringify(zone),
      });
    }
  },
};

// Billing API
export const billingAPI = {
  async getBilling() {
    return await apiCall('/billing');
  },

  async getBillingSummary(month?: number, year?: number, deviceId: string = 'ESP32_MAIN') {
    let url = '/billing/summary?';
    if (month) url += `month=${month}&`;
    if (year) url += `year=${year}&`;
    if (deviceId) url += `device_id=${deviceId}`;
    return await apiCall(url);
  },

  async updateBilling(billingData: Record<string, unknown>) {
    return await apiCall('/billing', {
      method: 'POST',
      body: JSON.stringify(billingData),
    });
  },
};

// Analytics API
export const analyticsAPI = {
  async getConsumptionAnalytics(period: 'week' | 'month' = 'week') {
    return await apiCall(`/analytics/consumption?period=${period}`);
  },
};

// Alerts API
export const alertsAPI = {
  async getUnreadAlerts() {
    return await apiCall('/alerts');
  },

  async markAsRead(id: number) {
    return await apiCall(`/alerts/${id}/read`, {
      method: 'PUT',
    });
  }
};

// General API instance for direct calls
export const api = {
  get: (endpoint: string) => apiCall(endpoint, { method: 'GET' }),
  post: (endpoint: string, data?: any) => apiCall(endpoint, { method: 'POST', body: JSON.stringify(data) }),
  put: (endpoint: string, data?: any) => apiCall(endpoint, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (endpoint: string, data?: any) => apiCall(endpoint, { method: 'DELETE', body: JSON.stringify(data) }),
};
