/**
 * 任务书生成器
 * 输入：{ title, studentName, advisorName, field, researchContent }
 * 输出：{ taskTitle, studentInfo, advisorInfo, researchContent, objectives, schedule, mainReferences, requirements }
 *
 * TODO: 后续接入真实 AI 插件时，用 AI 生成替换下方模板逻辑
 */

interface TaskAssignmentInput {
  title?: string;
  studentName?: string;
  advisorName?: string;
  field?: string;
  researchContent?: string;
}

export interface TaskAssignmentOutput {
  taskTitle: string;
  studentInfo: string;
  advisorInfo: string;
  researchContent: string;
  objectives: string[];
  schedule: { phase: string; deadline: string; deliverable: string }[];
  mainReferences: string[];
  requirements: string[];
}

export async function generate(input: TaskAssignmentInput): Promise<TaskAssignmentOutput> {
  const {
    title = '基于深度学习的图像分类系统设计与实现',
    studentName = '学生姓名',
    advisorName = '指导教师',
    field = '计算机科学与技术',
    researchContent = '深度学习与图像识别',
  } = input;

  const taskTitle = title;

  const studentInfo = `学生姓名：${studentName}\n` +
    `专业：${field}\n` +
    `学号：xxxxxxxx\n` +
    `班级：xxxx级xx班`;

  const advisorInfo = `指导教师：${advisorName}\n` +
    `职称：教授/副教授\n` +
    `研究方向：${researchContent}\n` +
    `所在单位：xxxxxxxx学院`;

  const researchContentContent = `本课题围绕"${title}"开展研究，主要内容包括：\n\n` +
    `1. 深入学习${researchContent}相关理论和技术，了解国内外研究现状；\n` +
    `2. 分析现有方法的优缺点，确定研究问题和技术路线；\n` +
    `3. 设计并实现针对具体问题的解决方案和系统原型；\n` +
    `4. 通过实验验证方案的有效性，并进行分析和优化；\n` +
    `5. 按照规范撰写毕业论文。`;

  const objectives = [
    '掌握课题相关的基础理论和专业知识，培养独立科研能力',
    `完成${title}的设计与实现，达到预定功能和性能目标`,
    '学会科学的研究方法，包括文献调研、方案设计、实验验证等',
    '培养学术写作能力，完成符合规范的毕业论文',
    '锻炼分析问题和解决问题的能力，为后续学习和工作奠定基础',
  ];

  const schedule = [
    { phase: '第一阶段：选题与文献调研', deadline: '第1-3周', deliverable: '选题确认、文献综述初稿' },
    { phase: '第二阶段：开题报告', deadline: '第4-6周', deliverable: '开题报告、研究方案' },
    { phase: '第三阶段：方案设计与实现', deadline: '第7-12周', deliverable: '系统设计文档、原型系统' },
    { phase: '第四阶段：实验与分析', deadline: '第13-14周', deliverable: '实验报告、数据分析结果' },
    { phase: '第五阶段：论文撰写与修改', deadline: '第15-17周', deliverable: '论文初稿、修改稿、定稿' },
    { phase: '第六阶段：答辩', deadline: '第18周', deliverable: '答辩PPT、最终论文' },
  ];

  const mainReferences = [
    `张三, 李四. ${researchContent}研究进展[J]. 计算机学报, 2023, 46(5): 1001-1020.`,
    `王五, 赵六. 深度学习入门与实践[M]. 北京: 清华大学出版社, 2022.`,
    `Smith J, Johnson A. Deep Learning for Computer Vision[M]. Cambridge: MIT Press, 2021.`,
    `陈刚. ${field}专业毕业设计指导[M]. 北京: 高等教育出版社, 2023.`,
    `钱七, 孙八. 图像分类方法研究综述[J]. 软件学报, 2022, 33(8): 2900-2925.`,
  ];

  const requirements = [
    '严格按照学校毕业设计规范完成各阶段任务，按时提交各项材料',
    '独立完成课题研究，严禁抄袭和学术不端行为',
    '每周至少与指导教师沟通一次，汇报进展并接受指导',
    '论文字数、格式、引用等需符合学校相关规定',
    '英文摘要翻译准确，专业术语使用规范',
    '答辩前需通过查重检测，重复率需在规定范围内',
  ];

  return {
    taskTitle,
    studentInfo,
    advisorInfo,
    researchContent: researchContentContent,
    objectives,
    schedule,
    mainReferences,
    requirements,
  };
}
