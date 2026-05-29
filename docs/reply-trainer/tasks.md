---
title: 聊天模拟器（Chat Simulator）一期 Tasks
plan: ./plan.md
status: draft
created: 2026-05-28
updated: 2026-05-28
author: yuanchuang
---

# 聊天模拟器（Chat Simulator）一期 Tasks

> 完成标准：每个 Task 的实现内容完成 + 测试用例全部通过。

## Task 列表

### Task 1：前端项目脚手架（对应 Plan 阶段 1 步骤 1.1-1.3）
- **操作类型**：新增
- **涉及文件**：
  - `chat-reply-trainer/package.json`（新增）
  - `chat-reply-trainer/vite.config.ts`（新增）
  - `chat-reply-trainer/tsconfig.json`（新增）
  - `chat-reply-trainer/tsconfig.node.json`（新增）
  - `chat-reply-trainer/index.html`（新增）
  - `chat-reply-trainer/src/main.tsx`（新增）
  - `chat-reply-trainer/src/App.tsx`（新增，占位）
  - `chat-reply-trainer/src/App.css`（新增，占位）
  - `chat-reply-trainer/src/vite-env.d.ts`（新增）
- **实现内容**：
  - `npm create vite@latest chat-reply-trainer -- --template react-ts`
  - vite.config.ts 配置 proxy：`'/api': { target: 'http://localhost:3001', changeOrigin: true }`
  - 创建目录：`src/components/`、`src/hooks/`、`src/services/`
  - App.tsx 占位：`<div>Chat Simulator</div>`
- **测试用例**：
  - 用例 1：`npm run dev` → localhost:5173 显示 "Chat Simulator"
  - 用例 2：curl localhost:5173/api/health → 代理到后端（需后端启动）
- **依赖**：无

### Task 2：后端项目脚手架 + 数据库（对应 Plan 阶段 1 步骤 1.2 + 阶段 2 步骤 2.1）
- **操作类型**：新增
- **涉及文件**：
  - `chat-reply-server/package.json`（新增）
  - `chat-reply-server/tsconfig.json`（新增）
  - `chat-reply-server/.env`（新增）
  - `chat-reply-server/src/index.ts`（新增）
  - `chat-reply-server/src/db.ts`（新增）
- **实现内容**：
  - npm init + 安装依赖：express, better-sqlite3, openai, dotenv, cors, uuid 及类型
  - tsconfig.json：target ES2020, module commonjs, outDir dist, rootDir src
  - .env：`ZHIPU_API_KEY=`（空占位）+ `ZHIPU_BASE_URL=https://open.bigmodel.cn/api/paas/v4/` + `ZHIPU_MODEL=glm-5.1` + `PORT=3001`
  - db.ts：
    - `import Database from 'better-sqlite3'`
    - 创建/打开 `data/chat-trainer.db`
    - 启用 WAL 模式
    - 建 4 张表（chat_targets, chat_messages, ai_sessions, ai_messages）+ 索引
    - `export default db`
  - index.ts：
    - import dotenv/config, express, cors
    - `app.use(cors())` + `app.use(express.json())`
    - `app.get('/api/health', (req, res) => res.json({ ok: true }))`
    - 注册路由占位
    - `app.listen(PORT)`
  - package.json scripts：`"dev": "tsx watch src/index.ts"`, `"build": "tsc"`, `"start": "node dist/index.js"`
- **测试用例**：
  - 用例 1：`npm run dev` → localhost:3001/api/health 返回 `{ ok: true }`
  - 用例 2：检查 data/chat-trainer.db 文件已创建
  - 用例 3：重新启动 → 数据库不重建（表已存在则跳过）
- **依赖**：无

### Task 3：聊天对象 CRUD API（对应 Plan 阶段 2 步骤 2.2）
- **操作类型**：新增
- **涉及文件**：
  - `chat-reply-server/src/routes/targets.ts`（新增）
  - `chat-reply-server/src/index.ts`（修改，注册路由）
