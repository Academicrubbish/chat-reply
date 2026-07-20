import OpenAI from 'openai';

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

export async function chatCompletion(messages: Array<{ role: string; content: string }>, maxTokens = 16384, maxRetries = 1): Promise<string> {
  const response = await withRetry(() => getClient().chat.completions.create({
    model: getModel(),
    messages: messages as any,
    temperature: 0.8,
    max_tokens: maxTokens,
  }), maxRetries, '非流式');
  return response.choices[0].message.content || '';
}

export async function* chatCompletionStream(messages: Array<{ role: string; content: string }>, maxRetries = 1, maxTokens = 16384): AsyncGenerator<string> {
  // 欠费错误会在 withRetry 内抛出，由调用方（SSE 端点）捕获并下发 error 事件。
  const stream = await withRetry(() => getClient().chat.completions.create({
    model: getModel(),
    messages: messages as any,
    temperature: 0.8,
    max_tokens: maxTokens,
    stream: true,
  }), maxRetries, '流式');

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) yield delta;
  }
}
