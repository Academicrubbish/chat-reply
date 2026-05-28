---
title: Chat Reply Trainer V2 Plan
design: ./design.md
status: draft
created: 2026-05-29
updated: 2026-05-29
author: yuanchuang
---

# Chat Reply Trainer V2 Plan

## 需求简述

V2 包含 9 个需求，分为安全加固、登录认证、体验优化、多模型切换四个方向。目标是消除系统安全风险、完善用户体验、支持多 LLM 模型。

## 前置条件

- V1 功能正常运行（聊天对象管理、消息收发、AI 回复生成）
- Node.js >= 18 运行环境
- 后端依赖已安装（chat-reply-server/node_modules）
- 前端依赖已安装（chat-reply-trainer/node_modules）
- 至少一个 LLM 模型的 API Key 已配置（ZHIPU_API_KEY）

## 实施阶段

### 阶段 1：安全加固
**目标**：加固后端请求安全（CORS/限流/请求体限制），增强系统稳定性（JSON 兜底/Error Boundary）
**为什么先做这个**：安全是基础设施，后续所有功能（认证、AI 生成）都依赖安全的请求管道；稳定性改进确保后续开发不会因 JSON 解析错误而中断

- 步骤 1.1：配置 CORS 白名单 + express.json 请求体限制 + express-rate-limit 限流
- 步骤 1.2：实现 JSON 多轮 fallback 解析链 + 兜底安全回复结构
- 步骤 1.3：实现 LLM 调用失败自动重试（1 次）
- 步骤 1.4：前端创建 ErrorBoundary 组件（全局 + 局部）
- 步骤 1.5：在 App.tsx 和关键子组件包裹 ErrorBoundary

**验证点**：
- 外部域名请求被 CORS 拒绝（curl 验证）
- 超过 100KB 的请求体返回 413
- 每分钟超过 100 次请求返回 429
- AI 返回非法 JSON 时前端显示兜底回复，不白屏
- 故意在组件 throw Error，页面显示错误提示而非白屏

### 阶段 2：登录认证
**目标**：实现完整的用户认证体系（JWT），保护所有 API 端点
**为什么先做这个**：认证是安全核心，依赖阶段 1 的 CORS 基础设施；认证完成后才能安全地暴露功能给外部

- 步骤 2.1：新增 users 表 + bcrypt 密码哈希
- 步骤 2.2：实现认证 API（setup/login/status/logout）
- 步骤 2.3：实现 JWT 中间件，保护所有 /api/* 路由
- 步骤 2.4：前端实现初始化页（首次创建管理员）
- 步骤 2.5：前端实现登录页
- 步骤 2.6：前端实现路由守卫 + Token 管理（localStorage + 请求拦截）

**验证点**：
- 无 Token 访问 /api/targets 返回 401
- POST /api/auth/setup 成功创建管理员并返回 JWT
- 已初始化后再次调用 setup 返回 403
- 登录成功后 JWT 存入 localStorage，后续请求自动带 Authorization header
- Token 过期后自动跳转登录页
- 刷新页面不丢失登录状态

### 阶段 3：体验优化
**目标**：完善用户体验，覆盖首次引导、移动端、删除防误触、性能优化
**为什么先做这个**：纯前端改动，依赖阶段 2 的认证体系（需在登录后生效）；可并行开发

- 步骤 3.1：实现删除操作二次确认（消息 Popconfirm + 对象 Modal.confirm）
- 步骤 3.2：实现首次使用引导页（无聊天对象时展示）
- 步骤 3.3：RoundTimeline memoization（useMemo + React.memo）
- 步骤 3.4：移动端响应式布局（768px 断点 + Tab 切换）

**验证点**：
- 删除消息前显示 Popconfirm 确认气泡
- 删除聊天对象前显示 Modal 确认弹窗
- 无聊天对象时显示引导页，创建对象后自动消失
- 50+ 条 AI 消息时 RoundTimeline 无明显卡顿
- iPhone SE 尺寸下 Tab 切换正常，聊天和 AI 辅助面板可正常操作

### 阶段 4：多模型切换
**目标**：支持多 LLM 模型切换，用户可在前端选择 GLM 或 MiMo
**为什么先做这个**：功能扩展优先级最低，依赖阶段 1 的 LLM 重试和 JSON 兜底机制

- 步骤 4.1：后端重构 llm.ts 为多模型客户端管理（MODEL_REGISTRY + 懒初始化）
- 步骤 4.2：后端新增 GET /api/models 接口，返回已配置的可用模型
- 步骤 4.3：generate 接口支持 provider 参数
- 步骤 4.4：前端 SessionBar 新增模型选择器（Select 下拉）
- 步骤 4.5：前端 AI 生成时传 provider 参数

**验证点**：
- GET /api/models 返回已配置的模型列表（未配置的不返回）
- 前端模型选择器展示可用模型
- 切换模型后 AI 回复使用对应模型生成
- 使用未配置的模型返回错误提示

## 并行策略

- 阶段 1 中：步骤 1.1-1.3（后端安全）和步骤 1.4-1.5（前端 ErrorBoundary）可并行
- 阶段 2 中：步骤 2.1-2.3（后端认证）和步骤 2.4-2.5（前端页面）可部分并行（前端页面可先开发，用 mock 数据）
- 阶段 3 中：步骤 3.1-3.4 互相独立，可并行
- 阶段 4 中：步骤 4.1-4.3（后端）和步骤 4.4-4.5（前端）可部分并行

## 风险与应对

| 风险 | 影响阶段 | 应对方案 |
|------|---------|---------|
| bcryptjs 在 Windows 上编译失败 | 阶段 2 | bcryptjs 是纯 JS 实现，无需原生编译；如果遇到问题，确认使用的是 bcryptjs 而非 bcrypt |
| JWT Secret 泄露 | 阶段 2 | 使用 .env 存储 JWT_SECRET，不提交到 git；添加 .gitignore 规则 |
| 多模型 API 响应格式不一致 | 阶段 4 | 使用 OpenAI 兼容接口统一调用方式；JSON 兜底链已覆盖格式异常 |
| 移动端布局在特定设备异常 | 阶段 3 | 使用 antd 的响应式断点；在 Chrome DevTools 模拟 iPhone SE 验证 |
| SSE 流式中断导致状态不一致 | 阶段 1 | 重试机制 + 兜底回复确保前端始终有数据可渲染 |

## 变更记录

| 日期 | 作者 | 变更内容 |
|------|------|---------|
| 2026-05-29 | yuanchuang | 初始版本 |
