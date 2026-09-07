import { redactLogValue } from './redaction';

describe('log redaction', () => {
  it('removes credentials, JWTs, prompts, responses and document content', () => {
    const value = redactLogValue({
      authorization: 'Bearer jwt-secret',
      apiKey: 'provider-secret',
      prompt: 'private prompt text',
      response: 'private response text',
      documentText: 'private document text',
      route: '/api/tasks',
      status: 500,
    });

    expect(value).toEqual({
      authorization: '[REDACTED]',
      apiKey: '[REDACTED]',
      prompt: '[REDACTED]',
      response: '[REDACTED]',
      documentText: '[REDACTED]',
      route: '/api/tasks',
      status: 500,
    });
    expect(JSON.stringify(value)).not.toContain('secret');
    expect(JSON.stringify(value)).not.toContain('private');
  });
});
