import { LlmService } from '../llm/llm.service';
import {
  TopicGenerationGenerator,
  type TopicGenerationInput,
} from './topic-generation.generator';

describe('TopicGenerationGenerator', () => {
  const input: TopicGenerationInput = {
    field: '教育学',
    educationLevel: '硕士',
    researchDirection: '高校人工智能素养教育',
    count: 2,
  };

  const validJson = JSON.stringify({
    topics: [
      {
        title: '高校人工智能素养教育评价框架构建研究',
        researchDirection: '教育学 / 人工智能素养教育',
        innovation: '构建面向高校学生的人工智能素养评价框架',
        difficulty: '中等',
        keyIdeas: ['界定核心概念', '设计评价维度'],
      },
      {
        title: '高校人工智能素养教育的影响因素研究',
        researchDirection: '教育学 / 人工智能素养教育',
        innovation: '分析课程、教师与学习环境等因素的作用',
        difficulty: '较难',
        keyIdeas: ['提出研究假设', '设计调查工具'],
      },
    ],
  });

  const createLlmService = () => ({
    generate: jest.fn().mockResolvedValue({
      content: validJson,
      provider: 'fake-generation',
      model: 'deepseek-v4-flash',
      usage: { promptTokens: 100, completionTokens: 80, totalTokens: 180 },
    }),
  });

  it('maps user fields into a professional prompt without placeholder values', async () => {
    const llmService = createLlmService();
    const result = await new TopicGenerationGenerator(llmService as unknown as LlmService).generate(input);
    const request = llmService.generate.mock.calls[0][0];
    const userPrompt = request.messages.find((message: { role: string }) => message.role === 'user')?.content;

    expect(userPrompt).toContain('专业领域：教育学');
    expect(userPrompt).toContain('学历层次：硕士');
    expect(userPrompt).toContain('研究方向：高校人工智能素养教育');
    expect(userPrompt).not.toContain('undefined');
    expect(userPrompt).not.toContain('null');
    expect(userPrompt).not.toContain('[object Object]');
    expect(request.jsonMode).toBe(true);
    expect(request).not.toHaveProperty('thinking');
    expect(result.resultData).toEqual(JSON.parse(validJson));
    expect(result.metadata).toEqual({
      provider: 'fake-generation',
      model: 'deepseek-v4-flash',
      usage: { promptTokens: 100, completionTokens: 80, totalTokens: 180 },
      generationTimeMs: expect.any(Number),
    });
  });

  it('retries once when the model returns invalid structured output', async () => {
    const llmService = createLlmService();
    llmService.generate
      .mockResolvedValueOnce({ content: 'not json', model: 'deepseek-v4-flash' })
      .mockResolvedValueOnce({ content: validJson, model: 'deepseek-v4-flash' });

    const result = await new TopicGenerationGenerator(llmService as unknown as LlmService).generate(input);

    expect(llmService.generate).toHaveBeenCalledTimes(2);
    expect(llmService.generate.mock.calls[1][0].messages.at(-1).content).toContain('上一次输出未通过校验');
    expect(result.resultData.topics).toHaveLength(2);
  });

  it('fails after one retry when the structured output remains invalid', async () => {
    const llmService = createLlmService();
    llmService.generate.mockResolvedValue({
      content: JSON.stringify({ topics: [{ title: '' }] }),
      model: 'deepseek-v4-flash',
    });

    await expect(
      new TopicGenerationGenerator(llmService as unknown as LlmService).generate(input),
    ).rejects.toThrow('invalid structured output');
    expect(llmService.generate).toHaveBeenCalledTimes(2);
  });
});
