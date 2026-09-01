/**
 * 实践报告生成器
 * 输入：{ title, field, practiceType, company, duration }
 * 输出：{ introduction, practiceContent, practiceProcess, results, experience, attachments }
 *
 * TODO: 后续接入真实 AI 插件时，用 AI 生成替换下方模板逻辑
 */

interface PracticeReportInput {
  title?: string;
  field?: string;
  practiceType?: string;
  company?: string;
  duration?: string;
}

export interface PracticeReportOutput {
  introduction: string;
  practiceContent: string;
  practiceProcess: string[];
  results: string;
  experience: string;
  attachments: { name: string; description: string }[];
}

const PROCESS_TEMPLATES = [
  '第一阶段：岗前培训与环境熟悉（第1周）',
  '第二阶段：跟班学习与基础操作（第2-3周）',
  '第三阶段：独立承担工作任务（第4-8周）',
  '第四阶段：项目参与与能力提升（第9-12周）',
  '第五阶段：总结梳理与成果汇报（最后1周）',
];

const ATTACHMENTS_TEMPLATES = [
  { name: '实习单位鉴定表', description: '由实习单位填写并盖章的实习鉴定表扫描件' },
  { name: '工作日志', description: '实习期间每日工作记录与总结' },
  { name: '工作成果证明', description: '参与项目或工作任务的成果材料' },
  { name: '实习周志', description: '每周实习记录与心得体会' },
];

export async function generate(input: PracticeReportInput): Promise<PracticeReportOutput> {
  const {
    title = '软件开发实习报告',
    field = '计算机科学与技术',
    practiceType = '毕业实习',
    company = '某科技有限公司',
    duration = '12周',
  } = input;

  const introduction = `## 一、实习概况\n\n` +
    `**实习类型**：${practiceType}\n\n` +
    `**实习单位**：${company}\n\n` +
    `**实习时间**：${duration}\n\n` +
    `**实习岗位**：${title.replace('报告', '')}\n\n` +
    `**实习目的**：通过在${company}的${practiceType}，将${field}专业所学的理论知识与实际工作相结合，` +
    `了解行业现状和企业运作模式，提升实践操作能力和职业素养，为毕业后的正式工作奠定基础。`;

  const practiceContent = `## 二、实习内容\n\n` +
    `本次${practiceType}的主要内容围绕${title.replace('报告', '')}展开，具体包括以下几个方面：\n\n` +
    `1. **岗位技能学习**：系统学习${field}领域相关的工作技能和工具使用，` +
    `包括专业软件操作、工作流程规范、质量标准要求等。\n\n` +
    `2. **项目参与**：参与${company}的实际项目，在导师指导下完成分配的工作任务，` +
    `体验真实工作环境下的项目开发/管理/实施过程。\n\n` +
    `3. **团队协作**：融入项目团队，学习与同事沟通协作的方式方法，` +
    `培养团队合作精神和职业沟通能力。\n\n` +
    `4. **问题解决**：在实践中发现问题、分析问题并尝试解决问题，` +
    `锻炼独立思考和解决实际问题的能力。\n\n` +
    `5. **职业素养培养**：了解企业文化和职业规范，培养良好的工作习惯和职业态度。`;

  const practiceProcess = PROCESS_TEMPLATES.map((phase) => {
    return `${phase}：在该阶段，主要完成了岗位适应、技能学习、任务承担等工作，` +
      `逐步从新手成长为能够独立完成基本任务的实习生。`;
  });

  const results = `## 四、实习成果\n\n` +
    `通过${duration}的${practiceType}，取得了以下成果：\n\n` +
    `- **技能提升**：熟练掌握了${field}领域相关的专业工具和工作方法，` +
    `实操能力较实习初期有显著提升。\n\n` +
    `- **项目贡献**：参与了公司的实际项目，完成了分配的工作任务，` +
      `得到了部门领导和同事的认可。\n\n` +
    `- **知识积累**：积累了大量${title.replace('报告', '')}的实践经验，` +
      `对行业发展和职业要求有了更深入的认识。\n\n` +
    `- **能力成长**：沟通协作能力、问题解决能力、学习能力等综合素质得到了锻炼和提升。\n\n` +
    `- **职业认知**：明确了职业发展方向，对未来的职业规划有了更清晰的认识。`;

  const experience = `## 五、实习体会\n\n` +
    `这次${practiceType}是我从校园走向社会的重要一步，收获颇丰，感触良多。\n\n` +
    `首先，理论与实践之间存在差距。在学校学习的${field}专业知识是基础，` +
    `但在实际工作中需要结合具体场景灵活运用。只有将理论知识转化为实践能力，` +
    `才能真正发挥专业价值。\n\n` +
    `其次，团队协作至关重要。现代企业的工作大多需要团队协作完成，` +
    `良好的沟通能力和团队意识是职业发展的必备素质。在${company}实习期间，` +
    `我深刻体会到了团队协作的效率和力量。\n\n` +
    `再次，持续学习是职业发展的核心动力。${field}领域技术更新快，` +
    `只有保持学习的热情和能力，才能跟上行业发展的步伐。\n\n` +
    `最后，感谢${company}提供的实习机会，感谢各位领导和同事的悉心指导和帮助。` +
    `这次实习经历将成为我职业生涯的宝贵财富。`;

  const attachments = ATTACHMENTS_TEMPLATES.map((att) => ({
    name: att.name,
    description: att.description,
  }));

  return {
    introduction,
    practiceContent,
    practiceProcess,
    results,
    experience,
    attachments,
  };
}
