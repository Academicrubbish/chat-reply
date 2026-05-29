---
title: 聊天模拟器（Chat Simulator）Tasks
plan: plan.md
status: draft
created: 2026-05-27
updated: 2026-05-27
author: 用户
---

# 聊天模拟器（Chat Simulator）Tasks

> 完成标准：每个 Task 的实现内容完成 + 测试用例全部通过。

## Task 列表

### Task 1：项目脚手架搭建（对应 Plan 阶段 1）
- **操作类型**：新增
- **涉及文件**：
  - `package.json`（新增）
  - `vite.config.ts`（新增）
  - `tsconfig.json`（新增）
  - `.env`（新增）
  - `.gitignore`（新增）
  - `index.html`（新增）
  - `src/main.tsx`（新增）
- **实现内容**：
  - 用 Vite 创建 React + TypeScript 项目
  - 安装依赖：express、@anthropic-ai/sdk、dotenv、concurrently、tsx
  - vite.config.ts 配置 API 代理：proxy /api → localhost:3001
  - 创建目录：server/、src/components/、src/hooks/、src/services/
  - .env 写入 ANTHROPIC_API_KEY=（空值占位）
  - .gitignore 包含 node_modules、dist、.env
  - package.json scripts：dev 用 concurrently 同时启动 vite + tsx watch server/index.ts
  - src/main.tsx 挂载 App 到 #root
- **测试用例**：
  - 用例 1：npm run dev → 浏览器 localhost:5173 显示默认 React 页面
  - 用例 2：Express 在 localhost:3001 启动（curl localhost:3001 返回 404）
  - 用例 3：.env 在 .gitignore 中 → git status 不显示 .env
- **依赖**：无

### Task 2：系统提示词（对应 Plan 步骤 2.1）
- **操作类型**：新增
- **涉及文件**：
  - `server/prompt.ts`（新增）
- **实现内容**：
  - 导出 SYSTEM_PROMPT 常量
  - 内容包含：
    - 角色设定：专业聊天策略分析师
    - 四大法则详细描述（扩大冲突、魔趣法则、平衡艺术、释放性信息）
    - 信号识别体系（正面冲突、正面无冲突、模糊、负面）
    - 关系阶段判断规则（初期接触、聊天升温、暧昧期、约会/恋爱期）
    - 回复生成规则（1-5 条、风格差异、至少一条安全回复、长度匹配）
    - 严格 JSON 输出格式指令，与 GenerateRepliesResponse 类型一致
- **测试用例**：
  - 用例 1：console.log(SYSTEM_PROMPT) 输出包含"四大法则"、"扩大冲突"、"魔趣法则"
  - 用例 2：SYSTEM_PROMPT 包含 JSON 格式示例
- **依赖**：Task 1

### Task 3：Express API 路由（对应 Plan 步骤 2.2）
- **操作类型**：新增
- **涉及文件**：
  - `server/index.ts`（新增）
- **实现内容**：
  - import dotenv 并 config()
  - 创建 Express 应用，使用 express.json() 中间件
  - POST /api/generate-replies 路由：
    1. 检查 process.env.ANTHROPIC_API_KEY，无则返回 500
    2. 校验 req.body.messages 为非空数组，否则返回 400
    3. 用 Anthropic SDK 调用 Claude，传入 SYSTEM_PROMPT + 对话历史
    4. 解析 response.content[0].text 为 JSON
    5. 返回 JSON 给前端
    6. try-catch 包裹，异常返回 500 + 错误信息
  - 监听 PORT 3001
- **测试用例**：
  - 用例 1：curl POST 含 messages 的请求 → 返回 analysis + replies + tip 的 JSON
  - 用例 2：无 API Key → 返回 `{ "error": "ANTHROPIC_API_KEY 未配置" }`
  - 用例 3：空 messages → 返回 `{ "error": "对话历史不能为空" }`
  - 用例 4：messages 含 3 条对话历史 → 返回 1-5 条 replies，每条含 id/strategy/reason/text
- **依赖**：Task 2

### Task 4：TypeScript 类型定义（对应 Plan 步骤 3.1）
- **操作类型**：新增
- **涉及文件**：
  - `src/types.ts`（新增）
- **实现内容**：
  - ChatMessage：`{ role: 'her' | 'me'; text: string }`
  - AnalysisData：`{ stage: string; signal: string; strategy: string }`
  - ReplyOption：`{ id: number; strategy: string; reason: string; text: string }`
  - GenerateRepliesResponse：`{ analysis: AnalysisData; replies: ReplyOption[]; tip: string }`
  - ApiErrorResponse：`{ error: string }`
  - ChatState：`{ phase: 'idle' | 'generating' | 'waiting_select'; messages: ChatMessage[]; analysis: AnalysisData | null; replies: ReplyOption[]; error: string | null }`
  - ChatAction：5 个 action 的联合类型