- **实现内容**：
  - `GET /api/targets` — `db.prepare('SELECT * FROM chat_targets ORDER BY created_at DESC').all()`
  - `POST /api/targets` — 验证 name 必填，生成 UUID，插入返回完整对象
  - `GET /api/targets/:id` — 按 id 查询，不存在返回 404
  - `PUT /api/targets/:id` — 更新所有字段（name, meet_scene, persona, hobbies, recent_chats, tone_level, goal_intent, forbidden_topics）
  - `DELETE /api/targets/:id` — 事务内级联删除：ai_messages（通过 session）→ ai_sessions → chat_messages → chat_targets
- **测试用例**：
  - 用例 1：POST `{ name: "小美", persona: "开朗" }` → 返回含 id 的对象，tone_level 默认 'moderate'
  - 用例 2：GET 列表 → 包含刚创建的对象
  - 用例 3：PUT 更新 persona → 再次 GET 详情 → persona 已更新
  - 用例 4：DELETE → 再次 GET 列表 → 不包含已删除对象
  - 用例 5：DELETE 后查询 chat_messages → 该对象消息已清空
- **依赖**：Task 2

### Task 4：聊天消息 API（对应 Plan 阶段 2 步骤 2.3）
- **操作类型**：新增
- **涉及文件**：
  - `chat-reply-server/src/routes/messages.ts`（新增）
  - `chat-reply-server/src/index.ts`（修改，注册路由）
- **实现内容**：
  - `GET /api/targets/:id/messages` — 按 created_at ASC 返回该对象所有消息
  - `POST /api/targets/:id/messages` — 验证 role（her/me）和 text 必填，生成 UUID，插入返回
  - `DELETE /api/targets/:id/messages` — 删除该对象所有消息
- **测试用例**：
  - 用例 1：POST `{ role: 'her', text: '你好', source: '手动输入' }` → 返回含 id 的消息
  - 用例 2：GET 消息列表 → 包含刚添加的消息
  - 用例 3：DELETE → 再次 GET → 空数组
- **依赖**：Task 2

### Task 5：AI 辅导窗口 CRUD API（对应 Plan 阶段 2 步骤 2.4）
- **操作类型**：新增
- **涉及文件**：
  - `chat-reply-server/src/routes/sessions.ts`（新增）
  - `chat-reply-server/src/index.ts`（修改，注册路由）
- **实现内容**：
  - `GET /api/targets/:id/sessions` — 返回该对象所有窗口，按 created_at DESC
  - `POST /api/targets/:id/sessions` — 创建新窗口：自动编号（#1, #2...），设 is_active=1，其他窗口设 is_active=0
  - `GET /api/sessions/:sessionId/messages` — 返回窗口内 AI 消息，按 created_at ASC
  - 创建窗口时 title 自动计算：`'#' + (该 target 现有窗口数 + 1)`
- **测试用例**：
  - 用例 1：POST 创建窗口 → 返回 `{ id, title: '#1', isActive: true, roundCount: 0 }`
  - 用例 2：再次 POST → title 为 '#2'，前一个窗口 isActive 变为 false
  - 用例 3：GET 窗口列表 → 返回 2 个窗口
  - 用例 4：GET 窗口消息 → 空数组
- **依赖**：Task 2

### Task 6：前端 TypeScript 类型定义（对应 Plan 阶段 3 步骤 3.1）
- **操作类型**：新增
- **涉及文件**：
  - `chat-reply-trainer/src/types.ts`（新增）
- **实现内容**：
  - ChatTarget, ChatMessage, AISession, AIMessage（与 design 数据结构一致）
  - GenerateResponse（含 analysis, plan, contextUsage, replies）
  - AppPhase: 'idle' | 'her_sent' | 'generating' | 'waiting_select'
  - AppState（含 phase, targets, currentTargetId, messages, sessions, currentSessionId, aiMessages, currentAnalysis, currentReplies, currentPlan, contextUsage, error）
  - AppAction 联合类型（所有 reducer action）
- **测试用例**：
  - 用例 1：`npx tsc --noEmit` → 无编译错误
  - 用例 2：AppAction 可接受所有 action type
- **依赖**：Task 1

### Task 7：前端 API 调用封装（对应 Plan 阶段 3 步骤 3.2）
- **操作类型**：新增
- **涉及文件**：
  - `chat-reply-trainer/src/services/api.ts`（新增）
