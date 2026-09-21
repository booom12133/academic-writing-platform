import { PaperGenerationService } from './paper-generation.service';

describe('P4 section generation orchestration', () => {
  const section = { id: 'section', status: 'active', currentRevisionNumber: 0, outlineNodeId: 'node' };
  const project = { id: 'project', selectedTitle: 'Title', profile: { schemaVersion: 1, researchIdea: 'Idea', paperType: 'other', language: 'en' }, defaultSourceStrategy: 'MODEL_ONLY', status: 'active', lockVersion: 0 };
  const repository = () => ({ require: jest.fn().mockResolvedValue(project), getSection: jest.fn().mockResolvedValue(section), listOutline: jest.fn().mockResolvedValue([{ id: 'node', nodeType: 'writing-unit', title: 'Section', position: 0, status: 'active' }]), listRevisions: jest.fn().mockResolvedValue([]), appendRevision: jest.fn(async (_u,_p,_s,_e,input)=>({ id:'revision',sectionId:'section',revisionNumber:1,createdAt:new Date().toISOString(),...input })) });

  it('creates an AI_DRAFT revision without sources or retrieval', async () => {
    const repo=repository(); const grounded={generate:jest.fn()};
    const service=new PaperGenerationService(repo as any,{list:jest.fn()} as any,{generate:jest.fn().mockResolvedValue({result:{content:'Safe draft',integrityWarnings:[]},metadata:{provider:'fake',model:'fixture'}})} as any,grounded as any);
    const result=await service.generate('u','project','section',{operation:'GENERATE',sourceStrategy:'MODEL_ONLY',expectedCurrentRevisionNumber:0});
    expect(result.revisionCreated).toBe(true); expect(repo.appendRevision).toHaveBeenCalledWith('u','project','section',0,expect.objectContaining({actualSupportMode:'AI_DRAFT',supportState:'NOT_CLAIMED',citations:[],evidenceTrace:[]}));
    expect(grounded.generate).not.toHaveBeenCalled();
  });

  it('fails closed before grounded generation when selected evidence is not ready', async () => {
    const repo=repository(); const grounded={generate:jest.fn()};
    const service=new PaperGenerationService(repo as any,{list:jest.fn().mockResolvedValue([{id:'s',documentVersionId:'v',originClass:'USER_KNOWLEDGE',evidenceAvailability:'NOT_INDEXED'}])} as any,{generate:jest.fn()} as any,grounded as any);
    const result=await service.generate('u','project','section',{operation:'GENERATE',sourceStrategy:'USER_KNOWLEDGE',expectedCurrentRevisionNumber:0});
    expect(result).toMatchObject({revisionCreated:false,evidenceAvailability:'NOT_INDEXED'}); expect(grounded.generate).not.toHaveBeenCalled(); expect(repo.appendRevision).not.toHaveBeenCalled();
  });

  it('maps model provider timeouts to the sanitized P4 error contract', async () => {
    const service=new PaperGenerationService(repository() as any,{list:jest.fn()} as any,{generate:jest.fn().mockRejectedValue(new Error('request timed out'))} as any,{generate:jest.fn()} as any);
    await expect(service.generate('u','project','section',{operation:'GENERATE',sourceStrategy:'MODEL_ONLY',expectedCurrentRevisionNumber:0}))
      .rejects.toMatchObject({code:'PAPER_GENERATION_TIMEOUT',message:'Paper generation timed out.'});
  });
});
