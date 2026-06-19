-- Create profiles table
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  full_name TEXT,
  email TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  login_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMPTZ,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create devices table
CREATE TABLE devices (
  id TEXT PRIMARY KEY,
  zone TEXT,
  status TEXT DEFAULT 'offline',
  type TEXT DEFAULT 'slave' CHECK (type IN ('master', 'slave')),
  relay_count INTEGER DEFAULT 0,
  current_sensor BOOLEAN DEFAULT FALSE,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add constraint for only one master per user
ALTER TABLE devices ADD CONSTRAINT unique_master_per_user 
  EXCLUDE (user_id WITH =) WHERE (type = 'master');

-- Create zones table
CREATE TABLE zones (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  consumption FLOAT DEFAULT 0,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create energy_readings table
CREATE TABLE energy_readings (
  id SERIAL PRIMARY KEY,
  device_id TEXT REFERENCES devices(id),
  zone_id INTEGER REFERENCES zones(id),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  current FLOAT,
  voltage FLOAT,
  power FLOAT,
  energy FLOAT,
  is_total BOOLEAN DEFAULT FALSE,
  sensor_type TEXT DEFAULT 'pzem004t',
  accuracy FLOAT DEFAULT 0.98,
  user_id UUID REFERENCES auth.users(id)
);

-- Create billing table
CREATE TABLE billing (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  month INTEGER,
  year INTEGER,
  amount FLOAT,
  tariff FLOAT,
  savings FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Create time_based_tariffs table
CREATE TABLE time_based_tariffs (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  slot_name TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  rate_per_unit FLOAT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Enable RLS on tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE energy_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Profiles: users can read/update their own profile
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Devices: users can CRUD their own devices
CREATE POLICY "Users can view own devices" ON devices FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own devices" ON devices FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own devices" ON devices FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own devices" ON devices FOR DELETE USING (auth.uid() = user_id);

-- Zones: users can CRUD their own zones
CREATE POLICY "Users can view own zones" ON zones FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own zones" ON zones FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own zones" ON zones FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own zones" ON zones FOR DELETE USING (auth.uid() = user_id);

-- Energy readings: users can CRUD their own readings
CREATE POLICY "Users can view own readings" ON energy_readings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own readings" ON energy_readings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own readings" ON energy_readings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own readings" ON energy_readings FOR DELETE USING (auth.uid() = user_id);

-- Billing: users can view their own billing
CREATE POLICY "Users can view own billing" ON billing FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own billing" ON billing FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own billing" ON billing FOR UPDATE USING (auth.uid() = user_id);