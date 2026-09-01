import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type { DocumentInputDescriptor } from '@shared/document-input.interface';

export async function uploadDocument(file: File): Promise<DocumentInputDescriptor> {
  const formData = new FormData();
  formData.append('file', file, file.name);
  const response = await axiosForBackend.post<DocumentInputDescriptor>('/api/document-inputs', formData);
  return response.data;
}
