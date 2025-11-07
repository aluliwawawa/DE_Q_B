const express = require('express');
const db = require('../config/database');
const authMiddleware = require('../middleware/auth');
const { checkAnswerLimit } = require('../services/scoring');
const { selectQuestions } = require('../services/questionSelector');

const router = express.Router();

router.get('/check-permission', authMiddleware, async (req, res, next) => {
  try {
    const { openid, id: userId } = req.user;
    const limitCheck = await checkAnswerLimit(openid, userId);
    
    res.json({
      code: 0,
      message: limitCheck.message,
      data: {
        canAnswer: limitCheck.canAnswer,
        remaining: limitCheck.remaining,
        message: limitCheck.message
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/current', authMiddleware, async (req, res, next) => {
  try {
    const { openid, id: userId } = req.user;
    
    const limitCheck = await checkAnswerLimit(openid, userId);
    if (!limitCheck.canAnswer) {
      return res.status(403).json({
        code: 403,
        message: limitCheck.message,
        data: null
      });
    }

    const questions = await selectQuestions();

    res.json({
      code: 0,
      message: '获取成功',
      data: {
        questions: questions.map(q => {
          const weightStr = String(q.weight).replace(',', '.');
          return {
            id: q.id,
            text: q.q_text,
            weight: parseFloat(weightStr),
            category: q.cat
          };
        })
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
