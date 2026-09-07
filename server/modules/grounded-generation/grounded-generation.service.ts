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
import { parseGroundedGenerationRequest } from './grounded-generation.http.dto';

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
    const validatedRequest = this.validateRequest(request);
    const deadline = Date.now() + this.deadlineMs;
    let evidenceSet: EvidenceSet;
    try {
      evidenceSet = await this.withDeadline(this.evidence.retrieve({
        userId,
        queryText: validatedRequest.queryText,
        ...(validatedRequest.retrieval?.selection === undefined ? {} : { selection: validatedRequest.retrieval.selection }),
        ...(validatedRequest.retrieval?.filters === undefined ? {} : { filters: validatedRequest.retrieval.filters }),
        ...(validatedRequest.retrieval?.policy === undefined ? {} : { policy: validatedRequest.retrieval.policy }),
      }), deadline);
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
      messages: this.promptBuilder.build(validatedRequest.instructions, evidenceSet),
      temperature: 0,
      jsonMode: true,
    };
    let generated: TextGenerationResult;
    try {
      generated = await this.withDeadline(this.llm.generate(generationRequest), deadline);
    } catch (error) {
      if (error instanceof GroundedGenerationError) throw error;
      throw this.mapProviderError(error, 'GROUNDED_GENERATION_PROVIDER_UNAVAILABLE');
    }
    this.ensureBeforeDeadline(deadline);
    const modelOutput = parseGroundedModelOutput(generated.content);
    const validation = this.validator.validate(modelOutput, evidenceSet);
    const onUnbound = validatedRequest.grounding?.onUnbound ?? 'block';
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

  private validateRequest(request: GroundedGenerationRequest): GroundedGenerationRequest {
    return parseGroundedGenerationRequest(request);
  }

  private ensureBeforeDeadline(deadline: number): void {
    if (Date.now() >= deadline) {
      throw new GroundedGenerationError('GROUNDED_GENERATION_TIMEOUT', 'Grounded generation exceeded its orchestration deadline.', 504);
    }
  }

  private async withDeadline<T>(operation: Promise<T>, deadline: number): Promise<T> {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new GroundedGenerationError('GROUNDED_GENERATION_TIMEOUT', 'The operation exceeded its orchestration deadline.', 504);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new GroundedGenerationError('GROUNDED_GENERATION_TIMEOUT', 'The operation exceeded its orchestration deadline.', 504)), remaining);
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
    const errorText = `${String(candidate?.code ?? '')} ${String(candidate?.message ?? '')}`;
    if (status === 429 || candidate?.code === 'ERR_TOO_MANY_REQUESTS' || /rate[ -]?limit|too many requests/i.test(errorText)) {
      return new GroundedGenerationError('GROUNDED_GENERATION_RATE_LIMITED', 'The generation provider is rate limited.', 429);
    }
    if (candidate?.code === 'ETIMEDOUT' || candidate?.code === 'ECONNABORTED' || /timed? ?out|timeout/i.test(errorText)) {
      return new GroundedGenerationError('GROUNDED_GENERATION_TIMEOUT', 'The generation provider timed out.', 504);
    }
    return new GroundedGenerationError(fallback, 'The grounded generation dependency is unavailable.', 502);
  }
}
