import type { DocumentInputDescriptor } from '@shared/document-input.interface';
import { productHttpClient } from './http';

export async function uploadDocument(file: File): Promise<DocumentInputDescriptor> {
  const formData = new FormData();
  formData.append('file', file, file.name);
  const response = await productHttpClient.post<DocumentInputDescriptor>('/api/document-inputs', formData);
  return response.data;
}
