import 'dotenv/config';

import { DeepSeekProvider } from '../server/modules/ai-tools/llm/deepseek.provider';

async function main(): Promise<void> {
  if (!process.env.DEEPSEEK_API_KEY?.trim()) {
    console.log('Skipped: DEEPSEEK_API_KEY is not configured');
    return;
  }

  const startedAt = Date.now();
  try {
    const result = await new DeepSeekProvider().generate({
      messages: [
        {
          role: 'system',
          content: '你是一个简洁的 API 连通性测试助手，只返回合法 JSON。',
        },
        {
          role: 'user',
          content: '请返回 {"ok":true}，不要输出其他内容。',
        },
      ],
      jsonMode: true,
      thinking: false,
      maxTokens: 40,
    });
    const latency = Date.now() - startedAt;
    console.log(JSON.stringify({
      success: true,
      model: result.model,
      usage: result.usage,
      latencyMs: latency,
      content: result.content,
    }, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'DeepSeek smoke test failed');
    process.exitCode = 1;
  }
}

void main();
