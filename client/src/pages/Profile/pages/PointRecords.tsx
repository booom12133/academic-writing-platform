import { useEffect, useState, useCallback } from 'react';
import {
  History,
  ChevronLeft,
  ChevronRight,
  Loader2,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { pointApi } from '@client/src/api/index';
import type { PointRecord, PointRecordType } from '@shared/api.interface';

type TypeTab = 'all' | PointRecordType;

const tabItems: { value: TypeTab; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'recharge', label: '充值' },
  { value: 'consume', label: '消耗' },
];

const typeLabels: Record<PointRecordType, string> = {
  recharge: '充值',
  consume: '消耗',
  refund: '退款',
};

export default function PointRecords() {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [typeTab, setTypeTab] = useState<TypeTab>('all');
  const [records, setRecords] = useState<PointRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params: { page: number; pageSize: number; type?: PointRecordType } =
        { page, pageSize };
      if (typeTab !== 'all') params.type = typeTab;
      const res = await pointApi.getPointRecords(params);
      setRecords(res.items);
      setTotal(res.total);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, typeTab]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const handleTabChange = (value: string) => {
    setTypeTab(value as TypeTab);
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-800">积分流水</h2>
      </div>

      <Card className="border-slate-200">
        <CardContent className="p-5">
          <Tabs value={typeTab} onValueChange={handleTabChange} className="mb-4">
            <TabsList>
              {tabItems.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {loading ? (
            <div className="flex items-center justify-center h-64 text-slate-500 text-sm">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              加载中...
            </div>
          ) : records.length === 0 ? (
            <div className="text-center py-12">
              <History className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <div className="text-slate-500 text-sm">暂无流水记录</div>
            </div>
          ) : (
            <>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 hover:bg-slate-50">
                      <TableHead className="px-4">时间</TableHead>
                      <TableHead className="px-4">类型</TableHead>
                      <TableHead className="px-4">积分变动</TableHead>
                      <TableHead className="px-4">余额</TableHead>
                      <TableHead className="px-4">关联</TableHead>
                      <TableHead className="px-4">描述</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((record) => {
                      const isRecharge =
                        record.type === 'recharge' || record.type === 'refund';
                      return (
                        <TableRow key={record.id}>
                          <TableCell className="px-4 text-sm text-slate-500">
                            {new Date(record.createdAt).toLocaleString('zh-CN')}
                          </TableCell>
                          <TableCell className="px-4">
                            <span
                              className={`inline-flex items-center gap-1 text-xs font-medium ${
                                isRecharge ? 'text-emerald-600' : 'text-slate-600'
                              }`}
                            >
                              {isRecharge ? (
                                <TrendingUp className="w-3.5 h-3.5" />
                              ) : (
                                <TrendingDown className="w-3.5 h-3.5" />
                              )}
                              {typeLabels[record.type]}
                            </span>
                          </TableCell>
                          <TableCell className="px-4 text-sm font-semibold">
                            <span
                              className={
                                isRecharge ? 'text-emerald-600' : 'text-red-500'
                              }
                            >
                              {isRecharge ? '+' : '-'}
                              {Math.abs(record.amount).toLocaleString()}
                            </span>
                          </TableCell>
                          <TableCell className="px-4 text-sm text-slate-700">
                            {record.balanceAfter.toLocaleString()}
                          </TableCell>
                          <TableCell className="px-4 text-xs text-slate-500 font-mono">
                            {record.taskId
                              ? `任务: ${record.taskId.slice(0, 8)}...`
                              : record.orderId
                                ? `订单: ${record.orderId.slice(0, 8)}...`
                                : '-'}
                          </TableCell>
                          <TableCell className="px-4 text-sm text-slate-600">
                            {record.description || '-'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* 分页 */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-slate-500">
                    共 {total} 条，第 {page} / {totalPages} 页
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                      (p) => (
                        <Button
                          key={p}
                          size="sm"
                          variant={p === page ? 'default' : 'outline'}
                          onClick={() => setPage(p)}
                        >
                          {p}
                        </Button>
                      ),
                    )}
                    <Button
                      variant="outline"
                      size="icon"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
