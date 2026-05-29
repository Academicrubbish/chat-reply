---
title: Chat Simulator V2 Tasks
plan: ./plan.md
status: draft
created: 2026-05-29
updated: 2026-05-29
author: yuanchuang
---

# Chat Simulator V2 Tasks

> 完成标准：每个 Task 的实现内容完成 + 测试用例全部通过。

## Task 列表

### Task 1：CORS 白名单 + 请求体限制 + 限流（对应 Plan 阶段1-步骤1.1）
- **操作类型**：修改
- **涉及文件**：
  - `chat-reply-server/src/index.ts`（修改）
  - `chat-reply-server/package.json`（修改）
- **实现内容**：
  - 安装 express-rate-limit：`npm install express-rate-limit`
  - 修改 cors 配置，限制 origin 为 `['http://localhost:5173', 'http://localhost:5174', 'http://127.0.0.1:5173']`，设置 `credentials: true`
  - 修改 express.json 添加 `limit: '100kb'`
  - 添加 rateLimit 中间件：`{ windowMs: 60_000, max: 100 }`
  - 中间件顺序：cors → rateLimit → express.json → 路由
- **测试用例**：
  - 用例 1：从 http://evil.com 发起请求 → CORS 拒绝，无响应头 Access-Control-Allow-Origin
  - 用例 2：发送 101KB JSON body → 返回 413 Payload Too Large
  - 用例 3：1 分钟内发送 101 次请求 → 第 101 次返回 429 Too Many Requests
  - 用例 4：从 http://localhost:5173 发起请求 → 正常响应
- **依赖**：无

### Task 2：JSON 多轮 fallback 解析链 + 兜底回复（对应 Plan 阶段1-步骤1.2）
- **操作类型**：修改
- **涉及文件**：
  - `chat-reply-server/src/index.ts`（修改）
- **实现内容**：
  - 在 SSE 流结束处理中增强 JSON 解析逻辑
  - 实现 `parseJsonSafely(raw: string)` 函数，按顺序尝试：
    1. `JSON.parse(raw)` 直接解析
    2. 剥离 `` ```json ... ``` `` 代码块后解析
    3. 替换中文引号 `""` → `""` 后解析
    4. 自动补全截断的括号和引号后解析
    5. 正则提取 `{ ... }` 最大匹配块后解析
  - 所有步骤失败时返回 `SAFE_FALLBACK` 固定结构体
  - 定义 `SAFE_FALLBACK` 常量（包含 analysis、plan、replies 的降级回复）
- **测试用例**：
  - 用例 1：输入 `` ```json\n{"analysis":{}}\n``` `` → 正确解析出 JSON 对象
  - 用例 2：输入 `{"analysis": “信号”}` → 替换中文引号后解析成功
  - 用例 3：输入 `{"analysis": {"stage": "分析` → 补全截断 JSON 后解析成功
  - 用例 4：输入 `totally not json @#$%` → 返回 SAFE_FALLBACK 结构体
  - 用例 5：前端收到兜底回复时显示降级提示，不白屏
- **依赖**：无

### Task 3：LLM 调用失败自动重试（对应 Plan 阶段1-步骤1.3）
- **操作类型**：修改
- **涉及文件**：
  - `chat-reply-server/src/llm.ts`（修改）
- **实现内容**：
  - 在 `chatCompletionStream` 函数外包装重试逻辑
  - 创建 `chatCompletionStreamWithRetry(params, maxRetries = 1)` 函数
  - 第一次调用失败（抛异常或连接中断）时，用相同参数重试 1 次
  - 重试仍失败时，返回 SAFE_FALLBACK 的 JSON 字符串作为流式响应
  - 前端无需修改，重试对前端透明
- **测试用例**：
  - 用例 1：LLM 第一次调用抛出网络错误 → 自动重试第二次成功 → 正常返回 AI 回复
  - 用例 2：LLM 两次调用都失败 → 返回兜底安全回复
  - 用例 3：LLM 正常调用 → 不触发重试，直接返回
