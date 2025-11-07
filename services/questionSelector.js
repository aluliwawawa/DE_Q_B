const db = require('../config/database');

// 标准化weight格式，处理德国格式的逗号小数点
function normalizeWeight(weight) {
  const weightStr = String(weight).replace(',', '.');
  const weightNum = parseFloat(weightStr);
  return String(weightNum);
}

// 智能选题：固定30题，权重分布：5题(-1) + 10题(1) + 10题(1.5) + 5题(2)，每个category至少3题
async function selectQuestions() {
  const [allQuestions] = await db.query(
    `SELECT id, q_text, weight, cat, cat_CN 
     FROM questionnaire 
     WHERE status = 1`
  );

  if (allQuestions.length === 0) {
    throw new Error('题库中没有启用的题目');
  }

  const byCategory = {};
  allQuestions.forEach(q => {
    const cat = q.cat;
    if (!byCategory[cat]) {
      byCategory[cat] = [];
    }
    byCategory[cat].push(q);
  });

  const byWeight = {
    '-1': [],
    '1': [],
    '1.5': [],
    '2': []
  };
  allQuestions.forEach(q => {
    const weight = normalizeWeight(q.weight);
    if (byWeight[weight]) {
      byWeight[weight].push(q);
    }
  });

  const targetDistribution = {
    '-1': 5,
    '1': 10,
    '1.5': 10,
    '2': 5
  };

  const weightErrors = [];
  if (byWeight['-1'].length < 5) {
    weightErrors.push(`weight=-1的题目不足5题（当前${byWeight['-1'].length}题）`);
  }
  if (byWeight['1'].length < 10) {
    weightErrors.push(`weight=1的题目不足10题（当前${byWeight['1'].length}题）`);
  }
  if (byWeight['1.5'].length < 10) {
    weightErrors.push(`weight=1.5的题目不足10题（当前${byWeight['1.5'].length}题）`);
  }
  if (byWeight['2'].length < 5) {
    weightErrors.push(`weight=2的题目不足5题（当前${byWeight['2'].length}题）`);
  }

  const categoryErrors = [];
  Object.keys(byCategory).forEach(cat => {
    if (byCategory[cat].length < 3) {
      categoryErrors.push(`category=${cat}的题目不足3题（当前${byCategory[cat].length}题）`);
    }
  });

  if (weightErrors.length > 0 || categoryErrors.length > 0) {
    const errorDetails = [];
    if (weightErrors.length > 0) {
      errorDetails.push('权重分布异常：' + weightErrors.join('；'));
    }
    if (categoryErrors.length > 0) {
      errorDetails.push('类别覆盖异常：' + categoryErrors.join('；'));
    }
    throw new Error('题库异常，请联系作者检查。' + errorDetails.join(' '));
  }

  const selected = [];
  const selectedByCategory = {};
  const selectedByWeight = {
    '-1': 0,
    '1': 0,
    '1.5': 0,
    '2': 0
  };

  // 第一步：每个category至少选3题
  Object.keys(byCategory).forEach(cat => {
    const catQuestions = [...byCategory[cat]];
    catQuestions.sort(() => Math.random() - 0.5);
    
    const minCount = Math.min(3, catQuestions.length);
    for (let i = 0; i < minCount && selected.length < 30; i++) {
      const q = catQuestions[i];
      const weight = normalizeWeight(q.weight);
      
      if (selectedByWeight[weight] < targetDistribution[weight]) {
        selected.push(q);
        selectedByWeight[weight]++;
        if (!selectedByCategory[cat]) {
          selectedByCategory[cat] = [];
        }
        selectedByCategory[cat].push(q);
      }
    }
  });

  // 第二步：补充题目直到满足权重分布
  const remaining = allQuestions.filter(q => {
    return !selected.find(s => s.id === q.id);
  });
  
  remaining.sort(() => Math.random() - 0.5);

  for (const q of remaining) {
    if (selected.length >= 30) break;
    
    const weight = normalizeWeight(q.weight);
    if (selectedByWeight[weight] < targetDistribution[weight]) {
      selected.push(q);
      selectedByWeight[weight]++;
      const cat = q.cat;
      if (!selectedByCategory[cat]) {
        selectedByCategory[cat] = [];
      }
      selectedByCategory[cat].push(q);
    }
  }

  if (selected.length !== 30) {
    throw new Error(`题库异常，请联系作者检查。选题失败：已选${selected.length}题，无法满足30题要求。`);
  }

  selected.sort(() => Math.random() - 0.5);

  return selected;
}

module.exports = {
  selectQuestions
};
