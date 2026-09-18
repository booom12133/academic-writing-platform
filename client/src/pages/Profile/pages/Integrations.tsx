import { Link } from 'react-router-dom';
import { ExternalLink, Library } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Integrations() {
  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-800">第三方集成</h1>
        <p className="mt-2 text-sm text-slate-500">按需连接高级文献管理工具；手动上传 PDF 和 Academic Search 仍是核心路径。</p>
      </div>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-lg"><Library className="h-5 w-5 text-blue-600" />Zotero</CardTitle>
            <Badge variant="secondary">可选高级集成</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-600">
          <p>当前支持 API Key 连接、元数据同步和可用 PDF 附件导入；Zotero OAuth 属于后续可选能力，本阶段不包含。</p>
          <p>导入全文后仍需在文档工作区显式建立索引，元数据与摘要不会自动成为 grounded evidence。</p>
          <Link className="inline-flex items-center gap-1 font-medium text-blue-700 hover:text-blue-900" to="/zotero">
            打开 Zotero 集成 <ExternalLink className="h-4 w-4" />
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
