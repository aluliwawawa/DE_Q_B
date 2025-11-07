const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const questionnaireRoutes = require('./routes/questionnaire');
const responseRoutes = require('./routes/response');
const shareRoutes = require('./routes/share');

const app = express();

app.use(cors());

// 跳过 ngrok 浏览器警告
app.use((req, res, next) => {
  res.setHeader('ngrok-skip-browser-warning', 'true');
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '服务运行正常' });
});

app.get('/api/config/check', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ message: '仅开发环境可用' });
  }
  
  const db = require('./config/database');
  const config = {
    env: process.env.NODE_ENV,
    hasJwtSecret: !!process.env.JWT_SECRET,
    dbHost: process.env.DB_HOST,
    dbName: process.env.DB_NAME,
    dbUser: process.env.DB_USER,
    hasDbPassword: !!process.env.DB_PASSWORD
  };
  
  let dbStatus = 'unknown';
  try {
    await db.query('SELECT 1');
    dbStatus = 'connected';
  } catch (err) {
    dbStatus = `error: ${err.message}`;
  }
  
  res.json({
    config,
    database: dbStatus
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/questionnaire', questionnaireRoutes);
app.use('/api/responses', responseRoutes);
app.use('/api/share', shareRoutes);

app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  if (process.env.NODE_ENV === 'development') {
    console.error('Stack:', err.stack);
  }
  
  let errorMessage = err.message || '服务器内部错误';
  if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
    errorMessage = `数据库连接失败: ${err.message}. 请检查数据库服务是否启动，以及.env文件中的数据库配置是否正确。`;
  } else if (err.code === 'ER_ACCESS_DENIED_ERROR' || err.code === 'ER_NOT_SUPPORTED_AUTH_MODE') {
    errorMessage = `数据库认证失败: ${err.message}. 请检查数据库用户名和密码是否正确。`;
  } else if (err.code === 'ER_BAD_DB_ERROR') {
    errorMessage = `数据库不存在: ${err.message}. 请检查.env文件中的DB_NAME配置是否正确。`;
  }
  
  res.status(err.status || 500).json({
    code: err.code || 500,
    message: errorMessage,
    data: process.env.NODE_ENV === 'development' ? { 
      stack: err.stack,
      originalError: err.message,
      code: err.code
    } : null
  });
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0'; // 监听所有网络接口，允许外部访问

app.listen(PORT, HOST, () => {
  console.log(`服务器运行在 http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
});
