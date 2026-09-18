import { NavLink, useNavigate } from 'react-router-dom';
import { Coins, PenTool, Menu, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { pointApi } from '@client/src/api/index';
import { useAppAuth } from '../auth/AppAuthProvider';

const navItems = [
  { path: '/', label: '首页', end: true },
  { path: '/tools', label: '工具中心' },
  { path: '/tasks', label: '我的任务' },
  { path: '/knowledge', label: '文档工作区' },
  { path: '/academic-search', label: 'Academic Search' },
  { path: '/grounded-writing', label: '有据写作' },
  { path: '/profile', label: '个人中心' },
];

const Navbar = () => {
  const navigate = useNavigate();
  const session = useAppAuth();
  const [balance, setBalance] = useState<number>(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (session.status !== 'authenticated') {
      setBalance(0);
      return;
    }
    void pointApi
      .getBalance()
      .then((balanceData) => setBalance(balanceData.points))
      .catch(() => setBalance(0));
  }, [session.status, session.userId]);

  const handleLogout = async () => {
    await session.logout();
    navigate('/login');
  };

  const displayName =
    session.displayName || session.userId?.slice(0, 8) || '用户';

  return (
    <header className="fixed top-0 left-0 right-0 z-40 h-[60px] bg-white border-b border-slate-200">
      <div className="max-w-[1200px] h-full mx-auto px-6 flex items-center justify-between">
        {/* Logo */}
        <NavLink to="/" className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <PenTool className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-semibold text-slate-800">学术写作AI</span>
        </NavLink>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={({ isActive }) =>
                `px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  isActive
                    ? 'text-blue-600 bg-blue-50'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Right Section */}
        <div className="flex items-center gap-3">
          {session.status === 'authenticated' ? (
            <>
              {/* Points */}
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-50 border border-amber-100">
                <Coins className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-medium text-amber-700">
                  {balance.toLocaleString()}
                </span>
              </div>

              {/* User Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 p-1 rounded-md hover:bg-slate-100 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                      <span className="text-sm font-medium text-blue-600">
                        {displayName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="hidden sm:block text-sm text-slate-700">
                      {displayName}
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => navigate('/profile')}>
                    个人中心
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/tasks')}>
                    我的任务
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {session.canSignOut ? (
                    <DropdownMenuItem
                      onClick={() => void handleLogout()}
                      className="text-red-500"
                    >
                      退出登录
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem disabled>
                      本地开发身份无真实退出登录
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            session.status !== 'loading' && (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/login')}
                >
                  登录
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => navigate('/register')}
                >
                  注册
                </Button>
              </div>
            )
          )}

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 rounded-md hover:bg-slate-100"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5 text-slate-600" />
            ) : (
              <Menu className="w-5 h-5 text-slate-600" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-slate-200">
          <nav className="flex flex-col py-2">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.end}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `px-6 py-3 text-sm font-medium ${
                    isActive
                      ? 'text-blue-600 bg-blue-50'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
            {session.status === 'authenticated' && (
              <>
                <div className="px-6 py-3 border-t border-slate-100">
                  <div className="flex items-center gap-2 text-sm text-amber-600">
                    <Coins className="w-4 h-4" />
                    <span>{balance.toLocaleString()} 积分</span>
                  </div>
                </div>
                {session.canSignOut ? (
                  <button
                    onClick={() => {
                      void handleLogout();
                      setMobileMenuOpen(false);
                    }}
                    className="text-left px-6 py-3 text-sm text-red-500 hover:bg-slate-50"
                  >
                    退出登录
                  </button>
                ) : (
                  <div className="px-6 py-3 text-sm text-slate-500">
                    本地开发身份无真实退出登录
                  </div>
                )}
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
};

export { Navbar };
