import { distanceOperator } from './retrieval.profile';
import type { RetrievalDistanceMetric } from './retrieval.types';
import { buildRetrievalOperator } from './knowledge-retrieval.repository';

describe('KnowledgeRetrievalRepository', () => {
  it.each([
    ['cosine', '<=>'],
    ['inner-product', '<#>'],
    ['l2', '<->'],
  ] as const)('uses only the allowlisted %s pgvector operator', (metric, operator) => {
    expect(buildRetrievalOperator(metric as RetrievalDistanceMetric)).toBe(distanceOperator(metric));
    expect(buildRetrievalOperator(metric as RetrievalDistanceMetric)).toBe(operator);
  });
});
