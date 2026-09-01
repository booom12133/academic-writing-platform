import React from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@client/src/components/ui/accordion';
import { HelpCircle, MessageCircle, BookOpen } from 'lucide-react';
import type { TaskType } from '@shared/api.interface';

interface ToolHelperProps {
  toolType: TaskType;
}

interface HelperContent {
  steps: string[];
  faqs: { q: string; a: string }[];
}

const COMMON_STEPS = [
  '填写相关信息和需求',
  '确认内容后提交任务',
  'AI自动处理生成结果',
  '在任务详情查看和下载',
];

const makeHelper = (steps: string[], faqs: { q: string; a: string }[]): HelperContent => ({
  steps,
  faqs,
});

const helperContentMap: Record<TaskType, HelperContent> = {
  // 写作规划类
  thesis: makeHelper(
    [
      '第一步：填写论文标题、专业领域、学历层次等基本信息',
      '第二步：预览AI生成的大纲框架，确认后继续',
      '第三步：确认任务信息，点击提交（消耗80积分）',
      '在任务详情页查看AI生成的完整毕业论文',
    ],
    [
      { q: '毕业论文生成需要多长时间？', a: '通常在5-15分钟内完成，字数越多耗时越长，请耐心等待。' },
      { q: '生成的论文可以直接使用吗？', a: 'AI生成内容仅供参考和写作辅助，建议您结合自己的研究进行修改和完善。' },
      { q: '支持哪些专业领域？', a: '支持计算机、教育学、医学、经济学、管理学、文学、法学、理学、工学等主流学科。' },
    ]
  ),
  'graduation-design': makeHelper(
    [
      '第一步：填写设计题目、专业领域、设计类型等信息',
      '第二步：预览设计方案框架，确认后继续',
      '第三步：确认任务信息，点击提交（消耗100积分）',
      '在任务详情页查看生成的毕业设计全套文档',
    ],
    [
      { q: '毕业设计包含哪些内容？', a: '包含设计说明书、源代码（可选）、设计图纸（可选）、演示PPT等，可根据需要选择。' },
      { q: '支持哪些设计类型？', a: '支持系统设计、产品设计、工程设计、艺术设计等多种类型的毕业设计。' },
      { q: '可以上传参考资料吗？', a: '可以，上传相关参考资料有助于AI生成更贴合需求的设计方案。' },
    ]
  ),
  'topic-generation': makeHelper(
    [
      '选择您的专业领域和学历层次',
      '填写选题要求（选填），提交生成任务',
      '在任务详情页查看 AI 推荐的多个候选题目',
      '可参考研究思路进一步调整或重新提交',
    ],
    [
      { q: '智能拟题需要多长时间？', a: '提交后会在任务详情页显示处理进度，通常几十秒内完成，具体取决于 API 响应。' },
      { q: '一次可以生成多少个题目？', a: '每次默认生成4个不同方向的题目，您可以根据结果重新提交更具体的要求。' },
      { q: '生成的题目都是原创的吗？', a: 'AI基于学术前沿和研究热点生成题目，建议使用前确认是否有类似研究。' },
    ]
  ),
  outline: makeHelper(
    [
      '填写论文标题、专业领域和学历层次等基本信息',
      '在大纲要求中说明章节数量、侧重点和特殊格式需求',
      '点击"生成大纲"提交任务，消耗20积分',
      '在任务详情页查看AI生成的结构化大纲',
    ],
    [
      { q: '大纲生成需要多长时间？', a: '通常在1-3分钟内完成，复杂题目可能需要稍长时间。' },
      { q: '可以调整大纲结构吗？', a: '生成后可以在结果页复制修改，也可以重新提交更具体的要求。' },
      { q: '支持哪些学科领域？', a: '支持计算机、教育学、医学、经济学、管理学、文学、法学、理学、工学等主流学科。' },
    ]
  ),
  literature: makeHelper(
    [
      '输入研究主题和关键词（多个关键词用逗号分隔）',
      '选择专业领域和所需文献数量',
      '设置文献年份范围',
      '点击"推荐文献"提交，消耗30积分起',
    ],
    [
      { q: '文献来源是什么？', a: '基于AI语义推荐相关文献方向和经典文献，供您进一步检索参考。' },
      { q: '可以获取全文吗？', a: '当前提供文献推荐和摘要，建议通过学校数据库获取全文。' },
      { q: '支持英文文献吗？', a: '支持中英文文献推荐，可在关键词中使用英文。' },
    ]
  ),
  'literature-review': makeHelper(COMMON_STEPS, [
    { q: '文献综述包含哪些部分？', a: '通常包含研究背景、国内外研究现状、研究述评、参考文献等部分。' },
    { q: '需要提供参考文献吗？', a: '可选填，如果您有已有的参考文献，AI会基于此生成更精准的综述。' },
    { q: '生成的综述有多少字？', a: '可根据目标字数要求生成，建议3000-8000字较为合适。' },
  ]),
  proposal: makeHelper(COMMON_STEPS, [
    { q: '开题报告包含哪些部分？', a: '包含研究背景与意义、国内外研究现状、研究内容与方法、研究计划、预期成果、参考文献等。' },
    { q: '可以上传参考资料吗？', a: '可以，上传相关资料有助于AI生成更贴合您研究方向的开题报告。' },
    { q: '生成需要多长时间？', a: '通常3-5分钟，具体时间取决于您提供的信息详细程度。' },
  ]),
  'task-assignment': makeHelper(COMMON_STEPS, [
    { q: '任务书包含哪些内容？', a: '包含题目、专业、任务要求、主要参考文献、进度安排等规范内容。' },
    { q: '需要填写学生信息吗？', a: '学生姓名、学号、指导教师为选填项，填写后生成的任务书更完整。' },
    { q: '支持不同学校的格式吗？', a: '生成通用规范格式，您可以根据学校具体要求进行微调。' },
  ]),
  'course-paper': makeHelper(COMMON_STEPS, [
    { q: '课程论文和毕业论文有什么区别？', a: '课程论文篇幅较短、结构相对简单，侧重于某一课程相关主题的论述。' },
    { q: '一般要求多少字？', a: '课程论文通常3000-8000字，具体可根据课程要求设置目标字数。' },
    { q: '可以指定参考文献吗？', a: '可以，您可以粘贴需要引用的参考文献，AI会在文中适当位置引用。' },
  ]),
  'journal-paper': makeHelper(COMMON_STEPS, [
    { q: '期刊论文的格式规范吗？', a: 'AI会按照期刊论文的通用规范生成，包含摘要、关键词、引言、方法、结果、讨论、参考文献等部分。' },
    { q: '支持SCI/EI级别吗？', a: '支持，选择对应的目标期刊方向即可。请注意AI生成内容仅供参考，投稿前需认真修改。' },
    { q: '可以上传数据资料吗？', a: '可以，上传数据资料有助于AI生成更贴合您研究的实证分析部分。' },
  ]),
  'practice-report': makeHelper(COMMON_STEPS, [
    { q: '支持哪些类型的实践报告？', a: '支持实习报告、社会实践报告、实验报告、调研报告等多种类型。' },
    { q: '需要提供实践内容吗？', a: '建议详细描述实践内容和过程，AI会基于您的描述生成完整报告。' },
    { q: '可以上传实践照片吗？', a: '可以上传相关资料作为参考，AI生成文本内容时会参考这些素材。' },
  ]),
  'project-application': makeHelper(COMMON_STEPS, [
    { q: '课题申报书包含哪些部分？', a: '包含研究目标与内容、研究方法与技术路线、预期成果、研究基础、经费预算等部分。' },
    { q: '支持哪些级别的课题？', a: '支持国家级、省部级、市厅级、校级等不同级别的课题申报。' },
    { q: '需要填写经费预算吗？', a: '经费预算为选填项，填写后AI会生成更完整的申报书内容。' },
  ]),
  'paper-revision': makeHelper(
    [
      '选择输入方式：上传文档或粘贴文本',
      '选择修改类型（可多选）',
      '填写具体修改要求',
      '提交后在任务详情查看修改结果',
    ],
    [
      { q: '可以同时选择多种修改类型吗？', a: '可以，您可以根据需要选择多种修改类型，AI会综合处理。' },
      { q: '修改后字数会变化吗？', a: '取决于您选择的修改类型，如内容扩充会增加字数，内容精简会减少字数。' },
      { q: '支持哪些文件格式？', a: '目前支持 .docx 格式的Word文档上传，也支持直接粘贴文本。' },
    ]
  ),
  'comment-revision': makeHelper(
    [
      '在Word文档中使用批注功能添加修改意见',
      '上传带有批注的.docx文档',
      '确认文件后提交任务，消耗25积分',
      'AI识别批注并逐条修改，在任务详情查看结果',
    ],
    [
      { q: '支持哪些批注格式？', a: '支持Word自带的"审阅 → 新建批注"功能生成的批注。' },
      { q: 'AI会逐条处理批注吗？', a: '是的，AI会识别文档中的每一条批注，并根据批注内容进行相应修改。' },
      { q: '文件大小有限制吗？', a: '支持最大50MB的.docx文档，建议文档不超过5万字。' },
    ]
  ),
  // 效率工具类
  polish: makeHelper(
    [
      '选择输入方式：粘贴文本或上传文档',
      '选择润色类型（语法纠错/学术化提升/降重改写/逻辑优化）',
      '确认字数和所需积分（按字数计费，最低10积分）',
      '提交后在任务详情查看润色结果',
    ],
    [
      { q: '润色是怎么计费的？', a: '按字数计费，每1000字10积分，不足1000字按10积分计算。' },
      { q: '支持哪些文件格式？', a: '目前支持 .docx 格式的Word文档上传。' },
      { q: '可以同时选择多种润色类型吗？', a: '每次提交选择一种主要类型，建议按需求分步润色效果更佳。' },
    ]
  ),
  format: makeHelper(
    [
      '上传需要排版的论文文档（.docx格式，最大50MB）',
      '上传格式模板文档（.docx格式，最大10MB）',
      '确认文件后提交，消耗50积分',
      '等待AI自动适配模板格式，下载排版后的文档',
    ],
    [
      { q: '支持哪些格式模板？', a: '支持学校、期刊提供的 .docx 格式模板，AI会自动匹配样式。' },
      { q: '排版后内容会变化吗？', a: '仅调整格式样式（字体、段落、页眉页脚等），不修改正文内容。' },
      { q: '排版需要多长时间？', a: '通常3-5分钟，长文档可能需要更久。' },
    ]
  ),
  check: makeHelper(
    [
      '选择输入方式：粘贴文本或上传文档',
      '确认待检测内容',
      '点击"开始查重"提交，消耗40积分',
      '查看相似度报告和修改建议',
    ],
    [
      { q: '查重结果和知网一样吗？', a: '本工具为AI辅助参考检测，结果仅供参考，正式查重请以学校指定系统为准。' },
      { q: '支持检测多少字？', a: '单次最多支持5万字检测，长文档建议分章节检测。' },
      { q: '会提供修改建议吗？', a: '会，检测报告附带降重改写建议，帮助您快速修改。' },
    ]
  ),
  chart: makeHelper(
    [
      '选择需要生成的图表类型',
      '在文本描述中说明图表的节点、关系和数据',
      '点击"生成图表"提交，消耗25积分',
      '在预览区查看生成的图表并导出',
    ],
    [
      { q: '支持哪些图表类型？', a: '支持技术路线图、流程图、组织架构图、柱状图、折线图、饼图、时序图、E-R图等。' },
      { q: '图表可以导出吗？', a: '生成后可导出为图片或Mermaid源码，方便插入论文。' },
      { q: '描述有什么要求？', a: '尽量清晰描述节点名称和关系，例如"第一阶段：文献综述，第二阶段：实证研究"。' },
    ]
  ),
  'data-analysis': makeHelper(
    [
      '上传数据文件（支持.xlsx/.xls/.csv格式）',
      '选择需要的分析类型（可多选）',
      '填写具体分析要求和变量说明',
      '提交后在任务详情查看分析报告和图表',
    ],
    [
      { q: '支持哪些数据分析方法？', a: '支持描述性统计、回归分析、相关性分析、假设检验、聚类分析、因子分析、中介效应、调节效应等。' },
      { q: '生成的报告包含图表吗？', a: '包含，AI会根据分析内容自动生成相应的统计图表。' },
      { q: '对数据格式有什么要求？', a: '建议使用标准的表格格式，第一行为变量名，每一行为一条记录。' },
    ]
  ),
  'questionnaire-design': makeHelper(COMMON_STEPS, [
    { q: '可以设计哪些类型的题目？', a: '支持单选题、多选题、量表题、开放题、矩阵题等多种题型。' },
    { q: '题目数量有限制吗？', a: '建议10-50题，题目过多可能影响受访者填写体验。' },
    { q: '生成的问卷可以直接使用吗？', a: 'AI生成的问卷为初稿，建议您根据实际研究需求进行调整和预测试。' },
  ]),
  'paper-reverse': makeHelper(
    [
      '上传完整的论文文档（.docx格式）',
      '确认文件后提交任务，消耗25积分',
      'AI自动反推论文的选题依据、研究框架等',
      '在任务详情查看倒推分析结果',
    ],
    [
      { q: '倒推分析包含哪些内容？', a: '包含选题依据、研究框架、大纲结构、研究方法、核心观点、创新点、研究结论等。' },
      { q: '适合什么场景使用？', a: '适合快速理解陌生领域论文、学习论文写作思路、进行文献综述准备等场景。' },
      { q: '对论文长度有要求吗？', a: '建议上传完整的论文文档，字数不少于3000字效果更佳。' },
    ]
  ),
  'ai-reduce': makeHelper(
    [
      '选择输入方式：上传文档或粘贴文本',
      '选择处理类型（降AI/降重/两者兼顾）和强度',
      '填写保留要求（选填），点击提交',
      '在任务详情查看改写结果和对比',
    ],
    [
      { q: '降AI和降重有什么区别？', a: '降AI主要针对AI检测率，通过句式重构、表述替换等方式降低AI特征；降重主要针对重复率，通过改写降低与已有文献的相似度。两者兼顾会同时处理。' },
      { q: '强力降重会改变原意吗？', a: '强力模式改动幅度较大，建议处理后人工复核确保核心意思不变。' },
      { q: '支持哪些文件格式？', a: '支持 .docx 格式文档上传，也可直接粘贴文本。' },
    ]
  ),
  'ai-ppt': makeHelper(
    [
      '输入PPT主题和内容要点',
      '设置目标页数、风格和使用场景',
      '点击提交，AI生成PPT大纲',
      '在任务详情查看每页内容并导出',
    ],
    [
      { q: '生成的PPT可以直接使用吗？', a: '目前生成PPT内容大纲和每页要点，可用于指导制作PPT，后续将支持直接导出PPT文件。' },
      { q: '支持多少页？', a: '支持5~100页，建议10~30页效果最佳。' },
      { q: '有哪些风格可选？', a: '提供学术风、商务风、简约风、科技风四种风格，可根据使用场景选择。' },
    ]
  ),
};

