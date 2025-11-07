const db = require('../config/database');

function calculateScore(answers, questions) {
  let totalScore = 0;
  for (const answer of answers) {
    const question = questions.find(q => q.id === answer.question_id);
    if (question) {
      const weightStr = String(question.weight).replace(',', '.');
      const weight = parseFloat(weightStr);
      totalScore += weight * answer.answer;
    }
  }
  return Math.round(totalScore * 100) / 100;
}

// 根据总分返回推荐等级 0-5（0.5向上取整）
// 梯度定义：
// 0: 10-10
// 1: 11-50
// 2: 51-90
// 3: 91-130
// 4: 131-169
// 5: 170-170
function getRecommendationLevel(totalScore) {
  // 0.5向上取整
  const roundedScore = Math.ceil(totalScore);
  
  if (roundedScore >= 10 && roundedScore <= 10) return 0;
  if (roundedScore >= 11 && roundedScore <= 50) return 1;
  if (roundedScore >= 51 && roundedScore <= 90) return 2;
  if (roundedScore >= 91 && roundedScore <= 130) return 3;
  if (roundedScore >= 131 && roundedScore <= 169) return 4;
  if (roundedScore >= 170 && roundedScore <= 170) return 5;
  
  // 边界情况处理
  if (roundedScore < 10) return 0;
  return 5; // > 170
}

// 根据推荐等级从数据库获取对应的文案
async function getRecommendationText(recommendationLevel) {
  // 根据 level 映射到对应的分数区间
  const levelToInterval = {
    0: { min: 10, max: 10 },
    1: { min: 11, max: 50 },
    2: { min: 51, max: 90 },
    3: { min: 91, max: 130 },
    4: { min: 131, max: 169 },
    5: { min: 170, max: 170 }
  };
  
  const interval = levelToInterval[recommendationLevel];
  if (!interval) {
    return '基于您的回答，我们建议您进一步了解相关信息。';
  }
  
  let rules;
  try {
    [rules] = await db.query(
      `SELECT * FROM score_rules 
       WHERE rule_type = 'score_interval' AND status = 1`
    );
  } catch (err) {
    console.error('获取建议规则失败:', err);
    return '基于您的回答，我们建议您进一步了解相关信息。';
  }
  
  for (const rule of rules) {
    let condition;
    try {
      if (typeof rule.condition_json === 'string') {
        condition = JSON.parse(rule.condition_json);
      } else if (rule.condition_json && typeof rule.condition_json === 'object') {
        condition = rule.condition_json;
      } else {
        continue;
      }
    } catch (parseErr) {
      continue;
    }
    
    if (condition && condition.min === interval.min && condition.max === interval.max) {
      return rule.result_text;
    }
  }
  
  return '基于您的回答，我们建议您进一步了解相关信息。';
}

function findExtremeChoices(answers, questions) {
  const extremes = [];
  for (const answer of answers) {
    if (answer.answer === 1 || answer.answer === 5) {
      const question = questions.find(q => q.id === answer.question_id);
      if (question) {
        const weightStr = String(question.weight).replace(',', '.');
        const weight = parseFloat(weightStr);
        extremes.push({
          question_id: answer.question_id,
          answer: answer.answer,
          category: question.cat,
          weight: weight
        });
      }
    }
  }
  return extremes;
}

