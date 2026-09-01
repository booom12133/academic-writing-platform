import { UniversalLink } from '@lark-apaas/client-toolkit/components/UniversalLink';
const footerLinks = {
  product: {
    title: '产品服务',
    links: ['智能大纲生成', '文献素材推荐', '语法润色', '格式规范排版', '查重参考', '图表可视化'],
  },
  legal: {
    title: '法律信息',
    links: ['用户协议', '隐私政策', '服务条款', '知识产权'],
  },
  help: {
    title: '帮助与支持',
    links: ['使用指南', '常见问题', '联系我们', '意见反馈'],
  },
  notice: {
    title: '使用须知',
    links: ['积分说明', '会员权益', '退款政策', 'AI生成声明'],
  },
};

const Footer = () => {
  return (
    <footer className="bg-white border-t border-slate-200 mt-auto">
      <div className="max-w-[1200px] mx-auto px-6 py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {Object.entries(footerLinks).map(([key, section]) => (
            <div key={key}>
              <h4 className="text-sm font-semibold text-slate-800 mb-4">
                {section.title}
              </h4>
              <ul className="space-y-2.5">
                {section.links.map((link) => (
                  <li key={link}>
                    <UniversalLink
                      to="#"
                      className="text-xs text-slate-500 hover:text-blue-600 transition-colors"
                    >
                      {link}
                    </UniversalLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 pt-6 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-2">
          <p className="text-xs text-slate-400">
            © {new Date().getFullYear()} 学术写作AI 平台. 保留所有权利.
          </p>
          <p className="text-xs text-slate-400">
            AI 生成内容仅供参考，请自行核实与修改
          </p>
        </div>
      </div>
    </footer>
  );
};

export { Footer };
