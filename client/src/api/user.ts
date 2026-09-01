import type { UserProfile } from '@shared/api.interface';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';

export async function getProfile(): Promise<UserProfile> {
  const response = await axiosForBackend.get<UserProfile>('/api/users/profile');
  return response.data;
}

export interface UpdateProfileData {
  username?: string;
  avatarUrl?: string;
  phone?: string;
}

export async function updateProfile(data: UpdateProfileData): Promise<UserProfile> {
  const response = await axiosForBackend.patch<UserProfile>('/api/users/profile', data);
  return response.data;
}

export async function ensureUser(): Promise<UserProfile> {
  const response = await axiosForBackend.post<UserProfile>('/api/users/ensure');
  return response.data;
}
