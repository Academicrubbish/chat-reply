# AI 响应速度优化方案

> 针对聊天回复训练器（chat-reply）项目的 AI 生成速度优化，涵盖服务端 Prompt 构建、LLM API 调用、前端体验三个层面。

---

## 一、现状瓶颈分析

### 1.1 请求生命周期

```
用户点击生成
  → [DB查询×4次] 串行执行（target / session / messages / ai_messages）
  → [Prompt构建] 每次重新遍历23个知识单元 + 格式化
  → [LLM API调用] 全量 system prompt 冷启动，无缓存
  → [流式返回] SSE delta 逐步推送
  → [JSON解析] 多轮 fallback（```json包裹、中文引号、截断修复）
```

### 1.2 主要延迟来源

| 环节 | 问题 | 影响 |
|---|---|---|
| Prompt 构建 | 每次请求遍历 23 个知识单元，`formatKnowledgeSection` 重新格式化 | ~5-10ms 服务端 CPU |
| LLM 输入 | full mode system prompt 约 3000-5000 tokens，每次冷启动 | **TTFT 3-8s**（最大瓶颈） |
| 知识注入 | 注入全部 23 个知识单元，实际只用 2-4 个 | 输入 token 浪费 60-70% |
| Regenerate | full mode 用非流式 `chatCompletion`，用户干等 | 体感延迟 = 完整生成时间 |
| 多轮对话 | 所有历史 ai_messages 全部塞入，随轮次线性增长 | 第 10 轮 token 翻倍 |
| DB 查询 | 多次 prepare.all 串行执行 | ~30-50ms |
| JSON 解析 | 模型偶尔返回 markdown 包裹/中文引号/截断 | 多轮 fallback 增加 CPU |

### 1.3 关键指标

- **Quick mode**: system prompt ~1500 tokens, 期望 < 3s
- **Full mode**: system prompt ~4000 tokens, 期望 < 5s
- **Regenerate**: 当前非流式，体感 > 8s

---

## 二、优化方案

### 🔴 第一优先级（ROI 最高，改动最小）

#### P1-1: System Prompt 静态部分缓存

**文件**: `src/prompt.ts`
**原理**: 知识体系（23个单元）+ 红线规则在部署后不变，启动时预计算为字符串，运行时只拼接动态上下文。
**预估收益**: 服务端 CPU ~5-10ms → ~0.1ms；为 API Prompt Caching 提供稳定前缀。

```
优化前: getUnitsForMode() → formatKnowledgeSection() → formatUnitForPrompt() ×23 → 拼接
优化后: cachedStaticPrefix[mode] + buildDynamicContext(params) → 直接拼接
```

#### P1-2: API Prompt Caching（拆分 system message）

**文件**: `src/llm.ts`, `src/index.ts`
**原理**: 将 system prompt 拆分为「静态知识」（永远不变）+「动态上下文」（每次变化）两条 system message。静态部分会被 LLM API 服务端缓存，后续请求直接命中缓存，跳过 prefill 计算。

```typescript
// 优化前
messages = [
  { role: 'system', content: '完整的4000 token prompt' },  // 每次冷启动
  { role: 'user', content: '对方最新消息：...' }
]