// 获取极端类别（返回 extreme_low 和 extreme_high 的 CSV 字符串）
// 核心逻辑：负分题（weight < 0）需要反转判断（选5分=低分，选1分=高分）
function getExtremeCategories(extremeChoices, questions) {
  if (extremeChoices.length === 0) {
    return {
      extremeLow: null,
      extremeHigh: null
    };
  }

  const categoryCNMap = {};
  if (questions) {
    questions.forEach(q => {
      if (q.cat && q.cat_CN && !categoryCNMap[q.cat]) {
        categoryCNMap[q.cat] = q.cat_CN;
      }
    });
  }

  const categoryExtremes = {};
  for (const choice of extremeChoices) {
    const cat = choice.category;
    const weight = choice.weight;
    
    if (!categoryExtremes[cat]) {
      categoryExtremes[cat] = {
        hasHigh: false,
        hasLow: false
      };
    }
    
    // 负分题反转逻辑：选5分=得分最低→触发low，选1分=得分最高→触发high
    let effectiveAnswer = choice.answer;
    if (weight < 0) {
      effectiveAnswer = choice.answer === 5 ? 1 : 5;
    }
    
    if (effectiveAnswer === 5) {
      categoryExtremes[cat].hasHigh = true;
    } else if (effectiveAnswer === 1) {
      categoryExtremes[cat].hasLow = true;
    }
  }

  const extremeLow = [];
  const extremeHigh = [];
  
  for (const [category, extremes] of Object.entries(categoryExtremes)) {
    const cat = parseInt(category);
    const catCN = categoryCNMap[cat] || `类别${cat}`;
    
    // 如果有 low，添加到 extremeLow
    if (extremes.hasLow) {
      extremeLow.push(catCN);
    }
    // 如果有 high，添加到 extremeHigh
    if (extremes.hasHigh) {
      extremeHigh.push(catCN);
    }
  }
  
  return {
    extremeLow: extremeLow.length > 0 ? extremeLow.join(',') : null,
    extremeHigh: extremeHigh.length > 0 ? extremeHigh.join(',') : null
  };
}

// 根据 extreme_low 和 extreme_high（CSV格式的cat_CN）生成反馈文本
async function generateExtremeFeedbackFromCategories(extremeLow, extremeHigh) {
  if ((!extremeLow || extremeLow.trim() === '') && (!extremeHigh || extremeHigh.trim() === '')) {
    return '选择挺中庸的，没啥别的好说的了';
  }

  // 查询问卷表，建立 cat_CN 到 category 的映射
  let questions;
  try {
    [questions] = await db.query(
      'SELECT DISTINCT cat, cat_CN FROM questionnaire WHERE status = 1 AND cat IS NOT NULL AND cat_CN IS NOT NULL'
    );
  } catch (err) {
    console.error('查询类别映射失败:', err);
    return '选择挺中庸的，没啥别的好说的了';
  }

  const catCNToCategory = {};
  questions.forEach(q => {
    if (q.cat_CN && q.cat) {
      catCNToCategory[q.cat_CN] = q.cat;
    }
  });

  // 解析 CSV 字符串
  const lowCategories = extremeLow ? extremeLow.split(',').map(c => c.trim()).filter(c => c) : [];
  const highCategories = extremeHigh ? extremeHigh.split(',').map(c => c.trim()).filter(c => c) : [];

  // 找出矛盾类别（同时出现在 low 和 high 中）
  const contradictoryCategories = lowCategories.filter(catCN => highCategories.includes(catCN));
  const normalLowCategories = lowCategories.filter(catCN => !contradictoryCategories.includes(catCN));
  const normalHighCategories = highCategories.filter(catCN => !contradictoryCategories.includes(catCN));

  // 查询极端反馈规则
  let rules;
  try {
    [rules] = await db.query(
      `SELECT * FROM score_rules 
       WHERE rule_type = 'extreme_feedback' AND status = 1`
    );
  } catch (err) {
    console.error('获取极端反馈规则失败:', err);
    return '选择挺中庸的，没啥别的好说的了';
  }

  const feedbacks = [];

  // 处理矛盾类别
  for (const catCN of contradictoryCategories) {
    const category = catCNToCategory[catCN];
    if (category) {
      feedbacks.push({
        category: parseInt(category),
        catCN: catCN,
        extremeType: 'contradictory',
        text: `您好像在${catCN}方面的选择有点矛盾？`
      });
    }
  }

  // 处理 high 类别
  for (const catCN of normalHighCategories) {
    const category = catCNToCategory[catCN];
    if (category) {
      for (const rule of rules) {
        let condition;
        try {
          if (typeof rule.condition_json === 'string') {
            condition = JSON.parse(rule.condition_json);
          } else if (rule.condition_json && typeof rule.condition_json === 'object') {
            condition = rule.condition_json;
          } else {
            continue;
          }
        } catch (parseErr) {
          continue;
        }
        
        if (condition && condition.category === parseInt(category) && condition.extreme_type === 'high') {
          feedbacks.push({
            category: parseInt(category),
            catCN: catCN,
            extremeType: 'high',
            text: rule.result_text
          });
          break;
        }
      }
    }
  }

  // 处理 low 类别
  for (const catCN of normalLowCategories) {
    const category = catCNToCategory[catCN];
    if (category) {
      for (const rule of rules) {
        let condition;
        try {
          if (typeof rule.condition_json === 'string') {
            condition = JSON.parse(rule.condition_json);
          } else if (rule.condition_json && typeof rule.condition_json === 'object') {
            condition = rule.condition_json;
          } else {
            continue;
          }
        } catch (parseErr) {
          continue;
        }
        
        if (condition && condition.category === parseInt(category) && condition.extreme_type === 'low') {
          feedbacks.push({
            category: parseInt(category),
            catCN: catCN,
            extremeType: 'low',
            text: rule.result_text
          });
          break;
        }
      }
    }
  }

  // 排序：先按 category，再按 extremeType（contradictory > high > low）
  feedbacks.sort((a, b) => {
    if (a.category !== b.category) {
      return a.category - b.category;
    }
    const order = { 'contradictory': 0, 'high': 1, 'low': 2 };
    return (order[a.extremeType] || 3) - (order[b.extremeType] || 3);
  });

  if (feedbacks.length === 0) {
    return '选择挺中庸的，没啥别的好说的了';
  }

  return feedbacks.map(f => f.text).join(' ||| ');
}

