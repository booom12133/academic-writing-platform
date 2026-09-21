import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { LlmService } from '../../ai-tools/llm/llm.service';
import type { SectionRole } from '../../../../shared/manuscript.interface';
import { PaperProjectError, toPaperGenerationError } from '../paper-project.errors';
import { PaperProjectRepository } from '../paper-project.repository';
import { computeBodyFingerprint, computeConclusionBasisFingerprint } from './manuscript-fingerprint';
import { WholeManuscriptGenerationContextBuilder } from './whole-manuscript-generation-context.builder';

const derivedRequestSchema = z.object({
  expectedBodyFingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
  expectedCurrentRevisionNumber: z.number().int().nonnegative(),
  instructions: z.string().max(10_000).optional(),
}).strict();
const conclusionRequestSchema = z.object({
  expectedConclusionBasisFingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
  expectedCurrentRevisionNumber: z.number().int().nonnegative(),
  baseRevisionId: z.string().uuid().optional(),
  instructions: z.string().max(10_000).optional(),
}).strict();
const abstractOutput = z.object({ content: z.string().trim().min(1).max(100_000) }).strict();
const keywordsOutput = z.object({ keywords: z.array(z.string().trim().min(1).max(200)).min(1).max(30) }).strict();

function parseJson(content: string): unknown {
  try { return JSON.parse(content); } catch { throw new PaperProjectError('PAPER_GENERATION_INVALID_RESPONSE', 'Derived generation returned invalid structured output.'); }
}

@Injectable()
export class DerivedContentService {
  private readonly contextBuilder = new WholeManuscriptGenerationContextBuilder();
  constructor(private readonly repository: PaperProjectRepository, private readonly llm: LlmService) {}

  async generateDerived(userId: string, projectId: string, role: Extract<SectionRole, 'ABSTRACT'|'KEYWORDS'>, body: unknown) {
    const parsed = derivedRequestSchema.safeParse(body);
    if (!parsed.success) throw new PaperProjectError('PAPER_PROJECT_INVALID_REQUEST', 'Derived generation request is invalid.', parsed.error.flatten());
    const before = await this.repository.loadManuscriptSnapshot(userId, projectId);
    if (before.project.status !== 'active') throw new PaperProjectError('PAPER_PROJECT_ARCHIVED', 'Archived paper projects cannot generate derived content.');
    const bodyFingerprint = computeBodyFingerprint(before);
    if (bodyFingerprint !== parsed.data.expectedBodyFingerprint) throw new PaperProjectError('PAPER_MANUSCRIPT_CHANGED', 'The manuscript changed; reload before generating.', { currentBodyFingerprint: bodyFingerprint });
    const existing = before.sections.find((section) => section.sectionRole === role && section.status === 'active');
    if ((existing?.currentRevisionNumber ?? 0) !== parsed.data.expectedCurrentRevisionNumber) throw new PaperProjectError('PAPER_SECTION_REVISION_CONFLICT', 'Derived content changed; reload before generating.', { currentRevisionNumber: existing?.currentRevisionNumber ?? 0 });
    const context = this.contextBuilder.build({ snapshot: before, operation: role, instructions: parsed.data.instructions });
    let generated: Awaited<ReturnType<LlmService['generate']>>;
    try {
      generated = await this.llm.generate({
        messages: [
          { role: 'system', content: `Return strict JSON for ${role}. Summarize only the supplied manuscript. Never invent citations, DOI, statistics, experiments, or findings.` },
          { role: 'user', content: context.text },
        ],
        jsonMode: true, temperature: 0.2, maxTokens: role === 'ABSTRACT' ? 1800 : 500,
      });
    } catch (error) { throw toPaperGenerationError(error); }
    const value = parseJson(generated.content);
    const structured = role === 'ABSTRACT' ? abstractOutput.safeParse(value) : keywordsOutput.safeParse(value);
    if (!structured.success) throw new PaperProjectError('PAPER_GENERATION_INVALID_RESPONSE', 'Derived generation returned invalid structured output.');
    const normalizedKeywords = role === 'KEYWORDS' ? (structured.data as z.infer<typeof keywordsOutput>).keywords : undefined;
    const content = role === 'ABSTRACT'
      ? (structured.data as z.infer<typeof abstractOutput>).content
      : normalizedKeywords!.join(before.project.profile.language === 'zh-CN' ? '；' : '; ');
    const after = await this.repository.loadManuscriptSnapshot(userId, projectId);
    const currentBodyFingerprint = computeBodyFingerprint(after);
    if (currentBodyFingerprint !== bodyFingerprint) throw new PaperProjectError('PAPER_MANUSCRIPT_CHANGED', 'The manuscript changed during generation; no revision was saved.', { currentBodyFingerprint });
    const section = await this.repository.getOrCreateDerivedSection(userId, projectId, role);
    if (section.currentRevisionNumber !== parsed.data.expectedCurrentRevisionNumber) throw new PaperProjectError('PAPER_SECTION_REVISION_CONFLICT', 'Derived content changed during generation.', { currentRevisionNumber: section.currentRevisionNumber });
    const revision = await this.repository.appendRevision(userId, projectId, section.id, section.currentRevisionNumber, {
      content, origin: 'AI_GENERATION', sourceStrategy: 'MODEL_ONLY', actualSupportMode: 'AI_DRAFT', supportState: 'NOT_CLAIMED',
      citations: [], bibliography: [], evidenceTrace: [], warnings: context.metadata.warnings,
      generationMetadata: { operation: 'DERIVED_GENERATION', derivedRole: role, derivedFromBodyFingerprint: bodyFingerprint, generationContext: context.metadata, provider: generated.provider, model: generated.model, ...(generated.usage ? { usage: generated.usage } : {}), ...(normalizedKeywords ? { normalizedKeywords } : {}) },
      rewriteInstruction: parsed.data.instructions,
    });
    return { section: { ...section, currentRevisionNumber: revision.revisionNumber, currentRevision: revision }, revision, derivedState: 'CURRENT' as const, bodyFingerprint };
  }

