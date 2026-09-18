import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, FileText, Link2, Download } from 'lucide-react';
import { academicSearchApi } from '@client/src/api/index';
import { ProductIntegrationError } from '@client/src/api/integration-error';
import { Button } from '@client/src/components/ui/button';
import { Card, CardContent } from '@client/src/components/ui/card';
import type { AcademicSearchResult } from '@shared/academic-search.interface';

interface AcademicSearchResultCardProps {
  item: AcademicSearchResult;
}

export function AcademicSearchResultCard({ item }: AcademicSearchResultCardProps) {
  const [importing, setImporting] = useState(false);
  const [outcome, setOutcome] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const doiHref = item.doi
    ? item.doi.startsWith('http') ? item.doi : `https://doi.org/${item.doi}`
    : undefined;

  return (
    <Card>
      <CardContent className="space-y-3 pt-5">
        <div>
          <h2 className="text-base font-semibold leading-relaxed text-slate-800">{item.title}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {item.authors.length > 0 ? item.authors.map((author) => author.name).join('、') : '作者信息未提供'}
          </p>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
          {item.venue && <span>{item.venue}</span>}
          {item.publicationDate && <span>{item.publicationDate}</span>}
          {item.publicationYear && <span>{item.publicationYear}</span>}
          {item.workType && <span>{item.workType}</span>}
          {item.citedByCount !== undefined && <span>被引 {item.citedByCount}</span>}
        </div>
        {item.abstract && <p className="line-clamp-3 text-sm leading-relaxed text-slate-600">{item.abstract}</p>}
        <div className="flex flex-wrap gap-2 text-sm">
          {doiHref && (
            <a className="inline-flex items-center gap-1 text-blue-700 hover:text-blue-900" href={doiHref} target="_blank" rel="noreferrer">
              <Link2 className="h-4 w-4" /> DOI
            </a>
          )}
          {item.landingPageUrl && (
            <a className="inline-flex items-center gap-1 text-blue-700 hover:text-blue-900" href={item.landingPageUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4" /> 出版页面
            </a>
          )}
          {item.pdfUrl && (
            <a className="inline-flex items-center gap-1 text-blue-700 hover:text-blue-900" href={item.pdfUrl} target="_blank" rel="noreferrer">
              <FileText className="h-4 w-4" /> PDF
            </a>
          )}
        </div>
        <div className="space-y-2 border-t border-slate-100 pt-3">
          <Button type="button" size="sm" disabled={importing} onClick={() => {
            setImporting(true); setImportError(null); setOutcome(null);
            void academicSearchApi.importToWorkspace({ provider: 'openalex', externalRecordId: item.externalRecordId })
              .then((result) => setOutcome(result.kind === 'full-text'
                ? '全文已导入；请到文档工作区显式建立索引。'
                : '仅元数据已导入；摘要不是全文证据，请上传 PDF。'))
              .catch((error) => setImportError(error instanceof ProductIntegrationError ? error.message : '导入工作区失败，请重试。'))
              .finally(() => setImporting(false));
          }}>
            <Download className="h-4 w-4" />{importing ? '正在导入…' : '导入工作区'}
          </Button>
          {outcome && <p className="text-xs text-emerald-700">{outcome} <Link className="text-blue-700 underline" to="/knowledge">前往文档工作区</Link></p>}
          {importError && <p className="text-xs text-red-600" role="alert">{importError}</p>}
        </div>
        <div className="border-t border-slate-100 pt-2 text-xs text-slate-400">
          来源：{item.provenance.provider} · 发现记录，不代表已导入或已建立索引
        </div>
      </CardContent>
    </Card>
  );
}