- **测试用例**：
  - 用例 1：TypeScript 编译无错误（npx tsc --noEmit）
  - 用例 2：ChatAction 类型可接受 5 种 action type
- **依赖**：Task 1

### Task 5：API 调用封装（对应 Plan 步骤 3.2）
- **操作类型**：新增
- **涉及文件**：
  - `src/services/api.ts`（新增）
- **实现内容**：
  - 导出 generateReplies(messages: ChatMessage[]): Promise\<GenerateRepliesResponse\>
  - fetch POST /api/generate-replies，Content-Type: application/json
  - body: JSON.stringify({ messages })
  - res.ok 为 false 时解析 ApiErrorResponse 并 throw new Error
  - res.ok 为 true 时返回 JSON
- **测试用例**：
  - 用例 1：传入 `[{ role: 'her', text: '你好' }]` → 返回 GenerateRepliesResponse（需后端运行）
  - 用例 2：后端返回 500 → 抛出 Error，message 为服务端错误信息
- **依赖**：Task 4

### Task 6：useChat 状态机（对应 Plan 步骤 3.3）
- **操作类型**：新增
- **涉及文件**：
  - `src/hooks/useChat.ts`（新增）
- **实现内容**：
  - useReducer 实现，初始状态：`{ phase: 'idle', messages: [], analysis: null, replies: [], error: null }`
  - reducer 处理：
    - SEND_MESSAGE：追加 `{ role: 'her', text }` 到 messages，phase → 'generating'
    - GENERATE_SUCCESS：设置 analysis、replies、tip，phase → 'waiting_select'，清空 error
    - GENERATE_FAILURE：设置 error，phase → 'idle'
    - SELECT_REPLY：找到对应 reply 追加 `{ role: 'me', text: reply.text }` 到 messages，清空 analysis/replies/error，phase → 'idle'
    - RESET：回到初始状态
  - 暴露便捷函数：
    - sendMessage(text)：dispatch SEND_MESSAGE → 调用 api.generateReplies → dispatch SUCCESS/FAILURE
    - selectReply(id)：dispatch SELECT_REPLY
    - reset()：dispatch RESET
  - 返回 `{ state, sendMessage, selectReply, reset }`
- **测试用例**：
  - 用例 1：sendMessage("测试") → state.messages 末尾为 `{ role: 'her', text: '测试' }`，phase 为 'generating'
  - 用例 2：API 成功后 → state.analysis 和 state.replies 有值，phase 为 'waiting_select'
  - 用例 3：selectReply(1) → state.messages 末尾为 `{ role: 'me', text: '...' }`，phase 为 'idle'
  - 用例 4：reset() → state 回到初始值
  - 用例 5：API 失败 → state.error 有值，phase 为 'idle'
- **依赖**：Task 5

### Task 7：ChatBubble 组件（对应 Plan 步骤 4.1）
- **操作类型**：新增
- **涉及文件**：
  - `src/components/ChatBubble.tsx`（新增）
- **实现内容**：
  - Props：`{ message: ChatMessage }`
  - 外层 div.msg-row，根据 message.role 添加 class 'her' 或 'me'
  - her：左对齐，粉色渐变头像（显示"她"），白色气泡，左上角直角（border-top-left-radius: 4px）
  - me：右对齐，绿色渐变头像（显示"我"），#95ec69 绿色气泡，右上角直角
  - 气泡最大宽度 70%
  - React.memo 包裹
- **测试用例**：
  - 用例 1：传入 her 消息 → 气泡靠左，白色背景
  - 用例 2：传入 me 消息 → 气泡靠右，绿色背景 #95ec69
  - 用例 3：传入长文本 → 气泡换行，不超过容器 70%
- **依赖**：Task 4

### Task 8：ChatHistory 组件（对应 Plan 步骤 4.2）
- **操作类型**：新增
- **涉及文件**：
  - `src/components/ChatHistory.tsx`（新增）
- **实现内容**：
  - Props：`{ messages: ChatMessage[]; children?: ReactNode }`
  - 容器 div.chat-messages，flex column，overflow-y auto
  - 渲染 messages.map → ChatBubble
  - children 插槽用于系统消息（如"—— AI 分析中... ——"）
  - useRef 获取容器 ref，useEffect 监听 messages 变化，scrollTop = scrollHeight
- **测试用例**：
  - 用例 1：传入 3 条消息 → 渲染 3 个 ChatBubble
  - 用例 2：传入 10 条消息 → 自动滚动到底部
  - 用例 3：传入 children → children 渲染在气泡列表中
- **依赖**：Task 7