- **实现内容**：
  - 封装所有后端 API：
    - targets: getTargets(), createTarget(data), getTarget(id), updateTarget(id, data), deleteTarget(id)
    - messages: getMessages(targetId), addMessage(targetId, data), clearMessages(targetId)
    - sessions: getSessions(targetId), createSession(targetId), getSessionMessages(sessionId)
    - generate: generateReply(sessionId, herMessage)
    - selectReply(sessionId, replyId), customReply(sessionId, text)
    - regenerate(sessionId, preferredStrategy?), sendFeedback(sessionId, replyId, rating)
  - 统一错误处理：res.ok 为 false 时 throw new Error(await res.json().error)
  - 所有函数返回类型化 Promise
- **测试用例**：
  - 用例 1：TypeScript 编译无错误（需后端运行才能实际调用）
  - 用例 2：函数签名与 types.ts 匹配
- **依赖**：Task 6

### Task 8：前端全局状态 Hook（对应 Plan 阶段 3 步骤 3.3-3.4）
- **操作类型**：新增
- **涉及文件**：
  - `chat-reply-trainer/src/hooks/useAppState.ts`（新增）
- **实现内容**：
  - useReducer 实现，初始状态：phase='idle', 所有数据为空/null
  - reducer 处理 actions：
    - SET_TARGETS: 设置对象列表
    - SELECT_TARGET: 切换当前对象（需加载该对象的 messages + sessions）
    - SEND_HER_MESSAGE: 追加 her 消息，phase → 'her_sent'
    - TRIGGER_AI: phase → 'generating'
    - GENERATE_SUCCESS: 设置 analysis/replies/plan/contextUsage，phase → 'waiting_select'
    - GENERATE_FAILURE: 设置 error，phase → 'idle'
    - SELECT_REPLY_ACTION: 追加 me 消息，清空分析数据，phase → 'idle'
    - CUSTOM_REPLY_ACTION: 同上
    - UPDATE_SESSIONS: 更新窗口列表
    - SET_PLAN: 更新策略计划
  - 暴露便捷函数：selectTarget(id), sendHerMessage(text), triggerAI(), selectReply(replyId), sendCustomReply(text)
  - triggerAI 内部：dispatch TRIGGER_AI → 调用 api.generateReply → dispatch SUCCESS/FAILURE
  - 使用 React Context 提供 state + actions
- **测试用例**：
  - 用例 1：sendHerMessage("测试") → messages 末尾为 her 消息，phase 为 'her_sent'
  - 用例 2：triggerAI() → phase 为 'generating'，成功后 phase 为 'waiting_select'
  - 用例 3：selectReply(id) → messages 末尾为 me 消息，phase 回到 'idle'
- **依赖**：Task 7

### Task 9：右侧聊天模拟器组件（对应 Plan 阶段 4 步骤 4.1-4.5）
- **操作类型**：新增
- **涉及文件**：
  - `chat-reply-trainer/src/components/ChatBubble.tsx`（新增）
  - `chat-reply-trainer/src/components/ChatHistory.tsx`（新增）
  - `chat-reply-trainer/src/components/MessageInput.tsx`（新增）
  - `chat-reply-trainer/src/components/ChatHeader.tsx`（新增）
- **实现内容**：
  - ChatBubble：
    - Props: `{ message: ChatMessage; targetName: string }`
    - her: 左对齐，粉色渐变头像（名字首字），白泡，border-top-left-radius: 3px
    - me: 右对齐，绿色渐变头像（"我"），绿泡 #95ec69，border-top-right-radius: 3px
    - 底部来源标记（9px 灰色小字）：手动输入 / AI建议·策略名 / 自定义回复
    - React.memo 包裹
  - ChatHistory：
    - Props: `{ messages: ChatMessage[]; targetName: string }`
    - flex column, overflow-y auto, gap 10px
    - 系统消息居中（如"—— 开始新对话 ——"）
    - useRef + useEffect scrollTop = scrollHeight
  - MessageInput：
    - Props: `{ onSend: (text: string) => void; disabled: boolean; placeholder?: string }`
    - textarea 自适应高度（min 34px, max 80px）
    - placeholder: "输入她刚发的消息..."
    - 发送按钮 disabled 条件：props.disabled || input.trim() 为空
    - Enter 发送（Shift+Enter 换行）
  - ChatHeader：
    - Props: `{ targetName: string; onAIAssist: () => void; onReset: () => void; isGenerating: boolean }`
    - 头像 + 名字 + 在线绿点 + "AI 辅助"按钮（蓝色渐变）+ "重新开始"按钮
    - isGenerating 时 AI 辅助按钮显示 loading 状态