const ToolHelper: React.FC<ToolHelperProps> = ({ toolType }) => {
  const content = helperContentMap[toolType];

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 px-5 py-4">
        <h3 className="text-base font-semibold text-slate-800">帮助中心</h3>
        <p className="mt-1 text-xs text-slate-500">使用指南与常见问题</p>
      </div>
      <div className="flex-1 overflow-y-auto">
        <Accordion type="multiple" defaultValue={['usage']} className="px-4">
          <AccordionItem value="usage">
            <AccordionTrigger className="text-sm font-medium text-slate-700">
              <span className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-blue-600" />
                使用说明
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <ol className="space-y-3 pl-1">
                {content.steps.map((step: string, index: number) => (
                  <li key={index} className="flex gap-3 text-sm text-slate-600">
                    <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                      {index + 1}
                    </span>
                    <span className="leading-relaxed">{step}</span>
                  </li>
                ))}
              </ol>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="faq">
            <AccordionTrigger className="text-sm font-medium text-slate-700">
              <span className="flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-amber-500" />
                常见问题
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4">
                {content.faqs.map((faq, index) => (
                  <div key={index}>
                    <p className="text-sm font-medium text-slate-700">
                      Q: {faq.q}
                    </p>
                    <p className="mt-1 text-sm text-slate-500 leading-relaxed">
                      A: {faq.a}
                    </p>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="contact">
            <AccordionTrigger className="text-sm font-medium text-slate-700">
              <span className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-emerald-500" />
                联系客服
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
                <p className="font-medium text-slate-700">在线客服</p>
                <p className="mt-2 leading-relaxed">
                  工作时间：周一至周日 9:00-22:00
                </p>
                <p className="mt-1 leading-relaxed">
                  如有使用问题或建议，欢迎随时联系我们。
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
};

export default ToolHelper;
