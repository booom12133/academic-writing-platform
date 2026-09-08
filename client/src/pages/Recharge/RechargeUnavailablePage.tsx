import { Link } from 'react-router-dom';
import { ArrowLeft, Info } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function RechargeUnavailablePage() {
  return (
    <div className="min-h-full bg-slate-50 px-6 py-12">
      <Card className="mx-auto max-w-xl border-slate-200">
        <CardContent className="space-y-4 p-8 text-center">
          <Info className="mx-auto h-10 w-10 text-slate-400" />
          <h1 className="text-2xl font-semibold text-slate-800">在线充值暂未开放</h1>
          <p className="text-sm leading-6 text-slate-600">
            当前版本未接入真实支付渠道。此页面不会创建订单或增加积分。
          </p>
          <Button variant="outline" asChild>
            <Link to="/profile">
              <ArrowLeft className="h-4 w-4" />返回个人中心
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
