---
title: 聊天模拟器（Chat Simulator）Design
spec: spec.md
status: draft
created: 2026-05-27
updated: 2026-05-27
author: 用户
---

# 聊天模拟器（Chat Simulator）Design

## 需求简述

构建一个左右分栏的本地 Web 应用，模拟微信风格聊天场景。用户输入对方消息后，后端调用 Claude API 分析信号并基于四大聊天策略法则（扩大冲突、魔趣法则、平衡艺术、释放性信息）生成 1-5 条回复选项，用户点选后自动上屏，形成闭环训练体验。

技术栈：React 18 + TypeScript + Vite（前端），Express（后端），Anthropic SDK（AI），纯 CSS。

## 业务逻辑

### 模块划分

按前后端分层，共 3 个模块：

| 模块 | 目录 | 职责 | 关联功能 |
|------|------|------|---------|
| 前端视图层 | `src/components/` | 聊天气泡、历史记录、输入框、信号分析栏、回复卡片等 UI 组件 | F1, F3, F4, F5, F6 |
| 前端状态层 | `src/hooks/useChat.ts` + `src/services/api.ts` | 状态机管理（useReducer）、API 调用封装 | F1, F2, F4, F6 |
| 后端服务层 | `server/` | Express 路由 + 系统提示词拼接 + Claude API 调用 + JSON 解析 | F2 |

### 目录结构

```
chat-reply-trainer/
├── package.json
├── vite.config.ts              # API 代理 /api → localhost:3001
├── tsconfig.json
├── index.html
├── .env                        # ANTHROPIC_API_KEY
├── .gitignore
│
├── server/
│   ├── index.ts                # Express 应用 + POST /api/generate-replies
│   └── prompt.ts               # 系统提示词（四大法则 + JSON 输出指令）
│
└── src/
    ├── main.tsx                # React 入口
    ├── App.tsx                 # 主组件：左右分栏布局 + 状态分发
    ├── App.css                 # 全局样式
    ├── types.ts                # ChatMessage, GenerateRepliesResponse 等类型
    │
    ├── services/
    │   └── api.ts              # fetch 封装，调用 /api/generate-replies
    │
    ├── hooks/
    │   └── useChat.ts          # useReducer 状态机
    │
    └── components/
        ├── ChatBubble.tsx       # 单条消息气泡
        ├── ChatHistory.tsx      # 消息流列表 + 自动滚动
        ├── MessageInput.tsx     # 输入框 + 发送按钮
        ├── AnalysisBar.tsx      # 情境状态栏 + Tab 切换
        ├── ReplyCard.tsx        # 单张回复选项卡片
        └── ReplyOptions.tsx     # 回复选项卡片列表容器
```

### 核心流程

#### 状态机设计（useChat reducer）

应用使用有限状态机管理，共 3 个状态：

```
┌─────────────────────────────────────────────────────────┐
│                    Chat State Machine                    │
│                                                         │
│  ┌──────────────────┐                                   │
│  │  IDLE             │  初始状态 / 重置后               │
│  │  (等待输入)       │                                   │
│  └────────┬─────────┘                                   │
│           │ 用户输入对方消息 + 点击发送                   │
│           ▼                                              │
│  ┌──────────────────┐                                   │
│  │  GENERATING      │  显示"AI 分析中..."               │
│  │                  │  后端调用 Claude API               │
│  └────────┬─────────┘                                   │
│           │ API 返回成功                                  │
│           ▼                                              │
│  ┌──────────────────┐                                   │
│  │  WAITING_SELECT  │  左侧显示分析+回复卡片             │
│  │                  │  右侧聊天区显示对方消息             │
│  └────────┬─────────┘                                   │
│           │ 用户点击某张回复卡片                          │
│           ▼                                              │
│     回到 IDLE（等待下一条对方消息）                       │
│                                                         │
│  ※ 任何状态 → 点击"重新开始" → 回到 IDLE                │
│  ※ GENERATING 状态下 API 失败 → 回到 IDLE（保留历史）    │
└─────────────────────────────────────────────────────────┘
```

#### Reducer Actions