### Task 9：MessageInput 组件（对应 Plan 步骤 4.3）
- **操作类型**：新增
- **涉及文件**：
  - `src/components/MessageInput.tsx`（新增）
- **实现内容**：
  - Props：`{ onSend: (text: string) => void; disabled: boolean }`
  - textarea：自适应高度（监听 input 事件，scrollHeight 调整 height，min 40px max 100px）
  - placeholder："输入她刚发的消息..."
  - 发送按钮（.btn-primary）：disabled 条件为 props.disabled || input 为空
  - 次按钮（.btn-secondary）："还没回她"
  - 点击发送或 Enter（非 Shift+Enter）→ onSend(text)，清空输入框
  - 生成中（disabled=true）→ 发送按钮置灰
- **测试用例**：
  - 用例 1：输入文本点发送 → onSend 被调用，输入框清空
  - 用例 2：输入框为空 → 发送按钮 disabled
  - 用例 3：disabled=true → 发送按钮 disabled，不触发 onSend
  - 用例 4：Enter 键触发发送；Shift+Enter 换行
- **依赖**：Task 4

### Task 10：AnalysisBar 组件（对应 Plan 步骤 4.4）
- **操作类型**：新增
- **涉及文件**：
  - `src/components/AnalysisBar.tsx`（新增）
- **实现内容**：
  - Props：`{ analysis: AnalysisData | null; tip: string | null }`
  - 情境状态栏（.context-bar）：
    - 标签区：关系阶段（绿底）、信号类型（蓝底）、推荐策略（粉底）
    - 好感度进度条（固定 65%，后续可动态）
  - Tab 切换区：信号分析 | 策略建议（useState 管理活跃 tab）
  - 信号分析 Tab：解读文本 + 情绪标签 + 小贴士
  - 策略建议 Tab：推荐策略名称 + 描述 + 列表
  - analysis 为 null 时显示"等待输入对方消息..."占位
- **测试用例**：
  - 用例 1：analysis=null → 显示"等待输入"占位
  - 用例 2：传入 analysis 数据 → 标签显示正确阶段/信号/策略
  - 用例 3：点击"策略建议" Tab → 切换到策略内容
  - 用例 4：tip 有值 → 显示小贴士提示框
- **依赖**：Task 4

### Task 11：ReplyCard 组件（对应 Plan 步骤 4.5）
- **操作类型**：新增
- **涉及文件**：
  - `src/components/ReplyCard.tsx`（新增）
- **实现内容**：
  - Props：`{ reply: ReplyOption; onSelect: (id: number) => void }`
  - 卡片结构：
    - 策略标签：魔趣=蓝、平衡=绿、冲突=粉、安全=紫、其他=橙
    - 回复文本：加粗，font-size 15px
    - 推荐理由：灰色小字，font-size 12px
  - Hover 效果：translateY(-2px) + box-shadow + border-color 变化
  - 点击 → onSelect(reply.id)
- **测试用例**：
  - 用例 1：传入魔趣法则 reply → 标签显示蓝色
  - 用例 2：Hover → 卡片上浮 2px
  - 用例 3：点击 → onSelect 被调用，参数为 reply.id
- **依赖**：Task 4

### Task 12：ReplyOptions 组件（对应 Plan 步骤 4.6）
- **操作类型**：新增
- **涉及文件**：
  - `src/components/ReplyOptions.tsx`（新增）
- **实现内容**：
  - Props：`{ replies: ReplyOption[]; onSelect: (id: number) => void }`
  - 标题 "选择回复"（带左侧蓝色竖线装饰）
  - replies.map → ReplyCard，垂直排列
  - replies 为空数组时整个区域隐藏（return null）
- **测试用例**：
  - 用例 1：传入 3 条 replies → 渲染 3 张 ReplyCard
  - 用例 2：传入空数组 → 不渲染任何内容
  - 用例 3：点击第 2 张卡片 → onSelect 参数为第 2 条 reply 的 id
- **依赖**：Task 11

### Task 13：App.tsx 主组件组装（对应 Plan 步骤 5.1）
- **操作类型**：新增
- **涉及文件**：
  - `src/App.tsx`（新增）
- **实现内容**：
  - 引入 useChat hook
  - 顶部标题栏：Logo（渐变紫蓝方块 + "AI"）+ "聊天模拟器" + 副标题
  - 左侧面板（.left-panel）：
    - AnalysisBar（传入 state.analysis, state.tip）
    - ReplyOptions（传入 state.replies, selectReply）
    - phase='generating' 时显示"AI 分析中..."加载指示器
  - 右侧面板（.right-panel）：
    - ChatHeader：粉色渐变头像（"她"）+ "她" + 在线绿点 + "重新开始"按钮
    - ChatHistory（传入 state.messages）
    - MessageInput（传入 sendMessage, disabled=phase!=='idle'）
  - "重新开始"按钮 → reset()
