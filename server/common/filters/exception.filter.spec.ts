import { GlobalExceptionFilter } from './exception.filter';

describe('GlobalExceptionFilter', () => {
  it('does not expose stack or cause for unknown exceptions', () => {
    const json = jest.fn();
    const response = { headersSent: false, status: jest.fn(() => ({ json })) };
    const host = { switchToHttp: () => ({ getResponse: () => response }) };
    const error = Object.assign(new Error('private implementation detail'), {
      cause: { password: 'secret' },
    });

    new GlobalExceptionFilter().catch(error, host as never);

    expect(response.status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      error: {
        code: 'INTERNAL_ERROR',
        message: '服务器内部错误',
        timestamp: expect.any(Number),
      },
    });
    expect(JSON.stringify(json.mock.calls[0]?.[0])).not.toContain('private');
    expect(JSON.stringify(json.mock.calls[0]?.[0])).not.toContain('secret');
  });
});
