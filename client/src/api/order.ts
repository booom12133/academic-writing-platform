import type {
  RechargeOrder,
  OrderListResponse,
  OrderStatus,
} from '@shared/api.interface';
import { productHttpClient } from './http';

export interface CreateOrderData {
  amount: number;
  payMethod: string;
}

export interface CreateOrderResponse {
  order: RechargeOrder;
  qrCodeUrl: string;
}

export interface GetOrderListParams {
  page?: number;
  pageSize?: number;
  status?: OrderStatus;
}

export async function createOrder(data: CreateOrderData): Promise<CreateOrderResponse> {
  const response = await productHttpClient.post<CreateOrderResponse>('/api/orders', data);
  return response.data;
}

export async function getOrderList(
  params: GetOrderListParams,
): Promise<OrderListResponse> {
  const response = await productHttpClient.get<OrderListResponse>('/api/orders', { params });
  return response.data;
}

export async function getOrder(id: string): Promise<RechargeOrder> {
  const response = await productHttpClient.get<RechargeOrder>(`/api/orders/${id}`);
  return response.data;
}

export async function payOrder(id: string): Promise<RechargeOrder> {
  const response = await productHttpClient.post<RechargeOrder>(`/api/orders/${id}/pay`);
  return response.data;
}

export async function cancelOrder(id: string): Promise<RechargeOrder> {
  const response = await productHttpClient.post<RechargeOrder>(`/api/orders/${id}/cancel`);
  return response.data;
}
