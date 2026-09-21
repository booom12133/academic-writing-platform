jest.mock('../../client/src/api/http',()=>({productHttpClient:{get:jest.fn(),post:jest.fn(),put:jest.fn(),patch:jest.fn(),delete:jest.fn()}}));
import { productHttpClient } from '../../client/src/api/http';
import { createProject, generateSection, getOutline, listProjects, remapSection, saveRevision } from '../../client/src/api/paper-projects';
import { canGenerateSection, canMoveOutlineSibling, getOutlineControlLabel, getOutlineProposalSaveAction, getPaperWorkspaceError, getSectionSwitchAction, getSourceSelectionTokens, getSupportBadge, initialPaperEditorState, moveOutlineSibling, orderEditableOutline, reducePaperEditorState, removeOutlineSubtree, toEditableOutline } from '../../client/src/lib/paper-workspace';

describe('paper workspace client',()=>{
  beforeEach(()=>jest.clearAllMocks());
  it('uses owner-scoped P4 routes without client user ids',async()=>{
    (productHttpClient.post as jest.Mock).mockResolvedValueOnce({data:{id:'p'}}).mockResolvedValueOnce({data:{revisionCreated:true}}).mockResolvedValueOnce({data:{noOp:false}}).mockResolvedValueOnce({data:{section:{id:'s/1'},lockVersion:2}});
    (productHttpClient.get as jest.Mock).mockResolvedValueOnce({data:[]}).mockResolvedValueOnce({data:{nodes:[],lockVersion:0}});
    const body={profile:{schemaVersion:1,researchIdea:'Idea',paperType:'other',language:'en'}} as const;
    await createProject(body);await listProjects();await getOutline('p/1');await generateSection('p/1','s/1',{operation:'GENERATE',sourceStrategy:'MODEL_ONLY',expectedCurrentRevisionNumber:0});await saveRevision('p/1','s/1',{expectedCurrentRevisionNumber:1,content:'edit'});await remapSection('p/1','s/1',{expectedLockVersion:1,targetOutlineNodeId:'n/1'});
    expect(productHttpClient.post).toHaveBeenNthCalledWith(1,'/api/paper-projects',body);
    expect(productHttpClient.get).toHaveBeenNthCalledWith(2,'/api/paper-projects/p%2F1/outline');
    expect(productHttpClient.post).toHaveBeenNthCalledWith(2,'/api/paper-projects/p%2F1/sections/s%2F1/generations',expect.objectContaining({sourceStrategy:'MODEL_ONLY'}));
    expect(productHttpClient.post).toHaveBeenNthCalledWith(4,'/api/paper-projects/p%2F1/sections/s%2F1/remap',{expectedLockVersion:1,targetOutlineNodeId:'n/1'});
    expect((productHttpClient.post as jest.Mock).mock.calls[0][1]).not.toHaveProperty('userId');
  });
  it('converts persisted outline nodes into editable requests without losing stable ids or parents',()=>{
    const editable=toEditableOutline([
      {id:'11111111-1111-4111-8111-111111111111',nodeType:'container',title:'Root',position:0,status:'active'},
      {id:'22222222-2222-4222-8222-222222222222',parentId:'11111111-1111-4111-8111-111111111111',nodeType:'writing-unit',title:'Child A',position:0,status:'active',sectionId:'section-a'},
      {id:'33333333-3333-4333-8333-333333333333',parentId:'11111111-1111-4111-8111-111111111111',nodeType:'writing-unit',title:'Child B',position:1,status:'active',sectionId:'section-b'},
    ]);
    expect(editable[1]).toMatchObject({id:'22222222-2222-4222-8222-222222222222',clientKey:'persisted:22222222-2222-4222-8222-222222222222',parentClientKey:'persisted:11111111-1111-4111-8111-111111111111'});
    expect(moveOutlineSibling(editable,editable[2].clientKey,'up').filter(node=>node.parentClientKey===editable[0].clientKey).map(node=>[node.id,node.position])).toEqual([
      ['22222222-2222-4222-8222-222222222222',1],
      ['33333333-3333-4333-8333-333333333333',0],
    ]);
    expect(orderEditableOutline(moveOutlineSibling(editable,editable[2].clientKey,'up')).map(node=>node.id)).toEqual([
      '11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333','22222222-2222-4222-8222-222222222222',
    ]);
    expect(removeOutlineSubtree(editable,editable[0].clientKey)).toEqual([]);
  });
  it('requires explicit replacement confirmation for a generated proposal but not saved-outline edits',()=>{
    expect(getOutlineProposalSaveAction('generated',true)).toBe('confirm-replace');
    expect(getOutlineProposalSaveAction('generated',false)).toBe('save');
    expect(getOutlineProposalSaveAction('saved-edit',true)).toBe('save');
  });
  it('gives outline controls node-specific accessible labels and disables boundary moves',()=>{
    const nodes=[{clientKey:'a',nodeType:'writing-unit' as const,title:'Methods',position:0},{clientKey:'b',nodeType:'writing-unit' as const,title:'Results',position:1}];
    expect(getOutlineControlLabel('up','Methods')).toBe('上移 Methods');
    expect(getOutlineControlLabel('title','Methods')).toBe('大纲标题 Methods');
    expect(canMoveOutlineSibling(nodes,'a','up')).toBe(false);
    expect(canMoveOutlineSibling(nodes,'a','down')).toBe(true);
    expect(canMoveOutlineSibling(nodes,'b','down')).toBe(false);
  });
  it('derives badges from persisted support, never requested strategy',()=>{
    expect(getSupportBadge({actualSupportMode:'AI_DRAFT',supportState:'NOT_CLAIMED'})).toBe('模型草稿');
    expect(getSupportBadge({actualSupportMode:'USER_EVIDENCE',supportState:'VALID'})).toBe('来自用户资料');
    expect(getSupportBadge({actualSupportMode:'WEB_EVIDENCE',supportState:'STALE_AFTER_EDIT'})).toBe('已编辑，证据需复核');
    expect(getSupportBadge({actualSupportMode:'WEB_EVIDENCE',supportState:'NOT_CLAIMED'})).toBe('证据状态待确认');
  });
  it('tracks local edits without creating revisions until explicit save',()=>{
    const edited=reducePaperEditorState(initialPaperEditorState,{type:'load',content:'a',revisionNumber:1});
    const dirty=reducePaperEditorState(edited,{type:'edit',content:'b'});expect(dirty).toMatchObject({dirty:true,content:'b',revisionNumber:1});
    expect(reducePaperEditorState(dirty,{type:'saved',revisionNumber:2})).toMatchObject({dirty:false,revisionNumber:2});
  });
  it('requires explicit confirmation before leaving a dirty section',()=>{
    expect(getSectionSwitchAction(false)).toBe('switch');
    expect(getSectionSwitchAction(true)).toBe('confirm');
  });
  it('blocks AI generation while local edits are unsaved',()=>{
    expect(canGenerateSection('section',false,false)).toBe(true);
    expect(canGenerateSection('section',false,true)).toBe(false);
    expect(canGenerateSection('',false,false)).toBe(false);
  });
  it('restores persisted source selections when the workspace reloads',()=>{
    expect([...getSourceSelectionTokens([
      { id:'a',sourceRecordId:'source-a',originClass:'WEB_IMPORTED',selectionStatus:'selected',evidenceAvailability:'METADATA_ONLY' },
      { id:'b',sourceRecordId:'source-b',documentVersionId:'version-b',originClass:'WEB_IMPORTED',selectionStatus:'selected',evidenceAvailability:'READY' },
      { id:'c',documentVersionId:'version-c',originClass:'USER_KNOWLEDGE',selectionStatus:'selected',evidenceAvailability:'READY' },
    ])]).toEqual(['s:source-a','v:version-b','v:version-c']);
  });
  it('turns optimistic concurrency failures into an actionable reload message',()=>{
    expect(getPaperWorkspaceError({ response: { status: 409, data: { code:'PAPER_SECTION_REVISION_CONFLICT',message:'changed' } } }))
      .toBe('内容已在其他窗口更新，请重新加载后再试。');
    expect(getPaperWorkspaceError(new Error('provider unavailable'))).toBe('provider unavailable');
  });
});