- **测试用例**：
  - 用例 1：ChatBubble 传入 her 消息 → 白泡靠左，显示来源标记
  - 用例 2：ChatBubble 传入 me 消息（source: 'AI建议', strategy: '魔趣法则'）→ 绿泡靠右，来源显示"AI建议 · 魔趣法则"
  - 用例 3：ChatHistory 传入 10 条消息 → 自动滚到底
  - 用例 4：MessageInput 空输入 → 发送按钮 disabled
  - 用例 5：MessageInput 输入文本 → 点击发送 → onSend 被调用，输入框清空
- **依赖**：Task 6

### Task 10：左侧 AI 控制台组件（对应 Plan 阶段 5 步骤 5.1-5.6）
- **操作类型**：新增
- **涉及文件**：
  - `chat-reply-trainer/src/components/PersonCard.tsx`（新增）
  - `chat-reply-trainer/src/components/SessionBar.tsx`（新增）
  - `chat-reply-trainer/src/components/ContextBar.tsx`（新增）
  - `chat-reply-trainer/src/components/PlanCard.tsx`（新增）
  - `chat-reply-trainer/src/components/AnalysisTabs.tsx`（新增）
  - `chat-reply-trainer/src/components/AgentSteps.tsx`（新增）
- **实现内容**：
  - PersonCard：
    - Props: `{ target: ChatTarget | null; onEdit: () => void }`
    - 头像（渐变粉，名字首字）+ 名字 + 标签（meetScene 高亮橙色）
    - "编辑人设"按钮
  - SessionBar：
    - Props: `{ session: AISession | null; sessions: AISession[]; onSelectSession: (id: string) => void; onCreateSession: () => void }`
    - 窗口编号（如 #3）+ 轮次数 + 上下文用量条（进度条 + 百分比 + >80% 橙色预警）
    - "窗口列表"按钮（下拉）+ "+ 新窗口"按钮
  - ContextBar：
    - Props: `{ analysis }` (GenerateResponse 的 analysis 部分)
    - 标签：关系阶段（绿底）、信号类型（蓝底）、推荐策略（粉底）
    - 好感度进度条（0-100，渐变绿色）
    - analysis 为 null 时显示占位
  - PlanCard：
    - Props: `{ plan: { goal: string; nextStep: string } | null; onEdit: (plan) => void }`
    - 当前目标 + 下一步建议 + 编辑按钮
  - AnalysisTabs：
    - Props: `{ analysis, tip }`
    - useState 管理 active tab
    - 信号分析 Tab：解读文本 + 情绪标签 + 小贴士
    - 策略建议 Tab：推荐策略名 + 描述 + 列表
  - AgentSteps：
    - Props: `{ phase: AppPhase }`
    - 4 步进度：分析消息 → 识别信号 → 匹配策略 → 生成回复
    - 根据 phase 决定步骤状态（done/active/pending）
    - active 步骤脉冲动画
- **测试用例**：
  - 用例 1：PersonCard 传入 target → 标签正确显示（meetScene 橙色高亮）
  - 用例 2：SessionBar 传入 session(contextTokens: 6400, maxTokens: 8000) → 用量条 80%，橙色 + "建议新建窗口"
  - 用例 3：ContextBar 传入 analysis → 标签和好感度正确
  - 用例 4：AnalysisTabs 点击"策略建议" → 切换到策略内容
  - 用例 5：AgentSteps phase='generating' → 前两步 done，第三步 active 脉冲
- **依赖**：Task 6

