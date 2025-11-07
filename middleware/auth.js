const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        code: 401,
        message: '未提供认证令牌',
        data: null
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Token验证失败:', error.message);
    return res.status(401).json({
      code: 401,
      message: '无效的认证令牌',
      data: null
    });
  }
};

module.exports = authMiddleware;
