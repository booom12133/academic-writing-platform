import { ExternalLink, FileText, Link2 } from 'lucide-react';
import { Card, CardContent } from '@client/src/components/ui/card';
import type { AcademicSearchResult } from '@shared/academic-search.interface';

interface AcademicSearchResultCardProps {
  item: AcademicSearchResult;
}

export function AcademicSearchResultCard({ item }: AcademicSearchResultCardProps) {
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
        <div className="border-t border-slate-100 pt-2 text-xs text-slate-400">
          来源：{item.provenance.provider} · 发现记录，不代表已导入或已建立索引
        </div>
      </CardContent>
    </Card>
  );
}
