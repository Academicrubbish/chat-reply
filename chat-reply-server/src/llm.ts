import OpenAI from 'openai';

const MODEL = process.env.ZHIPU_MODEL || 'glm-5.1';

let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!_client) {
    const apiKey = process.env.ZHIPU_API_KEY;
    if (!apiKey) {
      throw new Error('ZHIPU_API_KEY 未配置，请在 .env 文件中设置');
    }
    _client = new OpenAI({
      apiKey,
      baseURL: process.env.ZHIPU_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4/',
    });
  }
  return _client;
}

export async function chatCompletion(messages: Array<{ role: string; content: string }>): Promise<string> {
  const response = await getClient().chat.completions.create({
    model: MODEL,
    messages: messages as any,
    temperature: 0.8,
    max_tokens: 4096,
  });
  return response.choices[0].message.content || '';
}

export async function* chatCompletionStream(messages: Array<{ role: string; content: string }>): AsyncGenerator<string> {
  const stream = await getClient().chat.completions.create({
    model: MODEL,
    messages: messages as any,
    temperature: 0.8,
    max_tokens: 4096,
    stream: true,
  });
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) yield delta;
  }
}
