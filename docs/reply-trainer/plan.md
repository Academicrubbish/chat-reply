---
title: 聊天回复训练器（Chat Reply Trainer）一期 Plan
design: ./design.md
status: draft
created: 2026-05-28
updated: 2026-05-28
author: yuanchuang
---

# 聊天回复训练器（Chat Reply Trainer）一期 Plan

## 需求简述

构建左右分栏本地 Web 应用（左 70% AI Agent 控制台 + 右 30% 微信聊天模拟器）。支持多聊天对象 CRUD、SQLite 持久化、AI 辅导窗口上下文隔离、GLM-5.1 生成回复、对话策略规划、反馈机制。详见 [design.md](design.md)。

## 前置条件

- Node.js >= 18 已安装
- ZHIPU_API_KEY 已准备（写入 chat-reply-server/.env）
- Chrome / Edge 最新版浏览器
- 网络可访问智谱 API（open.bigmodel.cn）

## 实施阶段

### 阶段 1：项目脚手架搭建
**目标**：前后端项目骨架就绪，开发服务器可独立启动
**为什么先做这个**：后续所有阶段依赖项目结构和构建工具链

- 步骤 1.1：创建前端项目 `chat-reply-trainer/`（Vite + React 18 + TypeScript）
- 步骤 1.2：创建后端项目 `chat-reply-server/`（Express + TypeScript + tsx）
- 步骤 1.3：前端安装依赖（无额外库，纯 CSS），配置 vite.config.ts 代理 `/api` → `localhost:3001`
- 步骤 1.4：后端安装依赖（express, better-sqlite3, openai, dotenv, cors, uuid）
- 步骤 1.5：后端创建 `.env`（ZHIPU_API_KEY 占位 + PORT=3001）、`tsconfig.json`
- 步骤 1.6：创建目录结构：前端 `src/components/`、`src/hooks/`、`src/services/`；后端 `src/routes/`
- 步骤 1.7：后端 `src/index.ts` 最简 Express 应用（健康检查端点），前端 `src/main.tsx` + `index.html` 入口

**验证点**：
- 前端 `npm run dev` → localhost:5173 显示默认页面
- 后端 `npm run dev` → localhost:3001 健康检查返回 200
- Vite 代理 `/api` → 后端可达

### 阶段 2：后端数据层 + CRUD API
**目标**：SQLite 建表完成，聊天对象和消息的 CRUD API 全部可用
**为什么先做这个**：数据层是所有业务的基础，前端组件需要真实 API 驱动

- 步骤 2.1：创建 `src/db.ts` — SQLite 初始化，建 4 张表（chat_targets, chat_messages, ai_sessions, ai_messages）+ 索引
- 步骤 2.2：创建 `src/routes/targets.ts` — 聊天对象 CRUD（GET 列表、POST 创建、GET 详情、PUT 更新、DELETE 删除含级联清空）
- 步骤 2.3：创建 `src/routes/messages.ts` — 聊天消息 API（GET 某对象消息列表、POST 添加消息、DELETE 清空消息）
- 步骤 2.4：创建 `src/routes/sessions.ts` 基础部分 — AI 辅导窗口 CRUD（GET 某对象窗口列表、POST 创建窗口、GET 窗口内消息列表）
- 步骤 2.5：在 `src/index.ts` 中注册所有路由

**验证点**：
- curl POST 创建聊天对象 → 返回含 id 的对象
- curl GET 列表 → 返回刚创建的对象
- curl POST 添加消息 → 返回成功
- curl GET 消息列表 → 返回含新消息的数组
- curl POST 创建 AI 窗口 → 返回含 id 的窗口
- 删除对象 → 该对象的 messages、sessions 全部清空

### 阶段 3：前端状态层 + API 封装
**目标**：TypeScript 类型定义、API 调用封装、全局状态 hook 就绪
**为什么先做这个**：状态层是前端核心骨架，组件只是状态的渲染；可与阶段 2 并行

- 步骤 3.1：创建 `src/types.ts` — 所有 TypeScript 接口（ChatTarget, ChatMessage, AISession, AIMessage, GenerateResponse, AppState, AppPhase 等）
- 步骤 3.2：创建 `src/services/api.ts` — 封装所有后端 API 调用（targets CRUD, messages CRUD, sessions CRUD, generate, select-reply, custom-reply, regenerate, feedback）
- 步骤 3.3：创建 `src/hooks/useAppState.ts` — 全局状态管理（useReducer + Context），包含：对象列表、当前对象、消息列表、AI 窗口列表、当前窗口、分析结果、回复选项、策略计划、上下文用量、错误状态
- 步骤 3.4：实现 reducer actions：SELECT_TARGET, SEND_HER_MESSAGE, TRIGGER_AI, GENERATE_SUCCESS, GENERATE_FAILURE, SELECT_REPLY, CUSTOM_REPLY, SET_PLAN, UPDATE_SESSIONS 等

