/**
 * 图表可视化生成器
 * 输入：{ chartType, description, data }
 * 输出：{ chartCode, chartType, title, previewUrl? }
 *
 * 生成 mermaid 语法的图表代码，前端使用 mermaid.js 渲染。
 *
 * TODO: 后续接入真实 AI 生图/图表生成插件时增强
 */

type ChartType =
  | 'roadmap'
  | 'flowchart'
  | 'org'
  | 'bar'
  | 'line'
  | 'pie'
  | 'sequence'
  | 'er';

interface ChartGeneratorOutput {
  chartCode: string;
  chartType: string;
  title: string;
  previewUrl?: string;
}

const CHART_TYPE_NAMES: Record<ChartType, string> = {
  roadmap: '路线图',
  flowchart: '流程图',
  org: '组织结构图',
  bar: '柱状图',
  line: '折线图',
  pie: '饼图',
  sequence: '时序图',
  er: '实体关系图',
};

export async function generate(input: Record<string, any>): Promise<ChartGeneratorOutput> {
  const chartType = (input.chartType as ChartType) ?? 'flowchart';
  const description = (input.description as string) ?? '';
  const data = (input.data as Record<string, any> | undefined);

  const title = description ? `${description} - ${CHART_TYPE_NAMES[chartType]}` : CHART_TYPE_NAMES[chartType];

  let chartCode = '';

  switch (chartType) {
    case 'roadmap':
      chartCode = generateRoadmap(description, data);
      break;
    case 'flowchart':
      chartCode = generateFlowchart(description, data);
      break;
    case 'org':
      chartCode = generateOrgChart(description, data);
      break;
    case 'bar':
      chartCode = generateBarChart(description, data);
      break;
    case 'line':
      chartCode = generateLineChart(description, data);
      break;
    case 'pie':
      chartCode = generatePieChart(description, data);
      break;
    case 'sequence':
      chartCode = generateSequenceDiagram(description, data);
      break;
    case 'er':
      chartCode = generateErDiagram(description, data);
      break;
    default:
      chartCode = generateFlowchart(description, data);
  }

  return {
    chartCode,
    chartType,
    title,
  };
}

/* ---------- 各类型图表生成函数 ---------- */

function generateRoadmap(description: string, data?: Record<string, any>): string {
  const phases = (data?.phases as string[] | undefined) ?? [
    '第一阶段：选题与文献综述',
    '第二阶段：研究设计与方法',
    '第三阶段：数据收集与分析',
    '第四阶段：论文撰写与修改',
    '第五阶段：答辩与定稿',
  ];

  const ganttEntries = phases
    .map((phase: string, idx: number) => {
      const monthStart = idx * 2 + 1;
      const monthEnd = (idx + 1) * 2;
      const id = `phase${idx + 1}`;
      return `    ${id} : ${phase}, ${monthStart}d`;
    })
    .join('\n');

  return (
    `gantt
    title ${description || '研究技术路线图'}
    dateFormat  YYYY-MM-DD
    axisFormat  %m月
    section 研究阶段
${ganttEntries}
    section 关键节点
    开题答辩 : milestone, after phase2, 1d
    中期检查 : milestone, after phase3, 1d
    论文答辩 : milestone, after phase5, 1d`
  );
}

function generateFlowchart(description: string, data?: Record<string, any>): string {
  const steps = (data?.steps as string[] | undefined) ?? [
    '提出研究问题',
    '文献综述',
    '构建理论模型',
    '设计研究方案',
    '数据收集',
    '数据分析与验证',
    '得出研究结论',
  ];

  const nodes = steps.map((s: string, idx: number) => `    A${idx}[${s}]`).join('\n');
  const edges = steps
    .slice(0, -1)
    .map((_: string, idx: number) => `    A${idx} --> A${idx + 1}`)
    .join('\n');

  return (
    `flowchart TD
    %% ${description || '研究流程图'}
${nodes}
${edges}
    style A0 fill:#dbeafe,stroke:#2563eb
    style A${steps.length - 1} fill:#d1fae5,stroke:#10b981`
  );
}

