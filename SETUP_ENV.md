# 配置 .env 文件说明

## ⚠️ 重要提示

`env.example` 只是模板文件，**不会生效**！

您需要创建 `.env` 文件才能使用配置。

## 操作步骤

### 1. 复制模板文件为 .env

在 `backend` 目录下执行：

```powershell
# Windows PowerShell
cd backend
Copy-Item env.example .env
```

或者手动复制 `env.example` 文件，重命名为 `.env`

### 2. 检查 Navicat 连接信息

打开 Navicat，查看您连接的 MySQL：

1. 右键点击连接 → **编辑连接**
2. 查看 **常规** 选项卡中的信息：
   - **主机名/IP地址**: 
     - 如果是 `localhost` 或 `127.0.0.1` → 本地MySQL
     - 如果是其他IP（如 `192.168.x.x` 或域名）→ 远程MySQL
   - **端口**: 通常是 `3306`
   - **用户名**: 通常是 `root`

### 3. 根据连接信息更新 .env

#### 情况A: Navicat连接的是本地MySQL (localhost)

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=Aa123456!
DB_NAME=de_questionnaire
```

#### 情况B: Navicat连接的是远程MySQL服务器

```env
DB_HOST=远程服务器IP或域名  # 例如: 192.168.1.100 或 mysql.example.com
DB_PORT=3306
DB_USER=root
DB_PASSWORD=Aa123456!
DB_NAME=de_questionnaire
```

### 4. 验证配置

保存 `.env` 文件后，重新启动后端服务：

```bash
cd backend
npm run dev
```

查看输出，应该看到：
- ✅ 数据库连接成功

如果还是连接失败，请检查：
1. MySQL服务是否运行
2. 防火墙是否允许3306端口
3. DB_HOST 配置是否正确（本地 vs 远程）

