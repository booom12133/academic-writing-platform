import { InvariantExtractor } from './invariant.extractor';

describe('InvariantExtractor', () => {
  it('extracts protected academic values and technical identifiers', () => {
    const tokens = new InvariantExtractor().extract(
      'On DvXray, RT-DETR achieved 92.4% mAP (p = 0.032) [12]. DOI: 10.1234/example. The dose was 10 mg. $x_i^2$.',
    );
    const values = tokens.map((token) => `${token.type}:${token.value}`);

    expect(values).toEqual(expect.arrayContaining([
      'percentage:92.4%',
      'p-value:p = 0.032',
      'citation:[12]',
      'doi:10.1234/example',
      'unit:10 mg',
      'formula:$x_i^2$',
      'technical-identifier:DvXray',
      'technical-identifier:RT-DETR',
    ]));
  });

  it('keeps repeated invariants as a multiset', () => {
    const tokens = new InvariantExtractor().extract('10 mg was used, followed by 10 mg.');

    expect(tokens.filter((token) => token.type === 'unit')).toHaveLength(2);
  });

  it('recognizes acronym-prefixed dataset identifiers such as PIDray', () => {
    const tokens = new InvariantExtractor().extract('The comparison dataset was PIDray.');

    expect(tokens).toEqual(expect.arrayContaining([
      { type: 'technical-identifier', value: 'PIDray' },
    ]));
  });

  it.each([
    'real-world',
    'cross-domain',
    'state-of-the-art',
    'well-known',
    'single-dataset',
    'X-ray',
  ])('does not classify ordinary hyphenated language as a technical identifier: %s', (value) => {
    const tokens = new InvariantExtractor().extract(`The method has ${value} limitations.`);

    expect(tokens).not.toContainEqual({ type: 'technical-identifier', value });
  });

  it.each([
    'RT-DETR',
    'GPT-4',
    'BERT-base',
    'ResNet-50',
    'YOLO-v8',
    'PIDray',
    'DvXray',
    'mAP',
  ])('keeps technical identifiers protected: %s', (value) => {
    const tokens = new InvariantExtractor().extract(`The model is ${value}.`);

    expect(tokens).toContainEqual({ type: 'technical-identifier', value });
  });
});
