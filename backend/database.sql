-- Create database
SET FOREIGN_KEY_CHECKS = 0;
DROP DATABASE IF EXISTS smartwatt;
CREATE DATABASE smartwatt;
USE smartwatt;
SET FOREIGN_KEY_CHECKS = 1;

-- Create users table
CREATE TABLE users (
  id VARCHAR(50) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  status VARCHAR(50) DEFAULT 'unverified',
  last_login DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create profiles table
CREATE TABLE profiles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(50),
  full_name VARCHAR(255),
  email VARCHAR(255),
  is_verified BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  login_attempts INT DEFAULT 0,
  locked_until DATETIME,
  last_login DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create devices table
CREATE TABLE devices (
  id VARCHAR(255) PRIMARY KEY,
  zone VARCHAR(255),
  status VARCHAR(50) DEFAULT 'offline',
  type ENUM('master', 'slave') DEFAULT 'slave',
  relay_count INT DEFAULT 0,
  current_sensor BOOLEAN DEFAULT FALSE,
  user_id VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_master_per_user (user_id, type) -- Only one master per user
);

-- Create zones table
CREATE TABLE zones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  consumption FLOAT DEFAULT 0,
  user_id VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create energy_readings table
CREATE TABLE energy_readings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  device_id VARCHAR(255),
  zone_id INT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  current FLOAT,
  voltage FLOAT,
  power FLOAT,
  energy FLOAT,
  is_total BOOLEAN DEFAULT FALSE, -- For master module total readings
  sensor_type VARCHAR(50) DEFAULT 'pzem004t',
  accuracy FLOAT DEFAULT 0.98,
  user_id VARCHAR(50),
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
  FOREIGN KEY (zone_id) REFERENCES zones(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create billing table
CREATE TABLE billing (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(50),
  month INT,
  year INT,
  amount FLOAT,
  tariff FLOAT,
  savings FLOAT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create time_based_tariffs table
CREATE TABLE time_based_tariffs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(50),
  slot_name VARCHAR(100) NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  rate_per_unit FLOAT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create alerts table for leak detections
CREATE TABLE alerts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(50),
  message VARCHAR(255) NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  leak_amount FLOAT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);