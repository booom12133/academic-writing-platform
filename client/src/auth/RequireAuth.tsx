import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useAppAuth } from './AppAuthProvider';

export interface RequireAuthProps {
  children: React.ReactNode;
  returnTo?: string;
}

export function RequireAuth({ children, returnTo }: RequireAuthProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const session = useAppAuth();
  const target =
    returnTo ??
    `${location.pathname}${location.search}${location.hash}`;

  useEffect(() => {
    if (session.status === 'anonymous') {
      navigate(`/login?returnTo=${encodeURIComponent(target)}`, {
        replace: true,
      });
    }
  }, [navigate, session.status, target]);

  if (session.status === 'loading') {
    return <div className="p-8 text-center text-sm text-slate-500">正在检查登录状态…</div>;
  }
  if (session.status === 'error') {
    const message =
      session.errorCode === 'AUTH_CONFIGURATION_UNAVAILABLE'
        ? '认证配置不可用，请联系平台管理员'
        : '暂时无法验证登录状态，请稍后重试';
    return <div className="p-8 text-center text-sm text-red-600">{message}</div>;
  }
  if (session.status === 'anonymous') {
    return <div className="p-8 text-center text-sm text-slate-500">正在跳转登录…</div>;
  }
  return <>{children}</>;
}
