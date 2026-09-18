import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AcademicSearchImportController } from '../../server/modules/academic-search-import/academic-search-import.controller';
import { AcademicSearchImportService } from '../../server/modules/academic-search-import/academic-search-import.service';

describe('Academic Search import HTTP boundary', () => {
  let app: INestApplication;
  let baseUrl: string;
  const service = { import: jest.fn() };

  beforeEach(async () => {
    service.import.mockReset();
    const module = await Test.createTestingModule({
      controllers: [AcademicSearchImportController],
      providers: [{ provide: AcademicSearchImportService, useValue: service }],
    }).compile();
    app = module.createNestApplication();
    app.use((request: { userContext?: { userId: string } }, _response: unknown, next: () => void) => { request.userContext = { userId: 'owner-1' }; next(); });
    await app.listen(0);
    const address = app.getHttpServer().address() as { port: number };
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => app.close());

  it('returns the strict import union from POST /api/academic-search/import', async () => {
    const result = { kind: 'metadata-only', source: { id: 'source-1', contentStatus: 'metadata-only', isGroundedEvidence: false }, fullTextReason: 'not-advertised', uploadRequired: true };
    service.import.mockResolvedValue(result);
    const response = await fetch(`${baseUrl}/api/academic-search/import`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ provider: 'openalex', externalRecordId: 'W123' }) });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(result);
    expect(service.import).toHaveBeenCalledWith('owner-1', { provider: 'openalex', externalRecordId: 'W123' });
  });
});