| Action | Payload | 状态转换 | 说明 |
|--------|---------|---------|------|
| `SEND_MESSAGE` | `{ text: string }` | `IDLE` → `GENERATING` | 用户发送对方消息，消息立即上屏 |
| `GENERATE_SUCCESS` | `GenerateRepliesResponse` | `GENERATING` → `WAITING_SELECT` | API 返回成功，更新分析数据和回复选项 |
| `GENERATE_FAILURE` | `{ error: string }` | `GENERATING` → `IDLE`（保留历史） | API 失败，显示错误提示 |
| `SELECT_REPLY` | `{ replyId: number }` | `WAITING_SELECT` → `IDLE` | 选中回复上屏，左侧重置 |
| `RESET` | — | 任何 → `IDLE` | 清空所有数据 |

#### State 数据结构

```typescript
interface ChatState {
  phase: 'idle' | 'generating' | 'waiting_select';
  messages: ChatMessage[];
  analysis: AnalysisData | null;
  replies: ReplyOption[];
  error: string | null;
}
```

## 时序图

描述一次完整的"输入对方消息 → AI 生成 → 选择回复"交互流程：

```
用户          MessageInput    useChat(reducer)   api.ts        Express/Claude
 │                │                │                │                │
 │  输入消息       │                │                │                │
 │───────────────>│                │                │                │
 │  点击发送       │                │                │                │
 │───────────────>│                │                │                │
 │                │  dispatch       │                │                │
 │                │  SEND_MESSAGE   │                │                │
 │                │───────────────>│                │                │
 │                │                │  消息上屏(her)  │                │
 │                │                │  phase=generating               │
 │                │                │                │                │
 │                │                │  fetch POST     │                │
 │                │                │───────────────>│                │
 │                │                │                │  读取对话历史    │
 │                │                │                │  拼接提示词      │
 │                │                │                │───────────────>│
 │                │                │                │                │
 │  看到加载状态   │                │                │  Claude 处理    │
 │                │                │                │<───────────────│
 │                │                │                │  JSON 响应      │
 │                │                │  response       │                │
 │                │                │<───────────────│                │
 │                │                │                │                │
 │                │                │  dispatch       │                │
 │                │                │  GENERATE_SUCCESS               │
 │                │                │  phase=waiting_select           │
 │                │                │                │                │
 │  看到分析+卡片 │                │                │                │
 │<──────────────────────────────│                │                │
 │                │                │                │                │
 │  点击某张卡片  │                │                │                │
 │───────────────────────────────>│                │                │
 │                │                │  dispatch       │                │
 │                │                │  SELECT_REPLY   │                │
 │                │                │  回复上屏(me)   │                │
 │                │                │  phase=idle     │                │
 │                │                │                │                │
 │  看到回复上屏  │                │                │                │
 │<──────────────────────────────│                │                │
```

## 数据结构

所有类型定义集中在 `src/types.ts`：

```typescript
// ===== 消息 =====
interface ChatMessage {
  role: 'her' | 'me';
  text: string;
}

// ===== AI 分析结果 =====
interface AnalysisData {
  stage: string;          // 关系阶段：初期接触 | 聊天升温 | 暧昧期 | 约会/恋爱期
  signal: string;         // 对方信号：正面冲突 | 正面无冲突 | 模糊 | 负面
  strategy: string;       // 推荐策略：扩大冲突 | 魔趣法则 | 平衡艺术 | 释放性信息
}

// ===== 回复选项 =====
interface ReplyOption {
  id: number;
  strategy: string;
  reason: string;
  text: string;
}

// ===== API 响应 =====
interface GenerateRepliesResponse {
  analysis: AnalysisData;
  replies: ReplyOption[];
  tip: string;
}

// ===== API 错误响应 =====
interface ApiErrorResponse {
  error: string;
}

// ===== 状态机 State =====
interface ChatState {
  phase: 'idle' | 'generating' | 'waiting_select';
  messages: ChatMessage[];
  analysis: AnalysisData | null;
  replies: ReplyOption[];
  error: string | null;
}

// ===== Reducer Actions =====
type ChatAction =
  | { type: 'SEND_MESSAGE'; text: string }
  | { type: 'GENERATE_SUCCESS'; data: GenerateRepliesResponse }
  | { type: 'GENERATE_FAILURE'; error: string }
  | { type: 'SELECT_REPLY'; replyId: number }
  | { type: 'RESET' };
```

