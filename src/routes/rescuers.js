const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

// 数据库连接
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

// 验证JWT令牌的中间件
const authenticateToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({
      error: '未提供认证令牌',
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      error: '无效的认证令牌',
    });
  }
};

// 获取所有搜救队员
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        u.id,
        u.username,
        d.device_model,
        d.battery_level,
        d.battery_status,
        d.last_seen,
        lh.latitude,
        lh.longitude,
        lh.altitude,
        lh.accuracy,
        lh.timestamp as last_location_time
      FROM users u
      LEFT JOIN devices d ON u.id = d.user_id
      LEFT JOIN LATERAL (
        SELECT *
        FROM location_history
        WHERE user_id = u.id
        ORDER BY timestamp DESC
        LIMIT 1
      ) lh ON true
      WHERE u.role = 'rescuer'
    `);

    res.json({
      rescuers: result.rows,
    });
  } catch (error) {
    console.error('获取搜救队员列表错误:', error);
    res.status(500).json({
      error: '获取搜救队员列表失败',
    });
  }
});

// 获取单个搜救队员信息
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT 
        u.id,
        u.username,
        d.device_model,
        d.battery_level,
        d.battery_status,
        d.last_seen,
        lh.latitude,
        lh.longitude,
        lh.altitude,
        lh.accuracy,
        lh.timestamp as last_location_time
      FROM users u
      LEFT JOIN devices d ON u.id = d.user_id
      LEFT JOIN LATERAL (
        SELECT *
        FROM location_history
        WHERE user_id = u.id
        ORDER BY timestamp DESC
        LIMIT 1
      ) lh ON true
      WHERE u.id = $1 AND u.role = 'rescuer'
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: '搜救队员不存在',
      });
    }

    res.json({
      rescuer: result.rows[0],
    });
  } catch (error) {
    console.error('获取搜救队员信息错误:', error);
    res.status(500).json({
      error: '获取搜救队员信息失败',
    });
  }
});

// 获取搜救队员历史轨迹
router.get('/:id/history', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { start_time, end_time } = req.query;

    let query = `
      SELECT 
        latitude,
        longitude,
        altitude,
        accuracy,
        timestamp
      FROM location_history
      WHERE user_id = $1
    `;
    const params = [id];

    if (start_time && end_time) {
      query += ' AND timestamp BETWEEN $2 AND $3';
      params.push(start_time, end_time);
    }

    query += ' ORDER BY timestamp DESC';

    const result = await pool.query(query, params);

    res.json({
      history: result.rows,
    });
  } catch (error) {
    console.error('获取历史轨迹错误:', error);
    res.status(500).json({
      error: '获取历史轨迹失败',
    });
  }
});

// 更新搜救队员设备信息
router.put('/:id/device', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { device_model, battery_level, battery_status } = req.body;

    const result = await pool.query(`
      UPDATE devices
      SET 
        device_model = COALESCE($1, device_model),
        battery_level = COALESCE($2, battery_level),
        battery_status = COALESCE($3, battery_status),
        last_seen = NOW()
      WHERE user_id = $4
      RETURNING *
    `, [device_model, battery_level, battery_status, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: '设备信息不存在',
      });
    }

    res.json({
      device: result.rows[0],
    });
  } catch (error) {
    console.error('更新设备信息错误:', error);
    res.status(500).json({
      error: '更新设备信息失败',
    });
  }
});

module.exports = router; 