// 优化后
messages = [
  { role: 'system', content: cachedStaticKnowledge },  // ← API缓存命中
  { role: 'system', content: dynamicContext },           // 每次不同
  { role: 'user', content: '对方最新消息：...' }
]
```

**预估收益**: TTFT 降低 50-70%（静态 ~3000 tokens 跳过 prefill）。

#### P1-3: Regenerate 端点改为流式 SSE

**文件**: `src/index.ts` regenerate handler
**原理**: 当前 full mode regenerate 使用 `chatCompletion`（非流式），用户等待完整 JSON 生成。改为与 generate 一致的 SSE 流式推送。

**预估收益**: 体感延迟从 "等待完整生成" 降为 "逐步看到内容"。

---

### 🟡 第二优先级（效果明显，改动适中）

#### P2-1: 知识单元按需注入

**文件**: `src/prompt.ts`
**原理**: 先基于对方消息的关键词匹配相关触发条件（triggers.languageSignals），只注入命中的知识单元 + 核心框架（F01、F03）。
**预估收益**: 输入 token 减少 60-70%（4000 → 1500），TTFT 减半。

#### P2-2: DB 查询优化

**文件**: `src/index.ts`
**原理**: target 查询可提前复用 session 结果中的 target_id，减少一次查询；消息查询只查必要的字段。
**预估收益**: ~20-30ms。

#### P2-3: Quick Mode 知识预计算

**文件**: `src/prompt.ts`
**原理**: Quick mode 的 9 个知识单元在启动时预计算为固定文本（查表字符串），不再每次格式化。
**预估收益**: 减少 prompt 构建时间 + 输入 token 40%。

---

### 🟢 第三优先级（锦上添花）

#### P3-1: 前端预请求

**文件**: `chat-reply-trainer/src/hooks/useAppState.tsx`
**原理**: 发送 her message 后立即后台预构建 prompt / 预加载 target 数据，不等用户点击 AI 按钮。
**预估收益**: 体感提速 1-2s。

#### P3-2: 多轮对话上下文滑动窗口

**文件**: `src/index.ts`
**原理**: 限制历史 ai_messages 为最近 5 轮（10 条），更早的摘要化。
**预估收益**: 第 10 轮后 token 减少 50%+。

#### P3-3: JSON 输出约束强化

**文件**: `src/prompt.ts`
**原理**: 在 prompt 中更强调 "只返回纯JSON"，或启用智谱 API 的 JSON mode。
**预估收益**: 减少无效 token 10%，降低解析失败率。

---

## 三、实施计划

### Phase 1（预计 1-2 小时）

| 任务 | 文件 | 改动量 |
|---|---|---|
| Prompt 静态缓存 + 拆分 system message | `prompt.ts` | 新增缓存函数，重构 build 函数 |
| API Prompt Caching 适配 | `llm.ts`, `index.ts` | 消息结构拆分 |
| Regenerate 改流式 | `index.ts` | 复用 generate 的 SSE 逻辑 |
| 前端 Regenerate 流式适配 | `useAppState.tsx`, `api.ts` | 新增 SSE 处理 |

### Phase 2（预计半天）

| 任务 | 文件 | 改动量 |
|---|---|---|
| 知识按需注入 | `prompt.ts` | 新增 selectRelevantUnits |
| DB 查询优化 | `index.ts` | 重构查询逻辑 |
| Quick 知识预计算 | `prompt.ts` | 启动时生成固定文本 |

### Phase 3（可选）

- 前端预请求
- 上下文滑动窗口
- JSON 约束强化

---

## 四、预期效果

| 指标 | 优化前 | Phase 1 后 | Phase 2 后 |
|---|---|---|---|
| Quick mode TTFT | ~3s | **~1.5s** | **~1s** |
| Full mode TTFT | ~5-8s | **~2-3s** | **~1.5-2s** |
| Regenerate 体感 | 等完整生成 | **逐步展示** | **逐步展示** |
| 输入 token (full) | ~4000 | ~4000 | **~1500** |
| 服务端 Prompt 构建 | ~10ms | **~0.1ms** | **~0.1ms** |

---

## 五、风险与注意事项

1. **Prompt Caching 兼容性**: 智谱 GLM 和小米 MiMo 的 API 是否支持多 system message + 缓存需要实测验证。如果不支持，退化为单 system message 但仍享受本地缓存收益。
2. **JSON 解析稳定性**: 拆分 system message 后模型输出格式可能微调，需要测试 `parseJsonSafely` 的兼容性。
3. **Regenerate 流式化**: 前端需要同步修改以支持 SSE 事件流，当前 regenerate 是直接返回 JSON。
4. **知识按需注入**: 关键词匹配可能遗漏，需要保底机制（至少保留核心框架）。
