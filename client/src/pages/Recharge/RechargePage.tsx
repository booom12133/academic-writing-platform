import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Coins,
  Crown,
  Info,
  CreditCard,
  Smartphone,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  RadioGroup,
  RadioGroupItem,
} from '@/components/ui/radio-group';
import { userApi, orderApi } from '@client/src/api/index';
import type { UserProfile, MemberLevel } from '@shared/api.interface';
import { MEMBER_LEVELS, RECHARGE_OPTIONS } from '@shared/api.interface';
import { Image } from '@client/src/components/ui/image';

const memberColors: Record<MemberLevel, string> = {
  normal: 'bg-slate-500',
  silver: 'bg-slate-400',
  gold: 'bg-amber-500',
  diamond: 'bg-blue-500',
};

const memberBadgeVariants: Record<MemberLevel, string> = {
  normal: 'bg-slate-100 text-slate-700 border-slate-200',
  silver: 'bg-slate-100 text-slate-600 border-slate-300',
  gold: 'bg-amber-50 text-amber-700 border-amber-200',
  diamond: 'bg-blue-50 text-blue-700 border-blue-200',
};

type PayMethod = 'alipay' | 'wechat';

const payMethodLabels: Record<PayMethod, string> = {
  alipay: '支付宝扫码支付',
  wechat: '微信扫码支付',
};