- **依赖**：Task 2（使用 SAFE_FALLBACK 结构）

### Task 4：前端 ErrorBoundary 组件（对应 Plan 阶段1-步骤1.4）
- **操作类型**：新增
- **涉及文件**：
  - `chat-reply-trainer/src/components/ErrorBoundary.tsx`（新增）
- **实现内容**：
  - 创建 class 组件 ErrorBoundary，实现 `componentDidCatch` 和 `getDerivedStateFromError`
  - Props：`children`、`fallback?`（自定义渲染函数）、`boundaryName?: string`（用于日志标识）
  - 默认 UI：错误图标 + "页面出了点问题" 标题 + "重试" 按钮 + 可展开的错误详情（默认折叠）
  - "重试" 按钮 → `setState({ hasError: false })` 重置状态
  - 支持自定义 fallback 渲染函数，用于局部 ErrorBoundary 的精简提示
- **测试用例**：
  - 用例 1：子组件 throw Error → 显示错误页面 + 重试按钮
  - 用例 2：点击重试按钮 → ErrorBoundary 重置，子组件重新渲染
  - 用例 3：使用自定义 fallback → 显示自定义 UI
- **依赖**：无

### Task 5：App.tsx 和关键子组件包裹 ErrorBoundary（对应 Plan 阶段1-步骤1.5）
- **操作类型**：修改
- **涉及文件**：
  - `chat-reply-trainer/src/App.tsx`（修改）
  - `chat-reply-trainer/src/components/RoundTimeline.tsx`（修改）
  - `chat-reply-trainer/src/components/ChatHistory.tsx`（修改）
- **实现内容**：
  - App.tsx 最外层包裹 `<ErrorBoundary boundaryName="全局">`
  - RoundTimeline 组件外包裹 `<ErrorBoundary boundaryName="AI分析" fallback={...}>`
  - ChatHistory 组件外包裹 `<ErrorBoundary boundaryName="聊天记录" fallback={...}>`
  - 局部 ErrorBoundary 使用精简 fallback："该区域加载失败" + 重试按钮
- **测试用例**：
  - 用例 1：RoundTimeline 内部 throw Error → 仅 AI 分析区域显示错误，聊天记录不受影响
  - 用例 2：App 层级 throw Error → 全局错误页面
  - 用例 3：正常渲染时 ErrorBoundary 不影响 UI
- **依赖**：Task 4

### Task 6：新增 users 表 + 密码哈希工具（对应 Plan 阶段2-步骤2.1）
- **操作类型**：修改
- **涉及文件**：
  - `chat-reply-server/src/db.ts`（修改）
  - `chat-reply-server/package.json`（修改）
- **实现内容**：
  - 安装 bcryptjs：`npm install bcryptjs @types/bcryptjs`
  - 在 db.ts 的 initDB 中添加 users 表 CREATE TABLE：
    ```sql
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
    ```
  - 导出辅助函数 `hashPassword(password: string): Promise<string>` 使用 bcryptjs.hash
  - 导出辅助函数 `verifyPassword(password: string, hash: string): Promise<boolean>` 使用 bcryptjs.compare
- **测试用例**：
  - 用例 1：启动服务 → users 表自动创建，无报错
  - 用例 2：hashPassword("test123") → 返回 60 字符的 bcrypt 哈希
  - 用例 3：verifyPassword("test123", hash) → true；verifyPassword("wrong", hash) → false
- **依赖**：无

### Task 7：认证 API 路由 + JWT 签发（对应 Plan 阶段2-步骤2.2）
- **操作类型**：新增
- **涉及文件**：
  - `chat-reply-server/src/routes/auth.ts`（新增）
  - `chat-reply-server/package.json`（修改）
  - `chat-reply-server/src/index.ts`（修改）
