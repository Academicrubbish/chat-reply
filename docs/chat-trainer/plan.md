---
title: 聊天回复训练器（Chat Reply Trainer）Plan
design: design.md
status: draft
created: 2026-05-27
updated: 2026-05-27
author: 用户
---

# 聊天回复训练器（Chat Reply Trainer）Plan

## 需求简述

构建左右分栏本地 Web 应用，左侧策略控制台（信号分析 + 回复卡片），右侧微信风格聊天模拟器。用户输入对方消息 → Claude API 分析 → 生成回复选项 → 点选上屏，闭环训练。详见 [design.md](design.md)。

## 前置条件

- Node.js >= 18 已安装
- ANTHROPIC_API_KEY 已准备（写入 .env）
- Chrome / Edge 最新版浏览器
- 网络可访问 Claude API（api.anthropic.com）

## 实施阶段

### 阶段 1：项目初始化与配置
**目标**：搭建项目骨架，所有配置就绪，开发服务器可启动
**为什么先做这个**：后续所有阶段依赖项目结构和构建工具链

- 步骤 1.1：用 Vite 创建 React + TypeScript 项目
- 步骤 1.2：安装依赖：express、@anthropic-ai/sdk、dotenv、concurrently、tsx
- 步骤 1.3：配置 vite.config.ts（API 代理 /api → localhost:3001）
- 步骤 1.4：配置 tsconfig.json（server 目录纳入 TypeScript 编译）
- 步骤 1.5：创建 .env（ANTHROPIC_API_KEY=待填）、.gitignore（node_modules、dist、.env）
- 步骤 1.6：创建目录结构：server/、src/components/、src/hooks/、src/services/
- 步骤 1.7：配置 package.json scripts（dev、build、start）
- 步骤 1.8：创建 src/main.tsx 入口 + index.html

**验证点**：
- npm run dev 启动后，浏览器打开 localhost:5173 可看到默认页面
- Express 服务器在 localhost:3001 启动（可访问到 404）

### 阶段 2：后端服务层
**目标**：实现 POST /api/generate-replies 接口，可接收对话历史并返回 AI 分析结果
**为什么先做这个**：前端所有交互依赖后端 API，先确保 AI 链路通畅

- 步骤 2.1：创建 server/prompt.ts，编写系统提示词（四大法则全文 + 信号识别体系 + 关系阶段判断 + JSON 输出指令）
- 步骤 2.2：创建 server/index.ts，初始化 Express 应用
  - 加载 dotenv 读取 .env
  - 配置 express.json() 中间件
  - 实现 POST /api/generate-replies 路由
  - 校验 API Key、校验请求体、调用 Claude API、解析 JSON、返回结果
  - try-catch 统一错误处理
- 步骤 2.3：用 curl 或 Postman 测试接口，确认完整链路通畅

**验证点**：
- curl 发送含对话历史的 POST 请求 → 收到含 analysis + replies + tip 的 JSON 响应
- 不配置 API Key 时 → 返回 { error: "ANTHROPIC_API_KEY 未配置" }
- 发送空 messages → 返回 { error: "对话历史不能为空" }

### 阶段 3：前端状态层
**目标**：实现 types.ts + useChat.ts + api.ts，状态机可驱动完整流程
**为什么先做这个**：状态层是前端的核心骨架，组件只是状态的渲染

- 步骤 3.1：创建 src/types.ts，定义所有接口：ChatMessage、AnalysisData、ReplyOption、GenerateRepliesResponse、ApiErrorResponse、ChatState、ChatAction
- 步骤 3.2：创建 src/services/api.ts，封装 generateReplies(messages) 函数
  - fetch POST /api/generate-replies
  - 处理非 200 响应，抛出 Error
- 步骤 3.3：创建 src/hooks/useChat.ts，实现 useReducer 状态机
  - 初始状态：{ phase: 'idle', messages: [], analysis: null, replies: [], error: null }
  - reducer 处理 5 个 Action：SEND_MESSAGE、GENERATE_SUCCESS、GENERATE_FAILURE、SELECT_REPLY、RESET
  - 暴露 dispatch + 便捷函数：sendMessage、selectReply、reset
  - sendMessage 内部：dispatch SEND_MESSAGE → 调用 api.ts → dispatch SUCCESS/FAILURE

**验证点**：
- sendMessage("测试消息") → messages 新增一条 her 消息
- API 成功 → state.analysis 和 state.replies 有值，phase 为 waiting_select
- selectReply(id) → messages 新增 me 消息，phase 回到 idle
- reset() → 所有状态归零

### 阶段 4：前端 UI 组件
**目标**：实现 6 个 UI 组件，各自独立可渲染
**为什么先做这个**：组件是最终用户可见的界面，需在组装前逐个验证

- 步骤 4.1：ChatBubble.tsx — 单条消息气泡
  - Props：message: ChatMessage
  - 根据 role 决定靠左(her)/靠右(me)，头像颜色，气泡颜色
  - her：粉色渐变头像 + 白色气泡（左上直角）
  - me：绿色渐变头像 + 绿色气泡 #95ec69（右上直角）
  - React.memo 包裹

- 步骤 4.2：ChatHistory.tsx — 消息流列表
  - Props：messages: ChatMessage[]、children?: ReactNode
  - 垂直滚动容器，useRef + useEffect 自动滚到底部
  - 渲染 ChatBubble 列表