export default function RechargePage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [selectedAmount, setSelectedAmount] = useState<number>(50);
  const [customAmount, setCustomAmount] = useState('');
  const [payMethod, setPayMethod] = useState<PayMethod>('alipay');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [paying, setPaying] = useState(false);
  const [paySuccess, setPaySuccess] = useState(false);
  const [currentOrderId, setCurrentOrderId] = useState('');
  const [creating, setCreating] = useState(false);

  const actualAmount = customAmount
    ? Number(customAmount) || 0
    : selectedAmount;

  const pointsGained = actualAmount; // 1元 = 1积分

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const res = await userApi.getProfile();
        setProfile(res);
      } catch {
        // ignore
      }
    };
    loadProfile();
  }, []);

  const getNextLevelInfo = (totalRecharge: number, level: MemberLevel) => {
    const currentIdx = MEMBER_LEVELS.findIndex((l) => l.level === level);
    if (currentIdx >= MEMBER_LEVELS.length - 1) {
      return { nextName: '已达最高等级', needed: 0, progress: 100, discount: 0.8 };
    }
    const next = MEMBER_LEVELS[currentIdx + 1];
    const current = MEMBER_LEVELS[currentIdx];
    const needed = next.threshold - totalRecharge;
    const range = next.threshold - current.threshold;
    const progress =
      range > 0
        ? Math.min(100, ((totalRecharge - current.threshold) / range) * 100)
        : 100;
    return {
      nextName: next.name,
      needed,
      progress,
      discount: next.discount,
    };
  };

  const handleRecharge = async () => {
    if (actualAmount <= 0) return;
    setCreating(true);
    setPaySuccess(false);
    try {
      const res = await orderApi.createOrder({
        amount: actualAmount,
        payMethod,
      });
      setCurrentOrderId(res.order.id);
      setDialogOpen(true);
    } catch {
      // ignore
    } finally {
      setCreating(false);
    }
  };

  const handleConfirmPay = async () => {
    if (!currentOrderId) return;
    setPaying(true);
    try {
      await orderApi.payOrder(currentOrderId);
      setPaySuccess(true);
      setTimeout(() => {
        setDialogOpen(false);
        setPaySuccess(false);
        navigate('/profile');
      }, 1500);
    } catch {
      // ignore
    } finally {
      setPaying(false);
    }
  };

  const memberInfo = profile
    ? MEMBER_LEVELS.find((m) => m.level === profile.memberLevel)
    : null;
  const nextInfo = profile
    ? getNextLevelInfo(profile.totalRecharge, profile.memberLevel)
    : null;

  return (
    <div className="min-h-full bg-slate-50 py-8 px-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* 页面标题 */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-slate-800 mb-2">
            积分充值
          </h1>
          <p className="text-sm text-slate-500">
            1元 = 1积分，充值后即时到账，长期有效
          </p>
        </div>

        {/* 当前积分 & 会员状态 */}
        {profile && memberInfo && nextInfo && (
          <Card className="border-slate-200 bg-gradient-to-r from-blue-600 to-blue-500 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-blue-100 text-sm mb-1">当前积分余额</div>
                  <div className="text-4xl font-bold mb-2">
                    {profile.points.toLocaleString()}{' '}
                    <span className="text-lg font-normal text-blue-100">积分</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      className={`${memberBadgeVariants[profile.memberLevel]} border`}
                      variant="outline"
                    >
                      <Crown className="w-3 h-3 mr-1" />
                      {memberInfo.name}
                    </Badge>
                    <span className="text-xs text-blue-100">
                      享 {memberInfo.discount * 10} 折优惠
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-blue-100 text-sm mb-2">会员等级进度</div>
                  <div className="w-48">
                    <div className="flex justify-between text-xs text-blue-100 mb-1">
                      <span>{memberInfo.name}</span>
                      <span>{nextInfo.nextName}</span>
                    </div>
                    <div className="w-full h-2 bg-blue-400/30 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-white rounded-full transition-all"
                        style={{ width: `${nextInfo.progress}%` }}
                      />
                    </div>
                    {nextInfo.needed > 0 && (
                      <div className="text-xs text-blue-100 mt-2">
                        再充 ¥{nextInfo.needed.toLocaleString()} 升级
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 充值档位选择 */}
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <Coins className="w-4 h-4 text-blue-600" />
              选择充值档位
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-5">
              {RECHARGE_OPTIONS.map((amount) => {
                const isSelected =
                  !customAmount && selectedAmount === amount;
                return (
                  <button
                    key={amount}
                    onClick={() => {
                      setSelectedAmount(amount);
                      setCustomAmount('');
                    }}
                    className={`relative p-5 rounded-xl border-2 transition-all text-left ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50/50 shadow-sm'
                        : 'border-slate-200 hover:border-blue-300 bg-white'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-2 right-2">
                        <CheckCircle2 className="w-4 h-4 text-blue-500" />
                      </div>
                    )}
                    <div className="text-2xl font-bold text-slate-800">
                      ¥{amount}
                    </div>
                    <div className="text-sm text-slate-500 mt-1">
                      获得 {amount.toLocaleString()} 积分
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="pt-4 border-t border-slate-100">
              <div className="text-sm font-medium text-slate-700 mb-2">
                自定义金额
              </div>
              <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-xs">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                    ¥
                  </span>
                  <Input
                    type="number"
                    min={1}
                    value={customAmount}
                    onChange={(e) => {
                      setCustomAmount(e.target.value);
                    }}
                    placeholder="输入自定义金额"
                    className="pl-7"
                  />
                </div>
                <span className="text-sm text-slate-500">
                  = {(customAmount ? Number(customAmount) || 0 : 0).toLocaleString()} 积分
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 支付方式 */}
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-blue-600" />
              支付方式
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={payMethod}
              onValueChange={(v) => setPayMethod(v as PayMethod)}
              className="grid grid-cols-2 gap-4"
            >
              {(['alipay', 'wechat'] as PayMethod[]).map((method) => {
                const Icon = method === 'alipay' ? CreditCard : Smartphone;
                const color =
                  method === 'alipay' ? 'text-blue-600' : 'text-emerald-600';
                const isSelected = payMethod === method;
                return (
                  <label
                    key={method}
                    className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50/50'
                        : 'border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    <RadioGroupItem value={method} id={method} className="sr-only" />
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        method === 'alipay' ? 'bg-blue-50' : 'bg-emerald-50'
                      }`}
                    >
                      <Icon className={`w-5 h-5 ${color}`} />
                    </div>
                    <span className="text-sm font-medium text-slate-800">
                      {payMethodLabels[method]}
                    </span>
                    {isSelected && (
                      <CheckCircle2 className="w-4 h-4 text-blue-500 ml-auto" />
                    )}
                  </label>
                );
              })}
            </RadioGroup>
          </CardContent>
        </Card>

        {/* 会员权益提示 */}
        <Card className="border-slate-200 bg-amber-50/50">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <Crown className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="text-sm font-semibold text-slate-800 mb-1">
                  会员权益
                </div>
                <div className="text-sm text-slate-600 leading-relaxed">
                  累计充值越高，折扣越大：白银会员 95 折（满 ¥100）、黄金会员 9 折（满 ¥500）、钻石会员 8 折（满 ¥1000）。
                  {nextInfo && nextInfo.needed > 0 && (
                    <span className="text-amber-600 font-medium">
                      {' '}本次充值后还差 ¥
                      {Math.max(0, nextInfo.needed - actualAmount).toLocaleString()} 升级
                      {nextInfo.nextName}。
                    </span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 充值规则提示 */}
        <Card className="border-slate-200">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1">
                <div className="text-sm font-semibold text-slate-800">
                  温馨提示
                </div>
                <ul className="text-sm text-slate-600 leading-relaxed space-y-1">
                  <li>· 充值积分不支持退款，请按需充值</li>
                  <li>· 积分长期有效，不会过期</li>
                  <li>· 积分可用于全部六大AI工具的使用</li>
                  <li>· 如遇问题请联系客服</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 底部充值按钮 */}
        <div className="sticky bottom-0 -mx-6 px-6 py-4 bg-white border-t border-slate-200 shadow-[0_-4px_12px_rgba(0_0_0_0.05)]">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div>
              <span className="text-sm text-slate-500">应付金额：</span>
              <span className="text-2xl font-bold text-blue-600">
                ¥{actualAmount.toLocaleString()}
              </span>
              <span className="text-sm text-slate-500 ml-2">
                （获得 {pointsGained.toLocaleString()} 积分）
              </span>
            </div>
            <Button
              size="lg"
              variant="default"
              className="px-10 text-base"
              disabled={actualAmount <= 0 || creating}
              onClick={handleRecharge}
            >
              {creating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  创建订单中...
                </>
              ) : (
                <>立即充值 ¥{actualAmount.toLocaleString()}</>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* 支付弹窗 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">
              {payMethodLabels[payMethod]}
            </DialogTitle>
            <DialogDescription className="text-center">
              请使用手机{payMethod === 'alipay' ? '支付宝' : '微信'}扫码完成支付
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center py-4">
            {paySuccess ? (
              <div className="flex flex-col items-center py-8">
                <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                </div>
                <div className="text-lg font-semibold text-slate-800 mb-1">
                  支付成功
                </div>
                <div className="text-sm text-slate-500">
                  积分已到账，即将跳转到个人中心
                </div>
              </div>
            ) : (
              <>
                <div className="w-48 h-48 border-2 border-slate-200 rounded-lg overflow-hidden bg-white p-2">
                  <Image
                    src={`https://picsum.photos/seed/${payMethod}-${currentOrderId}/400/400`}
                    alt="支付二维码"
                    className="w-full h-full object-cover rounded"
                  />
                </div>
                <div className="mt-4 text-center">
                  <div className="text-sm text-slate-600">
                    支付金额：
                    <span className="text-xl font-bold text-blue-600">
                      ¥{actualAmount.toLocaleString()}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    订单号：{currentOrderId.slice(0, 12)}...
                  </div>
                </div>
              </>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-col gap-2">
            {!paySuccess && (
              <Button
                variant="default"
                className="w-full"
                onClick={handleConfirmPay}
                disabled={paying}
              >
                {paying ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    确认中...
                  </>
                ) : (
                  '我已支付'
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
