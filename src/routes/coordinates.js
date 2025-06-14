const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const proj4 = require('proj4');

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

// 坐标系定义
const coordinateSystems = {
  WGS84: 'EPSG:4326',
  GCJ02: '+proj=longlat +datum=GCJ02',
  BD09: '+proj=longlat +datum=BD09',
};

// 转换坐标
router.post('/convert', authenticateToken, async (req, res) => {
  try {
    const { coordinates, from, to } = req.body;

    if (!coordinates || !from || !to) {
      return res.status(400).json({
        error: '缺少必要参数',
      });
    }

    // 验证坐标系是否支持
    if (!coordinateSystems[from] || !coordinateSystems[to]) {
      return res.status(400).json({
        error: '不支持的坐标系',
      });
    }

    // 执行坐标转换
    const converted = coordinates.map(coord => {
      const result = proj4(
        coordinateSystems[from],
        coordinateSystems[to],
        [coord.lng, coord.lat]
      );

      return {
        original: coord,
        converted: {
          lat: result[1],
          lng: result[0],
        },
      };
    });

    // 保存转换记录
    await pool.query(
      'INSERT INTO conversion_history (user_id, original_coordinates, converted_coordinates, from_system, to_system) VALUES ($1, $2, $3, $4, $5)',
      [
        req.user.id,
        JSON.stringify(coordinates),
        JSON.stringify(converted.map(c => c.converted)),
        from,
        to,
      ]
    );

    res.json({
      results: converted,
    });
  } catch (error) {
    console.error('坐标转换错误:', error);
    res.status(500).json({
      error: '坐标转换失败',
    });
  }
});

// 获取转换历史记录
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const result = await pool.query(
      `SELECT 
        id,
        original_coordinates,
        converted_coordinates,
        from_system,
        to_system,
        timestamp,
        notes
      FROM conversion_history
      WHERE user_id = $1
      ORDER BY timestamp DESC
      LIMIT $2 OFFSET $3`,
      [req.user.id, limit, offset]
    );

    const totalResult = await pool.query(
      'SELECT COUNT(*) FROM conversion_history WHERE user_id = $1',
      [req.user.id]
    );

    res.json({
      history: result.rows,
      total: parseInt(totalResult.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (error) {
    console.error('获取转换历史错误:', error);
    res.status(500).json({
      error: '获取转换历史失败',
    });
  }
});

// 解析地图链接
router.post('/parse-map-url', authenticateToken, async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        error: '缺少URL参数',
      });
    }

    // 解析不同地图服务的URL
    let coordinates = null;
    let system = null;

    // 百度地图链接解析
    if (url.includes('map.baidu.com')) {
      const match = url.match(/@(\d+\.?\d*),(\d+\.?\d*)/);
      if (match) {
        coordinates = {
          lng: parseFloat(match[1]),
          lat: parseFloat(match[2]),
        };
        system = 'BD09';
      }
    }
    // 高德地图链接解析
    else if (url.includes('amap.com')) {
      const match = url.match(/location=(\d+\.?\d*),(\d+\.?\d*)/);
      if (match) {
        coordinates = {
          lng: parseFloat(match[1]),
          lat: parseFloat(match[2]),
        };
        system = 'GCJ02';
      }
    }
    // 腾讯地图链接解析
    else if (url.includes('map.qq.com')) {
      const match = url.match(/center=(\d+\.?\d*),(\d+\.?\d*)/);
      if (match) {
        coordinates = {
          lng: parseFloat(match[1]),
          lat: parseFloat(match[2]),
        };
        system = 'GCJ02';
      }
    }

    if (!coordinates) {
      return res.status(400).json({
        error: '无法解析地图链接',
      });
    }

    res.json({
      success: true,
      coordinates,
      system,
    });
  } catch (error) {
    console.error('解析地图链接错误:', error);
    res.status(500).json({
      error: '解析地图链接失败',
    });
  }
});

module.exports = router; 