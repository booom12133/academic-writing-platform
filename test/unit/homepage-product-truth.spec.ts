import * as fs from 'node:fs';
import * as path from 'node:path';

const homepagePath = path.resolve(
  __dirname,
  '../../client/src/pages/Home/HomePage.tsx',
);

const homepageSource = fs.readFileSync(homepagePath, 'utf8');

describe('homepage product truth', () => {
  it('does not expose unsupported product claims', () => {
    expect(homepageSource).not.toContain('10万+ 用户信赖');
    expect(homepageSource).not.toContain('23+ 核心工具');
    expect(homepageSource).not.toContain('平均处理 30 秒');
    expect(homepageSource).not.toContain('从选题到排版');
    expect(homepageSource).not.toContain('下载最终结果文件');
    expect(homepageSource).not.toContain('新用户注册即送 50 积分');
    expect(homepageSource).not.toContain('查看全部工具');
  });

  it('derives the visible capability count from production readiness', () => {
    expect(homepageSource).toContain(
      'const productionCapabilityCount = getProductCapabilities()',
    );
    expect(homepageSource).toContain(
      "capability.readiness === 'production'",
    );
    expect(homepageSource).toContain(
      '{productionCapabilityCount} 项能力已开放',
    );
  });
});
