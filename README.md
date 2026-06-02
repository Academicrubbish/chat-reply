# Chat Reply - AI 社交聊天训练器

基于《魔鬼约会学》知识体系的 AI 社交聊天辅导系统。通过 AI 实时分析聊天上下文，提供多策略回复建议、军师诊断和复盘评估，帮助用户提升聊天沟通能力。

## 功能特性

### 核心功能
- **AI 实时回复建议** — 分析对方消息的意图、情绪和信号，提供 4 种策略风格的回复选项
- **多模式 AI 辅助** — 完整模式 / 快速模式 / 军师诊断 / 复盘评价，按需切换
- **好感度追踪** — 每轮对话自动评估好感度变化，可视化历史趋势
- **聊天记录导入** — 支持粘贴微信聊天记录，自动解析并导入
- **知识体系驱动** — 内置《魔鬼约会学》完整知识库，按场景动态注入

### 分析系统
- **军师模式** — 诊断对方态度（上堆/下切/倾诉/关注）、情绪正负向、关系阶段
- **复盘模式** — 5 维雷达图评分（诚意表达、兴趣信号、节奏掌控、情绪共鸣、策略运用）
- **累积警告** — 自动追踪常见错误（真命天女症、诚意陷阱、过度解读等）

### 体验优化
- **SSE 流式输出** — AI 回复实时流式展示，支持心跳检测
- **回复版本管理** — 多次生成的回复可切换查看对比
- **新手引导** — 首次使用自动触发交互式引导教程
- **响应式布局** — 桌面端双面板，移动端 Tab 切换

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19 + TypeScript + Vite 8 + Ant Design 6 + Tailwind CSS 4 |
| 后端 | Express 5 + TypeScript + SQLite (sql.js) |
| AI | 小米 MiMo / 智谱 GLM（OpenAI 兼容接口） |
| 知识库 | RIA++ 方法论，23 个知识单元，4 种激活模式 |

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
cp .env.example .env   # 复制环境变量模板
npm install
npm run dev
```

### 3. 启动前端

```bash
cd chat-reply-trainer
npm install
npm run dev
```

### 4. 配置 AI 服务

编辑 `chat-reply-server/.env`，填入 API Key：

```env
# 小米 MiMo（推荐）
MIMO_API_KEY=你的API密钥
MIMO_BASE_URL=https://api.xiaomimimo.com/v1
MIMO_MODEL=mimo-v2.5-pro

# 或智谱 GLM
# ZHIPU_API_KEY=你的API密钥
# ZHIPU_BASE_URL=https://open.bigmodel.cn/api/paas/v4/
# ZHIPU_MODEL=glm-5.1
```

> 获取小米 MiMo API Key：[platform.xiaomimimo.com](https://platform.xiaomimimo.com)

## 项目结构

```
chat-reply/
├── chat-reply-server/              # 后端服务
│   ├── src/
│   │   ├── index.ts               # Express 主入口 + API 路由
│   │   ├── db.ts                  # SQLite 数据库初始化与迁移
│   │   ├── llm.ts                 # LLM 调用封装（多模型 + 流式）
│   │   ├── prompt.ts              # 提示词工程（静态/动态拆分 + 知识注入）
│   │   ├── knowledge/             # 知识库系统
│   │   │   ├── index.ts           # 知识单元注册与查询
│   │   │   ├── types.ts           # RIA++ 知识单元类型定义
│   │   │   ├── frameworks.ts      # 诊断框架（上堆下切等）
│   │   │   ├── principles.ts      # 核心原则（诚意法则等）
│   │   │   ├── scenarios.ts       # 场景策略（搭讪/微信等）
│   │   │   ├── concepts.ts        # 核心概念（真命天女症等）
│   │   │   └── mode-mapping.ts    # 模式-知识映射关系
│   │   ├── middleware/
│   │   │   └── auth.ts            # JWT 认证中间件
│   │   └── routes/
│   │       └── knowledge.ts       # 知识库 API 路由
│   └── .env                       # 环境配置（不入库）
│
├── chat-reply-trainer/             # 前端应用
│   ├── src/
│   │   ├── App.tsx                # 主应用（认证状态机 + 布局）
│   │   ├── hooks/
│   │   │   └── useAppState.tsx    # 全局状态管理（Context + Reducer）
│   │   ├── components/
│   │   │   ├── Toolbar.tsx        # 工具栏（模式切换 + 会话管理）
│   │   │   ├── RoundTimeline.tsx  # 回复卡片时间线
│   │   │   ├── ChatHistory.tsx    # 聊天记录面板
│   │   │   ├── ChatBubble.tsx     # 消息气泡
│   │   │   ├── AnalysisDrawer.tsx # 军师/复盘分析抽屉
│   │   │   ├── MessageInput.tsx   # 消息输入框
│   │   │   └── ...                # 其他 22 个组件
│   │   ├── services/
│   │   │   └── api.ts             # API 服务层（REST + SSE）
│   │   ├── types.ts               # TypeScript 类型定义
│   │   └── utils/
│   │       ├── parseChat.ts       # 聊天记录解析器
│   │       └── tourGuide.ts       # 新手引导（driver.js）
│   └── vite.config.ts             # Vite 配置（含 API 代理）
│
└── README.md
```

## 数据模型

```
users
  └── chat_targets (user_id)
        ├── chat_messages (target_id)
        ├── ai_sessions (target_id)
        │     ├── ai_messages (session_id)
        │     └── reply_selections (session_id)
        ├── chat_evaluations (target_id)
        └── chat_diagnoses (target_id)
              └── user_warnings (累积警告)
