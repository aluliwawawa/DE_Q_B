# 微信云托管部署指南

## 一、选择模板

在微信云托管控制台选择 **Express.js** 模板（第一个选项，黄色 JS 图标）。

## 二、部署步骤

### 1. 上传代码

微信云托管支持多种方式上传代码：
- **方式A（推荐）**：直接上传 `backend` 文件夹
- **方式B**：通过 Git 仓库连接
- **方式C**：使用 Docker 镜像

### 2. 配置环境变量

在微信云托管控制台的"环境变量"配置中，添加以下变量：

```
PORT=80
NODE_ENV=production

# MySQL数据库配置（使用你的云数据库信息）
DB_HOST=111.229.111.28
DB_PORT=3306
DB_USER=root
DB_PASSWORD=Aa123456!
DB_NAME=de_Q

# 微信小程序配置
WECHAT_APPID=wxd6039ac76feb6554
WECHAT_APPSECRET=9d8f881bd9ff50f673291bf794610fa0

# JWT密钥
JWT_SECRET=2jvkoZe4+pFRa3nT5/ZZfe9/jstr4+O75pU6HuPbD6g=
```

**注意**：
- `PORT` 通常设置为 `80`，微信云托管会自动处理端口映射
- 如果微信云托管自动分配端口，可能需要使用环境变量 `PORT`（平台会自动提供）

### 3. 配置启动命令

在微信云托管控制台的"服务配置"中：
- **启动命令**：`npm start` 或 `node app.js`
- **工作目录**：`/`（根目录，如果上传的是整个 backend 文件夹）

### 4. 获取服务域名

部署成功后，在微信云托管控制台获取：
- **服务域名**：类似 `https://your-service-id.weapp.run` 或 `https://your-service-id.app.weixin.qq.com`

## 三、更新前端配置

部署成功后，更新 `miniprogram/config.js`：

```javascript
prodApiBaseUrl: 'https://your-service-id.weapp.run/api', // 替换为微信云托管提供的域名
```

## 四、配置小程序合法域名

在微信小程序管理后台的"开发" -> "开发管理" -> "开发设置" -> "服务器域名"中：

1. **request合法域名**：添加微信云托管提供的域名（如：`https://your-service-id.weapp.run`）
2. **uploadFile合法域名**：同上
3. **downloadFile合法域名**：同上

**注意**：域名必须是 HTTPS，且需要在小程序管理后台配置。

## 五、验证部署

1. 访问健康检查接口：`https://your-service-id.weapp.run/health`
2. 应该返回：`{"status":"ok","message":"服务运行正常"}`

## 六、常见问题

### 问题1：端口配置
- 微信云托管通常使用 `80` 端口
- 如果平台自动分配，使用环境变量 `PORT`（平台会自动注入）

### 问题2：数据库连接
- 确保云数据库允许微信云托管的 IP 访问
- 检查数据库防火墙规则

### 问题3：环境变量未生效
- 确保在微信云托管控制台正确配置环境变量
- 重启服务使环境变量生效

### 问题4：域名访问失败
- 确保域名已在小程序管理后台配置为合法域名
- 检查域名是否包含 `/api` 路径前缀

## 七、优势

使用微信云托管的优势：
- ✅ **无需域名备案**：微信云托管提供的域名已备案
- ✅ **自动 HTTPS**：无需配置 SSL 证书
- ✅ **自动扩缩容**：根据流量自动调整
- ✅ **与小程序深度集成**：访问更稳定
- ✅ **免费额度**：有一定免费使用量

