import { Inject } from '@nestjs/common';
import { GroundedGenerationError } from './grounded-generation.errors';
import type {
  GroundedGenerationRequest,
  GroundedGenerationResult,
} from './grounded-generation.types';
import type { EvidenceSet } from '../knowledge/retrieval/evidence-assembly';
import type { KnowledgeRetrievalInput } from '../knowledge/retrieval/knowledge-retrieval.service';
import type { TextGenerationRequest, TextGenerationResult } from '../ai-tools/llm/llm.types';
import { EvidencePromptBuilder } from './prompt/evidence-prompt.builder';
import { parseGroundedModelOutput } from './prompt/grounded-output.parser';
import { ClaimBindingValidator } from './validation/claim-binding.validator';
import { CitationSemanticsService } from './citation/citation-semantics.service';
import { CitationRenderer } from './citation/citation-renderer';
import { BibliographyBuilder } from './citation/bibliography.builder';
import { GroundedEvidenceAdapter } from './evidence/grounded-evidence.adapter';
import { LlmService } from '../ai-tools/llm/llm.service';

interface EvidenceReader {
  retrieve(input: KnowledgeRetrievalInput): Promise<EvidenceSet>;
}

interface TextGenerator {
  generate(input: TextGenerationRequest): Promise<TextGenerationResult>;
}

export class GroundedGenerationService {
  private readonly promptBuilder = new EvidencePromptBuilder();
  private readonly validator = new ClaimBindingValidator();
  private readonly semantics = new CitationSemanticsService();
  private readonly renderer = new CitationRenderer();
  private readonly bibliography = new BibliographyBuilder();

  constructor(
    @Inject(GroundedEvidenceAdapter)
    private readonly evidence: EvidenceReader,
    @Inject(LlmService)
    private readonly llm: TextGenerator,
    private readonly deadlineMs = 90_000,
  ) {}

  async generate(userId: string, request: GroundedGenerationRequest): Promise<GroundedGenerationResult> {
    this.validateRequest(request);
    const deadline = Date.now() + this.deadlineMs;
    let evidenceSet: EvidenceSet;
    try {
      evidenceSet = await this.withDeadline(this.evidence.retrieve({
        userId,
        queryText: request.queryText,
        ...(request.retrieval?.selection === undefined ? {} : { selection: request.retrieval.selection }),
        ...(request.retrieval?.filters === undefined ? {} : { filters: request.retrieval.filters }),
        ...(request.retrieval?.policy === undefined ? {} : { policy: request.retrieval.policy }),
      }), deadline, 'GROUNDED_GENERATION_RETRIEVAL_UNAVAILABLE');
    } catch (error) {
      if (error instanceof GroundedGenerationError) throw error;
      throw this.mapProviderError(error, 'GROUNDED_GENERATION_RETRIEVAL_UNAVAILABLE');
    }
    if (!evidenceSet.items.some((item) => Boolean(item.evidenceId) && item.text.trim().length > 0)) {
      throw new GroundedGenerationError(
        'GROUNDED_GENERATION_INSUFFICIENT_EVIDENCE',
        'No usable evidence was found.',
        422,
      );
    }

    this.ensureBeforeDeadline(deadline);
    const generationRequest: TextGenerationRequest = {
      messages: this.promptBuilder.build(request.instructions, evidenceSet),
      temperature: 0,
      jsonMode: true,
    };
    let generated: TextGenerationResult;
    try {
      generated = await this.withDeadline(this.llm.generate(generationRequest), deadline, 'GROUNDED_GENERATION_TIMEOUT');
    } catch (error) {
      if (error instanceof GroundedGenerationError) throw error;
      throw this.mapProviderError(error, 'GROUNDED_GENERATION_PROVIDER_UNAVAILABLE');
    }
    this.ensureBeforeDeadline(deadline);
    const modelOutput = parseGroundedModelOutput(generated.content);
    const validation = this.validator.validate(modelOutput, evidenceSet);
    const onUnbound = request.grounding?.onUnbound ?? 'block';
    if (validation.groundingCoverage !== 'complete' && onUnbound === 'block') {
      throw new GroundedGenerationError(
        'GROUNDED_GENERATION_CITATION_INVALID',
        'Every generated unit must be bound to valid evidence.',
        422,
        validation.diagnostics,
      );
    }
    const semantics = this.semantics.create(modelOutput, validation);
    const bibliography = this.bibliography.build(semantics.citations, semantics.evidenceTrace);
    const rendered = this.renderer.render(modelOutput, semantics, bibliography.entries);
    const diagnostics = [
      ...semantics.grounding.diagnostics,
      ...bibliography.diagnostics.map((diagnostic) => ({
        code: 'bibliography-metadata-unresolved' as const,
        detail: `${diagnostic.citationId}${diagnostic.field ? `:${diagnostic.field}` : ''}`,
      })),
    ];
    return {
      schemaVersion: 1,
      status: validation.groundingCoverage === 'complete' ? 'grounded' : 'partial',
      content: rendered.content,
      claims: semantics.claims,
      citations: semantics.citations,
      bibliography: bibliography.entries,
      evidenceTrace: semantics.evidenceTrace,
      grounding: {
        groundingCoverage: validation.groundingCoverage,
        diagnostics,
      },
      provenance: {
        selectedVersionIds: evidenceSet.selectedVersionIds,
        retrievalProfile: evidenceSet.profile,
      },
      generation: {
        provider: generated.provider,
        model: generated.model,
        ...(generated.usage === undefined ? {} : { usage: generated.usage }),
      },
    };
  }

