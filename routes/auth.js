const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const db = require('../config/database');

const router = express.Router();

router.post('/dev/login', async (req, res, next) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        code: 403,
        message: '开发模式仅限开发环境使用',
        data: null
      });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        code: 500,
        message: '服务器配置错误：缺少JWT_SECRET环境变量。请检查.env文件是否正确配置。',
        data: null
      });
    }

    const { nickname } = req.body;
    const testOpenid = 'dev_test_' + Date.now();

    let users;
    try {
      [users] = await db.query(
        'SELECT * FROM users WHERE openid = ?',
        [testOpenid]
      );
    } catch (err) {
      console.error('数据库查询错误:', err);
      return res.status(500).json({
        code: 500,
        message: `数据库连接失败: ${err.message}. 请检查数据库配置和网络连接。`,
        data: process.env.NODE_ENV === 'development' ? { error: err.message } : null
      });
    }

    let user;
    if (users.length === 0) {
      let result;
      try {
        [result] = await db.query(
          'INSERT INTO users (openid, nickname) VALUES (?, ?)',
          [testOpenid, nickname || '测试用户']
        );
      } catch (err) {
        console.error('创建用户错误:', err);
        return res.status(500).json({
          code: 500,
          message: `创建用户失败: ${err.message}`,
          data: process.env.NODE_ENV === 'development' ? { error: err.message } : null
        });
      }
      
      try {
        [users] = await db.query('SELECT * FROM users WHERE id = ?', [result.insertId]);
      } catch (err) {
        console.error('查询新用户错误:', err);
        return res.status(500).json({
          code: 500,
          message: `查询新用户失败: ${err.message}`,
          data: process.env.NODE_ENV === 'development' ? { error: err.message } : null
        });
      }
      user = users[0];
    } else {
      user = users[0];
      if (nickname && user.nickname !== nickname) {
        try {
          await db.query(
            'UPDATE users SET nickname = ? WHERE id = ?',
            [nickname, user.id]
          );
          user.nickname = nickname;
        } catch (err) {
          console.error('更新用户错误:', err);
          return res.status(500).json({
            code: 500,
            message: `更新用户失败: ${err.message}`,
            data: process.env.NODE_ENV === 'development' ? { error: err.message } : null
          });
        }
      }
    }

    const token = jwt.sign(
      { id: user.id, openid: user.openid },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      code: 0,
      message: '开发模式登录成功',
      data: {
        token,
        user: {
          id: user.id,
          openid: user.openid,
          nickname: user.nickname
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post('/wechat/login', async (req, res, next) => {
  try {
    const { code, nickname } = req.body;

    if (!code) {
      return res.status(400).json({
        code: 400,
        message: '缺少code参数',
        data: null
      });
    }

    if (!process.env.WECHAT_APPID || !process.env.WECHAT_APPSECRET) {
      console.error('微信配置缺失');
      return res.status(500).json({
        code: 500,
        message: '服务器配置错误：缺少微信AppID或AppSecret',
        data: null
      });
    }

    const wechatResponse = await axios.get('https://api.weixin.qq.com/sns/jscode2session', {
      params: {
        appid: process.env.WECHAT_APPID,
        secret: process.env.WECHAT_APPSECRET,
        js_code: code,
        grant_type: 'authorization_code'
      }
    });

    const { openid, session_key, errcode, errmsg } = wechatResponse.data;

    if (errcode) {
      console.error('微信API返回错误:', { errcode, errmsg });
      return res.status(400).json({
        code: errcode,
        message: errmsg || '微信登录失败',
        data: null
      });
    }

    if (!openid) {
      console.error('获取openid失败');
      return res.status(400).json({
        code: 400,
        message: '获取openid失败',
        data: null
      });
    }

    let [users] = await db.query(
      'SELECT * FROM users WHERE openid = ?',
      [openid]
    );

    let user;
    if (users.length === 0) {
      const [result] = await db.query(
        'INSERT INTO users (openid, nickname) VALUES (?, ?)',
        [openid, nickname || null]
      );
      [users] = await db.query('SELECT * FROM users WHERE id = ?', [result.insertId]);
      user = users[0];
    } else {
      user = users[0];
      if (nickname && user.nickname !== nickname) {
        await db.query(
          'UPDATE users SET nickname = ? WHERE id = ?',
          [nickname, user.id]
        );
        user.nickname = nickname;
      }
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        code: 500,
        message: '服务器配置错误：缺少JWT_SECRET环境变量。请检查.env文件是否正确配置。',
        data: null
      });
    }

    const token = jwt.sign(
      { id: user.id, openid: user.openid },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      code: 0,
      message: '登录成功',
      data: {
        token,
        user: {
          id: user.id,
          openid: user.openid,
          nickname: user.nickname
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
