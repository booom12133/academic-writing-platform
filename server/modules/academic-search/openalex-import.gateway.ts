import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { createHash } from 'node:crypto';
import { request } from 'node:https';
import { Readable } from 'node:stream';

import type { AcademicSearchResult } from '@shared/academic-search.interface';
import { normalizeOpenAlexWork } from './academic-search.normalization';
import { AcademicSearchError } from './academic-search.errors';
import { OpenAlexClient } from './openalex.client';

const MAX_PDF_BYTES = 20 * 1024 * 1024;
const MAX_REDIRECTS = 3;

export interface ResolvedOpenAlexWork {
  result: AcademicSearchResult;
  updatedAtEpochMs: string;
}

export type PdfFetchResult =
  | { kind: 'downloaded'; buffer: Buffer }
  | { kind: 'unavailable' }
  | { kind: 'invalid-pdf' };

type LookupLike = (hostname: string) => Promise<Array<{ address: string; family: number }>>;
type ResolvedAddress = { address: string; family: number };
type PinnedFetchLike = (url: URL, init: RequestInit, pinnedAddress: ResolvedAddress) => Promise<Response>;

function pinnedHttpsFetch(url: URL, init: RequestInit, pinnedAddress: ResolvedAddress): Promise<Response> {
  return new Promise((resolve, reject) => {
    const outgoing = request(url, {
      method: 'GET',
      headers: init.headers as Record<string, string>,
      signal: init.signal ?? undefined,
      servername: url.hostname,
      lookup: (_hostname, _options, callback) => callback(null, pinnedAddress.address, pinnedAddress.family as 4 | 6),
    }, (incoming) => {
      const headers = new Headers();
      for (const [key, value] of Object.entries(incoming.headers)) {
        if (Array.isArray(value)) value.forEach((item) => headers.append(key, item));
        else if (value !== undefined) headers.set(key, value);
      }
      const status = incoming.statusCode ?? 502;
      const body = status === 204 || status === 304 ? null : Readable.toWeb(incoming) as ReadableStream<Uint8Array>;
      resolve(new Response(body, { status, statusText: incoming.statusMessage, headers }));
    });
    outgoing.once('error', reject);
    outgoing.end();
  });
}

function isPublicAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b, c] = address.split('.').map(Number);
    return !(
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && ((b === 0 && c === 0) || b === 168)) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113)
    );
  }
  if (isIP(address) === 6) {
    const normalized = address.toLowerCase();
    if (normalized.includes('.') || normalized.startsWith('::ffff:')) return false;
    const firstHextet = Number.parseInt(normalized.split(':')[0] || '0', 16);
    return firstHextet >= 0x2000 && firstHextet <= 0x3fff && !normalized.startsWith('2001:db8:');
  }
  return false;
}

export class OpenAlexImportGateway {
  constructor(
    private readonly client: OpenAlexClient,
    private readonly fetchImpl: PinnedFetchLike = pinnedHttpsFetch,
    private readonly lookupImpl: LookupLike = async (hostname) => lookup(hostname, { all: true, verbatim: true }),
  ) {}

  async resolveWork(externalRecordId: string): Promise<ResolvedOpenAlexWork> {
    const raw = await this.client.getWork(externalRecordId);
    const retrievedAt = new Date().toISOString();
    const result = normalizeOpenAlexWork(raw, 1, createHash('sha256').update(`import:${externalRecordId}`).digest('hex'), retrievedAt);
    if (!result) throw new AcademicSearchError('ACADEMIC_SEARCH_INVALID_RESPONSE', 'The OpenAlex work response was invalid.');
    const requestedId = externalRecordId.trim().replace(/^https:\/\/openalex\.org\//iu, '').toUpperCase();
    const resolvedId = result.externalRecordId.replace(/^https:\/\/openalex\.org\//iu, '').toUpperCase();
    if (resolvedId !== requestedId) throw new AcademicSearchError('ACADEMIC_SEARCH_INVALID_RESPONSE', 'The OpenAlex work response was invalid.');
    const rawUpdated = typeof raw.updated_date === 'string' ? Date.parse(raw.updated_date) : Number.NaN;
    if (!Number.isFinite(rawUpdated)) throw new AcademicSearchError('ACADEMIC_SEARCH_INVALID_RESPONSE', 'The OpenAlex work response was invalid.');
    return { result, updatedAtEpochMs: String(rawUpdated) };
  }

  async fetchPdf(pdfUrl: string): Promise<PdfFetchResult> {
    let current: URL;
    try { current = new URL(pdfUrl); } catch { return { kind: 'invalid-pdf' }; }
    const deadline = Date.now() + 15_000;
    for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
      const pinnedAddress = await this.resolveSafeAddress(current);
      if (!pinnedAddress) return { kind: 'invalid-pdf' };
      const controller = new AbortController();
      const remaining = deadline - Date.now();
      if (remaining <= 0) return { kind: 'unavailable' };
      const timeout = setTimeout(() => controller.abort(), remaining);
      try {
        const response = await this.fetchImpl(current, { redirect: 'manual', signal: controller.signal, headers: { Accept: 'application/pdf, application/octet-stream;q=0.8' } }, pinnedAddress);
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          const location = response.headers.get('location');
          await response.body?.cancel().catch(() => undefined);
          if (!location || redirect === MAX_REDIRECTS) return { kind: 'unavailable' };
          current = new URL(location, current);
          continue;
        }
        if (!response.ok) {
          await response.body?.cancel().catch(() => undefined);
          return { kind: 'unavailable' };
        }
        const length = Number(response.headers.get('content-length'));
        if (Number.isFinite(length) && length > MAX_PDF_BYTES) {
          await response.body?.cancel().catch(() => undefined);
          return { kind: 'invalid-pdf' };
        }
        const contentType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
        if (!['application/pdf', 'application/octet-stream'].includes(contentType)) {
          await response.body?.cancel().catch(() => undefined);
          return { kind: 'invalid-pdf' };
        }
        if (!response.body) return { kind: 'invalid-pdf' };
        const reader = response.body.getReader();
        const chunks: Buffer[] = [];
        let total = 0;
        while (true) {
          const next = await reader.read();
          if (next.done) break;
          total += next.value.byteLength;
          if (total > MAX_PDF_BYTES) { await reader.cancel(); return { kind: 'invalid-pdf' }; }
          chunks.push(Buffer.from(next.value));
        }
        const buffer = Buffer.concat(chunks);
        return buffer.subarray(0, 5).toString('ascii') === '%PDF-' ? { kind: 'downloaded', buffer } : { kind: 'invalid-pdf' };
      } catch {
        return { kind: 'unavailable' };
      } finally {
        clearTimeout(timeout);
      }
    }
    return { kind: 'unavailable' };
  }

  private async resolveSafeAddress(url: URL): Promise<ResolvedAddress | null> {
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) return null;
    try {
      const addresses = isIP(url.hostname)
        ? [{ address: url.hostname, family: isIP(url.hostname) }]
        : await this.lookupImpl(url.hostname);
      return addresses.length > 0 && addresses.every((entry) => isPublicAddress(entry.address)) ? addresses[0] : null;
    } catch {
      return null;
    }
  }
}
