import { useCallback, useEffect, useState } from 'react';
import { BookOpen, FileText, RefreshCw, Trash2 } from 'lucide-react';

import { knowledgeApi } from '@client/src/api/index';
import { DocumentUploadFlow } from '@client/src/components/documents/DocumentUploadFlow';
import { Badge } from '@client/src/components/ui/badge';
import { Button } from '@client/src/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@client/src/components/ui/card';
import type { KnowledgeWorkspaceDocument } from '@shared/knowledge-product.interface';

const originLabels: Record<KnowledgeWorkspaceDocument['document']['originKind'], string> = {
  'user-upload': '用户上传',
  'generated-artifact': '生成资料',
  'external-attachment': '外部附件',
};

export default function KnowledgePage() {
  const [documents, setDocuments] = useState<KnowledgeWorkspaceDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setDocuments(await knowledgeApi.listDocuments());
    } catch (_error) {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const deleteDocument = async (documentId: string) => {
    setDeletingId(documentId);
    try {
      await knowledgeApi.deleteDocument(documentId);
      setDocuments((current) => current.filter((item) => item.document.id !== documentId));
    } catch (_error) {
      setError(true);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-6 px-6 py-8">
      <div>
        <div className="flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-blue-600" />
          <h1 className="text-2xl font-semibold leading-tight text-slate-800">文档工作区</h1>
        </div>
        <p className="mt-2 text-sm text-slate-500">
          上传资料并保存为可复用文档。当前阶段只导入内容，不会自动建立索引。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">上传文档</CardTitle>
        </CardHeader>
        <CardContent>
          <DocumentUploadFlow onReady={() => undefined} onImported={loadDocuments} />
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-800">已导入文档</h2>
          <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => void loadDocuments()}>
            <RefreshCw className="h-4 w-4" />刷新
          </Button>
        </div>

        {loading ? (
          <Card><CardContent className="py-8 text-center text-sm text-slate-500">正在加载文档工作区…</CardContent></Card>
        ) : error ? (
          <Card>
            <CardContent className="space-y-3 py-8 text-center">
              <p className="text-sm text-red-600">文档工作区加载或操作失败。</p>
              <Button type="button" variant="outline" onClick={() => void loadDocuments()}>重试</Button>
            </CardContent>
          </Card>
        ) : documents.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-sm text-slate-500">暂无已导入文档。</CardContent></Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {documents.map((item) => (
              <Card key={item.document.id}>
                <CardContent className="space-y-4 pt-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 flex-none text-blue-600" />
                        <h3 className="truncate text-sm font-medium text-slate-800">
                          {item.document.displayName}
                        </h3>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {originLabels[item.document.originKind]} · {item.document.sourceType.toUpperCase()}
                      </p>
                    </div>
                    <Badge variant="secondary">
                      {item.index?.status ?? '未建立索引'}
                    </Badge>
                  </div>
                  <div className="space-y-1 text-xs text-slate-500">
                    <p>活动版本：{item.activeVersion?.versionNumber ?? '无'}</p>
                    <p>
                      文件工具：{item.documentRef ? '可用于润色与论文修改' : '仅文本知识版本，不提供文件引用'}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-red-600"
                    disabled={deletingId === item.document.id}
                    onClick={() => void deleteDocument(item.document.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                    {deletingId === item.document.id ? '正在移除…' : '从工作区移除'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
