# Vercel 环境变量配置指南

## 问题描述
本地食材识别正常，线上显示菜名作为食材的问题是由于线上缺少AI API环境变量导致的。

## 解决步骤

### 1. 登录Vercel
访问 https://vercel.com 并登录你的账户

### 2. 找到项目
在Dashboard中找到你的 `eat` 项目

### 3. 进入设置
- 点击项目名称进入项目详情
- 点击顶部的 **Settings** 标签

### 4. 配置环境变量
- 在左侧菜单点击 **Environment Variables**
- 点击 **Add New** 按钮，添加以下变量：

#### 变量1: AI_API_KEY
```
Name: AI_API_KEY
Value: sk-88fdba1b94534d75882fc281a4c4e5b0
Environment: ✅ Production ✅ Preview ✅ Development
```

#### 变量2: AI_API_BASE
```
Name: AI_API_BASE
Value: https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions
Environment: ✅ Production ✅ Preview ✅ Development
```

#### 变量3: AI_MODEL
```
Name: AI_MODEL
Value: qwen-turbo
Environment: ✅ Production ✅ Preview ✅ Development
```

### 5. 重新部署
- 回到项目的 **Deployments** 标签
- 找到最新的部署记录
- 点击右侧的三个点菜单 **⋯**
- 选择 **Redeploy**
- 确认重新部署

### 6. 验证修复
部署完成后，访问线上网站测试：
- 椒盐虾 应该显示 "虾" 而不是 "椒盐虾"
- 水煮肉片 应该显示具体食材而不是菜名

## 验证脚本
运行以下命令验证环境变量：
```bash
node verify-env.js
```

## 预期结果
配置完成后：
- ✅ 本地：椒盐虾 → 虾
- ✅ 线上：椒盐虾 → 虾

## 如果仍有问题
1. 检查环境变量是否保存成功
2. 确认重新部署已完成
3. 清除浏览器缓存重新访问
4. 查看Vercel的Function Logs检查错误信息