import type { KnowledgeWorkspaceDocument } from '@shared/knowledge-product.interface';
import type {
  GroundedBibliographyEntry,
  GroundedGenerationResult,
} from '../api/grounded-generation';

export interface GroundedWritingSourceOption {
  documentId: string;
  documentVersionId: string;
  displayName: string;
  sourceType: KnowledgeWorkspaceDocument['document']['sourceType'];
  versionNumber: number;
  indexStatus: 'indexed';
}

export type GroundedWritingViewState =
  | 'idle'
  | 'loading'
  | 'error'
  | 'blocked'
  | 'partial'
  | 'grounded';

export function mapGroundedGenerationResult(
  value: unknown,
): GroundedGenerationResult | null {
  if (!isRecord(value)) return null;
  if (value.schemaVersion !== 1 || !isGroundedStatus(value.status) || typeof value.content !== 'string') return null;
  if (!Array.isArray(value.claims) || !value.claims.every(isClaim)) return null;
  if (!Array.isArray(value.citations) || !value.citations.every(isCitation)) return null;
  if (!Array.isArray(value.bibliography) || !value.bibliography.every(isBibliographyEntry)) return null;
  if (!Array.isArray(value.evidenceTrace) || !value.evidenceTrace.every(isEvidenceTrace)) return null;
  if (!isRecord(value.grounding) || !isGroundingCoverage(value.grounding.groundingCoverage) || !Array.isArray(value.grounding.diagnostics)) return null;
  if (!isRecord(value.provenance) || !Array.isArray(value.provenance.selectedVersionIds) || !value.provenance.selectedVersionIds.every(isNonEmptyString)) return null;
  if (!isRecord(value.generation) || typeof value.generation.provider !== 'string' || typeof value.generation.model !== 'string') return null;
  return value as unknown as GroundedGenerationResult;
}

export function getSelectableKnowledgeSources(
  documents: KnowledgeWorkspaceDocument[],
): GroundedWritingSourceOption[] {
  const seen = new Set<string>();
  return documents.flatMap((item) => {
    if (
      item.document.lifecycleStatus !== 'active' ||
      !item.activeVersion ||
      !item.index ||
      item.index.status !== 'indexed' ||
      seen.has(item.activeVersion.id)
    ) return [];
    seen.add(item.activeVersion.id);
    return [{
      documentId: item.document.id,
      documentVersionId: item.activeVersion.id,
      displayName: item.document.displayName,
      sourceType: item.document.sourceType,
      versionNumber: item.activeVersion.versionNumber,
      indexStatus: 'indexed' as const,
    }];
  });
}

export function revalidateGroundedWritingSelection(
  state: unknown,
  documents: KnowledgeWorkspaceDocument[],
): string[] | null {
  const raw = isRecord(state) && isRecord(state.state) ? state.state : state;
  if (!isRecord(raw) || !Array.isArray(raw.documentVersionIds)) return null;
  const requested = raw.documentVersionIds.filter(isNonEmptyString);
  if (requested.length !== raw.documentVersionIds.length || requested.length === 0) return null;
  const selectable = new Set(getSelectableKnowledgeSources(documents).map((item) => item.documentVersionId));
  const unique = [...new Set(requested)];
  return unique.length === requested.length && unique.every((id) => selectable.has(id)) ? unique : null;
}

export function buildGroundedWritingLocationState(
  documentVersionIds: string[],
): { documentVersionIds: string[] } | null {
  const unique = [...new Set(documentVersionIds.filter(isNonEmptyString))];
  return unique.length === 0 ? null : { documentVersionIds: unique };
}

export function getGroundedWritingViewState(input: {
  loading: boolean;
  error: string | null;
  result: GroundedGenerationResult | null;
}): GroundedWritingViewState {
  if (input.loading) return 'loading';
  if (input.error) return 'error';
  if (!input.result) return 'idle';
  return input.result.status;
}

export function buildGroundedWritingMarkdown(
  result: GroundedGenerationResult,
): string {
  const content = result.content.trim();
  const bibliography = result.bibliography.length > 0
    ? `\n\n## Bibliography\n\n${result.bibliography.map(renderBibliographyEntry).join('\n')}`
    : '';
  return `${content}${bibliography}\n`;
}

export function createGroundedWritingMarkdownExport(
  result: GroundedGenerationResult,
): { blob: Blob; filename: string; mimeType: string } {
  const mimeType = 'text/markdown;charset=utf-8';
  return {
    blob: new Blob([buildGroundedWritingMarkdown(result)], { type: mimeType }),
    filename: 'grounded-writing.md',
    mimeType,
  };
}

function renderBibliographyEntry(entry: GroundedBibliographyEntry): string {
  const fields = Object.entries(entry.fields)
    .filter(([, value]) => typeof value === 'string' || typeof value === 'number')
    .map(([key, value]) => `${key}: ${String(value)}`);
  return `- ${entry.citationId}${fields.length > 0 ? ` — ${fields.join('; ')}` : ''}`;
}

function isClaim(value: unknown): boolean {
  if (!isRecord(value) || typeof value.claimId !== 'string' || typeof value.text !== 'string') return false;
  if (!isBindingStatus(value.bindingStatus) || !Array.isArray(value.evidenceRefs)) return false;
  return value.evidenceRefs.every((item) => isRecord(item) && isNonEmptyString(item.evidenceId));
}

function isCitation(value: unknown): boolean {
  return isRecord(value) && isNonEmptyString(value.citationId)
    && Array.isArray(value.evidenceIds) && value.evidenceIds.every(isNonEmptyString);
}

function isBibliographyEntry(value: unknown): value is GroundedBibliographyEntry {
  return isRecord(value) && isNonEmptyString(value.citationId) && isRecord(value.fields);
}

function isEvidenceTrace(value: unknown): boolean {
  return isRecord(value) && isNonEmptyString(value.evidenceId)
    && isRecord(value.citationLocator) && isRecord(value.provenance)
    && (value.sourceRecord === undefined || isRecord(value.sourceRecord));
}

function isGroundedStatus(value: unknown): value is GroundedGenerationResult['status'] {
  return value === 'grounded' || value === 'partial' || value === 'blocked';
}

function isBindingStatus(value: unknown): boolean {
  return value === 'bound' || value === 'partially-bound' || value === 'unbound';
}

function isGroundingCoverage(value: unknown): boolean {
  return value === 'complete' || value === 'partial' || value === 'none';
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
