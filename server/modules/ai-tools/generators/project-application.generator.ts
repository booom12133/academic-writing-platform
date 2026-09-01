/**
 * 课题申报生成器
 * 输入：{ projectTitle, field, projectType, applicant, fundingLevel }
 * 输出：{ projectTitle, researchObjectives, researchContent, methodology, technicalRoute, expectedOutcomes, researchFoundation, budgetEstimate, innovationPoints }
 *
 * TODO: 后续接入真实 AI 插件时，用 AI 生成替换下方模板逻辑
 */

interface ProjectApplicationInput {
  projectTitle?: string;
  field?: string;
  projectType?: string;
  applicant?: string;
  fundingLevel?: string;
}

export interface ProjectApplicationOutput {
  projectTitle: string;
  researchObjectives: string;
  researchContent: string;
  methodology: string;
  technicalRoute: string[];
  expectedOutcomes: string[];
  researchFoundation: string;
  budgetEstimate: { item: string; amount: string }[];
  innovationPoints: string[];
}

const BUDGET_TEMPLATES = [
  { item: '设备费', amount: '15万元' },
  { item: '材料费', amount: '8万元' },
  { item: '测试化验加工费', amount: '10万元' },
  { item: '差旅费', amount: '5万元' },
  { item: '会议费', amount: '3万元' },
  { item: '合作与交流费', amount: '6万元' },
  { item: '出版/文献/信息传播/知识产权事务费', amount: '4万元' },
  { item: '劳务费', amount: '12万元' },
  { item: '专家咨询费', amount: '3万元' },
  { item: '管理费', amount: '4万元' },
];

export async function generate(input: ProjectApplicationInput): Promise<ProjectApplicationOutput> {
  const {
    projectTitle = '面向多模态数据的智能分析方法与应用研究',
    field = '计算机科学与技术',
    projectType = '面上项目',
    applicant = '申请人',
    fundingLevel = '60万元',
  } = input;

  const researchObjectives = `本项目以"${projectTitle}"为研究目标，围绕${field}领域的关键科学问题开展系统研究。` +
    `总体目标是构建面向多模态数据的智能分析理论框架和技术体系，突破现有方法在多模态融合、` +
    `特征学习和可解释性等方面的瓶颈，为相关行业应用提供理论支撑和技术方案。` +
    `具体目标包括：（1）建立多模态数据统一表示与融合理论；（2）提出高效的智能分析算法；` +
    `（3）构建原型验证系统并进行应用验证；（4）培养高层次研究人才，产出高水平学术成果。`;

  const researchContent = `本项目的主要研究内容包括以下四个方面：\n\n` +
    `**研究内容一：多模态数据统一表示理论**\n` +
    `针对多模态数据的异构性和异构分布问题，研究统一的特征表示方法，` +
    `建立跨模态的语义对齐机制，为后续分析奠定基础。\n\n` +
    `**研究内容二：多模态融合与特征学习方法**\n` +
    `研究多模态深度融合策略，设计高效的注意力机制和特征选择方法，` +
    `提升模型对关键信息的提取能力和鲁棒性。\n\n` +
    `**研究内容三：可解释智能分析模型**\n` +
    `研究模型可解释性方法，构建可视化分析框架，增强模型的可信度和可验证性，` +
    `推动${field}领域智能技术的实际落地。\n\n` +
    `**研究内容四：系统实现与应用验证**\n` +
    `基于上述研究成果，构建原型验证系统，并在典型应用场景中进行验证和评估，` +
    `验证所提方法的有效性和实用性。`;

  const methodology = `本项目将综合运用理论分析、算法设计、实验验证和应用示范等多种研究方法。` +
    `在理论层面，采用数学建模和理论推导的方法，建立多模态数据统一表示的理论框架；` +
    `在算法层面，基于深度学习和统计学习理论，设计高效的多模态融合和特征学习算法；` +
    `在实验层面，构建多模态数据集，设计对比实验和消融实验，全面评估所提方法的性能；` +
    `在应用层面，与行业合作伙伴紧密合作，在真实场景中验证方法的有效性和实用性。` +
    `项目将遵循"理论创新-算法设计-实验验证-应用示范"的技术路线，层层递进，确保研究目标的实现。`;

  const technicalRoute = [
    '第一步：文献调研与问题凝练。系统梳理国内外研究现状，明确科学问题和研究目标。',
    '第二步：理论建模与方法设计。建立多模态统一表示理论，设计融合与学习算法。',
    '第三步：算法实现与性能优化。实现核心算法，进行性能优化和效率提升。',
    '第四步：实验验证与对比分析。构建实验平台，进行大量实验并深入分析结果。',
    '第五步：系统开发与应用验证。开发原型系统，在实际场景中进行验证和示范。',
    '第六步：成果总结与推广应用。总结研究成果，撰写论文，推动成果转化和应用。',
  ];

  const expectedOutcomes = [
    '提出多模态数据统一表示与融合的新理论和新方法，形成完整的理论体系',
    '发表高水平学术论文8-10篇，其中SCI/CCF-A类论文不少于5篇',
    '申请国家发明专利3-5项，形成自主知识产权',
    '开发原型系统1套，在至少2个典型应用场景中进行验证',
    '培养博士研究生2-3名，硕士研究生5-6名',
    '形成行业标准或技术规范建议稿1-2份',
  ];

  const researchFoundation = `申请人${applicant}长期从事${field}领域的研究工作，具有扎实的理论基础和丰富的研究经验。` +
    `近年来在相关领域发表高水平学术论文多篇，主持和参与多项国家级和省部级科研项目。` +
    `所在单位拥有良好的科研平台和实验条件，配备有高性能计算集群和完善的实验设备，` +
    `能够为本项目的顺利实施提供硬件和软件支撑。` +
    `项目团队成员结构合理，涵盖理论研究、算法设计、系统开发和应用验证等多个方面，` +
    `具有完成本项目研究任务的能力和条件。` +
    `此外，项目组与多家企业和科研机构建立了良好的合作关系，` +
    `可为项目的应用验证和成果转化提供有力支持。`;

  const budgetEstimate = BUDGET_TEMPLATES.map((item) => ({
    ...item,
    amount: item.amount,
  }));

  const innovationPoints = [
    '理论创新：提出多模态数据统一表示理论，建立跨模态语义对齐的新机制。',
    '方法创新：设计基于注意力机制的多模态深度融合算法，显著提升分析性能。',
    '技术创新：构建可解释的智能分析框架，增强模型的可解释性和可信度。',
    '应用创新：将研究成果应用于典型行业场景，推动技术落地和产业升级。',
  ];

  return {
    projectTitle,
    researchObjectives,
    researchContent,
    methodology,
    technicalRoute,
    expectedOutcomes,
    researchFoundation,
    budgetEstimate,
    innovationPoints,
  };
}
