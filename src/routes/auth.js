const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

// 数据库连接
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

// 用户注册
router.post('/register', async (req, res) => {
  try {
    const { username, password, email } = req.body;

    // 检查用户是否已存在
    const userExists = await pool.query(
      'SELECT * FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (userExists.rows.length > 0) {
      return res.status(400).json({
        error: '用户名或邮箱已被注册',
      });
    }

    // 加密密码
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 创建新用户
    const result = await pool.query(
      'INSERT INTO users (username, password_hash, email) VALUES ($1, $2, $3) RETURNING id, username, email',
      [username, hashedPassword, email]
    );

    // 生成JWT令牌
    const token = jwt.sign(
      { id: result.rows[0].id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: '注册成功',
      token,
      user: {
        id: result.rows[0].id,
        username: result.rows[0].username,
        email: result.rows[0].email,
      },
    });
  } catch (error) {
    console.error('注册错误:', error);
    res.status(500).json({
      error: '注册失败',
    });
  }
});

// 用户登录
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // 查找用户
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: '用户名或密码错误',
      });
    }

    const user = result.rows[0];

    // 验证密码
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({
        error: '用户名或密码错误',
      });
    }

    // 生成JWT令牌
    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: '登录成功',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    console.error('登录错误:', error);
    res.status(500).json({
      error: '登录失败',
    });
  }
});

// 获取当前用户信息
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        error: '未提供认证令牌',
      });
    }

    // 验证令牌
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 获取用户信息
    const result = await pool.query(
      'SELECT id, username, email FROM users WHERE id = $1',
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: '用户不存在',
      });
    }

    res.json({
      user: result.rows[0],
    });
  } catch (error) {
    console.error('获取用户信息错误:', error);
    res.status(401).json({
      error: '无效的认证令牌',
    });
  }
});

module.exports = router; 