---
title: Chat Reply Trainer V2
status: draft
created: 2026-05-28
updated: 2026-05-28
author: yuanchuang
---

# Chat Reply Trainer V2 Spec

## 背景

V1 已完成核心聊天回复训练功能（聊天对象管理、消息发送、AI 回复生成、好感度追踪、流式生成、场景消息）。V2 在此基础上聚焦四个方向：安全加固（CORS、Error Boundary、JSON 解析兜底）、用户认证（登录页 + JWT）、体验优化（引导页、移动端适配、删除确认、性能优化）、功能扩展（多模型切换）。

当前系统存在以下问题：
- 无认证机制，任何可访问端口的人都能操作
- AI 返回的 JSON 格式不稳定（markdown 包裹、截断、非法字符），导致前端白屏
- 桌面端固定 70/30 布局，手机上无法使用
- 删除操作无二次确认，误触风险高
- 仅支持单一 LLM 模型

## 目标

1. 加固系统安全性和稳定性，消除白屏、无认证、无请求限制等风险
2. 完善用户体验，覆盖首次使用引导、移动端操作、删除防误触等场景
3. 支持多 LLM 模型切换，降低单一模型依赖风险

## 功能描述

### Phase 1：安全加固

- CORS 限制：仅允许本地访问来源（localhost:5173/5174、127.0.0.1:5173），配置 credentials 支持
- 请求体大小限制：单条消息不超过 100KB（express.json limit）
- API 限流：每分钟 100 次请求（express-rate-limit）
- React Error Boundary：全局错误边界 + 关键子组件（RoundTimeline、ChatHistory）独立错误边界，捕获渲染异常并展示友好错误页面（重试按钮 + 可展开的错误详情）
- JSON 解析增强 + 兜底：剥离 markdown 代码块包装、剔除中文引号、自动补全截断 JSON（补括号补引号）、多轮 fallback（正则提取 → 修复 → 逐字符扫描）、最终兜底返回安全回复结构体
- LLM 调用重试：失败自动重试 1 次（同参数），重试失败再返回兜底

### Phase 2：登录认证

- 后端 users 表：id（TEXT PK）、username（TEXT UNIQUE）、password_hash（bcrypt）、created_at（INTEGER）
- 认证 API：POST /api/auth/setup（首次初始化，仅当无用户时可调）、POST /api/auth/login（登录返回 JWT）、GET /api/auth/status（检查是否已初始化）、POST /api/auth/logout（登出）
- JWT 中间件：所有 /api/* 路由（除 /api/auth/*）需校验 JWT Token
- 依赖：bcryptjs（密码哈希）、jsonwebtoken（JWT 签发/验证）
- 登录页：居中卡片布局（Logo + 标题 + 用户名/密码输入框 + 登录按钮）、loading 状态、错误提示（密码错误、网络异常）
- 初始化页：首次访问时展示「创建管理员账号」表单（用户名 + 密码 + 确认密码），创建成功后自动登录
- 路由守卫：未登录 → 跳转登录页；已登录 → 跳转主页；Token 存 localStorage，每次请求自动带 Authorization: Bearer <token>

### Phase 3：体验优化

- 引导页：当无聊天对象时显示 3 步引导（创建聊天对象 → 输入消息 → AI 辅助），带图标和「开始使用」按钮，创建对象后自动消失
- 移动端适配：>= 768px 保持左右分栏，< 768px 改为 Tab 切换布局（聊天 / AI辅助），回复选项弹窗改为底部全屏弹出
- 删除二次确认：聊天消息删除 → Popconfirm 气泡确认；聊天对象删除 → Modal 确认（提示不可恢复）；使用 antd Popconfirm 或 Modal.confirm
- RoundTimeline memoization：useMemo 缓存 parseAiMessages 解析结果，React.memo 包裹组件避免无关 state 变化重渲染

### Phase 4：多模型切换

- .env 多模型配置：ZHIPU_API_KEY / ZHIPU_BASE_URL / ZHIPU_MODEL、MIMO_API_KEY / MIMO_BASE_URL / MIMO_MODEL
- 后端多模型客户端管理：llm.ts 改为 Record<string, OpenAI> 客户端池，按 provider 读取对应配置
- generate 接口支持 provider 参数（默认 zhipu）
- 前端模型选择器：SessionBar 或 ContextBar 中新增 Select 下拉，AI 生成时传选中模型给后端
- 模型列表接口：GET /api/models 返回已配置的可用模型

## 边界条件

- 认证边界：setup 接口仅在 users 表为空时可调用，已初始化后返回 403
- JWT 过期：Token 过期后前端自动跳转登录页，清除 localStorage
- JSON 兜底边界：所有解析都失败时返回固定安全回复结构体，不抛异常不白屏
- Error Boundary 边界：仅捕获渲染阶段异常，不捕获事件处理、异步代码、服务端渲染中的错误
- 移动端边界：768px 为断点，Tab 切换不保留滚动位置
- CORS 边界：生产环境需根据部署域名调整 origin 配置
- 多模型边界：未配置的模型不返回在 /api/models 列表中，前端选择后传给后端校验

## 验收标准

| 需求 | 验收方式 |
|------|---------|
| 登录认证 | 未登录访问任何页面都跳转登录页；登录后可正常使用；刷新页面不丢失登录状态 |
| 引导页 | 删除所有聊天对象后显示引导页；创建对象后引导页消失 |
| JSON 解析 | AI 返回带 markdown 包裹 / 截断 / 乱码的 JSON 都能降级处理，不会白屏 |
| Error Boundary | 故意在组件内 throw Error，页面显示错误提示而非白屏 |
| 移动端 | iPhone SE 尺寸下可正常操作（Tab 切换聊天/AI） |
| 删除确认 | 删除消息/对象都有弹窗确认 |
| Memoization | 50+ 条 AI 消息时界面无明显卡顿 |
| CORS + 限流 | 外部域名请求被拒绝；超大请求体被拒绝 |
| 多模型 | 前端可切换 GLM/MiMo，切换后 AI 回复使用对应模型 |

## 关联信息

- 需求来源：docs/v2-需求文档.md
- 依赖：bcryptjs、jsonwebtoken、express-rate-limit（后端）
- 关联 spec：无

## 变更记录

| 日期 | 作者 | 变更内容 |
|------|------|---------|
| 2026-05-28 | yuanchuang | 初始版本 |
