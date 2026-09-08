jest.mock('@nestjs/common', () => ({
  Body: () => () => undefined,
  Controller: () => () => undefined,
  Get: () => () => undefined,
  Param: () => () => undefined,
  Post: () => () => undefined,
  Query: () => () => undefined,
  Req: () => () => undefined,
  HttpStatus: {
    OK: 200,
    CREATED: 201,
    ACCEPTED: 202,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    UNPROCESSABLE_ENTITY: 422,
    CONFLICT: 409,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
    BAD_GATEWAY: 502,
    SERVICE_UNAVAILABLE: 503,
  },
}));
jest.mock('@lark-apaas/fullstack-nestjs-core', () => ({
  NeedLogin: () => () => undefined,
}));

import { OrdersController } from './orders.controller';

type OrderServiceStub = {
  createOrder: jest.Mock;
  getOrderList: jest.Mock;
  getOrderDetail: jest.Mock;
  payOrder: jest.Mock;
  cancelOrder: jest.Mock;
};

describe('OrdersController HTTP payment boundary', () => {
  let service: OrderServiceStub;
  let controller: OrdersController;

  beforeEach(() => {
    service = {
      createOrder: jest.fn(),
      getOrderList: jest.fn(),
      getOrderDetail: jest.fn(),
      payOrder: jest.fn(),
      cancelOrder: jest.fn(),
    };

    controller = new OrdersController(service as never);
  });

  it.each([
    ['create', 'createOrder'],
    ['pay', 'payOrder'],
    ['cancel', 'cancelOrder'],
  ] as const)('rejects %s with a stable unavailable error before %s', async (path, method) => {
    const request = { userContext: { userId: 'user-1' } } as never;
    const invocation = path === 'create'
      ? controller.createOrder(request, { amount: 100, payMethod: 'alipay' })
      : path === 'pay'
        ? controller.payOrder(request, 'order-1')
        : controller.cancelOrder(request, 'order-1');

    await expect(invocation).rejects.toMatchObject({
      code: 'PAYMENT_NOT_AVAILABLE',
      message: '当前版本未接入真实支付渠道。',
      httpStatus: 503,
    });
    expect(service[method]).not.toHaveBeenCalled();
  });

  it('keeps the authenticated user scope for read-only order history', async () => {
    const orders = { items: [], total: 0, page: 2, pageSize: 5 };
    service.getOrderList.mockResolvedValue(orders);

    const result = await controller.getOrderList(
      { userContext: { userId: 'user-1' } } as never,
      '2',
      '5',
      'pending',
    );

    expect(result).toEqual(orders);
    expect(service.getOrderList).toHaveBeenCalledWith('user-1', 2, 5, 'pending');
  });

  it('keeps the authenticated user scope for a read-only order detail', async () => {
    const order = { id: 'order-1', userId: 'user-1', amount: 100, points: 100, status: 'pending', createdAt: '2026-01-01T00:00:00.000Z' };
    service.getOrderDetail.mockResolvedValue(order);

    const result = await controller.getOrderDetail(
      { userContext: { userId: 'user-1' } } as never,
      'order-1',
    );

    expect(result).toEqual(order);
    expect(service.getOrderDetail).toHaveBeenCalledWith('user-1', 'order-1');
  });
});
