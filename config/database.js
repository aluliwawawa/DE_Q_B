const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'de_Q',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  connectTimeout: 60000,
  ssl: false,
  handleDisconnects: true,
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true,
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
