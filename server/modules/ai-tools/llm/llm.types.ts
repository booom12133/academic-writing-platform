export type LlmMessageRole = 'system' | 'user' | 'assistant';

export interface LlmMessage {
  role: LlmMessageRole;
  content: string;
}

export interface TextGenerationRequest {
  messages: LlmMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

export interface LlmUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface TextGenerationResult {
  content: string;
  provider: string;
  model: string;
  usage?: LlmUsage;
}

export interface TextGenerationHealth {
  configured: boolean;
  provider: string;
  reachable: boolean;
  defaultModel: string;
  error?: string;
}

export type LlmGenerateOptions = TextGenerationRequest;
export type LlmGenerateResult = TextGenerationResult;
export type LlmHealthResult = TextGenerationHealth;
