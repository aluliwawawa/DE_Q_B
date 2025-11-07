# 微信云托管部署检查清单

## ✅ 部署前准备

- [ ] 选择 **Express.js** 模板
- [ ] 准备上传 `backend` 文件夹（或整个项目）

## ✅ 环境变量配置（在微信云托管控制台）

```
PORT=80
NODE_ENV=production
DB_HOST=111.229.111.28
DB_PORT=3306
DB_USER=root
DB_PASSWORD=Aa123456!
DB_NAME=de_Q
WECHAT_APPID=wxd6039ac76feb6554
WECHAT_APPSECRET=9d8f881bd9ff50f673291bf794610fa0
JWT_SECRET=2jvkoZe4+pFRa3nT5/ZZfe9/jstr4+O75pU6HuPbD6g=
```

## ✅ 部署后操作

1. [ ] 获取微信云托管提供的服务域名（如：`https://xxx.weapp.run`）
2. [ ] 更新 `miniprogram/config.js` 中的 `prodApiBaseUrl`
3. [ ] 在微信小程序管理后台配置合法域名
4. [ ] 测试健康检查接口：`https://your-domain/health`
5. [ ] 测试登录功能

## ✅ 小程序管理后台配置

**开发** -> **开发管理** -> **开发设置** -> **服务器域名**：

- request合法域名：`https://your-service-id.weapp.run`
- uploadFile合法域名：`https://your-service-id.weapp.run`
- downloadFile合法域名：`https://your-service-id.weapp.run`

## 📝 注意事项

- 微信云托管域名已自动配置 HTTPS，无需额外配置
- 域名已备案，无需自己备案
- 确保云数据库允许微信云托管 IP 访问

