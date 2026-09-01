/**
 * AI批注修改生成器
 * 输入：{ originalText, comments, field, revisionGoal }
 * 输出：{ revisedText, commentChanges, modificationSummary }
 *
 * TODO: 后续接入真实 AI 插件时，用 AI 生成替换下方模板逻辑
 */

interface CommentRevisionInput {
  originalText?: string;
  comments?: string[];
  field?: string;
  revisionGoal?: string;
}

export interface CommentRevisionOutput {
  revisedText: string;
  commentChanges: {
    comment: string;
    original: string;
    revised: string;
    explanation: string;
  }[];
  modificationSummary: string;
}

export async function generate(input: CommentRevisionInput): Promise<CommentRevisionOutput> {
  const {
    originalText = '人工智能在教育中的应用很广泛，很多老师都觉得这个技术好，学生也喜欢。但是也有一些问题需要解决，比如数据隐私和教师角色的变化。',
    comments = [
      '这里表述太口语化，请改为学术表达',
      '需要补充具体的数据或研究支撑',
      '这段逻辑不够清晰，建议分层论述',
    ],
    field = '教育技术学',
    revisionGoal = '提升学术规范性',
  } = input;

  const revisedText = `人工智能技术在教育领域的应用呈现规模化扩展趋势。已有研究表明，智能教育工具在提升教学效率、优化学习体验方面具有积极作用，得到了一线教育工作者和学习者的广泛认可。` +
    `\n\n然而，人工智能教育应用在快速发展的同时也面临若干挑战：其一，学生学习数据的采集、存储和使用涉及个人隐私保护问题，数据安全与伦理风险不容忽视；其二，智能技术的引入推动了教师角色从知识传授者向学习引导者的转型，这一转变对教师专业能力提出了新的要求。总体来看，人工智能与教育的深度融合是机遇与挑战并存的过程。`;

  const commentChanges = comments.map((comment: string, idx: number) => {
    const explanations = [
      '将原句中的口语化表述替换为规范的学术表达，使用"呈现规模化扩展趋势""积极作用"等更为正式的学术用语，提升文本学术感。',
      '补充了"已有研究表明"的学术表述框架，为观点提供了理论和文献支撑的暗示，增强了论证的可信度。',
      '将原先混合在一起的问题点拆分为"数据隐私"和"教师角色转型"两个层次，使用"其一""其二"进行逻辑分层，使论述结构更加清晰。',
    ];

    const originalSnippets = [
      '人工智能在教育中的应用很广泛，很多老师都觉得这个技术好',
      '很多老师都觉得这个技术好，学生也喜欢',
      '但是也有一些问题需要解决，比如数据隐私和教师角色的变化',
    ];

    const revisedSnippets = [
      '人工智能技术在教育领域的应用呈现规模化扩展趋势。已有研究表明，智能教育工具在提升教学效率、优化学习体验方面具有积极作用',
      '得到了一线教育工作者和学习者的广泛认可',
      '然而，人工智能教育应用在快速发展的同时也面临若干挑战：其一，学生学习数据的采集、存储和使用涉及个人隐私保护问题；其二，智能技术的引入推动了教师角色从知识传授者向学习引导者的转型',
    ];

    return {
      comment,
      original: originalSnippets[idx] ?? originalText.slice(0, 30),
      revised: revisedSnippets[idx] ?? revisedText.slice(0, 40),
      explanation: explanations[idx] ?? '根据批注意见进行了相应修改，提升文本质量。',
    };
  });

  const modificationSummary = `本次${revisionGoal}工作共处理批注 ${comments.length} 条，` +
    `修改类型涵盖学术化表达、论证增强和逻辑优化等方面。\n\n` +
    `**主要修改概览**：\n` +
    commentChanges.map((c: { comment: string }, i: number) =>
      `${i + 1}. 针对批注"${c.comment}"进行了对应修改`
    ).join('\n') +
    `\n\n**整体提升效果**：\n` +
    `- 语言表达更加规范、正式，符合${field}学术写作要求\n` +
    `- 论证更加充分，观点更具说服力\n` +
    `- 论述逻辑更加清晰，层次分明\n\n` +
    `建议作者进一步审阅修改后的内容，确保修改方向与研究本意一致，` +
    `并根据实际需要继续调整和完善。`;

  return {
    revisedText,
    commentChanges,
    modificationSummary,
  };
}
