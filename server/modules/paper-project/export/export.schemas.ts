import { z } from 'zod';

const fingerprint = z.string().regex(/^[a-f0-9]{64}$/u);
const warningCode = z.enum([
  'TITLE_MISSING', 'RESEARCH_PLAN_MISSING', 'MISSING_SECTION', 'ORPHANED_SECTION_EXCLUDED',
  'DERIVED_CONTENT_MISSING', 'DERIVED_CONTENT_STALE', 'CONCLUSION_REFRESH_STALE',
  'STALE_AFTER_EDIT', 'CITATION_RENUMBER_UNSAFE', 'CITATION_IDENTITY_CONFLICT',
  'BIBLIOGRAPHY_METADATA_UNRESOLVED',
]);

export const exportManifestV1Schema = z.object({
  schemaVersion: z.literal(1),
  exportId: z.string().uuid(),
  createdAt: z.string().datetime({ offset: true }),
  mode: z.enum(['DRAFT', 'CLEAN']),
  projectId: z.string().uuid(),
  bodyFingerprint: fingerprint,
  manuscriptFingerprint: fingerprint,
  outline: z.object({ nodeIdsInPreorder: z.array(z.string().uuid()).max(10_000) }).strict(),
  bodyRevisions: z.array(z.object({
    sectionId: z.string().uuid(), revisionId: z.string().uuid(), revisionNumber: z.number().int().positive(), contentHash: fingerprint,
  }).strict()).max(10_000),
  abstractRevisionId: z.string().uuid().optional(),
  keywordsRevisionId: z.string().uuid().optional(),
  citationMapping: z.array(z.object({
    sectionId: z.string().uuid(), localCitationId: z.string().min(1).max(200), globalNumbers: z.array(z.number().int().positive()).max(100),
  }).strict()).max(100_000),
  warnings: z.array(z.object({ code: warningCode, sectionId: z.string().uuid().optional(), revisionId: z.string().uuid().optional() }).strict()).max(10_000),
  template: z.object({ key: z.literal('generic-academic-v1'), version: z.literal('1') }).strict(),
  renderer: z.object({ key: z.literal('docx'), version: z.literal('1') }).strict(),
}).strict();

export const artifactRefV1Schema = z.object({
  version: z.literal(1),
  provider: z.enum(['platform-file', 'self-hosted-filesystem']),
  bucketId: z.string().min(1).max(512),
  objectKey: z.string().min(1).max(1_024),
  fileName: z.string().min(1).max(320),
  mimeType: z.literal('application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
  sizeBytes: z.number().int().nonnegative().max(50 * 1024 * 1024),
  sha256: fingerprint,
}).strict();