### 数据流向

```
ChatMessage[] ──POST body──> Express ──拼接到 prompt──> Claude API
                                                    │
                                                    ▼
                              React State <── JSON ── GenerateRepliesResponse
                                  │
                     ┌────────────┼────────────┐
                     ▼            ▼            ▼
               AnalysisBar    ReplyOptions   ChatHistory
              (信号分析展示)  (回复选项卡片)  (消息上屏)
```

## 错误处理

### 错误场景及策略

| 场景 | 触发条件 | 处理方式 | UI 表现 |
|------|---------|---------|---------|
| API Key 未配置 | .env 中无 ANTHROPIC_API_KEY | 后端返回 `{ error: "ANTHROPIC_API_KEY 未配置" }` | 左侧面板显示红色错误卡片 |
| Claude API 调用失败 | 网络超时 / API 限流 / 服务异常 | 后端捕获异常，返回 `{ error: 具体信息 }` | 左侧面板显示错误提示 + "重试"按钮 |
| 响应 JSON 解析失败 | Claude 返回非 JSON 格式 | 后端 try-catch 解析，返回 `{ error: "AI 响应格式异常" }` | 同上 |
| 空消息发送 | 输入框为空时点击发送 | 前端拦截，不 dispatch | 发送按钮置灰（disabled） |
| 重复提交 | phase === 'generating' 时再次点击 | 前端状态判断，忽略 | 发送按钮置灰（disabled） |

### 后端错误处理

```typescript
// server/index.ts
app.post('/api/generate-replies', async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY 未配置' });
  }
  const { messages } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: '对话历史不能为空' });
  }
  try {
    const response = await client.messages.create({ ... });
    const parsed = JSON.parse(response.content[0].text);
    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: 'AI 服务异常，请稍后重试' });
  }
});
```

### 前端错误处理

```typescript
// src/services/api.ts
export async function generateReplies(messages: ChatMessage[]): Promise<GenerateRepliesResponse> {
  const res = await fetch('/api/generate-replies', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  });
  if (!res.ok) {
    const err: ApiErrorResponse = await res.json();
    throw new Error(err.error);
  }
  return res.json();
}
```

## 性能设计

### 前端性能

| 关注点 | 方案 |
|--------|------|
| 聊天消息列表 | 使用 `useRef` + `scrollTop` 自动滚动，50 条消息内无需虚拟滚动 |
| 输入框自适应高度 | 监听 `input` 事件动态调整 `textarea.style.height`，上限 100px |
| 组件渲染优化 | `React.memo` 包裹 `ChatBubble`，避免无变化的气泡重渲染 |
| CSS 性能 | 纯 CSS，无运行时 CSS-in-JS 开销；Hover 动画使用 `transform` + `box-shadow`（GPU 加速） |

### 后端性能

| 关注点 | 方案 |
|--------|------|
| API 代理 | Vite 开发服务器配置 `proxy: { '/api': 'http://localhost:3001' }`，避免跨域 |
| 提示词长度 | 系统提示词（四大法则）约 2000 token，对话历史控制在 50 条内，总计约 4000-6000 token |
| Claude API 响应 | 目标 < 5 秒；使用 `max_tokens: 1024` 限制输出长度 |
| 进程管理 | 开发模式使用 `concurrently` 同时启动 Vite 和 Express |

### 构建配置

```
vite.config.ts:
  - proxy: '/api' → http://localhost:3001
  - build.outDir: 'dist'

package.json scripts:
  - dev: concurrently "vite" "tsx watch server/index.ts"
  - build: vite build && tsc server/index.ts --outDir dist/server
  - start: node dist/server/index.js
```

## 变更记录
| 日期 | 作者 | 变更内容 |
|------|------|---------|
| 2026-05-27 | 用户 | 初始版本 |
