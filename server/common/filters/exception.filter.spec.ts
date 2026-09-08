import { GlobalExceptionFilter } from './exception.filter';
import { ResponseCode } from '../constants/api_response_code';
import { BusinessException } from '../interfaces/exception.interface';

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

  it('serializes payment unavailability as a stable 503 product error', () => {
    const json = jest.fn();
    const response = { headersSent: false, status: jest.fn(() => ({ json })) };
    const host = { switchToHttp: () => ({ getResponse: () => response }) };

    new GlobalExceptionFilter().catch(
      new BusinessException(
        ResponseCode.PAYMENT_NOT_AVAILABLE,
        '当前版本未接入真实支付渠道。',
        503,
      ),
      host as never,
    );

    expect(response.status).toHaveBeenCalledWith(503);
    expect(json).toHaveBeenCalledWith({
      error: {
        code: 'PAYMENT_NOT_AVAILABLE',
        message: '当前版本未接入真实支付渠道。',
        timestamp: expect.any(Number),
      },
    });
  });
});
