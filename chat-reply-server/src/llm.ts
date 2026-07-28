import OpenAI from 'openai';
import { estimateTokens } from './db';

// ===== 单一模型：智谱 GLM =====
// 之前支持多 provider（zhipu / mimo），现已精简为仅 GLM。

const DEFAULT_BASE_URL = 'https://open.bigmodel.cn/api/paas/v4/';
const DEFAULT_MODEL = 'glm-5.1';

const BILLING_MESSAGE = '模型已欠费，请联系管理员';

/** 模型欠费/余额不足错误 —— 不重试、不降级，直接抛给用户。 */
export class LLMBillingError extends Error {
  constructor(message: string = BILLING_MESSAGE) {
    super(message);
    this.name = 'LLMBillingError';
  }
}

export function isLLMBillingError(err: any): boolean {
  return err?.name === 'LLMBillingError';
}

/** 识别智谱欠费/余额不足：错误码 1113（HTTP 429「您的账户已欠费」）或消息命中关键词。 */
function detectBillingError(err: any): boolean {
  if (!err) return false;
  const code = String(err?.error?.code ?? err?.code ?? '');
  const msg = String(err?.message ?? err?.error?.message ?? '');
  // 智谱「账户已欠费」专属业务错误码（参考 https://docs.bigmodel.cn/cn/api/api-code）
  if (code === '1113') return true;
  // 兜底：消息命中欠费/余额关键词（覆盖 1316-1321 等「余额不足」类错误）
  return /欠费|余额不足|账户余额|请充值|insufficient.{0,8}balance/i.test(msg);
}

let cachedClient: OpenAI | null = null;

function getClient(): OpenAI {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.ZHIPU_API_KEY;
  if (!apiKey) throw new Error('AI 模型（智谱 GLM）未配置 API Key，请联系管理员');
  const baseURL = process.env.ZHIPU_BASE_URL || DEFAULT_BASE_URL;
  cachedClient = new OpenAI({ apiKey, baseURL });
  return cachedClient;
}

function getModel(): string {
  return process.env.ZHIPU_MODEL || DEFAULT_MODEL;
}

/** 供用量监控埋点使用：当前实际模型名 */
export function getCurrentModel(): string {
  return getModel();
}

/** 欠费错误立即抛出；配置错误立即抛出；其余错误按 maxRetries 重试。 */
async function withRetry<T>(op: () => Promise<T>, maxRetries: number, tag: string): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await op();
    } catch (err: any) {
      // 欠费 / 配置错误：不可恢复，直接抛出，不重试、不降级
      if (detectBillingError(err)) throw new LLMBillingError();
      if (err.message?.includes('未配置')) throw err;
      lastError = err;
      if (attempt < maxRetries) {
        console.log(`[LLM] ${tag} attempt ${attempt + 1} failed, retrying...`, err.message);
      }
    }
  }
  throw lastError || new Error(`LLM ${tag} 调用失败`);
}

// ===== Token 用量监控 =====
export interface LLMUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  estimated: boolean;   // true=API 未返回 usage、由字节数估算
}
export interface ChatResult {
  content: string;
  usage: LLMUsage;
}

/** 优先取 API 返回的真实 usage，否则用字节数估算兜底 */
function usageFromResponse(u: any, fallbackPromptText: string, fallbackCompletionText: string): LLMUsage {
  if (u && typeof u.total_tokens === 'number') {
    return {
      prompt_tokens: u.prompt_tokens || 0,
      completion_tokens: u.completion_tokens || 0,
      total_tokens: u.total_tokens,
      estimated: false,
    };
  }
  const pt = estimateTokens(fallbackPromptText);
  const ct = estimateTokens(fallbackCompletionText);
  return { prompt_tokens: pt, completion_tokens: ct, total_tokens: pt + ct, estimated: true };
}

export async function chatCompletion(messages: Array<{ role: string; content: string }>, maxTokens = 16384, maxRetries = 1): Promise<ChatResult> {
  const inputText = messages.map(m => m.content).join('');
  const response = await withRetry(() => getClient().chat.completions.create({
    model: getModel(),
    messages: messages as any,
    temperature: 0.8,
    max_tokens: maxTokens,
  }), maxRetries, '非流式');
  const content = response.choices[0].message.content || '';
  const usage = usageFromResponse((response as any).usage, inputText, content);
  return { content, usage };
}

export async function* chatCompletionStream(
  messages: Array<{ role: string; content: string }>,
  maxRetries = 1,
  maxTokens = 16384,
  onUsage?: (u: LLMUsage) => void,
): AsyncGenerator<string> {
  const inputText = messages.map(m => m.content).join('');
  // 欠费错误会在 withRetry 内抛出，由调用方（SSE 端点）捕获并下发 error 事件。
  const stream = await withRetry(() => getClient().chat.completions.create({
    model: getModel(),
    messages: messages as any,
    temperature: 0.8,
    max_tokens: maxTokens,
    stream: true,
    stream_options: { include_usage: true },
  }), maxRetries, '流式');

  let usageReported = false;
  let collected = '';
  for await (const chunk of stream as any) {
    // usage 通常出现在最后一个 chunk（此时 choices 为空数组）
    if (chunk.usage) {
      // token 采集是旁路：回调/计算任何异常都不得中断主流式生成
      try { onUsage?.(usageFromResponse(chunk.usage, inputText, collected)); usageReported = true; } catch {}
    }
    const delta = chunk.choices?.[0]?.delta?.content;
    if (delta) { collected += delta; yield delta; }
  }
  // 流正常结束但 provider 未返回 usage → 估算兜底，保证调用方一定拿到 usage
  if (!usageReported) {
    try { onUsage?.(usageFromResponse(null, inputText, collected)); } catch {}
  }
}
