import type {
  PointRecordListResponse,
  PointRecordType,
  MemberLevel,
} from '@shared/api.interface';
import { productHttpClient } from './http';

export interface GetPointRecordsParams {
  page?: number;
  pageSize?: number;
  type?: PointRecordType;
}

export async function getPointRecords(
  params: GetPointRecordsParams,
): Promise<PointRecordListResponse> {
  const response = await productHttpClient.get<PointRecordListResponse>(
    '/api/points/records',
    { params },
  );
  return response.data;
}

export interface BalanceResponse {
  points: number;
  memberLevel: MemberLevel;
}

export async function getBalance(): Promise<BalanceResponse> {
  const response = await productHttpClient.get<BalanceResponse>('/api/points/balance');
  return response.data;
}
