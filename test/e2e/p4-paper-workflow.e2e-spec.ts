import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DRIZZLE_DATABASE } from '../../server/database/database.types';
import { createLocalDevelopmentDatabase, type LocalDevelopmentDatabase } from '../../server/database/local-development.database';
import { knowledgeDocuments, knowledgeDocumentVersions, knowledgeSourceRecords } from '../../server/database/schema';
import { TopicGenerationGenerator } from '../../server/modules/ai-tools/generators/topic-generation.generator';
import { GroundedGenerationService } from '../../server/modules/grounded-generation/grounded-generation.service';
import { KnowledgeRepository } from '../../server/modules/knowledge/knowledge.repository';
import { KnowledgeIndexRepository } from '../../server/modules/knowledge/indexing/knowledge-index.repository';
import { PaperOutlineGenerator } from '../../server/modules/paper-project/generators/paper-outline.generator';
import { PaperSectionModelGenerator } from '../../server/modules/paper-project/generators/paper-section-model.generator';
import { ResearchPlanGenerator } from '../../server/modules/paper-project/generators/research-plan.generator';
import { PaperGenerationService } from '../../server/modules/paper-project/paper-generation.service';
import { PaperPlanningService } from '../../server/modules/paper-project/paper-planning.service';
import { PaperProjectController } from '../../server/modules/paper-project/paper-project.controller';
import { PaperProjectRepository } from '../../server/modules/paper-project/paper-project.repository';
import { PaperProjectService } from '../../server/modules/paper-project/paper-project.service';
import { PaperSourceService } from '../../server/modules/paper-project/paper-source.service';
import { PaperWorkflowController } from '../../server/modules/paper-project/paper-workflow.controller';
import { PaperWorkflowService } from '../../server/modules/paper-project/paper-workflow.service';

const USER_SOURCE='10000000-0000-4000-8000-000000000001';
const USER_DOCUMENT='10000000-0000-4000-8000-000000000002';
const USER_VERSION='10000000-0000-4000-8000-000000000003';
const WEB_SOURCE='20000000-0000-4000-8000-000000000001';
const WEB_DOCUMENT='20000000-0000-4000-8000-000000000002';
const WEB_VERSION='20000000-0000-4000-8000-000000000003';
const META_SOURCE='30000000-0000-4000-8000-000000000001';

const plan={schemaVersion:1,researchProblem:'Transparent drafting',researchQuestions:['How?'],researchObjectives:['Explain'],methodology:{approach:'review',methods:['synthesis']},dataMaterialRequirements:[],expectedContributions:['Workflow'],limitationsAssumptions:[],keywords:['writing']};

