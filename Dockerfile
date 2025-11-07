# 使用 Node.js 18 LTS 作为基础镜像
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 package-lock.json
COPY package*.json ./

# 安装依赖（生产环境）
RUN npm ci --only=production

# 复制应用代码
COPY . .

# 暴露端口（微信云托管通常使用 80，但也可以使用环境变量 PORT）
EXPOSE 80

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=80

# 启动应用
CMD ["node", "app.js"]

