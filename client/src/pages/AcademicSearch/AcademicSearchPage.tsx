import { FormEvent, useState } from 'react';
import { AlertCircle, BookOpen, ChevronRight, Search, ShieldCheck } from 'lucide-react';
import { search, type AcademicDiscoverySet } from '@client/src/api/academic-search';
import { ProductIntegrationError } from '@client/src/api/integration-error';
import { AcademicSearchResultCard } from '@client/src/components/academic-search/AcademicSearchResultCard';
import { Button } from '@client/src/components/ui/button';
import { Card, CardContent } from '@client/src/components/ui/card';
import { Input } from '@client/src/components/ui/input';
import { getAcademicSearchViewState } from '@client/src/lib/academic-search-state';

function safeErrorMessage(error: unknown): string {
  return error instanceof ProductIntegrationError
    ? error.message
    : '学术搜索暂时失败，请稍后重试。';
}

export default function AcademicSearchPage() {
  const [query, setQuery] = useState('');
  const [fromPublicationDate, setFromPublicationDate] = useState('');
  const [toPublicationDate, setToPublicationDate] = useState('');
  const [publicationYear, setPublicationYear] = useState('');
  const [workType, setWorkType] = useState('');
  const [isOpenAccess, setIsOpenAccess] = useState(false);
  const [result, setResult] = useState<AcademicDiscoverySet | null>(null);
  const [cursor, setCursor] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const executeSearch = async (nextCursor?: string) => {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) return;
    setLoading(true);
    setError(null);
    try {
      const nextResult = await search({
        q: normalizedQuery,
        ...(fromPublicationDate ? { fromPublicationDate } : {}),
        ...(toPublicationDate ? { toPublicationDate } : {}),
        ...(publicationYear ? { publicationYear: Number(publicationYear) } : {}),
        ...(workType ? { workType } : {}),
        ...(isOpenAccess ? { isOpenAccess: true } : {}),
        ...(nextCursor === undefined ? {} : { cursor: nextCursor }),
        pageSize: 20,
      });
      setResult(nextResult);
      setCursor(nextResult.nextCursor);
    } catch (requestError) {
      setError(safeErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setCursor(undefined);
    setResult(null);
    void executeSearch();
  };

  const viewState = getAcademicSearchViewState({ loading, error, result });

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-6 px-6 py-8">
      <div>
        <div className="flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-blue-600" />
          <h1 className="text-2xl font-semibold leading-tight text-slate-800">Academic Search</h1>
        </div>
        <p className="mt-2 text-sm text-slate-500">
          从真实学术来源发现论文元数据，结果可用于后续筛选与导入工作区。
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-5">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="flex gap-2">
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="输入研究主题、问题或关键词"
                aria-label="学术搜索关键词"
              />
              <Button type="submit" disabled={loading || !query.trim()}>
                <Search className="h-4 w-4" />
                {loading ? '搜索中…' : '搜索'}
              </Button>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <label className="space-y-1 text-xs text-slate-500">
                起始日期
                <Input type="date" value={fromPublicationDate} onChange={(event) => setFromPublicationDate(event.target.value)} />
              </label>
              <label className="space-y-1 text-xs text-slate-500">
                结束日期
                <Input type="date" value={toPublicationDate} onChange={(event) => setToPublicationDate(event.target.value)} />
              </label>
              <label className="space-y-1 text-xs text-slate-500">
                出版年份
                <Input type="number" min="1000" max="9999" value={publicationYear} onChange={(event) => setPublicationYear(event.target.value)} placeholder="可选" />
              </label>
              <label className="space-y-1 text-xs text-slate-500">
                Work type
                <select className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700" value={workType} onChange={(event) => setWorkType(event.target.value)}>
                  <option value="">全部</option>
                  <option value="article">article</option>
                  <option value="book-chapter">book-chapter</option>
                  <option value="review">review</option>
                </select>
              </label>
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={isOpenAccess} onChange={(event) => setIsOpenAccess(event.target.checked)} />
              仅开放获取
            </label>
          </form>
          <div className="flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs leading-relaxed text-blue-800">
            <ShieldCheck className="mt-0.5 h-4 w-4 flex-none" />
            <span>搜索结果是 discovery metadata，不等于已导入知识库、已建立索引或已经成为 grounded evidence。</span>
          </div>
        </CardContent>
      </Card>

      {viewState === 'loading' && <Card><CardContent className="py-12 text-center text-sm text-slate-500">正在获取学术发现结果…</CardContent></Card>}
      {viewState === 'error' && (
        <Card><CardContent className="space-y-3 py-12 text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-red-300" />
          <p className="text-sm text-red-600">{error}</p>
          <Button variant="secondary" onClick={() => void executeSearch()}>重试</Button>
        </CardContent></Card>
      )}
      {viewState === 'empty' && (
        <Card><CardContent className="py-12 text-center text-sm text-slate-500">暂无匹配结果，请调整关键词或筛选条件。</CardContent></Card>
      )}
      {viewState === 'partial' && result && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          当前结果可能不完整，部分 provider 结果未能返回；已返回内容仍仅代表学术发现元数据。
        </div>
      )}
      {result && result.items.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">发现结果</h2>
              <p className="text-xs text-slate-500">Provider：{result.provider} · 检索时间：{result.provenance.retrievedAt}</p>
            </div>
            {cursor && <Button variant="secondary" disabled={loading} onClick={() => void executeSearch(cursor)}>下一页 <ChevronRight className="h-4 w-4" /></Button>}
          </div>
          {result.items.map((item) => <AcademicSearchResultCard key={`${item.provider}:${item.externalRecordId}`} item={item} />)}
        </section>
      )}
    </div>
  );
}
