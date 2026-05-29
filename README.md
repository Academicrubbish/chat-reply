# Chat Reply - AI 聊天回复训练器

一个基于 AI 的聊天回复训练工具，帮助用户提升聊天沟通能力。

## 功能特性

- **AI 智能分析**：分析聊天上下文，理解对方意图和情绪
- **多策略回复建议**：提供多种风格的回复选项（安全回应、幽默法则、平衡艺术等）
- **好感度追踪**：实时追踪聊天关系进展
- **多轮对话训练**：支持连续多轮 AI 辅助训练
- **聊天记录导入**：支持导入历史聊天记录进行分析

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19 + TypeScript + Vite + Ant Design + Tailwind CSS |
| 后端 | Express + TypeScript + SQLite (sql.js) |
| AI | 小米 MiMo / 智谱 GLM（OpenAI 兼容接口） |

## 快速开始

### 环境要求

- Node.js >= 18
- npm >= 9

### 1. 克隆项目

```bash
git clone https://github.com/Academicrubbish/chat-reply.git
cd chat-reply
```

### 2. 启动后端

```bash
cd chat-reply-server
npm install
npm run dev
```

后端默认运行在 `http://localhost:3001`

### 3. 启动前端

```bash
cd chat-reply-trainer
npm install
npm run dev
```

前端默认运行在 `http://localhost:5173`

### 4. 配置 AI 服务

复制环境变量模板并填入你的 API Key：

```bash
cd chat-reply-server
cp .env.example .env
```

编辑 `.env` 文件，填入你的 API Key：

```env
# 小米 MiMo（推荐）
MIMO_API_KEY=你的API密钥

# 或者智谱 GLM
# ZHIPU_API_KEY=你的API密钥
```

> 获取小米 MiMo API Key：[platform.xiaomimimo.com](https://platform.xiaomimimo.com)

## 项目结构

```
chat-reply/
├── chat-reply-server/          # 后端服务
│   ├── src/
│   │   ├── index.ts           # 主入口 + API 路由
│   │   ├── db.ts              # 数据库初始化
│   │   ├── llm.ts             # AI 模型调用
│   │   └── prompt.ts          # 提示词工程
│   └── .env                   # 环境配置
│
├── chat-reply-trainer/         # 前端应用
│   ├── src/
│   │   ├── App.tsx            # 主应用组件
│   │   ├── hooks/             # 状态管理
│   │   ├── components/        # UI 组件
│   │   ├── services/          # API 服务
│   │   └── utils/             # 工具函数
│   └── .env                   # 前端配置
│
└── README.md
```

## 使用指南

1. **创建聊天对象**：点击顶部导航栏的 "+" 按钮，填写对方的基本信息
2. **输入消息**：在右侧面板输入对方发送的消息
3. **获取 AI 建议**：点击 "AI 辅助" 按钮，获取智能回复建议
4. **选择回复**：从多个策略回复中选择一个，或自定义回复
5. **继续对话**：反复练习，提升聊天技巧

## Demo 模式

本项目支持 Demo 展示模式，特点：
- 无需登录，直接使用
- 所有用户共享数据
- 适合引流和功能展示

启用 Demo 模式：

```env
# 后端 .env
DEMO_MODE=true

# 前端 .env
VITE_DEMO_MODE=true
```

## API 文档

### 主要接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/targets | 获取聊天对象列表 |
| POST | /api/targets | 创建聊天对象 |
| POST | /api/targets/:id/messages | 添加消息 |
| POST | /api/sessions/:id/generate | AI 生成回复（SSE） |
| POST | /api/sessions/:id/select-reply | 选择回复 |

### AI 生成接口（SSE 流式）

```
POST /api/sessions/:sessionId/generate
Content-Type: application/json

{
  "herMessage": "对方的消息内容",
  "provider": "mimo"
}
```

响应事件类型：
- `step` - 处理步骤
- `delta` - 流式文本
- `analysis` - 分析结果
- `plan` - 策略计划
- `replies` - 回复选项
- `done` - 完成

## 许可证

MIT License