- **实现内容**：
  - 安装 jsonwebtoken：`npm install jsonwebtoken @types/jsonwebtoken`
  - 创建 `chat-reply-server/src/routes/auth.ts`：
    - `POST /api/auth/status`：查询 users 表是否为空，返回 `{ initialized: boolean }`
    - `POST /api/auth/setup`：检查 users 表为空 → hashPassword → INSERT INTO users → 签发 JWT → 返回 `{ token }`
    - `POST /api/auth/login`：查询用户 → verifyPassword → 签发 JWT → 返回 `{ token }`
    - `POST /api/auth/logout`：无服务端操作（JWT 无状态），返回 200
  - JWT 签发：payload 含 `userId` + `username`，过期时间 24h，secret 从 `process.env.JWT_SECRET` 读取
  - index.ts 中注册路由：`app.use('/api/auth', authRouter)`
- **测试用例**：
  - 用例 1：首次调用 GET /api/auth/status → `{ initialized: false }`
  - 用例 2：POST /api/auth/setup { username, password } → 返回 JWT token，users 表新增一条记录
  - 用例 3：再次调用 setup → 返回 403 "系统已初始化"
  - 用例 4：POST /api/auth/login 正确密码 → 返回 JWT
  - 用例 5：POST /api/auth/login 错误密码 → 返回 401
- **依赖**：Task 6

### Task 8：JWT 认证中间件（对应 Plan 阶段2-步骤2.3）
- **操作类型**：新增 + 修改
- **涉及文件**：
  - `chat-reply-server/src/middleware/auth.ts`（新增）
  - `chat-reply-server/src/index.ts`（修改）
- **实现内容**：
  - 创建 `chat-reply-server/src/middleware/auth.ts`：
    - 导出 `authMiddleware(req, res, next)` 函数
    - 从 `req.headers.authorization` 提取 Bearer token
    - 用 jsonwebtoken.verify 验证，失败返回 401
    - 成功后将 `req.user = decoded` 传递给后续处理
  - 在 index.ts 中，对所有 `/api/*` 路由（排除 `/api/auth/*`）应用 authMiddleware
  - 中间件顺序：cors → rateLimit → express.json → authMiddleware（仅非 auth 路由）→ 业务路由
- **测试用例**：
  - 用例 1：不带 Token 访问 GET /api/targets → 返回 401
  - 用例 2：带有效 JWT 访问 GET /api/targets → 正常返回数据
  - 用例 3：带过期/伪造 JWT → 返回 401
  - 用例 4：POST /api/auth/login 不需要 Token → 正常返回
- **依赖**：Task 7

### Task 9：前端初始化页（对应 Plan 阶段2-步骤2.4）
- **操作类型**：新增
- **涉及文件**：
  - `chat-reply-trainer/src/components/SetupPage.tsx`（新增）
  - `chat-reply-trainer/src/services/api.ts`（修改）
- **实现内容**：
  - api.ts 新增：`getAuthStatus()` → GET /api/auth/status；`setupAccount(username, password)` → POST /api/auth/setup
  - 创建 SetupPage.tsx：
    - 居中卡片布局：Logo + 标题 "创建管理员账号" + 用户名输入框 + 密码输入框 + 确认密码输入框 + "创建" 按钮
    - 表单验证：用户名非空、密码 >= 6 字符、两次密码一致
    - loading 状态：创建中按钮显示 loading
    - 成功后：将 token 存入 localStorage，跳转主页
    - 错误提示：显示具体错误信息
- **测试用例**：
  - 用例 1：首次访问 → 显示初始化页
  - 用例 2：密码不一致 → 显示 "两次密码不一致" 错误
  - 用例 3：创建成功 → Token 存入 localStorage，页面跳转到主页
  - 用例 4：创建失败（网络错误）→ 显示错误提示
- **依赖**：无（可并行开发）

