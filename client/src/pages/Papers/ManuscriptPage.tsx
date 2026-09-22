import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { ManuscriptProjectionV1, SectionRole } from '@shared/manuscript.interface';
import * as api from '../../api/paper-projects';
import { getHeadingAnchor, getManuscriptReadinessLabel, getManuscriptWarningLabel } from '../../lib/manuscript';

const button = 'rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50';

export default function ManuscriptPage() {
  const { projectId = '' } = useParams();
  const [manuscript, setManuscript] = useState<ManuscriptProjectionV1 | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function refresh() { setManuscript(await api.getManuscript(projectId)); }
  useEffect(() => { void refresh().catch(() => setError('整篇论文加载失败。')); }, [projectId]);

  async function run(work: () => Promise<void>) {
    setBusy(true); setError(''); setMessage('');
    try { await work(); await refresh(); } catch (caught) {
      const status = (caught as { response?: { status?: number } }).response?.status;
      setError(status === 409 ? '论文已发生变化，已为你刷新；请核对后重试。' : '操作失败，请稍后重试。');
      if (status === 409) await refresh().catch(() => undefined);
    } finally { setBusy(false); }
  }

  async function generate(role: Extract<SectionRole, 'ABSTRACT'|'KEYWORDS'>) {
    if (!manuscript) return;
    const derived = role === 'ABSTRACT' ? manuscript.derived.abstract : manuscript.derived.keywords;
    await api.generateDerivedContent(projectId, role, { expectedBodyFingerprint: manuscript.bodyFingerprint, expectedCurrentRevisionNumber: derived.revisionNumber ?? 0 });
    setMessage(`${role === 'ABSTRACT' ? '摘要' : '关键词'}已生成新修订。`);
  }

  async function refreshConclusion(section: ManuscriptProjectionV1['outline'][number]) {
    if (!section.sectionId || !section.conclusionBasisFingerprint || section.currentRevisionNumber === undefined) return;
    await api.refreshConclusion(projectId, section.sectionId, {
      expectedConclusionBasisFingerprint: section.conclusionBasisFingerprint,
      expectedCurrentRevisionNumber: section.currentRevisionNumber,
    });
    setMessage(`“${section.title}”已生成结论刷新修订。`);
  }

  if (!manuscript) return <main className="p-8 text-sm text-slate-500">{error || '正在装配整篇论文…'}</main>;
  return <main className="mx-auto max-w-[1500px] px-6 py-6">
    <header className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs text-slate-500">Whole Manuscript · {getManuscriptReadinessLabel(manuscript.readiness)}</p><h1 className="text-2xl font-semibold">{manuscript.title ?? '未命名论文'}</h1></div><div className="flex gap-3"><Link className="text-sm text-blue-600" to={`/papers/${projectId}`}>返回章节工作区</Link><Link className="text-sm text-blue-600" to="/papers">项目列表</Link></div></div>
      {(error || message) && <p className={`mt-4 rounded-md p-3 text-sm ${error ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>{error || message}</p>}
    </header>

    <div className="mt-4 grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)_280px]">
      <aside className="rounded-xl border border-slate-200 bg-white p-4"><h2 className="font-semibold">章节导航</h2><nav className="mt-3 space-y-1">{manuscript.outline.map((item) => <a key={item.nodeId} href={`#${getHeadingAnchor(item.nodeId)}`} style={{ paddingLeft: `${item.depth * 12 + 8}px` }} className="block rounded py-1 text-sm text-slate-700 hover:bg-blue-50">{item.title}{manuscript.warnings.some((warning) => warning.nodeId === item.nodeId && warning.code === 'MISSING_SECTION') ? ' · 未完成' : ''}</a>)}</nav></aside>

      <article className="rounded-xl border border-slate-200 bg-white p-7">
        <section className="mb-7"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Abstract</h2><button disabled={busy} className={`${button} border border-blue-200 text-blue-700`} onClick={() => void run(() => generate('ABSTRACT'))}>{manuscript.derived.abstract.state === 'MISSING' ? '生成摘要' : '刷新摘要'}</button></div><p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{manuscript.derived.abstract.content ?? '尚未生成'}</p></section>
        <section className="mb-7"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Keywords</h2><button disabled={busy} className={`${button} border border-blue-200 text-blue-700`} onClick={() => void run(() => generate('KEYWORDS'))}>{manuscript.derived.keywords.state === 'MISSING' ? '生成关键词' : '刷新关键词'}</button></div><p className="mt-3 text-sm text-slate-700">{manuscript.derived.keywords.content ?? '尚未生成'}</p></section>
        {manuscript.blocks.map((block, index) => {
          if (block.kind === 'heading') return <h2 id={getHeadingAnchor(block.nodeId)} key={`${block.nodeId}-${index}`} aria-level={Math.min(block.level + 1, 6)} className={`${block.level === 1 ? 'text-lg' : 'text-base'} mb-3 mt-7 font-semibold text-slate-900`}>{block.title}</h2>;
          if (block.kind === 'paragraph') return <p key={`${block.revisionId}-${index}`} className="mb-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">{block.text}</p>;
          if (block.kind === 'missing-section') return <p key={`${block.nodeId}-${index}`} className="mb-4 rounded bg-amber-50 p-3 text-sm text-amber-800">{block.text}</p>;
          return <section key={`references-${index}`} className="mt-8"><h2 className="text-lg font-semibold">References</h2><ol className="mt-3 space-y-2 text-sm text-slate-700">{block.entries.map((entry) => <li key={entry.identity}>[{entry.number}] {Object.values(entry.fields).flat().map(String).join('. ')}</li>)}</ol></section>;
        })}
      </article>

      <aside className="rounded-xl border border-slate-200 bg-white p-4"><h2 className="font-semibold">整篇状态</h2><dl className="mt-3 space-y-2 text-sm"><div className="flex justify-between"><dt>字数</dt><dd>{manuscript.wordCount}</dd></div><div className="flex justify-between"><dt>有效支持章节</dt><dd>{manuscript.supportSummary.validSections}</dd></div><div className="flex justify-between"><dt>全局引用</dt><dd>{manuscript.supportSummary.managedCitationCount}</dd></div></dl><h3 className="mt-5 text-sm font-semibold">提醒</h3><div className="mt-2 space-y-2">{manuscript.warnings.length === 0 ? <p className="text-xs text-emerald-700">没有阻塞问题。</p> : manuscript.warnings.map((warning, index) => <Link key={`${warning.code}-${index}`} to={warning.sectionId ? `/papers/${projectId}?sectionId=${encodeURIComponent(warning.sectionId)}` : `/papers/${projectId}`} className={`block rounded p-2 text-xs ${warning.severity === 'blocking' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'}`}>{getManuscriptWarningLabel(warning.code)}</Link>)}</div><h3 className="mt-5 text-sm font-semibold">刷新结论</h3><p className="mt-1 text-xs text-slate-500">明确选择一个现有写作单元；系统不会根据标题猜测结论章节。</p><div className="mt-2 max-h-48 space-y-2 overflow-auto">{manuscript.outline.filter((item) => item.sectionId && item.conclusionBasisFingerprint && item.currentRevisionNumber !== undefined).map((item) => <button key={item.nodeId} disabled={busy} className={`${button} w-full border border-slate-300 text-left`} onClick={() => void run(() => refreshConclusion(item))}>刷新“{item.title}”</button>)}</div><button disabled className={`${button} mt-5 w-full border border-slate-300`}>DOCX 导出将在导出工作包启用</button></aside>
    </div>
  </main>;
}
