const express = require('express');
const db = require('../config/database');
const authMiddleware = require('../middleware/auth');
const { calculateScore, getRecommendationLevel, getRecommendationText, findExtremeChoices, getExtremeCategories, generateExtremeFeedbackFromCategories, checkAnswerLimit, useAnswerQuota } = require('../services/scoring');
const { selectQuestions } = require('../services/questionSelector');

const router = express.Router();

// MySQL的JSON字段可能已经被mysql2解析为对象
function safeParseJSON(value) {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (err) {
      console.error('JSON解析失败:', err, '原始值:', value);
      return null;
    }
  }
  if (typeof value === 'object') {
    return value;
  }
  return null;
}

router.post('/submit', authMiddleware, async (req, res, next) => {
  try {
    const { answers } = req.body;
    const { id: userId, openid } = req.user;

    if (!answers || !Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({
        code: 400,
        message: '答题数据不能为空',
        data: null
      });
    }

    const limitCheck = await checkAnswerLimit(openid, userId);
    if (!limitCheck.canAnswer) {
      return res.status(403).json({
        code: 403,
        message: limitCheck.message,
        data: null
      });
    }

    let questions;
    try {
      questions = await selectQuestions();
    } catch (err) {
      if (err.code === 'ECONNRESET' || err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ETIMEDOUT') {
        let retries = 3;
        while (retries > 0) {
          try {
            await new Promise(resolve => setTimeout(resolve, 1000));
            questions = await selectQuestions();
            break;
          } catch (retryErr) {
            retries--;
            if (retries === 0) {
              throw retryErr;
            }
          }
        }
      } else {
        throw err;
      }
    }

    if (answers.length !== 30) {
      return res.status(400).json({
        code: 400,
        message: '请回答所有30道题目',
        data: null
      });
    }

    for (const answer of answers) {
      if (!answer.question_id || !answer.answer) {
        return res.status(400).json({
          code: 400,
          message: '答题格式错误',
          data: null
        });
      }
      if (answer.answer < 1 || answer.answer > 5) {
        return res.status(400).json({
          code: 400,
          message: '答案值必须在1-5之间',
          data: null
        });
      }
    }

    const totalScore = calculateScore(answers, questions);

    const recommendationLevel = getRecommendationLevel(totalScore);
    const recommendationText = await getRecommendationText(recommendationLevel);
    const extremeChoices = findExtremeChoices(answers, questions);
    const extremeCategories = getExtremeCategories(extremeChoices, questions);

    let result;
    try {
      [result] = await db.query(
        `INSERT INTO responses 
         (user_id, openid, answers_json, total_score, recommendation, extreme_low, extreme_high) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          openid,
          JSON.stringify(answers),
          totalScore,
          recommendationLevel,
          extremeCategories.extremeLow,
          extremeCategories.extremeHigh
        ]
      );
    } catch (err) {
      if (err.code === 'ECONNRESET' || err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ETIMEDOUT') {
        let retries = 3;
        while (retries > 0) {
          try {
            await new Promise(resolve => setTimeout(resolve, 1000));
            [result] = await db.query(
              `INSERT INTO responses 
               (user_id, openid, answers_json, total_score, recommendation, extreme_low, extreme_high) 
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [
                userId,
                openid,
                JSON.stringify(answers),
                totalScore,
                recommendationLevel,
                extremeCategories.extremeLow,
                extremeCategories.extremeHigh
              ]
            );
            break;
          } catch (retryErr) {
            retries--;
            if (retries === 0) {
              throw retryErr;
            }
          }
        }
      } else {
        throw err;
      }
    }

    // 使用答题次数
    await useAnswerQuota(openid, userId);

    const updatedLimitCheck = await checkAnswerLimit(openid, userId);
    
    res.json({
      code: 0,
      message: '提交成功',
      data: {
        response_id: result.insertId,
        total_score: totalScore,
        recommendation: recommendationLevel,
        recommendation_text: recommendationText,
        extreme_low: extremeCategories.extremeLow,
        extreme_high: extremeCategories.extremeHigh,
        remainingQuota: updatedLimitCheck.remaining
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', authMiddleware, async (req, res, next) => {
  try {
    const responseId = req.params.id;
    const { id: userId } = req.user;

    const [responses] = await db.query(
      `SELECT * FROM responses WHERE id = ? AND user_id = ?`,
      [responseId, userId]
    );

    if (responses.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '答题记录不存在',
        data: null
      });
    }

    const response = responses[0];
    
    // 根据 recommendation level 获取文案
    const recommendationText = await getRecommendationText(response.recommendation);
    
    // 根据 extreme_low 和 extreme_high 生成反馈文本
    const extremeFeedback = await generateExtremeFeedbackFromCategories(
      response.extreme_low,
      response.extreme_high
    );

    res.json({
      code: 0,
      message: '获取成功',
      data: {
        response_id: response.id,
        total_score: response.total_score,
        recommendation: response.recommendation,
        recommendation_text: recommendationText,
        extreme_feedback: extremeFeedback,
        extreme_low: response.extreme_low,
        extreme_high: response.extreme_high,
        answers: safeParseJSON(response.answers_json) || [],
        created_at: response.created_at
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