describe('P4 application-level HTTP workflow',()=>{
  let local:LocalDevelopmentDatabase;
  let app:INestApplication;
  let baseUrl:string;
  const topics={generate:jest.fn()};
  const plans={generate:jest.fn()};
  const outlines={generate:jest.fn()};
  const model={generate:jest.fn()};
  const grounded={generate:jest.fn()};
  const indexes={getLatestIndexForVersion:jest.fn()};
  const records=new Map<string,any>();
  const versions=new Map<string,any>();
  const documents=new Map<string,any>();
  const knowledge={
    getSourceRecord:jest.fn(async(userId:string,id:string)=>records.get(`${userId}:${id}`)??null),
    getVersion:jest.fn(async(userId:string,id:string)=>versions.get(`${userId}:${id}`)??null),
    getDocument:jest.fn(async(userId:string,id:string)=>documents.get(`${userId}:${id}`)??null),
  };

  beforeEach(async()=>{
    local=await createLocalDevelopmentDatabase();
    records.clear();versions.clear();documents.clear();
    jest.clearAllMocks();
    topics.generate.mockResolvedValue({resultData:{topics:[{title:'Evidence-aware writing',researchDirection:'writing',innovation:'traceability',difficulty:'moderate',keyIdeas:['evidence']}]},metadata:{provider:'fake',model:'topic'}});
    plans.generate.mockResolvedValue({result:plan,metadata:{provider:'fake',model:'plan'}});
    outlines.generate.mockResolvedValue({result:{nodes:[{clientKey:'intro',nodeType:'writing-unit',title:'Introduction',position:0}]},metadata:{provider:'fake',model:'outline'}});
    model.generate.mockResolvedValueOnce({result:{content:'Initial AI draft',integrityWarnings:[]},metadata:{provider:'fake',model:'section'}}).mockResolvedValue({result:{content:'Rewritten AI draft',integrityWarnings:[]},metadata:{provider:'fake',model:'section'}});
    indexes.getLatestIndexForVersion.mockImplementation(async(_userId:string,versionId:string)=>versionId===USER_VERSION||versionId===WEB_VERSION?{status:'indexed'}:null);
    grounded.generate.mockImplementation(async(_userId:string,request:any)=>{
      const selected:string[]=request.retrieval.selection.documentVersionIds;
      return {status:'grounded',content:'Grounded content [1].',citations:[{citationId:'citation-1',evidenceIds:selected.map(id=>`e-${id}`)}],bibliography:[],evidenceTrace:selected.map(id=>({evidenceId:`e-${id}`,provenance:{documentVersionId:id},citationLocator:{documentVersionId:id,chunkId:`chunk-${id}`}})),provenance:{selectedVersionIds:selected},generation:{provider:'fake',model:'grounded'}};
    });
    const repository=new PaperProjectRepository(local.db);
    const projectService=new PaperProjectService(repository);
    const workflowService=new PaperWorkflowService(repository);
    const sourceService=new PaperSourceService(repository,knowledge as any,indexes as any);
    const generationService=new PaperGenerationService(repository,sourceService,model as any,grounded as any);
    const planningService=new PaperPlanningService(repository,topics as any,plans as any,outlines as any);
    const module=await Test.createTestingModule({
      controllers:[PaperProjectController,PaperWorkflowController],
      providers:[
        {provide:DRIZZLE_DATABASE,useValue:local.db},{provide:PaperProjectRepository,useValue:repository},{provide:PaperProjectService,useValue:projectService},{provide:PaperWorkflowService,useValue:workflowService},{provide:PaperSourceService,useValue:sourceService},{provide:PaperGenerationService,useValue:generationService},{provide:PaperPlanningService,useValue:planningService},
        {provide:TopicGenerationGenerator,useValue:topics},{provide:ResearchPlanGenerator,useValue:plans},{provide:PaperOutlineGenerator,useValue:outlines},{provide:PaperSectionModelGenerator,useValue:model},
        {provide:GroundedGenerationService,useValue:grounded},{provide:KnowledgeRepository,useValue:knowledge},{provide:KnowledgeIndexRepository,useValue:indexes},
      ],
    }).compile();
    app=module.createNestApplication();
    app.use((request:{headers:Record<string,string|undefined>;userContext?:{userId:string}},_response:unknown,next:()=>void)=>{const userId=request.headers['x-test-user'];if(userId)request.userContext={userId};next();});
    await app.listen(0);
    const address=app.getHttpServer().address() as {port:number};
    baseUrl=`http://127.0.0.1:${address.port}`;
  });
  afterEach(async()=>{await app.close();await local.close();});

  async function http(method:string,path:string,body?:unknown,userId:string|null='user-a'){
    const response=await fetch(`${baseUrl}${path}`,{method,headers:{...(body===undefined?{}:{'content-type':'application/json'}),...(userId?{'x-test-user':userId}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
    return{status:response.status,body:await response.json() as any};
  }
  async function createReadyProject(){
    const created=await http('POST','/api/paper-projects',{profile:{schemaVersion:1,researchIdea:'Transparent academic drafting',paperType:'literature-review',language:'en'},selectedTitle:'Evidence-aware writing'});
    const outline=await http('PUT',`/api/paper-projects/${created.body.id}/outline`,{expectedLockVersion:0,nodes:[{clientKey:'intro',nodeType:'writing-unit',title:'Introduction',position:0}]});
    return{projectId:created.body.id,sectionId:outline.body.sections[0].id,lockVersion:outline.body.lockVersion};
  }
  async function seedSource(sourceId:string,external:boolean,documentId?:string,versionId?:string){
    await local.db.insert(knowledgeSourceRecords).values({id:sourceId,userId:'user-a',kind:'scholarly-work',canonicalMetadata:{},status:'active'});
    records.set(`user-a:${sourceId}`,{id:sourceId,userId:'user-a',status:'active',externalProvenance:external?[{connectorKind:'academic-discovery',provider:'openalex'}]:[]});
    if(!documentId||!versionId)return;
    await local.db.insert(knowledgeDocuments).values({id:documentId,userId:'user-a',sourceRecordId:sourceId,originKind:external?'academic-search':'upload',displayName:'Fixture',sourceType:'txt',activeVersionId:versionId,lifecycleStatus:'active'});
    await local.db.insert(knowledgeDocumentVersions).values({id:versionId,userId:'user-a',documentId,versionNumber:1,originalContentHash:`hash-${versionId}`,parserProfile:{},chunkingProfile:{},lifecycleStatus:'active',readinessStatus:'ready',indexInputFingerprint:`fingerprint-${versionId}`});
    documents.set(`user-a:${documentId}`,{id:documentId,userId:'user-a',sourceRecordId:sourceId,lifecycleStatus:'active'});
    versions.set(`user-a:${versionId}`,{id:versionId,userId:'user-a',documentId,lifecycleStatus:'active'});
  }

  it('A — completes zero-upload planning, drafting, editing, rewrite, reload, and ownership boundaries over HTTP',async()=>{
    const created=await http('POST','/api/paper-projects',{profile:{schemaVersion:1,researchIdea:'Transparent academic drafting',paperType:'literature-review',language:'en'}});
    expect(created.status).toBe(201);
    const projectId=created.body.id;
    const topic=await http('POST',`/api/paper-projects/${projectId}/topics/generate`,{expectedLockVersion:0,count:4});
    const titled=await http('PUT',`/api/paper-projects/${projectId}/topic-selection`,{expectedLockVersion:0,title:topic.body.resultData.topics[0].title});
    const proposedPlan=await http('POST',`/api/paper-projects/${projectId}/research-plan/generate`,{expectedLockVersion:titled.body.lockVersion});
    const savedPlan=await http('PUT',`/api/paper-projects/${projectId}/research-plan`,{expectedLockVersion:titled.body.lockVersion,researchPlan:proposedPlan.body.result});
    const proposedOutline=await http('POST',`/api/paper-projects/${projectId}/outline/generate`,{expectedLockVersion:savedPlan.body.lockVersion});
    const savedOutline=await http('PUT',`/api/paper-projects/${projectId}/outline`,{expectedLockVersion:savedPlan.body.lockVersion,nodes:proposedOutline.body.result.nodes});
    const sectionId=savedOutline.body.sections[0].id;
    const generated=await http('POST',`/api/paper-projects/${projectId}/sections/${sectionId}/generations`,{operation:'GENERATE',sourceStrategy:'MODEL_ONLY',expectedCurrentRevisionNumber:0});
    expect(generated.body.revision).toMatchObject({actualSupportMode:'AI_DRAFT',supportState:'NOT_CLAIMED',citations:[],evidenceTrace:[]});
    const edited=await http('POST',`/api/paper-projects/${projectId}/sections/${sectionId}/revisions`,{expectedCurrentRevisionNumber:1,baseRevisionId:generated.body.revision.id,content:'User-edited draft'});
    const rewritten=await http('POST',`/api/paper-projects/${projectId}/sections/${sectionId}/generations`,{operation:'REWRITE',sourceStrategy:'MODEL_ONLY',expectedCurrentRevisionNumber:2,baseRevisionId:edited.body.revision.id});
    expect(rewritten.body.revision).toMatchObject({revisionNumber:3,actualSupportMode:'AI_DRAFT',supportState:'NOT_CLAIMED'});
    expect((await http('GET',`/api/paper-projects/${projectId}/sections/${sectionId}/revisions`)).body).toHaveLength(3);
    expect((await http('GET',`/api/paper-projects/${projectId}`)).body.sections[0]).toMatchObject({id:sectionId,currentRevisionNumber:3});
    expect(grounded.generate).not.toHaveBeenCalled();expect(knowledge.getVersion).not.toHaveBeenCalled();
    expect((await http('GET',`/api/paper-projects/${projectId}`,undefined,'user-b')).status).toBe(404);
    expect((await http('GET',`/api/paper-projects/${projectId}`,undefined,null)).status).toBe(401);
  });

  it('B — binds indexed user Knowledge and persists VALID trace before a STALE_AFTER_EDIT revision',async()=>{
    await seedSource(USER_SOURCE,false,USER_DOCUMENT,USER_VERSION);
    const ready=await createReadyProject();
    const bound=await http('PUT',`/api/paper-projects/${ready.projectId}/sources`,{expectedLockVersion:ready.lockVersion,bindings:[{sourceRecordId:USER_SOURCE,documentVersionId:USER_VERSION}]});
    expect(bound.body.sources[0]).toMatchObject({originClass:'USER_KNOWLEDGE',evidenceAvailability:'READY'});
    const generated=await http('POST',`/api/paper-projects/${ready.projectId}/sections/${ready.sectionId}/generations`,{operation:'GENERATE',sourceStrategy:'USER_KNOWLEDGE',expectedCurrentRevisionNumber:0});
    expect(generated.body.revision).toMatchObject({actualSupportMode:'USER_EVIDENCE',supportState:'VALID',evidenceTrace:[expect.objectContaining({evidenceId:`e-${USER_VERSION}`})]});
    const edited=await http('POST',`/api/paper-projects/${ready.projectId}/sections/${ready.sectionId}/revisions`,{expectedCurrentRevisionNumber:1,baseRevisionId:generated.body.revision.id,content:'Edited grounded content'});
    expect(edited.body.revision.supportState).toBe('STALE_AFTER_EDIT');
    const history=(await http('GET',`/api/paper-projects/${ready.projectId}/sections/${ready.sectionId}/revisions`)).body;
    expect(history.find((revision:any)=>revision.id===generated.body.revision.id).evidenceTrace).toHaveLength(1);
  });

  it('C — grounds indexed web full text and creates no revision for metadata-only discovery',async()=>{
    await seedSource(WEB_SOURCE,true,WEB_DOCUMENT,WEB_VERSION);await seedSource(META_SOURCE,true);
    const ready=await createReadyProject();
    const bound=await http('PUT',`/api/paper-projects/${ready.projectId}/sources`,{expectedLockVersion:ready.lockVersion,bindings:[{sourceRecordId:WEB_SOURCE,documentVersionId:WEB_VERSION}]});
    const generated=await http('POST',`/api/paper-projects/${ready.projectId}/sections/${ready.sectionId}/generations`,{operation:'GENERATE',sourceStrategy:'WEB_RETRIEVED',expectedCurrentRevisionNumber:0});
    expect(generated.body.revision).toMatchObject({actualSupportMode:'WEB_EVIDENCE',supportState:'VALID'});
    await http('PUT',`/api/paper-projects/${ready.projectId}/sources`,{expectedLockVersion:bound.body.lockVersion,bindings:[{sourceRecordId:META_SOURCE}]});
    const blocked=await http('POST',`/api/paper-projects/${ready.projectId}/sections/${ready.sectionId}/generations`,{operation:'GENERATE',sourceStrategy:'WEB_RETRIEVED',expectedCurrentRevisionNumber:1});
    expect(blocked.body).toMatchObject({revisionCreated:false,evidenceAvailability:'METADATA_ONLY'});
    expect((await http('GET',`/api/paper-projects/${ready.projectId}/sections/${ready.sectionId}/revisions`)).body).toHaveLength(1);
  });

  it('D — binds user and web sources and classifies MIXED from the persisted evidence trace',async()=>{
    await seedSource(USER_SOURCE,false,USER_DOCUMENT,USER_VERSION);await seedSource(WEB_SOURCE,true,WEB_DOCUMENT,WEB_VERSION);
    const ready=await createReadyProject();
    await http('PUT',`/api/paper-projects/${ready.projectId}/sources`,{expectedLockVersion:ready.lockVersion,bindings:[{sourceRecordId:USER_SOURCE,documentVersionId:USER_VERSION},{sourceRecordId:WEB_SOURCE,documentVersionId:WEB_VERSION}]});
    const generated=await http('POST',`/api/paper-projects/${ready.projectId}/sections/${ready.sectionId}/generations`,{operation:'GENERATE',sourceStrategy:'MIXED',expectedCurrentRevisionNumber:0});
    expect(generated.body.revision).toMatchObject({actualSupportMode:'MIXED_EVIDENCE',supportState:'VALID',warnings:[]});
    expect(generated.body.revision.evidenceTrace.map((item:any)=>item.provenance.documentVersionId)).toEqual([USER_VERSION,WEB_VERSION]);
  });

  it('preserves stable section history through HTTP outline edits and exposes/remaps an orphan',async()=>{
    const created=await http('POST','/api/paper-projects',{profile:{schemaVersion:1,researchIdea:'Outline lifecycle',paperType:'other',language:'en'},selectedTitle:'Outline lifecycle'});
    const first=await http('PUT',`/api/paper-projects/${created.body.id}/outline`,{expectedLockVersion:0,nodes:[{clientKey:'a',nodeType:'writing-unit',title:'A',position:0},{clientKey:'b',nodeType:'writing-unit',title:'B',position:1}]});
    const nodeA=first.body.nodes.find((node:any)=>node.title==='A');const nodeB=first.body.nodes.find((node:any)=>node.title==='B');const sectionA=first.body.sections.find((section:any)=>section.outlineNodeId===nodeA.id);
    const revision=await http('POST',`/api/paper-projects/${created.body.id}/sections/${sectionA.id}/revisions`,{expectedCurrentRevisionNumber:0,content:'History survives'});
    const edited=await http('PUT',`/api/paper-projects/${created.body.id}/outline`,{expectedLockVersion:1,nodes:[{id:nodeB.id,clientKey:`persisted:${nodeB.id}`,nodeType:'writing-unit',title:'B',position:0},{id:nodeA.id,clientKey:`persisted:${nodeA.id}`,nodeType:'writing-unit',title:'Renamed A',position:1}]});
    expect(edited.body.nodes.find((node:any)=>node.id===nodeA.id)).toMatchObject({title:'Renamed A',sectionId:sectionA.id});
    expect((await http('GET',`/api/paper-projects/${created.body.id}/sections/${sectionA.id}/revisions`)).body[0].id).toBe(revision.body.revision.id);
    const replaced=await http('PUT',`/api/paper-projects/${created.body.id}/outline`,{expectedLockVersion:2,nodes:[{clientKey:'replacement',nodeType:'writing-unit',title:'Replacement',position:0}]});
    const workspace=await http('GET',`/api/paper-projects/${created.body.id}`);
    expect(workspace.body.sections).toContainEqual(expect.objectContaining({id:sectionA.id,status:'orphaned',currentRevisionNumber:1}));
    const remapped=await http('POST',`/api/paper-projects/${created.body.id}/sections/${sectionA.id}/remap`,{expectedLockVersion:3,targetOutlineNodeId:replaced.body.nodes[0].id});
    expect(remapped.body.section).toMatchObject({id:sectionA.id,status:'active',currentRevisionNumber:1,outlineNodeId:replaced.body.nodes[0].id});
    expect((await http('GET',`/api/paper-projects/${created.body.id}/sections/${sectionA.id}/revisions`)).body).toEqual([expect.objectContaining({id:revision.body.revision.id,content:'History survives'})]);
  });
});
