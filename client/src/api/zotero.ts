import type {
  ZoteroConnection,
  ZoteroImportResult,
  ZoteroItemsPage,
} from '@shared/zotero.interface';
import { productHttpClient } from './http';
import { normalizeProductIntegrationError } from './integration-error';

export async function getConnectionHealth(): Promise<ZoteroConnection[]> {
  try {
    const response = await productHttpClient.get<unknown>('/api/zotero/connection/health');
    return Array.isArray(response.data)
      ? response.data.map(sanitizeConnection)
      : [];
  } catch (error) {
    throw normalizeProductIntegrationError(error, 'zotero');
  }
}

export async function connect(apiKey: string): Promise<ZoteroConnection> {
  try {
    const response = await productHttpClient.post<unknown>('/api/zotero/connection', { apiKey });
    return sanitizeConnection(response.data);
  } catch (error) {
    throw normalizeProductIntegrationError(error, 'zotero');
  }
}

export async function disconnect(): Promise<{ status: 'revoked' }> {
  try {
    const response = await productHttpClient.delete<{ status: 'revoked' }>('/api/zotero/connection');
    return response.data;
  } catch (error) {
    throw normalizeProductIntegrationError(error, 'zotero');
  }
}

export async function listItems(): Promise<ZoteroItemsPage> {
  try {
    const response = await productHttpClient.get<ZoteroItemsPage>('/api/zotero/items');
    return response.data;
  } catch (error) {
    throw normalizeProductIntegrationError(error, 'zotero');
  }
}

export async function importItem(itemKey: string): Promise<ZoteroImportResult> {
  return postImport(`/api/zotero/items/${encodeURIComponent(itemKey)}/import`);
}

export async function syncItem(itemKey: string): Promise<ZoteroImportResult> {
  return postImport(`/api/zotero/items/${encodeURIComponent(itemKey)}/sync`);
}

export async function importAttachment(attachmentKey: string): Promise<ZoteroImportResult> {
  return postImport(`/api/zotero/attachments/${encodeURIComponent(attachmentKey)}/import`);
}

async function postImport(path: string): Promise<ZoteroImportResult> {
  try {
    const response = await productHttpClient.post<ZoteroImportResult>(path);
    return response.data;
  } catch (error) {
    throw normalizeProductIntegrationError(error, 'zotero');
  }
}

function sanitizeConnection(value: unknown): ZoteroConnection {
  const connection = isRecord(value) ? value : {};
  return {
    id: typeof connection.id === 'string' ? connection.id : '',
    libraryType: 'user',
    libraryId: typeof connection.libraryId === 'string' ? connection.libraryId : '',
    keyFingerprint: typeof connection.keyFingerprint === 'string' ? connection.keyFingerprint : '',
    status: isConnectionStatus(connection.status) ? connection.status : 'invalid',
    ...(typeof connection.lastCheckedAt === 'string' ? { lastCheckedAt: connection.lastCheckedAt } : {}),
    ...(typeof connection.lastSeenLibraryVersion === 'string' ? { lastSeenLibraryVersion: connection.lastSeenLibraryVersion } : {}),
    ...(typeof connection.createdAt === 'string' ? { createdAt: connection.createdAt } : {}),
    ...(typeof connection.updatedAt === 'string' ? { updatedAt: connection.updatedAt } : {}),
  };
}

function isConnectionStatus(value: unknown): value is ZoteroConnection['status'] {
  return value === 'active' || value === 'disabled' || value === 'invalid' || value === 'revoked';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export type { ZoteroConnection, ZoteroImportResult, ZoteroItem, ZoteroItemsPage } from '@shared/zotero.interface';
