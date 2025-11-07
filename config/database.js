const mysql = require('mysql2/promise');

// 调试：输出数据库配置（隐藏密码）
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD ? '***已设置***' : '***未设置***',
  database: process.env.DB_NAME || 'de_Q',
};

console.log('数据库配置:', {
  host: dbConfig.host,
  port: dbConfig.port,
  user: dbConfig.user,
  password: dbConfig.password,
  database: dbConfig.database,
});
console.log('环境变量检查:', {
  DB_HOST: process.env.DB_HOST || '未设置（使用默认值: localhost)',
  DB_PORT: process.env.DB_PORT || '未设置（使用默认值: 3306)',
  DB_USER: process.env.DB_USER || '未设置（使用默认值: root)',
  DB_PASSWORD: process.env.DB_PASSWORD ? '已设置' : '未设置',
  DB_NAME: process.env.DB_NAME || '未设置（使用默认值: de_Q)',
});

const pool = mysql.createPool({
  host: dbConfig.host,
  port: dbConfig.port,
  user: dbConfig.user,
  password: process.env.DB_PASSWORD,
  database: dbConfig.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  connectTimeout: 60000,
  ssl: false,
  // 注意：MySQL2 不再支持以下选项，已移除以避免警告
  // handleDisconnects, acquireTimeout, timeout, reconnect 已移除
  idleTimeout: 300000
});

pool.getConnection()
  .then(connection => {
    console.log('数据库连接成功');
    connection.release();
  })
  .catch(err => {
    console.warn('数据库连接失败:', err.message);
    console.warn('服务将继续启动，但数据库功能将无法使用');
  });

pool.on('connection', (connection) => {
  connection.on('error', (err) => {
    console.error('数据库连接错误:', err.message);
  });
});

pool.on('error', (err) => {
  console.error('数据库连接池错误:', err.message);
});

module.exports = pool;
