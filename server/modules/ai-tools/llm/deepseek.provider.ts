import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

import type {
  LlmGenerateOptions,
  LlmGenerateResult,
  LlmHealthResult,
} from './llm.types';
import type { TextGenerationProvider } from './text-generation.provider';

const DEFAULT_BASE_URL = 'https://api.deepseek.com';
const DEFAULT_MODEL = 'deepseek-v4-flash';
const REQUEST_TIMEOUT_MS = 90_000;

@Injectable()
// eslint-disable-next-line @darraghor/nestjs-typed/injectable-should-be-provided -- registered through the TEXT_GENERATION_PROVIDER token.
export class DeepSeekProvider implements TextGenerationProvider {
  private readonly logger = new Logger(DeepSeekProvider.name);

  async generate(options: LlmGenerateOptions): Promise<LlmGenerateResult> {
    const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
    if (!apiKey) {
      throw new Error('DeepSeek API key is not configured');
    }

    const model = options.model || this.getDefaultModel();
    const body: Record<string, unknown> = {
      model,
      messages: options.messages,
    };

    if (options.temperature !== undefined) body.temperature = options.temperature;
    if (options.maxTokens !== undefined) body.max_tokens = options.maxTokens;
    if (options.jsonMode) body.response_format = { type: 'json_object' };
    body.thinking = { type: 'disabled' };

    try {
      const response = await axios.post(
        `${this.getBaseUrl()}/chat/completions`,
        body,
        {
          timeout: REQUEST_TIMEOUT_MS,
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      const content = response.data?.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || content.trim().length === 0) {
        throw new Error('DeepSeek returned empty response');
      }

      const usage = response.data?.usage;
      return {
        content,
        provider: 'deepseek',
        model: response.data?.model || model,
        usage: usage
          ? {
              promptTokens: usage.prompt_tokens,
              completionTokens: usage.completion_tokens,
              totalTokens: usage.total_tokens,
            }
          : undefined,
      };
    } catch (error) {
      const safeError = this.toSafeError(error);
      this.logger.warn(safeError.message);
      throw safeError;
    }
  }

  async checkHealth(): Promise<LlmHealthResult> {
    const configured = Boolean(process.env.DEEPSEEK_API_KEY?.trim());
    const defaultModel = this.getDefaultModel();

    if (!configured) {
      return {
        configured: false,
        provider: 'deepseek',
        reachable: false,
        defaultModel,
        error: 'DeepSeek API key is not configured',
      };
    }

    try {
      await axios.get(`${this.getBaseUrl()}/models`, {
        timeout: REQUEST_TIMEOUT_MS,
        headers: {
          Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json',
        },
      });
      return { configured: true, provider: 'deepseek', reachable: true, defaultModel };
    } catch (error) {
      return {
        configured: true,
        provider: 'deepseek',
        reachable: false,
        defaultModel,
        error: this.toSafeError(error).message,
      };
    }
  }

  async checkConnectivity(): Promise<LlmHealthResult> {
    return this.checkHealth();
  }

  private getBaseUrl(): string {
    return (process.env.DEEPSEEK_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
  }

  private getDefaultModel(): string {
    return process.env.DEEPSEEK_DEFAULT_MODEL || DEFAULT_MODEL;
  }

  private toSafeError(error: unknown): Error {
    const candidate = error as {
      code?: string;
      message?: string;
      response?: { status?: number; data?: { error?: { message?: string } } };
    };
    const status = candidate?.response?.status;
    const message = candidate?.response?.data?.error?.message || candidate?.message || '';

    if (status === 401 || status === 403) {
      return new Error('DeepSeek authentication failed');
    }
    if (status === 429) {
      return new Error('DeepSeek rate limit reached');
    }
    if (
      candidate?.code === 'ECONNABORTED' ||
      candidate?.code === 'ETIMEDOUT' ||
      /timeout/i.test(message)
    ) {
      return new Error('DeepSeek request timed out');
    }
    if (status === 402 || /billing|balance|insufficient/i.test(message)) {
      return new Error(`DeepSeek billing error: ${this.safeSummary(message)}`);
    }
    if (status) {
      const summary = this.safeSummary(message);
      return new Error(
        summary
          ? `DeepSeek API request failed (${status}): ${summary}`
          : `DeepSeek API request failed (${status})`,
      );
    }
    return new Error(
      this.safeSummary(message) || 'DeepSeek request failed',
    );
  }

  private safeSummary(message: string): string {
    return message.replace(/\s+/g, ' ').trim().slice(0, 200);
  }
}