### Task 11：顶部栏 + 新建对象 Modal（对应 Plan 阶段 5 步骤 5.7-5.8）
- **操作类型**：新增
- **涉及文件**：
  - `chat-reply-trainer/src/components/TargetSelector.tsx`（新增）
  - `chat-reply-trainer/src/components/TargetModal.tsx`（新增）
- **实现内容**：
  - TargetSelector：
    - Props: `{ targets: ChatTarget[]; currentId: string | null; onSelect: (id: string) => void; onCreateNew: () => void; onDelete: (id: string) => void }`
    - 按钮显示当前对象头像 + 名字 + 下拉箭头
    - 点击展开下拉列表：每个对象（头像 + 名字 + 简介 + 消息数 + 删除按钮）
    - 底部"+ 新建聊天对象"入口
    - 点击外部关闭下拉
  - TargetModal：
    - Props: `{ open: boolean; target?: ChatTarget | null; onClose: () => void; onSave: (data) => void }`
    - 表单字段：名字、认识场景、朋友圈人设、兴趣爱好、近期聊天内容
    - AI 行为偏好区域：语气偏好（三选一 radio）、目标意图（三选一 radio）、话题禁区（input，逗号分隔）
    - 编辑模式：传入 target 时表单预填现有数据
    - 标题动态：新建 → "新建聊天对象"；编辑 → "编辑人设 - xxx"
- **测试用例**：
  - 用例 1：TargetSelector 传入 2 个 target → 下拉显示 2 项
  - 用例 2：点击某项 → onSelect 被调用
  - 用例 3：TargetModal 新建模式 → 表单为空，提交调用 onSave
  - 用例 4：TargetModal 编辑模式 → 表单预填数据
  - 用例 5：AI 行为偏好 radio 选择正确
- **依赖**：Task 6

### Task 12：系统提示词 + GLM-5.1 调用封装（对应 Plan 阶段 6 步骤 6.1-6.2）
- **操作类型**：新增
- **涉及文件**：
  - `chat-reply-server/src/prompt.ts`（新增）
  - `chat-reply-server/src/llm.ts`（新增）
- **实现内容**：
  - prompt.ts：
    - `buildSystemPrompt(params: { target, recentMessages, planGoal, planNextStep, feedbackPreferences }): string`
    - 拼接：角色定义 + 四大法则 + 信号识别体系 + 关系阶段 + 对方人设 + AI 行为偏好 + 对话策略计划 + 历史反馈偏好 + 当前聊天记录 + JSON 输出格式要求
    - JSON 输出格式与 GenerateResponse 类型一致
  - llm.ts：
    - `import OpenAI from 'openai'`
    - 初始化 client：`new OpenAI({ apiKey, baseURL })`
    - `export async function chatCompletion(messages): Promise<string>`
    - model: process.env.ZHIPU_MODEL || 'glm-5.1'
    - temperature: 0.8, max_tokens: 2048
    - 返回 `response.choices[0].message.content`
- **测试用例**：
  - 用例 1：buildSystemPrompt 传入 target + messages → 输出包含名字、四大法则、JSON 格式要求
  - 用例 2：chatCompletion 传入 messages → 返回字符串（需 API Key）
- **依赖**：Task 2

### Task 13：AI 生成核心接口 + 回复操作 API（对应 Plan 阶段 6 步骤 6.3-6.4）
- **操作类型**：新增
- **涉及文件**：
  - `chat-reply-server/src/routes/sessions.ts`（修改，追加路由）
- **实现内容**：
  - POST `/api/sessions/:sessionId/generate`：
    1. 从 req.body 取 herMessage
    2. 保存到 chat_messages（role: 'her', source: '手动输入'）
    3. 查询 session → 获取 targetId
    4. 查询 target 获取人设 + 偏好
    5. 查询最近 10-15 条 chat_messages
    6. 查询该 session 的 ai_messages（多轮上下文）
    7. 查询历史反馈偏好
    8. buildSystemPrompt()
    9. 估算 token
    10. 调用 chatCompletion()
    11. JSON.parse 解析（try-catch）
    12. 保存 user + assistant 到 ai_messages
    13. 更新 session（round_count +1, context_tokens, plan_goal, plan_next_step）
    14. 返回 { analysis, plan, contextUsage, replies }
  - POST `/api/sessions/:sessionId/select-reply`：找 reply → 存 chat_messages
  - POST `/api/sessions/:sessionId/custom-reply`：存自定义回复
  - POST `/api/sessions/:sessionId/regenerate`：追加 user 消息后重新调用 AI
  - POST `/api/sessions/:sessionId/feedback`：记录反馈
