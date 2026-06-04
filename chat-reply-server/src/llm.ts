import OpenAI from 'openai';

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

export function getAvailableModels(): { provider: string; label: string; model: string }[] {
  return MODEL_REGISTRY
    .filter(m => !!process.env[m.apiKeyEnv])
    .map(m => ({ provider: m.provider, label: m.label, model: process.env[m.modelEnv] || '' }));
}

export async function chatCompletion(messages: Array<{ role: string; content: string }>, provider: string = 'zhipu', maxTokens = 16384): Promise<string> {
  const response = await getClient(provider).chat.completions.create({
    model: getModel(provider),
    messages: messages as any,
    temperature: 0.8,
    max_tokens: maxTokens,
  });
  return response.choices[0].message.content || '';
}

export async function* chatCompletionStream(messages: Array<{ role: string; content: string }>, provider: string = 'zhipu', maxRetries = 1, maxTokens = 16384): AsyncGenerator<string> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const stream = await getClient(provider).chat.completions.create({
        model: getModel(provider),
        messages: messages as any,
        temperature: 0.8,
        max_tokens: maxTokens,
        stream: true,
      });
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) yield delta;
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