### Task 10：前端登录页（对应 Plan 阶段2-步骤2.5）
- **操作类型**：新增
- **涉及文件**：
  - `chat-reply-trainer/src/components/LoginPage.tsx`（新增）
  - `chat-reply-trainer/src/services/api.ts`（修改）
- **实现内容**：
  - api.ts 新增：`login(username, password)` → POST /api/auth/login
  - 创建 LoginPage.tsx：
    - 居中卡片布局：Logo + 标题 "登录" + 用户名输入框 + 密码输入框 + "登录" 按钮
    - loading 状态：登录中按钮显示 loading
    - 成功后：将 token 存入 localStorage，跳转主页
    - 错误提示：密码错误 → "用户名或密码错误"；网络异常 → "网络异常，请重试"
- **测试用例**：
  - 用例 1：输入正确用户名密码 → 登录成功，跳转主页
  - 用例 2：输入错误密码 → 显示 "用户名或密码错误"
  - 用例 3：后端不可达 → 显示 "网络异常，请重试"
- **依赖**：无（可并行开发）

### Task 11：前端路由守卫 + Token 管理（对应 Plan 阶段2-步骤2.6）
- **操作类型**：修改
- **涉及文件**：
  - `chat-reply-trainer/src/App.tsx`（修改）
  - `chat-reply-trainer/src/services/api.ts`（修改）
  - `chat-reply-trainer/src/hooks/useAppState.tsx`（修改）
- **实现内容**：
  - api.ts：所有请求自动从 localStorage 读取 token 并添加 `Authorization: Bearer <token>` header
  - api.ts：响应拦截 401 → 清除 localStorage token + 跳转登录页
  - App.tsx 添加认证状态判断逻辑：
    - 页面加载时调用 GET /api/auth/status
    - 未初始化 → 渲染 SetupPage
    - 已初始化但未登录（无有效 token）→ 渲染 LoginPage
    - 已登录 → 渲染主应用内容
  - 主应用内容用 `<ErrorBoundary>` 包裹（已在 Task 5 实现）
- **测试用例**：
  - 用例 1：首次访问（无 token、未初始化）→ 显示 SetupPage
  - 用例 2：已有账户（无 token）→ 显示 LoginPage
  - 用例 3：有效 token → 显示主页
  - 用例 4：Token 过期后操作 → 自动跳转 LoginPage
  - 用例 5：刷新页面 → 登录状态保持（token 在 localStorage）
- **依赖**：Task 5, Task 8, Task 9, Task 10

### Task 12：删除操作二次确认（对应 Plan 阶段3-步骤3.1）
- **操作类型**：修改
- **涉及文件**：
  - `chat-reply-trainer/src/components/ChatHistory.tsx`（修改）
  - `chat-reply-trainer/src/components/TargetSelector.tsx`（修改）
- **实现内容**：
  - ChatHistory.tsx：消息删除图标改为 antd Popconfirm 包裹
    - `title="确定删除这条消息？"` + `okText="删除"` + `cancelText="取消"` + `okButtonProps={{ danger: true }}`
    - onConfirm 执行原删除逻辑
  - TargetSelector.tsx：聊天对象删除改为 Modal.confirm
    - `title="删除聊天对象"` + `content="删除后所有聊天记录和 AI 窗口将清除，不可恢复"` + `okType="danger"`
    - onOk 执行原删除逻辑
- **测试用例**：
  - 用例 1：点击消息删除图标 → 弹出 Popconfirm 气泡 "确定删除这条消息？"
  - 用例 2：点击取消 → 气泡关闭，消息不删除
  - 用例 3：点击聊天对象删除 → 弹出 Modal "删除后所有聊天记录和 AI 窗口将清除，不可恢复"
  - 用例 4：Modal 点击确认 → 删除对象及其所有数据
- **依赖**：无

### Task 13：首次使用引导页（对应 Plan 阶段3-步骤3.2）
- **操作类型**：新增 + 修改
- **涉及文件**：
  - `chat-reply-trainer/src/components/OnboardingPage.tsx`（新增）
  - `chat-reply-trainer/src/App.tsx`（修改）
