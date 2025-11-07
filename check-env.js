#!/usr/bin/env node

/**
 * 环境变量检查脚本
 * 用于诊断微信云托管环境变量配置是否正确
 */

console.log('=== 环境变量诊断 ===\n');

const requiredVars = [
  'PORT',
  'NODE_ENV',
  'DB_HOST',
  'DB_PORT',
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME',
  'WECHAT_APPID',
  'WECHAT_APPSECRET',
  'JWT_SECRET'
];

let allSet = true;

requiredVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    // 隐藏敏感信息
    if (varName.includes('PASSWORD') || varName === 'JWT_SECRET' || varName === 'WECHAT_APPSECRET') {
      console.log(`✅ ${varName}: 已设置 (${value.substring(0, 3)}***)`);
    } else {
      console.log(`✅ ${varName}: ${value}`);
    }
  } else {
    console.log(`❌ ${varName}: 未设置`);
    allSet = false;
  }
});

console.log('\n=== 诊断结果 ===');
if (allSet) {
  console.log('✅ 所有必需的环境变量都已设置');
} else {
  console.log('❌ 部分环境变量未设置，请检查微信云托管控制台的环境变量配置');
  console.log('\n重要提示：');
  console.log('1. 确保在微信云托管控制台正确配置了所有环境变量');
  console.log('2. 配置后必须重启服务才能生效');
  console.log('3. 如果 DB_HOST 未设置，将使用默认值 localhost，这会导致连接失败');
}

console.log('\n当前数据库连接配置：');
console.log(`  DB_HOST: ${process.env.DB_HOST || 'localhost (默认值 - 会导致连接失败!)'}`);
console.log(`  DB_PORT: ${process.env.DB_PORT || '3306 (默认值)'}`);
console.log(`  DB_USER: ${process.env.DB_USER || 'root (默认值)'}`);
console.log(`  DB_NAME: ${process.env.DB_NAME || 'de_Q (默认值)'}`);

