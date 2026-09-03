import { Injectable } from '@nestjs/common';
import { z } from 'zod';

import { LlmService } from '../llm/llm.service';
import type { LlmGenerateResult } from '../llm/llm.types';

export interface TopicGenerationInput {
  field?: string;
  researchDirection?: string;
  educationLevel?: string;
  count?: number;
  keywords?: string[];
}

export interface TopicGenerationOutput {
  topics: {
    title: string;
    researchDirection: string;
    innovation: string;
    difficulty: string;
    keyIdeas: string[];
  }[];
}

export interface TopicGenerationMetadata {
  provider: 'deepseek';
  model: string;
  usage?: LlmGenerateResult['usage'];
  generationTimeMs: number;
}

const topicResultSchema = z.object({
  topics: z.array(
    z.object({
      title: z.string().trim().min(1),
      researchDirection: z.string().trim().min(1),
      innovation: z.string().trim().min(1),
      difficulty: z.string().trim().min(1),
      keyIdeas: z.array(z.string().trim().min(1)).min(1),
    }),
  ).min(1),
});

const SYSTEM_PROMPT = `你是一名严谨的学术研究与论文写作助手。

你的任务是根据用户提供的研究领域、研究主题、关键词、研究对象、研究方法和其他约束，生成具有学术研究价值的论文题目。

必须遵守：
1. 标题必须准确反映研究对象、核心变量或问题和研究范围。
2. 避免空泛、宏大、营销化和新闻式标题。
3. 不得虚构用户未提供的数据、样本、地区、实验结果或研究结论。
4. 不得默认研究已经得到某种正向或负向结论。
5. 尽可能体现研究问题、方法或研究对象，但不要机械堆砌关键词。
6. 标题应符合正式学术论文表达。
7. 候选题目之间必须有明显差异，不得只是简单同义改写。
8. 如果信息不足，只生成合理、保守的候选题目，不得自行制造具体事实。
9. 只返回合法 JSON，不要 Markdown、代码块或解释文字。

JSON 必须严格符合以下结构：
{
  "topics": [
    {
      "title": "论文题目",
      "researchDirection": "研究方向",
      "innovation": "可能的研究价值或创新切入点",
      "difficulty": "难度",
      "keyIdeas": ["研究思路一", "研究思路二"]
    }
  ]
}`;

@Injectable()
export class TopicGenerationGenerator {
  constructor(private readonly llmService: LlmService) {}

  async generate(input: TopicGenerationInput): Promise<{
    resultData: TopicGenerationOutput;
    metadata: TopicGenerationMetadata;
  }> {
    const messages = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      { role: 'user' as const, content: this.buildUserPrompt(input) },
    ];
    const startedAt = Date.now();

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const requestMessages = attempt === 0
        ? messages
        : [
            ...messages,
            {
              role: 'user' as const,
              content: '上一次输出未通过校验。请重新生成，只返回符合要求的合法 JSON，不要附加任何文字。',
            },
          ];
      const response = await this.llmService.generate({
        messages: requestMessages,
        jsonMode: true,
        temperature: 0.7,
        maxTokens: 1600,
      });

      try {
        const parsed: unknown = JSON.parse(response.content);
        const validated = topicResultSchema.safeParse(parsed);
        if (validated.success) {
          return {
            resultData: validated.data as TopicGenerationOutput,
            metadata: {
              provider: 'deepseek',
              model: response.model,
              usage: response.usage,
              generationTimeMs: Date.now() - startedAt,
            },
          };
        }
      } catch {
        // JSON parsing failure is eligible for the single structured-output retry.
      }
    }

    throw new Error('DeepSeek returned invalid structured output');
  }

  private buildUserPrompt(input: TopicGenerationInput): string {
    const fields: Array<[string, string]> = [];
    this.addField(fields, '专业领域', input.field);
    this.addField(fields, '研究方向', input.researchDirection);
    this.addField(fields, '学历层次', input.educationLevel);

    if (input.keywords?.length) {
      this.addField(fields, '关键词', input.keywords.filter(Boolean).join('、'));
    }

    const count = Math.min(Math.max(input.count ?? 4, 1), 10);
    const details = fields.map(([label, value]) => `${label}：${value}`).join('\n');
    return `${details || '用户暂未提供具体研究信息。'}\n候选题目数量：${count}\n请根据以上信息生成候选论文题目，并严格按照指定 JSON 结构返回。`;
  }

  private addField(fields: Array<[string, string]>, label: string, value?: string): void {
    const normalized = value?.trim();
    if (normalized) fields.push([label, normalized]);
  }
}