- **实现内容**：
  - 创建 OnboardingPage.tsx：
    - 居中布局，标题 "聊天模拟器"
    - 副标题 "用 AI 帮你分析对方消息并生成多种风格的回复建议"
    - 3 步骤卡片（带图标）：① 创建聊天对象 → ② 输入消息 → ③ AI 辅助
    - "开始使用 — 创建第一个对象" 按钮 → 触发创建聊天对象弹窗
  - App.tsx：当 targets 列表为空时显示 OnboardingPage，否则显示主布局
  - 创建对象成功后 targets 列表不再为空 → OnboardingPage 自动消失
- **测试用例**：
  - 用例 1：删除所有聊天对象 → 显示引导页
  - 用例 2：引导页点击 "开始使用" → 弹出创建聊天对象弹窗
  - 用例 3：创建对象后 → 引导页消失，显示主界面
- **依赖**：无

### Task 14：RoundTimeline memoization（对应 Plan 阶段3-步骤3.3）
- **操作类型**：修改
- **涉及文件**：
  - `chat-reply-trainer/src/components/RoundTimeline.tsx`（修改）
- **实现内容**：
  - 在 RoundTimeline 内部，将 `parseAiMessages(aiMessages)` 调用替换为：
    ```typescript
    const rounds = useMemo(() => parseAiMessages(aiMessages), [aiMessages]);
    ```
  - 用 `React.memo` 包裹 RoundTimeline 组件导出，自定义比较函数：
    ```typescript
    export default React.memo(RoundTimeline, (prev, next) => {
      return prev.rounds === next.rounds;
    });
    ```
  - 确保父组件传递的 aiMessages 是引用稳定（useMemo 或 useCallback 保护）
- **测试用例**：
  - 用例 1：50 条 AI 消息时滚动、切换 → 无明显卡顿
  - 用例 2：其他无关 state 变化（如 input 聚焦）→ RoundTimeline 不重新渲染
  - 用例 3：新 AI 消息到达 → rounds 正确更新
- **依赖**：无

### Task 15：移动端响应式布局（对应 Plan 阶段3-步骤3.4）
- **操作类型**：修改
- **涉及文件**：
  - `chat-reply-trainer/src/App.tsx`（修改）
  - `chat-reply-trainer/src/index.css` 或 Tailwind 配置（修改）
- **实现内容**：
  - 使用 `window.matchMedia('(min-width: 768px)')` 或 CSS media query 检测屏幕宽度
  - `>= 768px`：保持现有左右分栏布局（70/30）
  - `< 768px`：
    - 隐藏左面板或右面板，改为 Tab 切换
    - 顶部新增 Tab 栏：`[聊天] [AI辅助]`
    - 当前 Tab 对应的面板 `display: block`，另一个 `display: none`
    - ChatHeader 简化（隐藏部分信息）
  - 回复选项弹窗（ReplyPopup）在移动端改为底部全屏弹出
  - 使用 useState 管理 activeTab 状态
- **测试用例**：
  - 用例 1：桌面端（>= 768px）→ 左右分栏布局不变
  - 用例 2：iPhone SE（375px）→ 显示 Tab 切换，默认显示聊天 Tab
  - 用例 3：切换到 AI 辅助 Tab → 显示 AI 分析面板
  - 用例 4：移动端点击回复选项 → 底部全屏弹出
- **依赖**：无

### Task 16：后端多模型客户端管理（对应 Plan 阶段4-步骤4.1）
- **操作类型**：修改
- **涉及文件**：
  - `chat-reply-server/src/llm.ts`（修改）
  - `chat-reply-server/.env`（修改）