- **测试用例**：
  - 用例 1：初始加载 → 左侧"等待输入"，右侧空聊天区 + 输入框
  - 用例 2：输入消息发送 → 右侧出现白泡，左侧显示加载
  - 用例 3：AI 返回后 → 左侧出现分析 + 回复卡片
  - 用例 4：点击回复卡片 → 右侧出现绿泡，左侧重置
  - 用例 5：点击"重新开始" → 全部清空
- **依赖**：Task 6, Task 8, Task 9, Task 10, Task 12

### Task 14：App.css 完整样式（对应 Plan 步骤 5.2）
- **操作类型**：新增
- **涉及文件**：
  - `src/App.css`（新增）
- **实现内容**：
  - 全局重置：margin 0, padding 0, box-sizing border-box
  - body：font-family（-apple-system, PingFang SC, Microsoft YaHei），bg #f7f8fa，height 100vh，flex column
  - .top-bar：白色背景，border-bottom，flex，Logo + 标题
  - .main-layout：flex row，flex: 1，overflow hidden
  - .left-panel：width 40%，min 400px，max 520px，白色，border-right，flex column
  - .context-bar：渐变蓝背景，标签（胶囊形），好感度进度条
  - .tab-bar / .tab-item：下划线切换，active 颜色 #3b5998
  - .signal-card / .tip-box：浅蓝背景卡片 + 黄色小贴士
  - .reply-section / .reply-card：白色卡片，hover 上浮阴影，策略标签颜色
  - .right-panel：flex: 1，bg #ededed，flex column
  - .chat-header：白色，头像 + 在线状态 + 重置按钮
  - .chat-messages：flex: 1，overflow-y auto，gap 16px
  - .msg-row / .msg-bubble：her 白泡左对齐 / me 绿泡(#95ec69)右对齐，圆角 12px
  - .chat-input-area：flex，textarea 圆角 + btn-primary (#3b5998) + btn-secondary
  - 所有尺寸、颜色、圆角严格对照 ui-scheme.html
- **测试用例**：
  - 用例 1：页面整体视觉与 ui-scheme.html 一致（截图对比）
  - 用例 2：回复卡片 Hover → 上浮 + 阴影变化
  - 用例 3：Tab 切换样式正确（下划线跟随）
  - 用例 4：聊天气泡颜色：her 白色、me #95ec69
- **依赖**：Task 13

### Task 15：集成联调（对应 Plan 阶段 6）
- **操作类型**：验证
- **涉及文件**：
  - 无新增文件，验证已有代码
- **实现内容**：
  - 完整流程测试：输入 → 上屏 → AI 分析 → 卡片 → 点选 → 上屏 → 循环 5 轮
  - 错误场景：清空 API Key → 验证错误提示；断网 → 验证错误提示
  - 边界测试：50 条消息流畅滚动；超长文本换行；快速连续点击
  - 重置功能：多轮后点击"重新开始" → 全部清空
  - 对照 Spec VC1-VC7 验收标准逐条验证
- **测试用例**：
  - 用例 1：VC1 — 输入消息点击发送 → 白泡出现，输入框清空
  - 用例 2：VC2 — AI 返回后 → 分析+卡片显示，至少含一张安全回复
  - 用例 3：VC3 — 点击卡片 → 绿泡出现，左侧重置
  - 用例 4：VC4 — 状态栏标签+进度条+Tab 切换正确
  - 用例 5：VC5 — 50 条消息滚动流畅，新消息自动滚到底
  - 用例 6：VC6 — 重置按钮 → 全部清空
  - 用例 7：VC7 — API Key 缺失/网络异常 → 错误提示；生成中重复点击 → 无重复请求
- **依赖**：Task 14

## 依赖关系图

```
Task 1 (脚手架)
  ├── Task 2 (提示词) ──→ Task 3 (Express API)
  └── Task 4 (类型定义)
        ├── Task 5 (API 封装) ──→ Task 6 (useChat) ──┐
        ├── Task 7 (ChatBubble) ──→ Task 8 (ChatHistory) ──┐
        ├── Task 9 (MessageInput) ──┐                       │
        ├── Task 10 (AnalysisBar) ──┤                       │
        └── Task 11 (ReplyCard) ──→ Task 12 (ReplyOptions) ─┤
                                                             │
                    Task 13 (App 组装) ←──────────────────────┘
                      └──→ Task 14 (CSS 样式)
                             └──→ Task 15 (集成联调)
```

## 变更记录
| 日期 | 作者 | 变更内容 |
|------|------|---------|
| 2026-05-27 | 用户 | 初始版本 |