- **测试用例**：
  - 用例 1：POST generate { herMessage: "你好" } → 返回含 analysis + replies 的 JSON
  - 用例 2：返回的 replies 含 3-4 条，至少 1 条安全回复
  - 用例 3：POST select-reply { replyId: 1 } → chat_messages 新增 me 消息
  - 用例 4：POST custom-reply { text: "自定义" } → chat_messages 新增 me 消息
  - 用例 5：POST regenerate → 返回新一批 replies
  - 用例 6：session 的 round_count +1
  - 用例 7：无 API Key → 返回 500 错误
- **依赖**：Task 5, Task 12

### Task 14：回复弹窗组件（对应 Plan 阶段 7 步骤 7.1-7.4）
- **操作类型**：新增
- **涉及文件**：
  - `chat-reply-trainer/src/components/ReplyCard.tsx`（新增）
  - `chat-reply-trainer/src/components/ReplyGrid.tsx`（新增）
  - `chat-reply-trainer/src/components/CustomReply.tsx`（新增）
  - `chat-reply-trainer/src/components/ReplyPopup.tsx`（新增）
- **实现内容**：
  - ReplyCard：
    - Props: `{ reply; selected; onSelect; onFeedback }`
    - 策略标签（颜色编码：魔趣=蓝、平衡=绿、冲突=粉、安全=紫、释放=橙）
    - 回复文本（加粗 15px）+ 推荐理由（灰色 12px）
    - 👍/👎 按钮（点击高亮，stopPropagation）
    - Hover: translateY(-2px) + 阴影 + 边框变色
    - 选中态：蓝色边框 + 浅蓝背景
  - ReplyGrid：
    - Props: `{ replies; onRegenerate; onStrategySelect; strategies }`
    - CSS Grid 2x2 布局
    - 底部按钮："重新生成" + "指定策略"（下拉选策略）
  - CustomReply：
    - Props: `{ onSend: (text: string) => void }`
    - 虚线分隔 + 标签 + textarea + 发送按钮
  - ReplyPopup：
    - Props: `{ open; replies; onClose; onSelectReply; onCustomReply; onRegenerate; onFeedback }`
    - 固定定位，从底部弹出（slideUp 动画 0.3s）
    - 遮罩层 + Header + Body(ReplyGrid + CustomReply)
    - 点击遮罩或关闭按钮关闭
- **测试用例**：
  - 用例 1：ReplyCard 传入魔趣法则 reply → 标签蓝色
  - 用例 2：Hover → 卡片上浮 2px
  - 用例 3：点击卡片 → onSelect 被调用
  - 用例 4：点击 👍 → onFeedback 被调用，按钮高亮
  - 用例 5：ReplyPopup open=true → 弹窗从底部弹出
  - 用例 6：点击遮罩 → onClose 被调用
- **依赖**：Task 6

### Task 15：App.tsx 主组件组装 + 完整 CSS（对应 Plan 阶段 8 步骤 8.1-8.2）
- **操作类型**：新增
- **涉及文件**：
  - `chat-reply-trainer/src/App.tsx`（修改，替换占位）
  - `chat-reply-trainer/src/App.css`（修改，替换占位）