- **实现内容**：
  - .env 新增配置：
    ```
    MIMO_API_KEY=xxx
    MIMO_BASE_URL=https://xxx.api.xiaomi.com/v1/
    MIMO_MODEL=MiMo-7B-RL
    ```
  - llm.ts 重构：
    - 定义 `MODEL_REGISTRY` 数组，每个元素含 provider / label / apiKeyEnv / baseUrlEnv / modelEnv
    - 实现 `getClient(provider: string): OpenAI` 函数，从 MODEL_REGISTRY 查找配置，懒初始化 OpenAI 客户端并缓存到 `clients` Record
    - 修改 `chatCompletion` 和 `chatCompletionStream` 接受 `provider` 参数（默认 "zhipu"），使用 `getClient(provider)` 获取客户端
    - 修改模型名获取：从 `process.env[config.modelEnv]` 读取
- **测试用例**：
  - 用例 1：getClient("zhipu") → 返回配置了 ZHIPU_API_KEY 的 OpenAI 客户端
  - 用例 2：getClient("mimo") → 返回配置了 MIMO_API_KEY 的 OpenAI 客户端
  - 用例 3：重复调用 getClient("zhipu") → 返回同一实例（缓存）
  - 用例 4：getClient("unknown") → 抛出错误 "未知的模型提供者"
- **依赖**：Task 3（LLM 重试机制）

### Task 17：GET /api/models 接口 + generate 支持 provider（对应 Plan 阶段4-步骤4.2、4.3）
- **操作类型**：修改
- **涉及文件**：
  - `chat-reply-server/src/routes/sessions.ts`（修改）
  - `chat-reply-server/src/index.ts`（修改）
- **实现内容**：
  - 新增 GET /api/models 路由：
    - 遍历 MODEL_REGISTRY，检查每个 provider 的 apiKeyEnv 对应环境变量是否存在
    - 返回 `{ models: [{ provider, label, model }] }`，仅包含已配置的模型
  - 修改 generate 路由（POST /api/sessions/:sessionId/generate）：
    - 从 request body 读取 `provider` 字段（可选，默认 "zhipu"）
    - 传递给 llm.ts 的 chatCompletionStream 函数
  - 在 index.ts 注册 GET /api/models 路由
- **测试用例**：
  - 用例 1：GET /api/models → 返回已配置的模型列表（如 zhipu + mimo）
  - 用例 2：未配置 MIMO_API_KEY → /api/models 不返回 mimo
  - 用例 3：POST generate { provider: "mimo" } → 使用 MiMo 模型生成回复
  - 用例 4：POST generate { provider: "unknown" } → 返回 400 错误
- **依赖**：Task 16

### Task 18：前端模型选择器 + 传递 provider（对应 Plan 阶段4-步骤4.4、4.5）
- **操作类型**：修改
- **涉及文件**：
  - `chat-reply-trainer/src/components/SessionBar.tsx`（修改）
  - `chat-reply-trainer/src/services/api.ts`（修改）
  - `chat-reply-trainer/src/hooks/useAppState.tsx`（修改）
  - `chat-reply-trainer/src/types.ts`（修改）
- **实现内容**：
  - types.ts：新增 `ModelOption { provider: string; label: string; model: string }` 类型
  - api.ts：新增 `getModels()` → GET /api/models
  - useAppState.tsx：新增 `selectedProvider` state（默认 "zhipu"），页面加载时调用 getModels 获取可用模型列表
  - SessionBar.tsx：在顶部工具栏新增 antd Select 组件，options 从模型列表生成
  - AI 生成调用时将 `selectedProvider` 作为 provider 参数传递
- **测试用例**：
  - 用例 1：页面加载 → 模型选择器显示已配置的模型
  - 用例 2：切换模型 → selectedProvider 更新
  - 用例 3：点击 AI 生成 → 请求中包含选中的 provider 参数
  - 用例 4：只有一个模型时 → 选择器仍显示，但只有一个选项
- **依赖**：Task 17

## 变更记录

| 日期 | 作者 | 变更内容 |
|------|------|---------|
| 2026-05-29 | yuanchuang | 初始版本 |
