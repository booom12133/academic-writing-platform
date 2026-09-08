import * as fs from 'node:fs';
import * as path from 'node:path';

function readClientSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(__dirname, '../../client/src', relativePath), 'utf8');
}

const navbarSource = readClientSource('components/Navbar.tsx');
const dashboardSource = readClientSource('pages/Profile/pages/Dashboard.tsx');
const ordersSource = readClientSource('pages/Profile/pages/Orders.tsx');
const appSource = readClientSource('app.tsx');
const unavailableSource = readClientSource('pages/Recharge/RechargeUnavailablePage.tsx');

describe('payment product truth', () => {
  it('removes production recharge actions from the authenticated navbar', () => {
    expect(navbarSource).not.toContain("navigate('/recharge')");
    expect(navbarSource).not.toContain('充值中心');
    expect(navbarSource).not.toContain('>充值<');
    expect(navbarSource).toContain('balance.toLocaleString()');
  });

  it('keeps the profile dashboard truthful and derives open capability count', () => {
    expect(dashboardSource).not.toContain('累计充值');
    expect(dashboardSource).not.toContain('充值积分');
    expect(dashboardSource).not.toContain('多种档位，即充即用');
    expect(dashboardSource).not.toContain('再充 ¥');
    expect(dashboardSource).not.toContain('六大AI工具');
    expect(dashboardSource).toContain('getProductCapabilities');
    expect(dashboardSource).toContain("capability.readiness === 'production'");
    expect(dashboardSource).toContain('使用已开放的 AI 工具');
  });

  it('keeps profile order history read-only', () => {
    expect(ordersSource).not.toContain('payOrder');
    expect(ordersSource).not.toContain('cancelOrder');
    expect(ordersSource).not.toContain('>支付<');
    expect(ordersSource).toContain('历史订单仅供查看');
  });

  it('routes recharge to a truthful unavailable page instead of legacy payment UI', () => {
    expect(appSource).toContain("import RechargeUnavailablePage from './pages/Recharge/RechargeUnavailablePage';");
    expect(appSource).not.toContain("import RechargePage from './pages/Recharge/RechargePage';");
    expect(appSource).toContain('<RechargeUnavailablePage />');
    expect(unavailableSource).toContain('在线充值暂未开放');
    expect(unavailableSource).toContain('当前版本未接入真实支付渠道');
    expect(unavailableSource).toContain('此页面不会创建订单或增加积分');
    expect(unavailableSource).not.toContain('createOrder');
    expect(unavailableSource).not.toContain('payOrder');
    expect(unavailableSource).not.toContain('picsum.photos');
    expect(unavailableSource).not.toContain('支付宝');
    expect(unavailableSource).not.toContain('微信');
  });
});
