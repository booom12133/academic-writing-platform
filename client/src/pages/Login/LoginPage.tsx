import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, PenTool, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { userApi } from '@client/src/api/index';
import { UniversalLink } from '@lark-apaas/client-toolkit/components/UniversalLink';

type LoginTab = 'password' | 'sms';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<LoginTab>('password');
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [captcha, setCaptcha] = useState('');
  const [captchaInput, setCaptchaInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generateCaptcha = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 4; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setCaptcha(result);
  };

  useEffect(() => {
    generateCaptcha();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (captchaInput.toUpperCase() !== captcha) {
      setError('图形验证码错误');
      generateCaptcha();
      return;
    }

    if (activeTab === 'password') {
      if (!account || !password) {
        setError('请输入账号和密码');
        return;
      }
    } else {
      if (!phone || !code) {
        setError('请输入手机号和验证码');
        return;
      }
    }

    setLoading(true);
    try {
      await userApi.ensureUser();
      localStorage.setItem('aw_user_token', 'mock_token');
      navigate('/');
    } catch (err) {
      setError('登录失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-slate-50 to-blue-100 px-4 py-8">
      <div className="w-full">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
              <PenTool className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-semibold text-slate-800">学术写作AI</span>
          </Link>
        </div>

        <Card className="w-[400px] max-w-full mx-auto p-8">
          <h1 className="text-2xl font-semibold text-slate-800 mb-6">欢迎回来</h1>

          {/* Tabs */}
          <div className="flex border-b border-slate-200 mb-6">
            <button
              className={`pb-3 px-4 text-sm font-medium transition-colors ${
                activeTab === 'password'
                  ? 'text-blue-600 border-b-2 border-blue-600 -mb-px'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
              onClick={() => setActiveTab('password')}
            >
              密码登录
            </button>
            <button
              className={`pb-3 px-4 text-sm font-medium transition-colors ${
                activeTab === 'sms'
                  ? 'text-blue-600 border-b-2 border-blue-600 -mb-px'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
              onClick={() => setActiveTab('sms')}
            >
              短信验证码登录
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-md text-sm text-red-600">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {activeTab === 'password' ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    手机号 / 用户名
                  </label>
                  <Input
                    type="text"
                    placeholder="请输入手机号或用户名"
                    value={account}
                    onChange={(e) => setAccount(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    密码
                  </label>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="请输入密码"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    手机号
                  </label>
                  <Input
                    type="tel"
                    placeholder="请输入手机号"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    验证码
                  </label>
                  <div className="flex gap-3">
                    <Input
                      type="text"
                      placeholder="请输入验证码"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="whitespace-nowrap"
                      disabled
                    >
                      获取验证码
                    </Button>
                  </div>
                </div>
              </>
            )}

            {/* Captcha */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                图形验证码
              </label>
              <div className="flex gap-3">
                <Input
                  type="text"
                  placeholder="请输入验证码"
                  value={captchaInput}
                  onChange={(e) => setCaptchaInput(e.target.value)}
                  maxLength={4}
                  className="flex-1"
                />
                <button
                  type="button"
                  onClick={generateCaptcha}
                  className="h-9 px-4 bg-slate-100 border border-slate-200 rounded-md font-mono text-lg font-bold text-slate-600 tracking-widest hover:bg-slate-200 transition-colors flex items-center gap-2"
                  title="点击刷新"
                >
                  <span className="italic select-none" style={{ letterSpacing: '4px' }}>
                    {captcha}
                  </span>
                  <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-10 mt-6"
              disabled={loading}
            >
              {loading ? '登录中...' : '登录'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-slate-500">
              还没有账号？{' '}
              <Link to="/register" className="text-blue-600 hover:text-blue-700 font-medium">
                立即注册
              </Link>
            </p>
          </div>
        </Card>

        <p className="text-center text-xs text-slate-400 mt-6">
          登录即表示您同意{' '}
          <UniversalLink to="#" className="text-slate-500 hover:text-slate-700">用户协议</UniversalLink>
          {' '}和{' '}
          <UniversalLink to="#" className="text-slate-500 hover:text-slate-700">隐私政策</UniversalLink>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