// 检查答题配额限制
async function checkAnswerLimit(openid, userId) {
  const enableLimit = process.env.ENABLE_ANSWER_LIMIT !== 'false';
  
  if (!enableLimit) {
    return { canAnswer: true, remaining: -1, message: '可以答题' };
  }

  let users;
  try {
    [users] = await db.query(
      'SELECT id, answer_quota, extra_quota, used_quota FROM users WHERE openid = ?',
      [openid]
    );
    
    if (users.length === 0) {
      return { canAnswer: false, remaining: 0, message: '用户不存在' };
    }
  } catch (err) {
    if (err.code === 'ECONNRESET' || err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ETIMEDOUT') {
      let retries = 3;
      while (retries > 0) {
        try {
          await new Promise(resolve => setTimeout(resolve, 1000));
          [users] = await db.query(
            'SELECT id, answer_quota, extra_quota, used_quota FROM users WHERE openid = ?',
            [openid]
          );
          if (users.length > 0) {
            break;
          }
        } catch (retryErr) {
          retries--;
          if (retries === 0) {
            console.error('检查答题限制失败，默认允许答题');
            return { canAnswer: true, remaining: -1, message: '可以答题' };
          }
        }
      }
    } else {
      throw err;
    }
  }

  if (users.length === 0) {
    return { canAnswer: false, remaining: 0, message: '用户不存在' };
  }

  const user = users[0];
  const totalQuota = (user.answer_quota || 2) + (user.extra_quota || 0);
  const remaining = totalQuota - (user.used_quota || 0);
  
  return {
    canAnswer: remaining > 0,
    remaining: remaining,
    totalQuota: totalQuota,
    usedQuota: user.used_quota || 0,
    message: remaining > 0 
      ? `还可以答题 ${remaining} 次` 
      : '答题次数已用完'
  };
}

// 使用答题次数
async function useAnswerQuota(openid, userId) {
  try {
    await db.query(
      'UPDATE users SET used_quota = used_quota + 1 WHERE openid = ?',
      [openid]
    );
  } catch (err) {
    console.error('更新答题次数失败:', err);
  }
}

// 增加额外次数（用于分享奖励或手动添加）
async function addExtraQuota(openid, userId, amount = 1, reason = 'share') {
  try {
    await db.query(
      'UPDATE users SET extra_quota = extra_quota + ? WHERE openid = ?',
      [amount, openid]
    );
    
    if (reason === 'share') {
      await db.query(
        'UPDATE users SET share_count = share_count + 1 WHERE openid = ?',
        [openid]
      );
    }
    
    return true;
  } catch (err) {
    console.error('增加额外次数失败:', err);
    return false;
  }
}

module.exports = {
  calculateScore,
  getRecommendationLevel,
  getRecommendationText,
  findExtremeChoices,
  getExtremeCategories,
  generateExtremeFeedbackFromCategories,
  checkAnswerLimit,
  useAnswerQuota,
  addExtraQuota
};
