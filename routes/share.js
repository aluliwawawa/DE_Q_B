const express = require('express');
const db = require('../config/database');
const authMiddleware = require('../middleware/auth');
const { addExtraQuota, checkAnswerLimit } = require('../services/scoring');

const router = express.Router();

// 分享奖励接口
router.post('/reward', authMiddleware, async (req, res, next) => {
  try {
    const { id: userId, openid } = req.user;
    
    // 检查是否已经分享过（不限制时间，只检查分享次数）
    const [users] = await db.query(
      'SELECT share_count FROM users WHERE id = ?',
      [userId]
    );
    
    if (users.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '用户不存在',
        data: null
      });
    }
    
    if (users[0].share_count > 0) {
      const limitCheck = await checkAnswerLimit(openid, userId);
      return res.json({
        code: 0,
        message: '已经分享过了',
        data: {
          rewarded: false,
          remaining: limitCheck.remaining,
          message: '您已经通过分享获得过额外次数了'
        }
      });
    }
    
    // 增加额外次数
    const success = await addExtraQuota(openid, userId, 1, 'share');
    
    if (success) {
      const limitCheck = await checkAnswerLimit(openid, userId);
      res.json({
        code: 0,
        message: '分享成功，获得1次额外答题机会',
        data: {
          rewarded: true,
          remaining: limitCheck.remaining,
          message: `分享成功！现在还可以答题 ${limitCheck.remaining} 次`
        }
      });
    } else {
      res.status(500).json({
        code: 500,
        message: '奖励发放失败',
        data: null
      });
    }
  } catch (error) {
    next(error);
  }
});

module.exports = router;

