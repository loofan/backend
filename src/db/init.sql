-- 创建用户表
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  role VARCHAR(20) DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建设备信息表
CREATE TABLE IF NOT EXISTS devices (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  device_model VARCHAR(100),
  battery_level INTEGER,
  battery_status VARCHAR(20),
  last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建位置历史表
CREATE TABLE IF NOT EXISTS location_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  altitude DOUBLE PRECISION,
  accuracy DOUBLE PRECISION,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建坐标转换历史表
CREATE TABLE IF NOT EXISTS conversion_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  original_coordinates JSONB NOT NULL,
  converted_coordinates JSONB NOT NULL,
  from_system VARCHAR(20) NOT NULL,
  to_system VARCHAR(20) NOT NULL,
  notes TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id);
CREATE INDEX IF NOT EXISTS idx_location_history_user_id ON location_history(user_id);
CREATE INDEX IF NOT EXISTS idx_location_history_timestamp ON location_history(timestamp);
CREATE INDEX IF NOT EXISTS idx_conversion_history_user_id ON conversion_history(user_id);
CREATE INDEX IF NOT EXISTS idx_conversion_history_timestamp ON conversion_history(timestamp);

-- 创建更新时间触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 为users表添加更新时间触发器
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 为devices表添加更新时间触发器
CREATE TRIGGER update_devices_updated_at
  BEFORE UPDATE ON devices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 插入测试数据
INSERT INTO users (username, password_hash, email, role)
VALUES 
  ('admin', '$2a$10$X7UrH5YxX5YxX5YxX5YxX.5YxX5YxX5YxX5YxX5YxX5YxX5YxX', 'admin@example.com', 'admin'),
  ('rescuer1', '$2a$10$X7UrH5YxX5YxX5YxX5YxX.5YxX5YxX5YxX5YxX5YxX5YxX5YxX', 'rescuer1@example.com', 'rescuer'),
  ('rescuer2', '$2a$10$X7UrH5YxX5YxX5YxX5YxX.5YxX5YxX5YxX5YxX5YxX5YxX5YxX', 'rescuer2@example.com', 'rescuer')
ON CONFLICT (username) DO NOTHING;

-- 插入测试设备数据
INSERT INTO devices (user_id, device_model, battery_level, battery_status)
SELECT id, 'iPhone 13', 85, 'charging'
FROM users
WHERE role = 'rescuer'
ON CONFLICT (user_id) DO NOTHING;

-- 插入测试位置数据
INSERT INTO location_history (user_id, latitude, longitude, altitude, accuracy)
SELECT 
  id,
  39.9042 + (random() * 0.1),
  116.4074 + (random() * 0.1),
  50 + (random() * 100),
  10 + (random() * 5)
FROM users
WHERE role = 'rescuer'
LIMIT 10; 