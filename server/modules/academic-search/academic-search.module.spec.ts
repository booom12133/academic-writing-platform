jest.mock('./academic-search.controller', () => ({ AcademicSearchController: class AcademicSearchController {} }));

import { Test } from '@nestjs/testing';
import { ACADEMIC_SEARCH_CONFIG } from './academic-search.config';
import { ACADEMIC_SEARCH_PROVIDER } from './academic-search.provider';
import { AcademicSearchModule } from './academic-search.module';
import { AcademicSearchService } from './academic-search.service';
import { OpenAlexClient } from './openalex.client';
import { OpenAlexProvider } from './openalex.provider';

describe('AcademicSearchModule', () => {
  it('wires the OpenAlex provider behind the replaceable academic search seam', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AcademicSearchModule] }).compile();

    expect(moduleRef.get(AcademicSearchService)).toBeInstanceOf(AcademicSearchService);
    expect(moduleRef.get(OpenAlexClient)).toBeInstanceOf(OpenAlexClient);
    expect(moduleRef.get(OpenAlexProvider)).toBeInstanceOf(OpenAlexProvider);
    expect(moduleRef.get(ACADEMIC_SEARCH_PROVIDER)).toBeInstanceOf(OpenAlexProvider);
    expect(moduleRef.get(ACADEMIC_SEARCH_CONFIG)).toMatchObject({ baseUrl: expect.any(String), maxPageSize: 100 });
    await moduleRef.close();
  });

  it('exports only the public provider seam and service', () => {
    const exports = Reflect.getMetadata('exports', AcademicSearchModule);
    expect(exports).toEqual(expect.arrayContaining([ACADEMIC_SEARCH_PROVIDER, AcademicSearchService]));
    expect(exports).not.toContain(OpenAlexClient);
  });
});
