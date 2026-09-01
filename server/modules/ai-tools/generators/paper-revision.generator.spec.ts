import { LlmService } from '../llm/llm.service';
import { SkillComposer } from '../skills/skill.composer';
import { SkillRegistry } from '../skills/skill.registry';
import { InvariantValidator } from '../skills/validators/invariant.validator';
import { PaperRevisionGenerator } from './paper-revision.generator';

describe('PaperRevisionGenerator', () => {
  const input = {
    text: 'The model was evaluated.',
    revisionTypes: ['logic', 'discussion'],
    requirements: 'Strengthen the discussion and identify missing external validation.',
  };

  const createGenerator = (output = {
    revisedContent: 'The model was evaluated, but external validation remains to be addressed.',
    changeSummary: ['Reorganized the discussion.'],
    unresolvedIssues: ['Author must provide external validation results.'],
    authorInputNeeded: true,
    warnings: [],
  }) => {
    const llmService = {
      generate: jest.fn().mockResolvedValue({
        content: JSON.stringify(output),
        model: 'deepseek-v4-flash',
        usage: { promptTokens: 30, completionTokens: 20, totalTokens: 50 },
      }),
    };
    const composer = { compose: jest.fn().mockReturnValue({ system: 'system', user: 'user', skillIds: ['academic-revision'] }) };
    const registry = { getStackFor: jest.fn().mockReturnValue({ id: 'academic-revision-en', validatorProfile: 'revision-conservative' }) };
    const validator = { validate: jest.fn().mockReturnValue({ status: 'PASS', violations: [], summary: { errors: 0, warnings: 0 } }) };
    return {
      generator: new PaperRevisionGenerator(
        llmService as unknown as LlmService,
        composer as unknown as SkillComposer,
        registry as unknown as SkillRegistry,
        validator as unknown as InvariantValidator,
      ),
      llmService,
      composer,
      registry,
      validator,
    };
  };

  it('passes the real frontend contract into the revision skill stack', async () => {
    const context = createGenerator();

    const result = await context.generator.generate(input);

    expect(context.registry.getStackFor).toHaveBeenCalledWith('revision', 'en');
    expect(context.composer.compose).toHaveBeenCalledWith('academic-revision-en', expect.objectContaining({
      sourceText: input.text,
      requirements: expect.stringContaining('logic, discussion'),
    }));
    expect(context.composer.compose).toHaveBeenCalledWith('academic-revision-en', expect.objectContaining({
      requirements: expect.stringContaining(input.requirements),
    }));
    expect(context.llmService.generate).toHaveBeenCalledWith(expect.objectContaining({ jsonMode: true }));
    expect(context.validator.validate).toHaveBeenCalledWith(expect.objectContaining({
      profile: 'revision-conservative',
      original: input.text,
      revised: expect.any(String),
      userRequirements: input.requirements,
    }));
    expect(result).toMatchObject({
      originalContent: input.text,
      revisedContent: expect.any(String),
      authorInputNeeded: true,
      metadata: { model: 'deepseek-v4-flash', usage: { totalTokens: 50 } },
    });
  });

  it('never substitutes a default example when the submitted text is present', async () => {
    const context = createGenerator();

    await context.generator.generate({ ...input, text: 'REAL_FRONTEND_TEXT' });

    expect(context.composer.compose).toHaveBeenCalledWith('academic-revision-en', expect.objectContaining({
      sourceText: 'REAL_FRONTEND_TEXT',
    }));
  });

  it('accepts generic external-dataset discussion without naming a new entity', async () => {
    const context = createGenerator({
      revisedContent: 'Future work should evaluate the model on independent external datasets.',
      changeSummary: [],
      unresolvedIssues: [],
      authorInputNeeded: false,
      warnings: [],
    });

    const result = await context.generator.generate({
      text: 'Our model achieves 92.4% mAP on DvXray.',
      requirements: 'Discuss the need for external dataset validation.',
      language: 'en',
    });

    expect(result.authorInputNeeded).toBe(false);
    expect(result.unresolvedIssues).toEqual([]);
  });

  it('accepts a non-blocking unresolved research limitation when authorInputNeeded is false', async () => {
    const context = createGenerator({
      revisedContent: 'External validation remains necessary.',
      changeSummary: [],
      unresolvedIssues: ['External validation results were not provided.'],
      authorInputNeeded: false,
      warnings: [],
    });

    const result = await context.generator.generate(input);

    expect(result.authorInputNeeded).toBe(false);
    expect(result.unresolvedIssues).toEqual(['External validation results were not provided.']);
  });

  it('rejects authorInputNeeded=true without an unresolved issue explanation', async () => {
    const context = createGenerator({
      revisedContent: 'External validation remains necessary.',
      changeSummary: [],
      unresolvedIssues: [],
      authorInputNeeded: true,
      warnings: [],
    });

    await expect(context.generator.generate(input)).rejects.toThrow(
      'Revision output consistency error: authorInputNeeded=true requires unresolvedIssues',
    );
  });

  it('accepts an output with no unresolved issues and no author input needed', async () => {
    const context = createGenerator({
      revisedContent: 'The discussion is complete and supported by the supplied evidence.',
      changeSummary: [],
      unresolvedIssues: [],
      authorInputNeeded: false,
      warnings: [],
    });

    const result = await context.generator.generate(input);

    expect(result.authorInputNeeded).toBe(false);
    expect(result.unresolvedIssues).toEqual([]);
  });

  it('replays the saved real Test B output through parsing, consistency, validation, and delivery', async () => {
    const context = createGenerator({
      revisedContent: 'Our model achieves 92.4% mAP on DvXray, demonstrating the effectiveness of the proposed method. However, several limitations should be acknowledged. First, the model\'s performance is evaluated only on DvXray, which may not fully represent the diversity of real-world scenarios. The dataset\'s specific characteristics, such as image quality and object distribution, could influence the results, and the model\'s generalization to other domains remains uncertain. Second, the computational complexity of the method has not been thoroughly analyzed, and its efficiency in resource-constrained environments is yet to be verified. Third, the model\'s robustness to adversarial attacks or noisy inputs has not been tested, which could be critical for practical deployment. To address these limitations, future work should include external validation on independent datasets to assess the model\'s generalizability. Additionally, investigating the model\'s performance under various conditions, such as different imaging protocols or hardware settings, would provide a more comprehensive understanding of its applicability. Without such external validation, the practical applicability of the method, while promising, should be considered preliminary.',
      changeSummary: [
        'Rewrote the discussion to avoid simple repetition of results, focusing instead on limitations and future work.',
        'Added discussion of model limitations, including dataset-specific evaluation, computational complexity, and robustness to adversarial inputs.',
        'Added discussion of external dataset validation without fabricating specific metrics or datasets, using general wording.',
        'Clarified that practical applicability is preliminary pending external validation.',
      ],
      unresolvedIssues: ['No specific external dataset results were provided; thus, the discussion uses general terms and does not include fabricated metrics.'],
      authorInputNeeded: false,
      warnings: [],
    });

    const result = await context.generator.generate({
      text: 'Our model achieves 92.4% mAP on DvXray. These results demonstrate the effectiveness of the proposed method. The method performs well in our experiments and therefore has strong practical applicability.',
      requirements: '请重写这一段 Discussion。减少对结果的简单重复，增加对模型局限性的讨论，并补充外部数据集验证的讨论。如果没有提供真实的外部数据集实验结果，不要编造任何指标。',
      language: 'en',
    });

    expect(result.authorInputNeeded).toBe(false);
    expect(result.unresolvedIssues).toHaveLength(1);
    expect(result.validation.status).toBe('PASS');
    expect(context.validator.validate).toHaveBeenCalledTimes(1);
  });
});
