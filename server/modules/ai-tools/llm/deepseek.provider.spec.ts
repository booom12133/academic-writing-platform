import axios from 'axios';

import { DeepSeekProvider } from './deepseek.provider';

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

const mockedAxios = jest.mocked(axios);

describe('DeepSeekProvider', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      DEEPSEEK_API_KEY: 'fake-key',
      DEEPSEEK_BASE_URL: 'https://api.deepseek.com',
      DEEPSEEK_DEFAULT_MODEL: 'deepseek-v4-flash',
    };
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('uses the configured model and authorization header for JSON generation', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        model: 'deepseek-v4-flash',
        choices: [{ message: { content: '{"ok":true}' } }],
      },
    });

    const result = await new DeepSeekProvider().generate({
      messages: [{ role: 'user', content: 'test' }],
      jsonMode: true,
      thinking: false,
    });

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://api.deepseek.com/chat/completions',
      {
        model: 'deepseek-v4-flash',
        messages: [{ role: 'user', content: 'test' }],
        response_format: { type: 'json_object' },
        thinking: { type: 'disabled' },
      },
      {
        timeout: 90_000,
        headers: {
          Authorization: 'Bearer fake-key',
          'Content-Type': 'application/json',
        },
      },
    );
    expect(result.content).toBe('{"ok":true}');
    expect(result.model).toBe('deepseek-v4-flash');
  });

  it('fails clearly when the API key is not configured', async () => {
    delete process.env.DEEPSEEK_API_KEY;

    await expect(
      new DeepSeekProvider().generate({
        messages: [{ role: 'user', content: 'test' }],
      }),
    ).rejects.toThrow('DeepSeek API key is not configured');
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('maps content and usage from a normal response', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        model: 'deepseek-v4-flash',
        choices: [{ message: { content: 'generated text' } }],
        usage: {
          prompt_tokens: 12,
          completion_tokens: 8,
          total_tokens: 20,
        },
      },
    });

    await expect(
      new DeepSeekProvider().generate({
        messages: [{ role: 'user', content: 'test' }],
      }),
    ).resolves.toEqual({
      content: 'generated text',
      model: 'deepseek-v4-flash',
      usage: {
        promptTokens: 12,
        completionTokens: 8,
        totalTokens: 20,
      },
    });
  });

  it('converts authentication failures to a safe error', async () => {
    mockedAxios.post.mockRejectedValueOnce({
      response: { status: 401, data: { error: { message: 'secret details' } } },
    });

    await expect(
      new DeepSeekProvider().generate({
        messages: [{ role: 'user', content: 'test' }],
      }),
    ).rejects.toThrow('DeepSeek authentication failed');
  });

  it('converts rate-limit failures to a safe error', async () => {
    mockedAxios.post.mockRejectedValueOnce({ response: { status: 429 } });

    await expect(
      new DeepSeekProvider().generate({
        messages: [{ role: 'user', content: 'test' }],
      }),
    ).rejects.toThrow('DeepSeek rate limit reached');
  });
});
