import { Injectable } from '@nestjs/common';

import type { SkillStackDefinition } from './skill.types';

export class SkillRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SkillRegistryError';
  }
}

const STACKS: Record<string, SkillStackDefinition> = {
  'academic-polish-en': {
    id: 'academic-polish-en',
    task: 'polish',
    language: 'en',
    skills: [
      { source: 'project', id: 'academic-polish' },
      { source: 'vendor', id: 'codex-academic-humanizer' },
    ],
    validatorProfile: 'polish-strict',
  },
  'academic-polish-zh': {
    id: 'academic-polish-zh',
    task: 'polish',
    language: 'zh',
    skills: [
      { source: 'project', id: 'academic-polish' },
      { source: 'project', id: 'chinese-academic-writing' },
      { source: 'vendor', id: 'codex-academic-humanizer' },
    ],
    validatorProfile: 'polish-strict',
  },
  'academic-revision-en': {
    id: 'academic-revision-en',
    task: 'revision',
    language: 'en',
    skills: [{ source: 'project', id: 'academic-revision' }],
    validatorProfile: 'revision-conservative',
  },
  'academic-revision-zh': {
    id: 'academic-revision-zh',
    task: 'revision',
    language: 'zh',
    skills: [
      { source: 'project', id: 'academic-revision' },
      { source: 'project', id: 'chinese-academic-writing' },
    ],
    validatorProfile: 'revision-conservative',
  },
};

@Injectable()
export class SkillRegistry {
  getStack(id: string): SkillStackDefinition {
    const stack = STACKS[id];
    if (!stack) throw new SkillRegistryError(`Unsupported skill stack: ${id}`);
    return {
      ...stack,
      skills: stack.skills.map((skill) => ({ ...skill })),
    };
  }

  getStackFor(task: SkillStackDefinition['task'], language: 'zh' | 'en'): SkillStackDefinition {
    return this.getStack(`academic-${task}-${language}`);
  }
}
