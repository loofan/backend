const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const { Pool } = require('pg');
require('dotenv').config();

// 创建Express应用
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

// 数据库连接配置
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

// 中间件
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json());

// 路由
app.use('/api/auth', require('./routes/auth'));
app.use('/api/rescuers', require('./routes/rescuers'));
app.use('/api/coordinates', require('./routes/coordinates'));

// WebSocket连接处理
io.on('connection', (socket) => {
  console.log('新的客户端连接');

  // 处理位置更新
  socket.on('locationUpdate', async (data) => {
    try {
      // 保存位置数据到数据库
      await pool.query(
        'INSERT INTO location_history (user_id, latitude, longitude, altitude, accuracy) VALUES ($1, $2, $3, $4, $5)',
        [data.userId, data.latitude, data.longitude, data.altitude, data.accuracy]
      );

      // 广播位置更新给所有客户端
      io.emit('locationUpdate', data);
    } catch (error) {
      console.error('位置更新错误:', error);
    }
  });

  // 处理设备状态更新
  socket.on('deviceStatusUpdate', async (data) => {
    try {
      // 更新设备状态
      await pool.query(
        'UPDATE devices SET battery_level = $1, battery_status = $2, last_seen = NOW() WHERE user_id = $3',
        [data.batteryLevel, data.batteryStatus, data.userId]
      );

      // 广播设备状态更新
      io.emit('deviceStatusUpdate', data);
    } catch (error) {
      console.error('设备状态更新错误:', error);
    }
  });

  // 处理断开连接
  socket.on('disconnect', () => {
    console.log('客户端断开连接');
  });
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: '服务器内部错误',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// 启动服务器
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`服务器运行在端口 ${PORT}`);
}); 