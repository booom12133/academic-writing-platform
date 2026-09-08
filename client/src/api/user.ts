import type { UserProfile } from '@shared/api.interface';
import { productHttpClient } from './http';

export async function getProfile(): Promise<UserProfile> {
  const response = await productHttpClient.get<UserProfile>('/api/users/profile');
  return response.data;
}

export interface UpdateProfileData {
  username?: string;
  avatarUrl?: string;
  phone?: string;
}

export async function updateProfile(data: UpdateProfileData): Promise<UserProfile> {
  const response = await productHttpClient.patch<UserProfile>('/api/users/profile', data);
  return response.data;
}

export async function ensureUser(): Promise<UserProfile> {
  const response = await productHttpClient.post<UserProfile>('/api/users/ensure');
  return response.data;
}
