export type SkillSource = 'vendor' | 'project';

export interface SkillReference {
  source: SkillSource;
  id: string;
  relativePath?: string;
}

export interface SkillDefinition {
  id: string;
  source: SkillSource;
  relativePath: string;
  language: string;
  content: string;
  metadata: Record<string, string | number | boolean>;
}

export interface SkillStackDefinition {
  id: string;
  task: 'polish' | 'revision';
  language: 'zh' | 'en';
  skills: SkillReference[];
  validatorProfile: 'polish-strict' | 'revision-conservative';
}

export interface ComposedSkillPrompt {
  system: string;
  user: string;
  skillIds: string[];
}
