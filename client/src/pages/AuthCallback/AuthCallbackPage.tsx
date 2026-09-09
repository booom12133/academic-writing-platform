import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAppAuth } from '../../auth/AppAuthProvider';
import { sanitizeReturnPath } from '../../auth/return-path';

const AuthCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const auth = useAppAuth();
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    if (!auth.completeLogin) {
      navigate('/login?oidcError=1', { replace: true });
      return () => {
        active = false;
      };
    }
    void auth
      .completeLogin()
      .then(({ returnUrl }) => {
        if (active) navigate(sanitizeReturnPath(returnUrl), { replace: true });
      })
      .catch(() => {
        if (active) {
          setError(true);
          navigate('/login?oidcError=1', { replace: true });
        }
      });
    return () => {
      active = false;
    };
  }, [auth.completeLogin, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">
      {error ? '登录回调无效，请返回登录页重试。' : '正在完成登录…'}
    </div>
  );
};

export default AuthCallbackPage;
