import { Link } from 'react-router-dom';
import { PenTool } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { UniversalLink } from '@lark-apaas/client-toolkit/components/UniversalLink';
import { useAppAuth } from '../../auth/AppAuthProvider';

const RegisterPage: React.FC = () => {
  const session = useAppAuth();
  const hasLoginHandoff = Boolean(session.beginLogin);

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
          <h1 className="text-2xl font-semibold text-slate-800 mb-4">账户注册</h1>
          <p className="text-sm leading-relaxed text-slate-500">
            账户由当前运行环境的组织身份系统创建，本平台不提供模拟注册流程。
          </p>
          {session.errorCode === 'AUTH_CONFIGURATION_UNAVAILABLE' && (
            <p className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-md text-sm text-amber-700">
              当前认证配置不可用，请联系平台管理员。
            </p>
          )}
          {hasLoginHandoff && (
            <Button className="w-full mt-6" asChild>
              <Link to="/login">返回身份认证</Link>
            </Button>
          )}
          {!hasLoginHandoff && (
            <p className="mt-6 text-sm text-slate-500">
              请由组织身份系统创建账户后，再返回本平台登录。
            </p>
          )}
          <div className="mt-6 text-center">
            <p className="text-sm text-slate-500">
              已有账号？{' '}
              <Link to="/login" className="text-blue-600 hover:text-blue-700 font-medium">
                返回登录
              </Link>
            </p>
          </div>
        </Card>

        <p className="text-center text-xs text-slate-400 mt-6">
          注册及登录均受组织身份系统的用户协议和隐私政策约束。{' '}
          <UniversalLink to="#" className="text-slate-500 hover:text-slate-700">查看相关说明</UniversalLink>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;
