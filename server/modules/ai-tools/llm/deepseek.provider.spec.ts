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
    expect(result.provider).toBe('deepseek');
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
      provider: 'deepseek',
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

  it('preserves empty-content errors as safe provider errors', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: { choices: [{ message: { content: '   ' } }] },
    });

    await expect(
      new DeepSeekProvider().generate({
        messages: [{ role: 'user', content: 'test' }],
      }),
    ).rejects.toThrow('DeepSeek returned empty response');
  });

  it('maps timeout, billing, and generic status failures safely', async () => {
    mockedAxios.post.mockRejectedValueOnce({ code: 'ETIMEDOUT', message: 'socket timeout' });
    await expect(
      new DeepSeekProvider().generate({ messages: [{ role: 'user', content: 'test' }] }),
    ).rejects.toThrow('DeepSeek request timed out');

    mockedAxios.post.mockRejectedValueOnce({
      response: { status: 402, data: { error: { message: 'insufficient balance' } } },
    });
    await expect(
      new DeepSeekProvider().generate({ messages: [{ role: 'user', content: 'test' }] }),
    ).rejects.toThrow('DeepSeek billing error');

    mockedAxios.post.mockRejectedValueOnce({
      response: { status: 500, data: { error: { message: 'upstream details' } } },
    });
    await expect(
      new DeepSeekProvider().generate({ messages: [{ role: 'user', content: 'test' }] }),
    ).rejects.toThrow('DeepSeek API request failed (500)');
  });

  it('returns a neutral health result without calling the API when unconfigured', async () => {
    delete process.env.DEEPSEEK_API_KEY;

    await expect(new DeepSeekProvider().checkHealth()).resolves.toEqual({
      configured: false,
      provider: 'deepseek',
      reachable: false,
      defaultModel: 'deepseek-v4-flash',
      error: 'DeepSeek API key is not configured',
    });
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it('returns a reachable health result from the models endpoint', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: { data: [] } });

    await expect(new DeepSeekProvider().checkHealth()).resolves.toEqual({
      configured: true,
      provider: 'deepseek',
      reachable: true,
      defaultModel: 'deepseek-v4-flash',
    });
    expect(mockedAxios.get).toHaveBeenCalledWith(
      'https://api.deepseek.com/models',
      expect.objectContaining({ timeout: 90_000 }),
    );
  });
});
