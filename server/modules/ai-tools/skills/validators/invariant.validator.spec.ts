import { InvariantValidator } from './invariant.validator';

describe('InvariantValidator', () => {
  const validator = new InvariantValidator();

  it('passes unchanged protected values in polish-strict mode', () => {
    const result = validator.validate({
      profile: 'polish-strict',
      original: 'Accuracy was 32.7% (p = 0.032) using RT-DETR [12] at 10 mg.',
      revised: 'The accuracy was 32.7% (p = 0.032) using RT-DETR [12] at 10 mg.',
    });

    expect(result.status).toBe('PASS');
    expect(result.violations).toHaveLength(0);
  });

  it.each([
    ['p = 0.032', 'p = 0.023', 'p-value'],
    ['DvXray', 'PIDray', 'technical-identifier'],
    ['[12]', '[13]', 'citation'],
    ['10 mg', '20 mg', 'unit'],
  ])('reports changed %s as an error', (originalValue, revisedValue, type) => {
    const result = validator.validate({
      profile: 'polish-strict',
      original: `The result was ${originalValue}.`,
      revised: `The result was ${revisedValue}.`,
    });

    expect(result.status).toBe('ERROR');
    expect(result.violations.some((violation) => violation.type === type && violation.severity === 'ERROR')).toBe(true);
  });

  it('warns when a figure reference changes in polish-strict mode', () => {
    const result = validator.validate({
      profile: 'polish-strict',
      original: 'See Figure 4 for details.',
      revised: 'See Figure 5 for details.',
    });

    expect(result.status).toBe('WARN');
    expect(result.violations).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'figure/table', severity: 'WARN' }),
    ]));
  });

  it('warns when revision removes an original invariant', () => {
    const result = validator.validate({
      profile: 'revision-conservative',
      original: 'The model achieved 92.4%.',
      revised: 'The results section was removed.',
      userRequirements: 'Delete the result description.',
    });

    expect(result.status).toBe('WARN');
    expect(result.violations).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'percentage', originalValue: '92.4%', severity: 'WARN' }),
    ]));
  });

  it('errors when revision introduces a value absent from the source and requirements', () => {
    const result = validator.validate({
      profile: 'revision-conservative',
      original: 'The model was evaluated.',
      revised: 'The model achieved 94.7%.',
      userRequirements: 'Strengthen the discussion.',
    });

    expect(result.status).toBe('ERROR');
    expect(result.violations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'percentage',
        revisedValue: '94.7%',
        message: expect.stringContaining('UNSUPPORTED_NEW_VALUE'),
      }),
    ]));
  });

  it('allows a technical identifier to repeat in revision-conservative mode', () => {
    const result = validator.validate({
      profile: 'revision-conservative',
      original: 'Our model achieves 92.4% mAP on DvXray.',
      revised: 'The result on DvXray should be interpreted cautiously because evaluation is currently limited to DvXray.',
      userRequirements: 'Improve the discussion.',
    });

    expect(result.violations.filter((violation) => violation.type === 'technical-identifier' && violation.severity === 'ERROR')).toHaveLength(0);
  });

  it('allows mAP to repeat in revision-conservative mode', () => {
    const result = validator.validate({
      profile: 'revision-conservative',
      original: 'The model achieves 92.4% mAP.',
      revised: 'Although the reported mAP is 92.4%, the mAP alone is insufficient to establish generalizability.',
    });

    expect(result.violations.filter((violation) => violation.type === 'technical-identifier' && violation.severity === 'ERROR')).toHaveLength(0);
  });

  it('still rejects a genuinely new dataset identifier in revision-conservative mode', () => {
    const result = validator.validate({
      profile: 'revision-conservative',
      original: 'DvXray',
      revised: 'DvXray and PIDray',
    });

    expect(result.status).toBe('ERROR');
    expect(result.violations).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'technical-identifier', revisedValue: 'PIDray', severity: 'ERROR' }),
    ]));
  });

  it('rejects a specific external dataset name absent from source and requirements', () => {
    const result = validator.validate({
      profile: 'revision-conservative',
      original: 'Our model achieves 92.4% mAP on DvXray.',
      revised: 'Future work should evaluate the method on COCO.',
      userRequirements: 'Discuss the need for external dataset validation.',
    });

    expect(result.status).toBe('ERROR');
    expect(result.violations).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'technical-identifier', revisedValue: 'COCO', severity: 'ERROR' }),
    ]));
  });

  it('allows an explicitly provided dataset name in revision-conservative mode', () => {
    const result = validator.validate({
      profile: 'revision-conservative',
      original: 'The comparison dataset was PIDray.',
      revised: 'Future work should further evaluate the method on PIDray.',
      userRequirements: 'Retain the PIDray comparison.',
    });

    expect(result.violations.filter((violation) => violation.severity === 'ERROR')).toHaveLength(0);
  });

  it('still rejects a genuinely new percentage in revision-conservative mode', () => {
    const result = validator.validate({
      profile: 'revision-conservative',
      original: '92.4%',
      revised: '92.4% and 94.7%',
    });

    expect(result.status).toBe('ERROR');
    expect(result.violations).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'percentage', revisedValue: '94.7%', severity: 'ERROR' }),
    ]));
  });

  it('warns rather than errors when revision removes original invariants', () => {
    const result = validator.validate({
      profile: 'revision-conservative',
      original: '92.4% on DvXray',
      revised: 'The method demonstrates promising performance.',
    });

    expect(result.status).toBe('WARN');
    expect(result.summary.errors).toBe(0);
    expect(result.violations.every((violation) => violation.severity === 'WARN')).toBe(true);
  });

  it('keeps polish-strict occurrence-count behavior unchanged', () => {
    const result = validator.validate({
      profile: 'polish-strict',
      original: 'DvXray',
      revised: 'DvXray and DvXray',
    });

    expect(result.status).toBe('ERROR');
    expect(result.violations).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'technical-identifier', revisedValue: 'DvXray', severity: 'ERROR' }),
    ]));
  });
});