function generateOrgChart(_description: string, data?: Record<string, any>): string {
  const root = (data?.root as string) ?? '研究团队';
  const divisions = (data?.divisions as string[] | undefined) ?? [
    '理论研究组',
    '实证分析组',
    '数据处理组',
    '论文撰写组',
  ];

  const divisionNodes = divisions
    .map((d: string, idx: number) => `    B${idx}[${d}]`)
    .join('\n');
  const divisionEdges = divisions
    .map((_: string, idx: number) => `    A --> B${idx}`)
    .join('\n');

  return (
    `flowchart TD
    A[${root}]
${divisionNodes}
${divisionEdges}
    style A fill:#2563eb,color:#fff,stroke:#1d4ed8`
  );
}

function generateBarChart(description: string, data?: Record<string, any>): string {
  const categories = (data?.categories as string[] | undefined) ?? [
    '维度一', '维度二', '维度三', '维度四', '维度五',
  ];
  const values = (data?.values as number[] | undefined) ?? [65, 82, 48, 73, 91];

  const barEntries = categories
    .map((cat: string, idx: number) => `    "${cat}" : ${values[idx] ?? 0}`)
    .join('\n');

  return (
    `xychart-beta
    title "${description || '柱状图'}"
    x-axis [${categories.map((c: string) => `"${c}"`).join(', ')}]
    y-axis "数值" 0 --> 100
    bar [${values.join(', ')}]
%% 数据明细
${barEntries}`
  );
}

function generateLineChart(description: string, data?: Record<string, any>): string {
  const labels = (data?.labels as string[] | undefined) ?? [
    '2019', '2020', '2021', '2022', '2023', '2024',
  ];
  const values = (data?.values as number[] | undefined) ?? [12, 25, 38, 52, 68, 85];

  return (
    `xychart-beta
    title "${description || '趋势折线图'}"
    x-axis [${labels.map((l: string) => `"${l}"`).join(', ')}]
    y-axis "数值" 0 --> 100
    line [${values.join(', ')}]
    marker`
  );
}

function generatePieChart(description: string, data?: Record<string, any>): string {
  const items = (data?.items as Array<{ name: string; value: number }> | undefined) ?? [
    { name: '文献研究', value: 30 },
    { name: '实证分析', value: 35 },
    { name: '数据处理', value: 15 },
    { name: '论文撰写', value: 20 },
  ];

  const pieEntries = items
    .map((item) => `    "${item.name}" : ${item.value}`)
    .join('\n');

  return (
    `pie showData
    title ${description || '研究内容占比'}
${pieEntries}`
  );
}

function generateSequenceDiagram(description: string, _data?: Record<string, any>): string {
  return (
    `sequenceDiagram
    participant 用户 as 研究人员
    participant 系统 as AI写作系统
    participant 数据库 as 文献数据库
    participant AI as AI模型

    Note over 用户,AI: ${description || '研究流程时序'}

    用户->>系统: 提交研究主题
    系统->>数据库: 检索相关文献
    数据库-->>系统: 返回文献列表
    系统->>AI: 请求大纲生成
    AI-->>系统: 返回论文大纲
    系统-->>用户: 展示推荐结果
    用户->>系统: 确认并开始写作`
  );
}

function generateErDiagram(description: string, _data?: Record<string, any>): string {
  return (
    `erDiagram
    %% ${description || '实体关系图'}

    PAPER {
        uuid id PK
        string title
        string field
        text abstract
        timestamptz created_at
    }

    CHAPTER {
        uuid id PK
        uuid paper_id FK
        string title
        int level
        text content
    }

    REFERENCE {
        uuid id PK
        uuid paper_id FK
        string title
        string authors
        int year
        string journal
    }

    TASK {
        uuid id PK
        string user_id FK
        string task_type
        string status
        int progress
    }

    PAPER ||--o{ CHAPTER : 包含
    PAPER ||--o{ REFERENCE : 引用
    TASK }o--|| PAPER : 生成`
  );
}
