import { useEffect, useState } from 'react';
import {
  User,
  Phone,
  Lock,
  CheckCircle2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { userApi } from '@client/src/api/index';
import type { UserProfile } from '@shared/api.interface';

export default function Settings() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [pwdSuccess, setPwdSuccess] = useState(false);
  const [pwdError, setPwdError] = useState('');

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const res = await userApi.getProfile();
        setProfile(res);
        setUsername(res.username || '');
        setPhone(res.phone || '');
      } catch {
        // ignore
      }
    };
    loadProfile();
  }, []);

  const handleSaveProfile = async () => {
    setSaveLoading(true);
    setSaveSuccess(false);
    try {
      const res = await userApi.updateProfile({ username, phone });
      setProfile(res);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch {
      // ignore
    } finally {
      setSaveLoading(false);
    }
  };

  const handleChangePassword = async () => {
    setPwdError('');
    setPwdSuccess(false);

    if (!oldPassword) {
      setPwdError('请输入旧密码');
      return;
    }
    if (newPassword.length < 6) {
      setPwdError('新密码至少6位');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdError('两次输入的新密码不一致');
      return;
    }

    setPwdLoading(true);
    try {
      // 模拟修改密码
      await new Promise((resolve) => setTimeout(resolve, 800));
      setPwdSuccess(true);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPwdSuccess(false), 2000);
    } catch {
      // ignore
    } finally {
      setPwdLoading(false);
    }
  };

  if (!profile) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500 text-sm">
        加载中...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-xl font-semibold text-slate-800">账号设置</h2>

      {/* 绑定信息 */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <User className="w-4 h-4 text-blue-600" />
            绑定信息
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              用户名
            </label>
            <div className="flex items-center gap-3">
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="请输入用户名"
                className="flex-1"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
              <Phone className="w-4 h-4 text-slate-500" />
              手机号
            </label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="请输入手机号"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button
              variant="default"
              onClick={handleSaveProfile}
              disabled={saveLoading}
            >
              {saveLoading ? '保存中...' : '保存修改'}
            </Button>
            {saveSuccess && (
              <span className="flex items-center gap-1 text-sm text-emerald-600">
                <CheckCircle2 className="w-4 h-4" />
                保存成功
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 修改密码 */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <Lock className="w-4 h-4 text-blue-600" />
            修改密码
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              旧密码
            </label>
            <Input
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              placeholder="请输入旧密码"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              新密码
            </label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="请输入新密码（至少6位）"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              确认新密码
            </label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="请再次输入新密码"
            />
          </div>

          {pwdError && (
            <Badge
              variant="destructive"
              className="border-transparent bg-red-50 text-red-600"
            >
              {pwdError}
            </Badge>
          )}

          <div className="flex items-center gap-3 pt-2">
            <Button
              variant="default"
              onClick={handleChangePassword}
              disabled={pwdLoading}
            >
              {pwdLoading ? '提交中...' : '确认修改'}
            </Button>
            {pwdSuccess && (
              <span className="flex items-center gap-1 text-sm text-emerald-600">
                <CheckCircle2 className="w-4 h-4" />
                密码修改成功
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