**验证点**：
- TypeScript 编译无错误
- api.ts 各函数签名与后端路由匹配
- useReducer 初始状态正确
- dispatch SELECT_TARGET → state.currentTargetId 更新

### 阶段 4：前端 UI 组件（右侧聊天模拟器）
**目标**：右侧面板完整可用，消息输入/展示/上屏流程跑通
**为什么先做这个**：右侧是最基础的用户交互面，先跑通再接 AI

- 步骤 4.1：`ChatBubble.tsx` — 单条消息气泡（her 白泡左对齐 / me 绿泡右对齐，来源标记）
- 步骤 4.2：`ChatHistory.tsx` — 消息流列表 + 自动滚到底部
- 步骤 4.3：`MessageInput.tsx` — 输入框 + 发送按钮（空消息 disabled）
- 步骤 4.4：`ChatHeader.tsx` — 头像 + 名字 + 在线状态 + AI 辅助按钮 + 重新开始按钮
- 步骤 4.5：右侧面板组装 — ChatHeader + ChatHistory + 等待提示条 + MessageInput

**验证点**：
- ChatBubble her/me 消息正确靠左/靠右，颜色正确
- ChatHistory 多条消息自动滚到底
- MessageInput 输入文本点发送 → 触发 onSend
- 空输入 → 发送按钮 disabled

### 阶段 5：前端 UI 组件（左侧 AI 控制台 + 顶部栏）
**目标**：左侧面板和顶部栏所有静态组件就绪
**为什么先做这个**：组件独立可渲染，组装前逐个验证

- 步骤 5.1：`PersonCard.tsx` — 人设卡片（头像 + 名字 + 标签 + 编辑按钮）
- 步骤 5.2：`SessionBar.tsx` — 辅导窗口管理条（窗口编号 + 轮次 + 上下文用量条 + 窗口列表下拉 + 新建窗口按钮）
- 步骤 5.3：`ContextBar.tsx` — 情境状态栏（关系阶段/信号/策略标签 + 好感度进度条）
- 步骤 5.4：`PlanCard.tsx` — 对话策略计划卡片（当前目标 + 下一步建议 + 编辑按钮）
- 步骤 5.5：`AnalysisTabs.tsx` — Tab 切换（信号分析 / 策略建议），含信号卡片和策略说明
- 步骤 5.6：`AgentSteps.tsx` — AI 工作步骤进度（已完成/进行中/待执行三态）
- 步骤 5.7：`TargetSelector.tsx` — 顶部栏聊天对象选择器（下拉列表 + 新建入口）
- 步骤 5.8：`TargetModal.tsx` — 新建/编辑对象 Modal（完整表单含 AI 行为偏好）

**验证点**：
- PersonCard 传入 target 数据 → 标签正确显示
- SessionBar 传入 session 数据 → 窗口编号、轮次、上下文用量条正确
- ContextBar 传入 analysis → 标签和进度条正确
- PlanCard 显示目标和下一步
- AnalysisTabs Tab 切换正常
- TargetSelector 下拉展开/收起
- TargetModal 表单完整，提交/取消正常

### 阶段 6：核心 AI 功能
**目标**：GLM-5.1 调用链路端到端打通，generate 接口可用
**为什么先做这个**：AI 是核心功能，先确保链路通畅再接前端交互

- 步骤 6.1：创建 `src/prompt.ts` — 系统提示词构建函数，拼接四大法则 + 人设 + 行为偏好 + 对话计划 + 最近聊天 + 历史反馈偏好 + JSON 输出指令
- 步骤 6.2：创建 `src/llm.ts` — OpenAI SDK 初始化 + `chatCompletion(messages)` 封装
- 步骤 6.3：在 `src/routes/sessions.ts` 中实现 `POST /api/sessions/:sessionId/generate`：
  - 保存 herMessage → chat_messages
  - 读取 session 上下文 + target 人设 + 最近聊天 + 策略计划 + 反馈偏好
  - 估算 token 数
  - 调用 GLM-5.1
  - 解析 JSON，保存 AI 消息，更新 session（round_count, context_tokens, plan_goal, plan_next_step）
  - 返回 analysis + plan + replies + contextUsage
- 步骤 6.4：实现回复操作 API：
  - `POST select-reply` — 找到对应 reply 存入 chat_messages
  - `POST custom-reply` — 存入自定义回复
  - `POST regenerate` — 追加 user 消息后重新调用 GLM-5.1
  - `POST feedback` — 记录反馈，后续拼入提示词