  private validateRequest(request: GroundedGenerationRequest): void {
    if (!request || typeof request.instructions !== 'string' || !request.instructions.trim() || typeof request.queryText !== 'string' || !request.queryText.trim()) {
      throw new GroundedGenerationError('GROUNDED_GENERATION_INVALID_QUERY', 'Instructions and queryText are required.', 400);
    }
  }

  private ensureBeforeDeadline(deadline: number): void {
    if (Date.now() >= deadline) {
      throw new GroundedGenerationError('GROUNDED_GENERATION_TIMEOUT', 'Grounded generation exceeded its orchestration deadline.', 504);
    }
  }

  private async withDeadline<T>(operation: Promise<T>, deadline: number, timeoutCode: 'GROUNDED_GENERATION_TIMEOUT' | 'GROUNDED_GENERATION_RETRIEVAL_UNAVAILABLE'): Promise<T> {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new GroundedGenerationError(timeoutCode === 'GROUNDED_GENERATION_TIMEOUT' ? timeoutCode : 'GROUNDED_GENERATION_RETRIEVAL_UNAVAILABLE', 'The operation exceeded its orchestration deadline.', timeoutCode === 'GROUNDED_GENERATION_TIMEOUT' ? 504 : 502);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new GroundedGenerationError(timeoutCode === 'GROUNDED_GENERATION_TIMEOUT' ? timeoutCode : 'GROUNDED_GENERATION_RETRIEVAL_UNAVAILABLE', 'The operation exceeded its orchestration deadline.', timeoutCode === 'GROUNDED_GENERATION_TIMEOUT' ? 504 : 502)), remaining);
    });
    try {
      return await Promise.race([operation, timeout]);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }

  private mapProviderError(error: unknown, fallback: 'GROUNDED_GENERATION_PROVIDER_UNAVAILABLE' | 'GROUNDED_GENERATION_RETRIEVAL_UNAVAILABLE') {
    const candidate = error as { code?: unknown; response?: { status?: unknown }; message?: unknown };
    const status = candidate?.response?.status;
    if (status === 429 || candidate?.code === 'ERR_TOO_MANY_REQUESTS') {
      return new GroundedGenerationError('GROUNDED_GENERATION_RATE_LIMITED', 'The generation provider is rate limited.', 429);
    }
    if (candidate?.code === 'ETIMEDOUT' || candidate?.code === 'ECONNABORTED') {
      return new GroundedGenerationError('GROUNDED_GENERATION_TIMEOUT', 'The generation provider timed out.', 504);
    }
    return new GroundedGenerationError(fallback, 'The grounded generation dependency is unavailable.', 502);
  }
}
