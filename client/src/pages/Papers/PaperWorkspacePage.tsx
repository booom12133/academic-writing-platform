import { useEffect, useReducer, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type {
  OutlineNode,
  PaperProject,
  PaperProjectSource,
  PaperSection,
  PaperSectionRevision,
  ProjectProfileV1,
  ResearchPlanV1,
  SourceStrategy,
} from '@shared/paper-project.interface';
import type {
  KnowledgeWorkspaceDocument,
  KnowledgeWorkspaceSource,
} from '@shared/knowledge-product.interface';
import * as api from '../../api/paper-projects';
import { listDocuments, listSources as listKnowledgeSources } from '../../api/knowledge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import {
  canGenerateSection,
  type EditableOutlineNode,
  getSectionSwitchAction,
  getPaperWorkspaceError,
  getOutlineProposalSaveAction,
  getSourceSelectionTokens,
  getSupportBadge,
  initialPaperEditorState,
  moveOutlineSibling,
  reducePaperEditorState,
  toEditableOutline,
} from '../../lib/paper-workspace';

type Topic = { title: string; innovation: string };
type ProposalNode = EditableOutlineNode;

const button = 'rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50';

export default function PaperWorkspacePage() {
  const { projectId = '' } = useParams();
  const [project, setProject] = useState<PaperProject | null>(null);
  const [outline, setOutline] = useState<OutlineNode[]>([]);
  const [sections, setSections] = useState<PaperSection[]>([]);
  const [sources, setSources] = useState<PaperProjectSource[]>([]);
  const [sectionId, setSectionId] = useState('');
  const [revision, setRevision] = useState<PaperSectionRevision | null>(null);
  const [history, setHistory] = useState<PaperSectionRevision[]>([]);
  const [editor, dispatch] = useReducer(reducePaperEditorState, initialPaperEditorState);
  const [strategy, setStrategy] = useState<SourceStrategy>('MODEL_ONLY');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState('');
  const [topics, setTopics] = useState<Topic[]>([]);
  const [planText, setPlanText] = useState('');
  const [proposal, setProposal] = useState<ProposalNode[]>([]);
  const [proposalMode, setProposalMode] = useState<'generated' | 'saved-edit' | null>(null);
  const [documents, setDocuments] = useState<KnowledgeWorkspaceDocument[]>([]);
  const [catalogSources, setCatalogSources] = useState<KnowledgeWorkspaceSource[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pendingSectionId, setPendingSectionId] = useState('');
  const [pendingRevisionId, setPendingRevisionId] = useState('');
  const [profileDraft, setProfileDraft] = useState<ProjectProfileV1 | null>(null);
  const [pendingOutlineReplace, setPendingOutlineReplace] = useState(false);
  const [remapTargets, setRemapTargets] = useState<Record<string, string>>({});

  async function refresh() {
    const workspace = await api.getWorkspace(projectId);
    const nextProject = workspace.project;
    const nextOutline = workspace.outline;
    const nextSources = workspace.sources;
    setProject(nextProject);
    setProfileDraft(nextProject.profile);
    setTitle(nextProject.selectedTitle ?? '');
    setPlanText(nextProject.researchPlan ? JSON.stringify(nextProject.researchPlan, null, 2) : '');
    setStrategy(nextProject.defaultSourceStrategy);
    setOutline(nextOutline.filter((node) => node.status === 'active'));
    setSections(workspace.sections);
    setSources(nextSources);
    setSelected(getSourceSelectionTokens(nextSources));
  }

  useEffect(() => {
    void refresh().catch(() => setError('论文工作区加载失败。'));
    void Promise.all([listDocuments(), listKnowledgeSources()])
      .then(([nextDocuments, nextSources]) => {
        setDocuments(nextDocuments);
        setCatalogSources(nextSources);
      })
      .catch(() => undefined);
  }, [projectId]);

  useEffect(() => {
    if (!sectionId) return;
    let active = true;
    void Promise.all([
      api.getSection(projectId, sectionId),
      api.listRevisions(projectId, sectionId),
    ]).then(([detail, revisions]) => {
      if (!active) return;
      setRevision(detail.currentRevision);
      setHistory(revisions);
      dispatch({
        type: 'load',
        content: detail.currentRevision?.content ?? '',
        revisionNumber: detail.section.currentRevisionNumber,
        baseRevisionId: detail.currentRevision?.id,
      });
    }).catch(() => { if (active) setError('章节加载失败。'); });
    return () => { active = false; };
  }, [projectId, sectionId]);

  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => {
      if (editor.dirty) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [editor.dirty]);

  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await work();
    } catch (caught) {
      setError(getPaperWorkspaceError(caught));
    } finally {
      setBusy(false);
    }
  }

  async function saveTitle(nextTitle: string) {
    if (!project) return;
    const next = await api.selectTopic(projectId, {
      expectedLockVersion: project.lockVersion,
      title: nextTitle,
    });
    setProject(next);
    setTitle(next.selectedTitle ?? '');
    setMessage('题目已保存。');
  }

  async function saveProfile() {
    if (!project || !profileDraft) return;
    const next = await api.updateProject(projectId, {
      expectedLockVersion: project.lockVersion,
      profile: profileDraft,
    });
    setProject(next);
    setProfileDraft(next.profile);
    setMessage('项目要求已保存。');
  }

  async function generateSection(operation: 'GENERATE' | 'REWRITE') {
    if (!sectionId) return;
    const result = await api.generateSection(projectId, sectionId, {
      operation,
      sourceStrategy: strategy,
      expectedCurrentRevisionNumber: editor.revisionNumber,
      ...(operation === 'REWRITE' && revision ? { baseRevisionId: revision.id } : {}),
    });
    if (result.revisionCreated === false) {
      setMessage(`${result.evidenceAvailability}：${result.safeNextAction}`);
      return;
    }
    setRevision(result.revision);
    dispatch({
      type: 'load',
      content: result.revision.content,
      revisionNumber: result.revision.revisionNumber,
      baseRevisionId: result.revision.id,
    });
    setHistory(await api.listRevisions(projectId, sectionId));
    setMessage('已创建新的 AI 修订。');
  }

  async function saveEdit() {
    if (!sectionId) return;
    const result = await api.saveRevision(projectId, sectionId, {
      expectedCurrentRevisionNumber: editor.revisionNumber,
      baseRevisionId: revision?.id,
      content: editor.content,
    });
    setRevision(result.revision);
    dispatch({ type: 'saved', revisionNumber: result.revision.revisionNumber, baseRevisionId: result.revision.id });
    setHistory(await api.listRevisions(projectId, sectionId));
    setMessage(result.noOp ? '内容未变化，没有创建重复修订。' : '手动修订已保存。');
  }

  async function saveBindings() {
    if (!project) return;
    const bindings: Array<{ sourceRecordId?: string; documentVersionId?: string }> = [];
    for (const document of documents) {
      const version = document.activeVersion;
      if (version && selected.has(`v:${version.id}`)) {
        bindings.push({
          documentVersionId: version.id,
          ...(document.document.sourceRecordId ? { sourceRecordId: document.document.sourceRecordId } : {}),
        });
      }
    }
    for (const source of catalogSources) {
      if (selected.has(`s:${source.id}`) && !bindings.some((item) => item.sourceRecordId === source.id)) {
        bindings.push({ sourceRecordId: source.id });
      }
    }
    const result = await api.saveProjectSources(projectId, {
      expectedLockVersion: project.lockVersion,
      bindings,
    }) as { sources: PaperProjectSource[]; lockVersion: number };
    setSources(result.sources);
    setProject({ ...project, lockVersion: result.lockVersion });
    setMessage('来源选择已保存。');
  }

  async function saveOutlineDraft() {
    if (!project) return;
    await api.saveOutline(projectId, { expectedLockVersion: project.lockVersion, nodes: proposal });
    setProposal([]);
    setProposalMode(null);
    setPendingOutlineReplace(false);
    await refresh();
    setMessage('大纲已保存；保留的节点继续使用原章节与修订历史。');
  }

  function editPersistedOutline() {
    setProposal(toEditableOutline(outline));
    setProposalMode('saved-edit');
  }

  async function remapOrphan(section: PaperSection) {
    if (!project) return;
    const targetOutlineNodeId = remapTargets[section.id];
    if (!targetOutlineNodeId) return;
    await api.remapSection(projectId, section.id, { expectedLockVersion: project.lockVersion, targetOutlineNodeId });
    await refresh();
    setSectionId(section.id);
    setMessage('孤立章节已恢复到新的写作单元，原修订历史保持不变。');
  }

  function requestSectionSwitch(nextSectionId: string) {
    if (getSectionSwitchAction(editor.dirty) === 'confirm') {
      setPendingSectionId(nextSectionId);
      return;
    }
    setSectionId(nextSectionId);
  }

  function confirmSectionSwitch() {
    setSectionId(pendingSectionId);
    setPendingSectionId('');
  }

  function loadHistoryRevision(item: PaperSectionRevision) {
    setRevision(item);
    dispatch({ type: 'load', content: item.content, revisionNumber: Math.max(editor.revisionNumber, item.revisionNumber), baseRevisionId: item.id });
    setMessage('历史内容已载入；保存会复制为新修订。');
  }

  function requestHistoryRevision(item: PaperSectionRevision) {
    if (getSectionSwitchAction(editor.dirty) === 'confirm') {
      setPendingRevisionId(item.id);
      return;
    }
    loadHistoryRevision(item);
  }

  function confirmDiscardAndNavigate() {
    if (pendingSectionId) {
      confirmSectionSwitch();
      setPendingRevisionId('');
      return;
    }
    if (pendingRevisionId) {
      const item = history.find((candidate) => candidate.id === pendingRevisionId);
      if (item) loadHistoryRevision(item);
      setPendingRevisionId('');
    }
  }

  if (!project) return <main className="p-8 text-sm text-slate-500">{error || '正在加载…'}</main>;
  const selectedNode = outline.find((node) => node.sectionId === sectionId);
  const orphanedSections = sections.filter((section) => section.status === 'orphaned');
  const emptyTargets = outline.filter((node) => node.nodeType === 'writing-unit' && sections.some((section) => section.outlineNodeId === node.id && section.status === 'active' && section.currentRevisionNumber === 0));

  return (
    <main className="max-w-[1500px] mx-auto px-6 py-6">
      <header className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between gap-4">
          <div><p className="text-xs text-slate-500">Paper Project · v{project.lockVersion}</p><h1 className="text-2xl font-semibold">{project.selectedTitle ?? '未命名论文'}</h1></div>
          <Link to="/papers" className="text-sm text-blue-600">返回项目列表</Link>
        </div>
        <div className="mt-4 flex gap-2">
          <input value={title} onChange={(event) => setTitle(event.target.value)} className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="手动输入或选择题目" />
          <button className={`${button} bg-blue-600 text-white`} disabled={busy || !title.trim()} onClick={() => void run(() => saveTitle(title))}>保存题目</button>
          <button className={`${button} border border-blue-200 text-blue-700`} disabled={busy} onClick={() => void run(async () => {
            const data = await api.generateTopics(projectId, { expectedLockVersion: project.lockVersion, count: 4 }) as { resultData: { topics: Topic[] } };
            setTopics(data.resultData.topics);
          })}>生成候选题</button>
        </div>
        {topics.length > 0 && <div className="mt-3 grid gap-2 md:grid-cols-2">{topics.map((topic) => <button key={topic.title} className="rounded-md border border-slate-200 p-3 text-left text-sm" onClick={() => void run(() => saveTitle(topic.title))}><strong>{topic.title}</strong><span className="mt-1 block text-xs text-slate-500">{topic.innovation}</span></button>)}</div>}
      </header>

      {(error || message) && <p className={`my-4 rounded-md p-3 text-sm ${error ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>{error || message}</p>}

      <section className="my-4 grid gap-4 lg:grid-cols-3">
        {profileDraft && <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold">项目要求</h2>
          <label className="mt-3 block text-xs font-medium text-slate-600">研究想法<textarea rows={3} value={profileDraft.researchIdea} onChange={(event) => setProfileDraft({ ...profileDraft, researchIdea: event.target.value })} className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm" /></label>
          <label className="mt-3 block text-xs font-medium text-slate-600">学科<input value={profileDraft.discipline ?? ''} onChange={(event) => setProfileDraft({ ...profileDraft, ...(event.target.value ? { discipline: event.target.value } : { discipline: undefined }) })} className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm" /></label>
          <label className="mt-3 block text-xs font-medium text-slate-600">补充要求<textarea rows={3} value={profileDraft.requirements ?? ''} onChange={(event) => setProfileDraft({ ...profileDraft, ...(event.target.value ? { requirements: event.target.value } : { requirements: undefined }) })} className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm" /></label>
          <button disabled={busy || !profileDraft.researchIdea.trim()} className={`${button} mt-3 bg-slate-800 text-white`} onClick={() => void run(saveProfile)}>保存项目要求</button>
        </div>}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex justify-between"><h2 className="font-semibold">Research Plan</h2><button className="text-sm text-blue-600" onClick={() => void run(async () => {
            const data = await api.generateResearchPlan(projectId, { expectedLockVersion: project.lockVersion }) as { result: ResearchPlanV1 };
            setPlanText(JSON.stringify(data.result, null, 2));
          })}>生成提案</button></div>
          <textarea rows={8} value={planText} onChange={(event) => setPlanText(event.target.value)} className="mt-3 w-full rounded-md border border-slate-300 p-3 font-mono text-xs" />
          <button className={`${button} bg-slate-800 text-white`} onClick={() => void run(async () => {
            const next = await api.saveResearchPlan(projectId, { expectedLockVersion: project.lockVersion, researchPlan: JSON.parse(planText) as ResearchPlanV1 });
            setProject(next);
            setMessage('Research Plan 已保存。');
          })}>保存计划</button>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex justify-between gap-2"><h2 className="font-semibold">论文大纲</h2><div className="flex gap-2"><button className="text-sm text-slate-600" disabled={!outline.length} onClick={editPersistedOutline}>编辑已保存大纲</button><button className="text-sm text-blue-600" onClick={() => void run(async () => {
            const data = await api.generateOutline(projectId, { expectedLockVersion: project.lockVersion }) as { result: { nodes: ProposalNode[] } };
            setProposal(data.result.nodes);
            setProposalMode('generated');
          })}>生成新提案</button></div></div>
          {proposalMode === 'generated' && outline.length > 0 && <p className="mt-2 text-xs text-amber-700">新提案不会自动覆盖当前大纲；保存时需要明确确认替换。</p>}
          <div className="mt-3 space-y-2">{proposal.map((node, index) => <div key={node.clientKey} className="flex items-center gap-1"><input value={node.title} onChange={(event) => setProposal((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value } : item))} className={`min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm ${node.parentClientKey ? 'ml-4' : ''}`} /><button aria-label="上移" className="rounded border px-2 py-1 text-xs" onClick={() => setProposal((current) => moveOutlineSibling(current,node.clientKey,'up'))}>↑</button><button aria-label="下移" className="rounded border px-2 py-1 text-xs" onClick={() => setProposal((current) => moveOutlineSibling(current,node.clientKey,'down'))}>↓</button><button aria-label="移除" className="rounded border border-red-200 px-2 py-1 text-xs text-red-600" onClick={() => setProposal((current) => current.filter((item) => item.clientKey !== node.clientKey && item.parentClientKey !== node.clientKey))}>移除</button></div>)}</div>
          {proposal.length > 0 && <button className={`${button} mt-2 bg-slate-800 text-white`} onClick={() => void run(async () => {
            if (getOutlineProposalSaveAction(proposalMode,outline.length > 0) === 'confirm-replace') { setPendingOutlineReplace(true); return; }
            await saveOutlineDraft();
          })}>{proposalMode === 'generated' && outline.length > 0 ? '明确替换当前大纲…' : '保存已编辑大纲'}</button>}
        </div>
      </section>

      <div className="grid min-h-[650px] gap-4 xl:grid-cols-[240px_minmax(0,1fr)_280px]">
        <aside className="rounded-xl border border-slate-200 bg-white p-4"><h2 className="font-semibold">大纲</h2><div className="mt-3 space-y-1">{outline.map((node) => <button key={node.id} disabled={!node.sectionId} onClick={() => requestSectionSwitch(node.sectionId ?? '')} className={`w-full rounded-md px-2 py-2 text-left text-sm ${sectionId === node.sectionId ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50'} ${node.parentId ? 'pl-5' : ''}`}>{node.title}</button>)}</div>{orphanedSections.length > 0 && <div className="mt-5 border-t border-slate-200 pt-3"><h3 className="text-sm font-semibold text-amber-800">待恢复章节</h3><p className="mt-1 text-xs text-slate-500">删除大纲节点不会删除正文或历史。</p>{orphanedSections.map((section) => <div key={section.id} className="mt-3 rounded-md bg-amber-50 p-2"><button className="text-xs text-blue-700" onClick={() => requestSectionSwitch(section.id)}>查看旧内容（修订 {section.currentRevisionNumber}）</button><select aria-label="恢复目标" value={remapTargets[section.id] ?? ''} onChange={(event) => setRemapTargets((current) => ({...current,[section.id]:event.target.value}))} className="mt-2 w-full rounded border border-slate-300 p-1 text-xs"><option value="">选择空写作单元</option>{emptyTargets.map((node) => <option key={node.id} value={node.id}>{node.title}</option>)}</select><button disabled={!remapTargets[section.id] || busy} className="mt-2 rounded bg-amber-700 px-2 py-1 text-xs text-white disabled:opacity-50" onClick={() => void run(() => remapOrphan(section))}>恢复并映射</button></div>)}</div>}</aside>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">{selectedNode?.title ?? (sectionId ? '孤立章节（待恢复）' : '选择一个写作章节')}</h2><p className="text-xs text-slate-500">{getSupportBadge(revision)} · 修订 {editor.revisionNumber}</p></div><div className="flex gap-2"><button disabled={!canGenerateSection(selectedNode?.sectionId ?? '', busy, editor.dirty)} className={`${button} border border-blue-200 text-blue-700`} onClick={() => void run(() => generateSection(revision ? 'REWRITE' : 'GENERATE'))}>{revision ? 'AI 改写' : '生成正文'}</button><button disabled={!editor.dirty || busy} className={`${button} bg-blue-600 text-white`} onClick={() => void run(saveEdit)}>保存修订</button></div></div>
          {editor.dirty && <p className="mt-2 text-xs text-amber-700">存在未保存修改；请先保存，再运行 AI 生成或改写。</p>}
          <textarea disabled={!sectionId} value={editor.content} onChange={(event) => dispatch({ type: 'edit', content: event.target.value })} className="mt-4 min-h-[430px] w-full rounded-md border border-slate-300 p-4 text-sm leading-relaxed" placeholder="选择 writing-unit 后生成或撰写正文…" />
          <h3 className="mt-5 text-sm font-semibold">修订历史</h3><div className="mt-2 flex flex-wrap gap-2">{history.map((item) => <button key={item.id} className="rounded border border-slate-200 px-2 py-1 text-xs" onClick={() => requestHistoryRevision(item)}>#{item.revisionNumber} {item.origin}</button>)}</div>
        </section>

        <aside className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold">来源与证据</h2>
          <select value={strategy} onChange={(event) => setStrategy(event.target.value as SourceStrategy)} className="mt-3 w-full rounded-md border border-slate-300 p-2 text-sm"><option>MODEL_ONLY</option><option>USER_KNOWLEDGE</option><option>WEB_RETRIEVED</option><option>MIXED</option></select>
          <p className="mt-4 text-xs font-medium text-slate-600">Knowledge 全文版本</p>{documents.map((document) => document.activeVersion && <SourceCheck key={document.activeVersion.id} token={`v:${document.activeVersion.id}`} checked={selected.has(`v:${document.activeVersion.id}`)} label={`${document.document.displayName} · ${document.index?.status ?? 'not-indexed'}`} setSelected={setSelected} />)}
          <p className="mt-4 text-xs font-medium text-slate-600">检索元数据</p>{catalogSources.map((source) => <SourceCheck key={source.id} token={`s:${source.id}`} checked={selected.has(`s:${source.id}`)} label={`${source.title ?? source.id} · ${source.contentStatus}`} setSelected={setSelected} />)}
          <button className={`${button} mt-3 w-full border border-slate-300`} onClick={() => void run(saveBindings)}>保存来源选择</button>
          <div className="mt-4 space-y-2">{sources.map((source) => <div key={source.id} className="rounded bg-slate-50 p-2 text-xs"><p>{source.originClass}</p><p className="text-slate-500">{source.evidenceAvailability}</p></div>)}</div>
          <div className="mt-4 flex gap-3 text-xs"><Link to="/knowledge" className="text-blue-600">管理资料</Link><Link to="/academic-search" className="text-blue-600">Academic Search</Link></div>
          {revision?.citations.length ? <pre className="mt-4 max-h-52 overflow-auto whitespace-pre-wrap text-xs text-slate-600">{JSON.stringify({ citations: revision.citations, evidenceTrace: revision.evidenceTrace }, null, 2)}</pre> : null}
        </aside>
      </div>
      <Dialog open={Boolean(pendingSectionId || pendingRevisionId)} onOpenChange={(open) => { if (!open) { setPendingSectionId(''); setPendingRevisionId(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>放弃未保存的修改？</DialogTitle>
            <DialogDescription>当前章节有尚未保存的内容。切换章节或载入历史修订会放弃这些本地修改。</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button className={`${button} border border-slate-300`} onClick={() => { setPendingSectionId(''); setPendingRevisionId(''); }}>继续编辑</button>
            <button className={`${button} bg-red-600 text-white`} onClick={confirmDiscardAndNavigate}>放弃并继续</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={pendingOutlineReplace} onOpenChange={setPendingOutlineReplace}>
        <DialogContent>
          <DialogHeader><DialogTitle>替换当前大纲？</DialogTitle><DialogDescription>只有新提案中的节点会保留。被移除写作单元的正文会进入“待恢复章节”，修订历史不会删除。</DialogDescription></DialogHeader>
          <DialogFooter><button className={`${button} border border-slate-300`} onClick={() => setPendingOutlineReplace(false)}>取消</button><button className={`${button} bg-amber-700 text-white`} onClick={() => void run(saveOutlineDraft)}>确认替换</button></DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function SourceCheck(props: { token: string; checked: boolean; label: string; setSelected: React.Dispatch<React.SetStateAction<Set<string>>> }) {
  return <label className="mt-2 flex gap-2 text-xs"><input type="checkbox" checked={props.checked} onChange={(event) => props.setSelected((current) => {
    const next = new Set(current);
    if (event.target.checked) next.add(props.token); else next.delete(props.token);
    return next;
  })} /><span>{props.label}</span></label>;
}
