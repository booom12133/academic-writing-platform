import type { OpenAlexWorkLike } from './academic-search.normalization';

export interface OpenAlexPage {
  meta: {
    count: number;
    next_cursor: string | null;
  };
  results: OpenAlexWorkLike[];
}
