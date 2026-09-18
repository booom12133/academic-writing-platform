import { AcademicSearchImportController } from './academic-search-import.controller';

describe('AcademicSearchImportController', () => {
  it('delegates only the authenticated owner and request body', async () => {
    const service = { import: jest.fn().mockResolvedValue({ kind: 'metadata-only' }) };
    const controller = new AcademicSearchImportController(service as never);
    const body = { provider: 'openalex', externalRecordId: 'W123' };
    await expect(controller.import({ userContext: { userId: 'owner-1' } } as never, body)).resolves.toEqual({ kind: 'metadata-only' });
    expect(service.import).toHaveBeenCalledWith('owner-1', body);
  });

  it('rejects missing authentication before orchestration', async () => {
    const service = { import: jest.fn() };
    const controller = new AcademicSearchImportController(service as never);
    await expect(controller.import({} as never, {})).rejects.toMatchObject({ status: 401 });
    expect(service.import).not.toHaveBeenCalled();
  });
});
