import OpenAI from 'openai';
import { estimateTokens } from './db';

interface ModelConfig {
  provider: string;
  label: string;
  apiKeyEnv: string;
  baseUrlEnv: string;
  modelEnv: string;
}

const MODEL_REGISTRY: ModelConfig[] = [
  { provider: 'zhipu', label: '智谱 GLM', apiKeyEnv: 'ZHIPU_API_KEY', baseUrlEnv: 'ZHIPU_BASE_URL', modelEnv: 'ZHIPU_MODEL' },
  { provider: 'mimo', label: '小米 MiMo', apiKeyEnv: 'MIMO_API_KEY', baseUrlEnv: 'MIMO_BASE_URL', modelEnv: 'MIMO_MODEL' },
];

const clients: Record<string, OpenAI> = {};

function getClient(provider: string = 'zhipu'): OpenAI {
  if (clients[provider]) return clients[provider];
  const config = MODEL_REGISTRY.find(m => m.provider === provider);
  if (!config) throw new Error(`未知的模型提供者: ${provider}`);

  const apiKey = process.env[config.apiKeyEnv];
  if (!apiKey) throw new Error(`当前AI模型（${config.label}）未配置，请切换其他模型或联系管理员`);

  const baseURL = process.env[config.baseUrlEnv] || (provider === 'zhipu' ? 'https://open.bigmodel.cn/api/paas/v4/' : undefined);
  clients[provider] = new OpenAI({ apiKey, ...(baseURL && { baseURL }) });
  return clients[provider];
}

function getModel(provider: string = 'zhipu'): string {
  const config = MODEL_REGISTRY.find(m => m.provider === provider);
  if (!config) return 'glm-5.1';
  return process.env[config.modelEnv] || 'glm-5.1';
}

/** 供埋点记录使用：返回某 provider 当前实际使用的模型名 */
export function getProviderModel(provider: string = 'zhipu'): string {
  return getModel(provider);
}

export function getAvailableModels(): { provider: string; label: string; model: string }[] {
  return MODEL_REGISTRY
    .filter(m => !!process.env[m.apiKeyEnv])
    .map(m => ({ provider: m.provider, label: m.label, model: process.env[m.modelEnv] || '' }));
}

/** 单次调用的 token 消耗；estimated=true 表示 API 未返回 usage、由字节数估算 */
export interface LLMUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  estimated: boolean;
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

export async function chatCompletion(messages: Array<{ role: string; content: string }>, provider: string = 'zhipu', maxTokens = 16384, maxRetries = 1): Promise<ChatResult> {
  let lastError: Error | null = null;
  const inputText = messages.map(m => m.content).join('');
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await getClient(provider).chat.completions.create({
        model: getModel(provider),
        messages: messages as any,
        temperature: 0.8,
        max_tokens: maxTokens,
      });
      const content = response.choices[0].message.content || '';
      const usage = usageFromResponse((response as any).usage, inputText, content);
      return { content, usage };
    } catch (err: any) {
      lastError = err;
      if (err.message?.includes('未配置') || err.message?.includes('未知的模型提供者')) {
        throw err;
      }
      if (attempt < maxRetries) {
        console.log(`[LLM] Non-stream attempt ${attempt + 1} failed, retrying...`, err.message);
      }
    }
  }
  throw lastError || new Error('LLM 非流式调用失败');
}

export async function* chatCompletionStream(
  messages: Array<{ role: string; content: string }>,
  provider: string = 'zhipu',
  maxRetries = 1,
  maxTokens = 16384,
  onUsage?: (u: LLMUsage) => void,
): AsyncGenerator<string> {
  let lastError: Error | null = null;
  const inputText = messages.map(m => m.content).join('');
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const stream = await getClient(provider).chat.completions.create({
        model: getModel(provider),
        messages: messages as any,
        temperature: 0.8,
        max_tokens: maxTokens,
        stream: true,
        stream_options: { include_usage: true },
      } as any);
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
      return;
    } catch (err: any) {
      lastError = err;
      // 配置错误直接抛出，不降级返回假数据
      if (err.message?.includes('未配置') || err.message?.includes('未知的模型提供者')) {
        throw err;
      }
      if (attempt < maxRetries) {
        console.log(`[LLM] Stream attempt ${attempt + 1} failed, retrying...`, err.message);
      }
    }
  }
  console.error('[LLM] All stream attempts failed:', lastError?.message);
  const fallback = JSON.stringify({
    analysis: {
      stage: '分析中', signal: '模糊', strategy: '安全回复',
      signalText: 'AI 服务暂时不可用，已降级处理', emotions: [],
      tip: '建议重新生成', favorability: 50, favorabilityReason: '',
    },
    plan: { goal: '维持当前关系', nextStep: '继续对话' },
    replies: [{ id: 1, strategy: '安全回复', text: '嗯嗯，确实', reason: '降级兜底回复' }],
  });
  yield fallback;
}