- **实现内容**：
  - App.tsx：
    - 引入 useAppState hook（Context Provider）
    - 顶部栏：Logo + 标题 + 副标题 + TargetSelector
    - 左侧面板（70%, min 600px）：PersonCard → SessionBar → ContextBar → PlanCard → Tab(AgentSteps + AnalysisTabs)
    - 右侧面板（30%, min 320px, max 420px）：ChatHeader → ChatHistory → 等待提示条 → MessageInput
    - ReplyPopup 弹窗（条件渲染：phase === 'waiting_select'）
    - TargetModal 弹窗（条件渲染：modalOpen）
    - 首次加载 useEffect：getTargets + getLastTarget 加载数据
    - 无对象时显示空状态引导
  - App.css：
    - 全局重置 + body flex column + font-family
    - .top-bar（56px 白色，Logo + 标题 + 选择器）
    - .main-layout（flex row, flex: 1）
    - .left-panel（70%, 白色, border-right）+ 所有子组件样式
    - .right-panel（30%, #ededed）+ 所有子组件样式
    - .reply-popup-overlay + .reply-popup（固定定位，底部弹出动画）
    - .modal-overlay + .modal（居中弹窗）
    - 所有尺寸、颜色、圆角严格对照 ui-scheme.html
    - AgentSteps 三态动画（pulse keyframes）
    - 好感度/上下文用量进度条渐变动画
- **测试用例**：
  - 用例 1：页面整体视觉与 ui-scheme.html 一致
  - 用例 2：左70% 右30% 分栏正确
  - 用例 3：首次打开无对象 → 显示创建引导
  - 用例 4：创建对象后 → 左右面板正确显示
- **依赖**：Task 8, Task 9, Task 10, Task 11, Task 14

### Task 16：集成联调与收尾（对应 Plan 阶段 8 步骤 8.3-8.6）
- **操作类型**：验证
- **涉及文件**：
  - 无新增文件，验证已有代码
- **实现内容**：
  - 完整流程：创建对象 → 输入消息 → AI 分析 → 选择回复 → 循环 5 轮
  - 多对象切换：创建 2 个对象 → 切换 → 数据正确加载
  - AI 窗口管理：新建窗口 → 上下文重置 → 切换回看旧窗口
  - 错误场景：API Key 缺失 → 错误提示；网络异常 → 错误提示
  - 边界：空状态引导、上下文 >80% 预警、50+ 消息滚动、超长文本
  - 反馈：👍/👎 → 后续 AI 生成考虑偏好
  - 对话策略：AI 更新计划 → 手动编辑计划
  - 对照 Spec VC1-VC9 逐条验证
- **测试用例**：
  - 用例 1：VC1 — 创建/编辑/删除对象正常
  - 用例 2：VC2 — 输入消息白泡上屏，空消息不可发
  - 用例 3：VC3 — AI 返回 3-4 条回复含安全回复，弹窗正常弹出
  - 用例 4：VC4 — 选择回复绿泡上屏，弹窗关闭
  - 用例 5：VC5 — 新建窗口上下文重置，切换正常，>80% 预警
  - 用例 6：VC6 — 情境状态栏 + Tab + 策略计划正确更新
  - 用例 7：VC7 — 反馈按钮高亮，数据持久化
  - 用例 8：VC8 — 页面刷新数据不丢失
  - 用例 9：VC9 — API Key 缺失/网络异常 → 错误提示
- **依赖**：Task 15

## 依赖关系图

```
Task 1 (前端脚手架) ─────────────────────────────┐
Task 2 (后端脚手架+DB) ──┐                        │
  ├── Task 3 (targets API)                        │
  ├── Task 4 (messages API)                       │
  ├── Task 5 (sessions API 基础) ──┐              │
  └── Task 12 (prompt + LLM) ──┐  │              │
                                │  │              │
Task 6 (前端类型) ←────────────┼──┼──────────────┘
  ├── Task 7 (API 封装)         │  │
  │     └── Task 8 (状态 Hook)  │  │
  ├── Task 9 (右侧组件)         │  │
  ├── Task 10 (左侧组件)        │  │
  └── Task 11 (顶部栏+Modal)    │  │
                                 │  │
         Task 13 (generate API) ←┘  │
           │                        │
         Task 14 (回复弹窗) ←───────┘
           │
         Task 15 (App 组装 + CSS) ←── Task 8, 9, 10, 11, 14
           │
         Task 16 (集成联调)
```

## 变更记录
| 日期 | 作者 | 变更内容 |
|------|------|---------|
| 2026-05-28 | yuanchuang | 初始版本（16 个 Task，覆盖一期完整需求） |