```

## API 文档

### 认证

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/auth/status` | 检查系统是否已初始化 |
| POST | `/api/auth/setup` | 首次初始化管理员 |
| POST | `/api/auth/register` | 用户注册 |
| POST | `/api/auth/login` | 用户登录 |
| POST | `/api/auth/logout` | 用户登出 |

### 聊天对象

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/targets` | 获取聊天对象列表 |
| POST | `/api/targets` | 创建聊天对象 |
| GET | `/api/targets/:id` | 获取单个对象详情 |
| PUT | `/api/targets/:id` | 更新聊天对象 |
| DELETE | `/api/targets/:id` | 删除聊天对象 |

### 消息

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/targets/:id/messages` | 获取消息列表 |
| POST | `/api/targets/:id/messages` | 添加消息 |
| PUT | `/api/messages/:id` | 编辑消息 |
| DELETE | `/api/messages/:id` | 删除消息 |
| DELETE | `/api/targets/:id/messages` | 清空所有消息 |

### AI 会话

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/targets/:id/sessions` | 获取会话列表 |
| POST | `/api/targets/:id/sessions` | 创建新会话 |
| GET | `/api/sessions/:id/messages` | 获取会话消息 |
| DELETE | `/api/sessions/:id` | 删除会话 |

### AI 生成（SSE 流式）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/sessions/:id/generate` | AI 生成回复（SSE） |
| POST | `/api/sessions/:id/regenerate` | 重新生成（SSE） |
| POST | `/api/sessions/:id/select-reply` | 选择 AI 建议的回复 |
| POST | `/api/sessions/:id/custom-reply` | 发送自定义回复 |

### 分析

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/sessions/:id/analyze` | 军师诊断 / 复盘评价（SSE） |
| GET | `/api/targets/:id/analyses` | 获取分析历史 |
| GET | `/api/targets/:id/evaluations` | 获取评估记录 |
| GET | `/api/targets/:id/diagnoses` | 获取诊断记录 |
| GET | `/api/targets/:id/warnings` | 获取累积警告 |

### SSE 事件类型

```
generate / regenerate 接口返回的事件流：

step        → 处理步骤（analyze / generating / parsing）
heartbeat   → 心跳检测（每 2 秒）
delta       → 流式文本片段
analysis    → 分析结果（信号、策略、好感度）
plan        → 策略计划（目标、下一步）
replies     → 回复选项列表
reply_ready → 快速模式下逐条返回
done        → 完成（含 token 用量）
error       → 错误信息
```

## AI 模式说明

| 模式 | 说明 | 适用场景 |
|------|------|---------|
| **full** | 完整分析 + 4 种策略回复 | 日常聊天辅导 |
| **quick** | 查表式快速回复 | 需要快速回应时 |
| **advisor** | 只分析不回复，给出诊断和建议 | 想了解对方心理 |
| **review** | 回复打分 + 5 维雷达图 + 知识缺口 | 复盘学习提升 |

## 使用指南

1. **首次使用** — 注册账号，创建第一个聊天对象
2. **输入消息** — 在右侧面板输入对方发送的消息，或导入聊天记录
3. **AI 辅助** — 点击「AI 辅助」按钮，选择模式，获取智能建议
4. **选择回复** — 从多种策略回复中选择一个，或自定义回复
5. **军师诊断** — 点击「军师」查看对方的情绪分析和关系阶段
6. **复盘学习** — 对话结束后点击「复盘」，获取评分和改进建议

## 知识库体系

基于 RIA++ 方法论，包含 23 个知识单元：

- **框架**（F01-F06）— 上堆下切语言模式、态度判断框架等
- **原则**（P01-P08）— 诚意法则、关注反应、魔趣法则等
- **场景**（S01-S05）— 搭讪开场、微信沟通、约会推进等
- **概念**（C01-C04）— 真命天女症、诚意陷阱、大姧升级等

知识单元根据聊天内容动态匹配注入，不同 AI 模式激活不同的知识组合。

## 许可证

MIT License