- 步骤 4.3：MessageInput.tsx — 输入区
  - Props：onSend: (text: string) => void、disabled: boolean
  - textarea 自适应高度（min 40px, max 100px）
  - 发送按钮 + 次按钮"还没回她"
  - 空内容时发送按钮 disabled

- 步骤 4.4：AnalysisBar.tsx — 情境状态栏 + Tab 切换
  - Props：analysis: AnalysisData | null、tip: string | null
  - 顶部：标签区（关系阶段/信号/策略）+ 好感度进度条
  - Tab 切换：信号分析 | 策略建议
  - analysis 为 null 时显示"等待输入"占位

- 步骤 4.5：ReplyCard.tsx — 单张回复卡片
  - Props：reply: ReplyOption、onSelect: (id: number) => void
  - 策略标签（颜色编码）+ 回复文本 + 推荐理由
  - Hover 上浮动画

- 步骤 4.6：ReplyOptions.tsx — 回复卡片列表容器
  - Props：replies: ReplyOption[]、onSelect: (id: number) => void
  - 垂直排列 ReplyCard 列表
  - replies 为空时隐藏

**验证点**：
- ChatBubble 传入 her/me 消息 → 正确靠左/靠右，颜色正确
- ChatHistory 传入多条消息 → 渲染列表，自动滚到底
- MessageInput 输入文本后点发送 → 触发 onSend 回调
- AnalysisBar 传入 analysis 数据 → 标签和进度条正确显示
- ReplyCard Hover → 上浮动画；点击 → 触发 onSelect

### 阶段 5：App 组装与样式
**目标**：在 App.tsx 中组装左右分栏布局，完成 App.css 全部样式
**为什么先做这个**：组件就绪后需要组合和视觉打磨，形成完整界面

- 步骤 5.1：实现 App.tsx 主组件
  - 引入 useChat hook 获取 state 和操作函数
  - 左侧面板：AnalysisBar + ReplyOptions
  - 右侧面板：ChatHeader（头像+昵称+在线状态+重置按钮）+ ChatHistory + MessageInput
  - 顶部标题栏：Logo + 标题
  - 根据 state.phase 控制各区域显示/隐藏
  - phase === 'generating' 时显示加载指示器

- 步骤 5.2：实现 App.css 完整样式（对照 ui-scheme.html）
  - 整体布局：body flex column，.main-layout flex row
  - 左侧面板：40% 宽度，min 400px，max 520px，白色背景
  - 右侧面板：flex: 1，#ededed 背景
  - 顶部标题栏、情境状态栏、Tab、信号分析卡片、回复卡片、聊天气泡、输入区——全部按设计稿规格

**验证点**：
- 页面与 ui-scheme.html 视觉一致
- 顶部标题栏显示 Logo + "聊天回复训练器"
- 左侧面板初始显示"等待输入"状态
- 右侧面板显示空聊天区 + 输入框

### 阶段 6：集成联调与收尾
**目标**：端到端打通完整流程，处理边界情况，确保验收标准全部通过
**为什么最后做**：每个模块单独就绪后，最后串联验证

- 步骤 6.1：完整流程联调
  - 输入对方消息 → 消息上屏 → AI 分析 → 回复卡片出现 → 点选 → 回复上屏 → 等待下一条
  - 重复多轮（5 轮以上），验证对话历史累积正确

- 步骤 6.2：错误场景验证
  - 故意清空 .env 中的 API Key → 发送消息 → 确认显示错误提示
  - 断开网络 → 发送消息 → 确认显示错误提示 + 可重试
  - 生成中再次点击发送 → 确认按钮 disabled，无重复请求

- 步骤 6.3：边界验证
  - 连续发送 50 条消息 → 确认滚动流畅
  - 发送超长文本 → 确认气泡换行正确
  - 快速连续点击不同回复卡片 → 确认只生效最后一次

- 步骤 6.4：重置功能验证
  - 多轮对话后点击"重新开始" → 全部清空

**验证点**：
- Spec 中 VC1-VC7 验收标准全部通过
- 完整流程无 JS 报错、无控制台 warning
- 50 条消息内流畅无卡顿

## 并行策略

阶段 2（后端）和阶段 3（前端状态层）可并行开发：
- 后端在 server/ 目录工作，前端在 src/ 目录工作
- 前端状态层用 mock 数据先验证 reducer 逻辑
- 阶段 4（UI 组件）可在阶段 3 完成后立即开始

```
阶段 1 ──→ 阶段 2（后端）──┐
       ──→ 阶段 3（状态层）──┼──→ 阶段 4（组件）──→ 阶段 5（组装）──→ 阶段 6（联调）
                （2 和 3 可并行）
```

## 风险与应对

| 风险 | 影响阶段 | 应对方案 |
|------|---------|---------|
| Claude API 返回非 JSON | 阶段 2 | prompt.ts 明确要求 JSON；后端 try-catch 解析失败返回友好错误 |
| Claude API 超时（>10s） | 阶段 2 | 后端 30s 超时；前端显示"AI 正在思考..."动画 |
| 提示词 token 过长 | 阶段 2 | 对话历史超 40 条时截断最早消息 |
| API Key 泄露 | 阶段 1 | .gitignore 忽略 .env；后端代理，前端不接触 key |
| 气泡样式还原度不够 | 阶段 5 | 对照 ui-scheme.html 逐像素调整 |

## 变更记录
| 日期 | 作者 | 变更内容 |
|------|------|---------|
| 2026-05-27 | 用户 | 初始版本 |
