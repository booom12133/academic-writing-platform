export type LlmMessageRole = 'system' | 'user' | 'assistant';

export interface LlmMessage {
  role: LlmMessageRole;
  content: string;
}

export interface LlmGenerateOptions {
  messages: LlmMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  thinking?: boolean;
}

export interface LlmUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface LlmGenerateResult {
  content: string;
  model: string;
  usage?: LlmUsage;
}

export interface LlmHealthResult {
  configured: boolean;
  provider: 'deepseek';
  reachable: boolean;
  defaultModel: string;
  error?: string;
}
