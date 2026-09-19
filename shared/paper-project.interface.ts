export type PaperType =
  | 'empirical-quantitative'
  | 'empirical-qualitative'
  | 'mixed-methods'
  | 'computer-science-engineering'
  | 'literature-review'
  | 'conceptual-theoretical'
  | 'other';

export type SourceStrategy = 'MODEL_ONLY' | 'WEB_RETRIEVED' | 'USER_KNOWLEDGE' | 'MIXED';
export type ActualSupportMode = 'AI_DRAFT' | 'WEB_EVIDENCE' | 'USER_EVIDENCE' | 'MIXED_EVIDENCE';
export type SupportState = 'NOT_CLAIMED' | 'VALID' | 'STALE_AFTER_EDIT';
export type EvidenceAvailability =
  | 'NOT_REQUIRED' | 'READY' | 'PARTIALLY_READY' | 'METADATA_ONLY'
  | 'NOT_INDEXED' | 'INDEXING' | 'INDEX_FAILED' | 'NO_EVIDENCE';
export type RevisionOrigin = 'AI_GENERATION' | 'AI_REWRITE' | 'USER_EDIT';

export interface ProjectProfileV1 {
  schemaVersion: 1;
  researchIdea: string;
  discipline?: string;
  educationLevel?: string;
  paperType: PaperType;
  language: 'zh-CN' | 'en';
  targetWords?: number;
  requirements?: string;
}

export interface ResearchPlanV1 {
  schemaVersion: 1;
  researchProblem: string;
  researchQuestions: string[];
  hypotheses?: Array<{ id: string; statement: string; rationale?: string }>;
  propositions?: Array<{ id: string; statement: string; rationale?: string }>;
  researchObjectives: string[];
  methodology: {
    approach: string;
    design?: string;
    methods: string[];
    dataOrMaterials?: string[];
    samplingOrSelection?: string;
    analysisPlan?: string[];
    validationPlan?: string[];
  };
  dataMaterialRequirements: string[];
  expectedContributions: string[];
  limitationsAssumptions: string[];
  keywords: string[];
}

export interface PaperProject {
  id: string;
  selectedTitle?: string;
  profile: ProjectProfileV1;
  researchPlan?: ResearchPlanV1;
  defaultSourceStrategy: SourceStrategy;
  status: 'active' | 'archived';
  lockVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface OutlineNode {
  id: string;
  parentId?: string;
  nodeType: 'container' | 'writing-unit';
  title: string;
  position: number;
  targetWords?: number;
  generationNotes?: string;
  status: 'active' | 'archived';
  sectionId?: string;
}

export interface PaperSectionRevision {
  id: string;
  sectionId: string;
  revisionNumber: number;
  baseRevisionId?: string;
  content: string;
  origin: RevisionOrigin;
  sourceStrategy: SourceStrategy;
  actualSupportMode: ActualSupportMode;
  supportState: SupportState;
  citations: unknown[];
  bibliography: unknown[];
  evidenceTrace: unknown[];
  generationMetadata: Record<string, unknown>;
  warnings: string[];
  rewriteInstruction?: string;
  createdAt: string;
}

export interface PaperSection {
  id: string;
  outlineNodeId?: string;
  status: 'active' | 'orphaned' | 'archived';
  currentRevisionNumber: number;
  currentRevision?: PaperSectionRevision;
}

export interface PaperProjectSource {
  id: string;
  sourceRecordId?: string;
  documentVersionId?: string;
  originClass: 'WEB_IMPORTED' | 'USER_KNOWLEDGE';
  selectionStatus: 'selected' | 'unbound';
  evidenceAvailability: EvidenceAvailability;
}

export interface PaperWorkspace {
  project: PaperProject;
  outline: OutlineNode[];
  sections: PaperSection[];
  sources: PaperProjectSource[];
}

export type PaperGenerationResponse =
  | { revisionCreated: true; evidenceAvailability: EvidenceAvailability; revision: PaperSectionRevision }
  | { revisionCreated: false; evidenceAvailability: EvidenceAvailability; code: string; safeNextAction: string; affectedSourceIds?: string[] };