  async refreshConclusion(userId: string, projectId: string, sectionId: string, body: unknown) {
    const parsed = conclusionRequestSchema.safeParse(body);
    if (!parsed.success) throw new PaperProjectError('PAPER_PROJECT_INVALID_REQUEST', 'Conclusion refresh request is invalid.', parsed.error.flatten());
    const before = await this.repository.loadManuscriptSnapshot(userId, projectId);
    if (before.project.status !== 'active') throw new PaperProjectError('PAPER_PROJECT_ARCHIVED', 'Archived paper projects cannot refresh a conclusion.');
    const target = before.sections.find((section) => section.id === sectionId && section.sectionRole === 'OUTLINE' && section.status === 'active');
    if (!target || !target.outlineNodeId || !before.outline.some((node) => node.id === target.outlineNodeId && node.nodeType === 'writing-unit')) throw new PaperProjectError('PAPER_PROJECT_NOT_FOUND', 'Conclusion target section was not found.');
    if (target.currentRevisionNumber !== parsed.data.expectedCurrentRevisionNumber) throw new PaperProjectError('PAPER_SECTION_REVISION_CONFLICT', 'Conclusion section changed; reload before refreshing.', { currentRevisionNumber: target.currentRevisionNumber });
    const basis = computeConclusionBasisFingerprint(before, sectionId);
    if (basis !== parsed.data.expectedConclusionBasisFingerprint) throw new PaperProjectError('PAPER_MANUSCRIPT_CHANGED', 'The conclusion basis changed; reload before refreshing.', { currentConclusionBasisFingerprint: basis });
    const context = this.contextBuilder.build({ snapshot: before, operation: 'CONCLUSION_REFRESH', targetSectionId: sectionId, instructions: parsed.data.instructions });
    let generated: Awaited<ReturnType<LlmService['generate']>>;
    try {
      generated = await this.llm.generate({ messages: [{ role: 'system', content: 'Return strict JSON {content}. Write a conclusion from supplied manuscript content only; never invent evidence, citations, DOI, statistics, or findings.' }, { role: 'user', content: context.text }], jsonMode: true, temperature: 0.2, maxTokens: 2500 });
    } catch (error) { throw toPaperGenerationError(error); }
    const structured = abstractOutput.safeParse(parseJson(generated.content));
    if (!structured.success) throw new PaperProjectError('PAPER_GENERATION_INVALID_RESPONSE', 'Conclusion refresh returned invalid structured output.');
    const content = structured.data.content;
    const after = await this.repository.loadManuscriptSnapshot(userId, projectId);
    const currentBasis = computeConclusionBasisFingerprint(after, sectionId);
    if (currentBasis !== basis) throw new PaperProjectError('PAPER_MANUSCRIPT_CHANGED', 'The conclusion basis changed during generation; no revision was saved.', { currentConclusionBasisFingerprint: currentBasis });
    const revision = await this.repository.appendRevision(userId, projectId, sectionId, parsed.data.expectedCurrentRevisionNumber, {
      content, baseRevisionId: parsed.data.baseRevisionId, origin: 'AI_REWRITE', sourceStrategy: 'MODEL_ONLY', actualSupportMode: 'AI_DRAFT', supportState: 'NOT_CLAIMED', citations: [], bibliography: [], evidenceTrace: [], warnings: context.metadata.warnings,
      generationMetadata: { operation: 'CONCLUSION_REFRESH', conclusionBasisFingerprint: basis, conclusionTargetSectionId: sectionId, generationContext: context.metadata, provider: generated.provider, model: generated.model, ...(generated.usage ? { usage: generated.usage } : {}) },
      rewriteInstruction: parsed.data.instructions,
    });
    return { revision, conclusionBasisFingerprint: basis };
  }
}
