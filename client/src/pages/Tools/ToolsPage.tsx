import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { TaskType } from '@shared/api.interface';
import { productCapabilityFor } from '@shared/product-capability.catalog';
import ToolSidebar from './ToolSidebar';
import ToolHelper from './ToolHelper';
import CapabilityGate from './CapabilityGate';
import OutlineTool from './tools/OutlineTool';
import LiteratureTool from './tools/LiteratureTool';
import PolishTool from './tools/PolishTool';
import FormatTool from './tools/FormatTool';
import CheckTool from './tools/CheckTool';
import ChartTool from './tools/ChartTool';
import ThesisTool from './tools/ThesisTool';
import GraduationDesignTool from './tools/GraduationDesignTool';
import TopicGenerationTool from './tools/TopicGenerationTool';
import LiteratureReviewTool from './tools/LiteratureReviewTool';
import ProposalTool from './tools/ProposalTool';
import TaskAssignmentTool from './tools/TaskAssignmentTool';
import CoursePaperTool from './tools/CoursePaperTool';
import JournalPaperTool from './tools/JournalPaperTool';
import PracticeReportTool from './tools/PracticeReportTool';
import ProjectApplicationTool from './tools/ProjectApplicationTool';
import PaperRevisionTool from './tools/PaperRevisionTool';
import CommentRevisionTool from './tools/CommentRevisionTool';
import DataAnalysisTool from './tools/DataAnalysisTool';
import QuestionnaireDesignTool from './tools/QuestionnaireDesignTool';
import PaperReverseTool from './tools/PaperReverseTool';
import AiReduceTool from './tools/AiReduceTool';
import AiPptTool from './tools/AiPptTool';

const TOOL_COMPONENTS: Record<TaskType, React.FC> = {
  thesis: ThesisTool,
  'graduation-design': GraduationDesignTool,
  outline: OutlineTool,
  'topic-generation': TopicGenerationTool,
  literature: LiteratureTool,
  'literature-review': LiteratureReviewTool,
  proposal: ProposalTool,
  'task-assignment': TaskAssignmentTool,
  'course-paper': CoursePaperTool,
  'journal-paper': JournalPaperTool,
  'practice-report': PracticeReportTool,
  'project-application': ProjectApplicationTool,
  'paper-revision': PaperRevisionTool,
  'comment-revision': CommentRevisionTool,
  polish: PolishTool,
  format: FormatTool,
  check: CheckTool,
  chart: ChartTool,
  'data-analysis': DataAnalysisTool,
  'questionnaire-design': QuestionnaireDesignTool,
  'paper-reverse': PaperReverseTool,
  'ai-reduce': AiReduceTool,
  'ai-ppt': AiPptTool,
};

const ToolsPage: React.FC = () => {
  const { toolType } = useParams<{ toolType: string }>();
  const navigate = useNavigate();

  const requestedType = toolType as TaskType | undefined;
  const fallbackType: TaskType = 'topic-generation';
  const requestedCapability = requestedType
    ? productCapabilityFor(requestedType)
    : productCapabilityFor(fallbackType);
  const activeType: TaskType = requestedCapability?.type ?? fallbackType;

  const currentConfig = productCapabilityFor(activeType);
  const ToolComponent = TOOL_COMPONENTS[activeType];

  const handleToolChange = (type: TaskType) => {
    navigate(`/tools/${type}`);
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50">
      <aside
        className="flex-shrink-0 border-r border-slate-200 bg-white"
        style={{ width: 240 }}
      >
        <ToolSidebar activeType={activeType} onSelect={handleToolChange} />
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[900px] px-6 py-6">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold leading-tight text-slate-800">
              {currentConfig?.name}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              {currentConfig?.description}
            </p>
          </div>
          <CapabilityGate type={activeType}>
            <ToolComponent />
          </CapabilityGate>
        </div>
      </main>

      <aside
        className="flex-shrink-0 border-l border-slate-200 bg-white"
        style={{ width: 280 }}
      >
        <ToolHelper toolType={activeType} />
      </aside>
    </div>
  );
};

export default ToolsPage;
