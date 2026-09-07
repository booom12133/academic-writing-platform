import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { PenTool } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { UniversalLink } from '@lark-apaas/client-toolkit/components/UniversalLink';
import { useAppAuth } from '../../auth/AppAuthProvider';

function returnPath(search: string): string {
  const value = new URLSearchParams(search).get('returnTo');
  return value?.startsWith('/') ? value : '/';
}

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const session = useAppAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const destination = returnPath(location.search);

  useEffect(() => {
    if (session.status === 'authenticated') {
      navigate(destination, { replace: true });
    }
  }, [destination, navigate, session.status]);

  const handleLogin = async () => {
    setError('');
    if (!session.beginLogin) {
      setError(
        session.errorCode === 'AUTH_CONFIGURATION_UNAVAILABLE'
          ? '当前认证配置不可用，请联系平台管理员'
          : '当前运行环境不提供登录跳转，请联系平台管理员',
      );
      return;
    }

    setLoading(true);
    try {
      await session.beginLogin(destination);
    } catch (_error) {
      setError('登录服务暂时不可用，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const isLocalDevelopment =
    session.status === 'authenticated' && !session.beginLogin;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-slate-50 to-blue-100 px-4 py-8">
      <div className="w-full">
        <div className="flex justify-center mb-8">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
              <PenTool className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-semibold text-slate-800">学术写作AI</span>
          </Link>
        </div>

        <Card className="w-[400px] max-w-full mx-auto p-8">
          <h1 className="text-2xl font-semibold text-slate-800 mb-4">登录学术写作AI</h1>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-md text-sm text-red-600">
              {error}
            </div>
          )}
          {isLocalDevelopment ? (
            <>
              <p className="text-sm leading-relaxed text-slate-500">
                当前使用本地开发认证中间件提供的固定开发身份。
              </p>
              <Button className="w-full mt-6" onClick={() => navigate(destination)}>
                进入平台
              </Button>
            </>
          ) : session.status === 'error' ? (
            <p className="text-sm leading-relaxed text-slate-500">
              {session.errorCode === 'AUTH_CONFIGURATION_UNAVAILABLE'
                ? '当前认证配置不可用，请联系平台管理员。'
                : '暂时无法验证认证服务，请稍后重试。'}
            </p>
          ) : (
            <>
              <p className="text-sm leading-relaxed text-slate-500">
                将跳转到当前运行环境提供的身份认证服务完成登录。
              </p>
              <Button className="w-full mt-6" onClick={handleLogin} disabled={loading}>
                {loading ? '正在跳转…' : '继续登录'}
              </Button>
            </>
          )}
          <div className="mt-6 text-center">
            <p className="text-sm text-slate-500">
              还没有账号？{' '}
              <Link to="/register" className="text-blue-600 hover:text-blue-700 font-medium">
                查看注册说明
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
