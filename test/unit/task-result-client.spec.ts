import {
  adaptTaskResult,
  normalizeTaskResultText,
} from '../../client/src/lib/task-result';

describe('TaskResultEnvelope adapters', () => {
  it('adapts a Polish result into a copyable/exportable envelope', () => {
    const result = adaptTaskResult('polish', {
      originalContent: ' Original text ',
      revisedContent: ' Revised text ',
      changes: [{ original: 'Original', revised: 'Revised', reason: 'clarity' }],
      warnings: ['review terminology'],
    });

    expect(result).toEqual({
      valid: true,
      envelope: expect.objectContaining({
        schemaVersion: 1,
        kind: 'polish',
        originalContent: ' Original text ',
        revisedContent: ' Revised text ',
        content: ' Revised text ',
        warnings: ['review terminology'],
        exportable: true,
      }),
    });
    if (result.valid) expect(normalizeTaskResultText(result.envelope)).toBe('Revised text');
  });

  it('adapts Topic Generation into readable text without claiming legacy support', () => {
    const result = adaptTaskResult('topic-generation', {
      topics: [{
        title: 'A real topic',
        researchDirection: 'Education',
        innovation: 'A bounded question',
        difficulty: 'medium',
        keyIdeas: ['review literature'],
      }],
    });

    expect(result).toMatchObject({ valid: true, envelope: { kind: 'topic-generation', exportable: true } });
    if (result.valid) expect(result.envelope.content).toContain('A real topic');
    expect(adaptTaskResult('literature', { references: [{ title: 'synthetic' }] })).toMatchObject({
      valid: false,
    });
  });

  it('returns an invalid result for malformed production output', () => {
    expect(adaptTaskResult('paper-revision', {
      originalContent: 'source',
      changeSummary: [],
    })).toEqual({ valid: false, reason: 'malformed' });
  });

  it('adapts a Paper Revision result into the same envelope contract', () => {
    const result = adaptTaskResult('paper-revision', {
      originalContent: 'Source',
      revisedContent: 'Revised',
      changeSummary: ['Clarified the argument'],
      unresolvedIssues: [],
      warnings: [],
    });

    expect(result).toMatchObject({
      valid: true,
      envelope: {
        schemaVersion: 1,
        kind: 'paper-revision',
        content: 'Revised',
        exportable: true,
      },
    });
  });
});