**验证点**：
- curl POST generate 含 herMessage → 返回含 analysis + replies 的 JSON
- AI 返回 3-4 条回复，至少 1 条安全回复
- curl POST select-reply → 消息存入 chat_messages
- curl POST custom-reply → 消息存入 chat_messages
- curl POST regenerate → 返回新一批回复
- session 的 round_count +1, context_tokens 更新

### 阶段 7：回复弹窗组件 + 前端交互闭环
**目标**：回复选项弹窗（底部浮层）完整可用，选择/自定义/重新生成/反馈全流程跑通
**为什么先做这个**：回复选择是核心交互闭环的关键

- 步骤 7.1：`ReplyCard.tsx` — 单张回复卡片（策略标签 + 回复文本 + 推荐理由 + 👍/👎按钮）
- 步骤 7.2：`ReplyGrid.tsx` — 2x2 四宫格布局 + 重新生成按钮 + 指定策略下拉
- 步骤 7.3：`CustomReply.tsx` — 自定义回复输入区
- 步骤 7.4：回复弹窗浮层组件（底部弹出，遮罩层，关闭逻辑）
- 步骤 7.5：在 App.tsx 中串联 AI 辅助触发 → 弹窗弹出 → 选择/自定义 → 上屏 → 弹窗关闭

**验证点**：
- 点击 AI 辅助 → 弹窗弹出，含 4 张回复卡片
- 点击卡片选中 → 再次点击确认 → 绿泡上屏 → 弹窗关闭
- 自定义回复输入发送 → 绿泡上屏 → 弹窗关闭
- 重新生成 → 换一批回复
- 👍/👎 点击高亮

### 阶段 8：App 组装 + 样式 + 集成联调
**目标**：App.tsx 完整组装左右分栏布局，CSS 样式还原 UI 方案，全流程端到端跑通
**为什么最后做**：所有组件就绪后组装验证

- 步骤 8.1：`App.tsx` 主组件组装 — 顶部栏 + 左侧面板（PersonCard → SessionBar → ContextBar → PlanCard → AnalysisTabs → AgentSteps）+ 右侧面板
- 步骤 8.2：`App.css` 完整样式 — 严格对照 ui-scheme.html，所有尺寸、颜色、圆角、动画
- 步骤 8.3：完整流程联调 — 创建对象 → 输入消息 → AI 分析 → 选择回复 → 循环多轮
- 步骤 8.4：多对象切换联调 — 切换对象 → 数据正确加载 → AI 窗口正确切换
- 步骤 8.5：错误场景验证 — API Key 缺失、网络异常、重复请求
- 步骤 8.6：边界验证 — 空状态引导、上下文用量预警、超长文本、50+ 消息滚动

**验证点**：
- 页面视觉与 ui-scheme.html 一致
- 完整流程：创建对象 → 输入 → AI 分析 → 选择回复 → 循环 5 轮无报错
- 多对象切换数据不串
- Spec VC1-VC9 验收标准全部通过

## 并行策略

```
阶段 1（脚手架）
  ├── 阶段 2（后端数据层 + CRUD）──┐
  └── 阶段 3（前端状态层）─────────┼── 阶段 4 + 5（前端 UI 组件）
                                   │      ↓
                                   └── 阶段 6（AI 功能）
                                          ↓
                                     阶段 7（回复弹窗 + 闭环）
                                          ↓
                                     阶段 8（组装 + 样式 + 联调）
```

- 阶段 2 和阶段 3 可完全并行（后端/前端独立目录）
- 阶段 4 和阶段 5 可并行（右侧组件 / 左侧组件独立）
- 阶段 6 需要阶段 2 完成后的数据库 + 路由基础
- 阶段 7 需要阶段 6 的 AI 接口

## 风险与应对

| 风险 | 影响阶段 | 应对方案 |
|------|---------|---------|
| GLM-5.1 返回非 JSON | 阶段 6 | prompt.ts 严格要求 JSON 格式 + 后端 try-catch 解析 + 回退策略 |
| GLM-5.1 超时（>10s） | 阶段 6 | 前端 AgentSteps 进度展示缓解等待感；后端不设额外超时 |
| 提示词 token 过长 | 阶段 6 | 滑动窗口限制最近 10-15 条 + AI 多轮历史超限提示新建窗口 |
| API Key 泄露 | 阶段 1 | .gitignore 忽略 .env；后端代理，前端不接触 key |
| UI 样式还原度不够 | 阶段 8 | 对照 ui-scheme.html 逐像素调整；回复弹窗、气泡、卡片为重点 |
| SQLite 并发写入 | 阶段 2 | WAL 模式 + 单用户本地应用无实际并发问题 |

## 变更记录
| 日期 | 作者 | 变更内容 |
|------|------|---------|
| 2026-05-28 | yuanchuang | 初始版本（8 阶段，含多对象、SQLite、GLM-5.1、辅导窗口、反馈机制） |
