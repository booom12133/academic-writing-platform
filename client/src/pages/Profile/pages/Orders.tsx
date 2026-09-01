import { useEffect, useState, useCallback } from 'react';
import {
  Receipt,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { orderApi } from '@client/src/api/index';
import type { RechargeOrder, OrderStatus } from '@shared/api.interface';

const statusLabels: Record<OrderStatus, string> = {
  pending: '待支付',
  paid: '已支付',
  cancelled: '已取消',
  failed: '失败',
};

const statusColors: Record<OrderStatus, string> = {
  pending: 'bg-amber-100 text-amber-700',
  paid: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-slate-100 text-slate-600',
  failed: 'bg-red-100 text-red-700',
};

type StatusTab = 'all' | OrderStatus;

const tabItems: { value: StatusTab; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'pending', label: '待支付' },
  { value: 'paid', label: '已支付' },
  { value: 'cancelled', label: '已取消' },
  { value: 'failed', label: '失败' },
];

export default function Orders() {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [statusTab, setStatusTab] = useState<StatusTab>('all');
  const [orders, setOrders] = useState<RechargeOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params: { page: number; pageSize: number; status?: OrderStatus } =
        { page, pageSize };
      if (statusTab !== 'all') params.status = statusTab;
      const res = await orderApi.getOrderList(params);
      setOrders(res.items);
      setTotal(res.total);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusTab]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const handleTabChange = (value: string) => {
    setStatusTab(value as StatusTab);
    setPage(1);
  };

  const handlePay = async (id: string) => {
    try {
      await orderApi.payOrder(id);
      loadOrders();
    } catch {
      // ignore
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await orderApi.cancelOrder(id);
      loadOrders();
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-800">充值订单</h2>
      </div>

      <Card className="border-slate-200">
        <CardContent className="p-5">
          <Tabs value={statusTab} onValueChange={handleTabChange} className="mb-4">
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
          ) : orders.length === 0 ? (
            <div className="text-center py-12">
              <Receipt className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <div className="text-slate-500 text-sm">暂无订单记录</div>
            </div>
          ) : (
            <>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 hover:bg-slate-50">
                      <TableHead className="px-4">订单号</TableHead>
                      <TableHead className="px-4">金额</TableHead>
                      <TableHead className="px-4">积分</TableHead>
                      <TableHead className="px-4">支付方式</TableHead>
                      <TableHead className="px-4">状态</TableHead>
                      <TableHead className="px-4">创建时间</TableHead>
                      <TableHead className="px-4 text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="px-4 font-mono text-xs text-slate-600">
                          {order.id}
                        </TableCell>
                        <TableCell className="px-4 text-sm font-medium text-slate-800">
                          ¥{order.amount.toLocaleString()}
                        </TableCell>
                        <TableCell className="px-4 text-sm text-slate-600">
                          {order.points.toLocaleString()}
                        </TableCell>
                        <TableCell className="px-4 text-sm text-slate-600">
                          {order.payMethod || '-'}
                        </TableCell>
                        <TableCell className="px-4">
                          <Badge
                            className={`${statusColors[order.status]} border-transparent`}
                            variant="secondary"
                          >
                            {statusLabels[order.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-4 text-sm text-slate-500">
                          {new Date(order.createdAt).toLocaleString('zh-CN')}
                        </TableCell>
                        <TableCell className="px-4 text-right">
                          {order.status === 'pending' && (
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => handlePay(order.id)}
                              >
                                支付
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCancel(order.id)}
                              >
                                取消
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
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
