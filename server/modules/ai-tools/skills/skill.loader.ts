import * as fs from 'node:fs';
import * as path from 'node:path';
import { Injectable } from '@nestjs/common';

import type { SkillDefinition, SkillReference } from './skill.types';

export class SkillLoaderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SkillLoaderError';
  }
}

type SkillMetadata = Record<string, string | number | boolean>;

@Injectable()
export class SkillLoader {
  private readonly cache = new Map<string, SkillDefinition>();

  constructor(
    private readonly skillsRoot = path.resolve(process.cwd(), 'server/modules/ai-tools/skills'),
  ) {}

  load(reference: SkillReference): SkillDefinition {
    const relativePath = this.resolveRelativePath(reference);
    const cacheKey = `${reference.source}:${relativePath}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const absolutePath = this.resolveInsideRoot(relativePath);
    if (!fs.existsSync(absolutePath)) {
      throw new SkillLoaderError(`Skill not found: ${relativePath}`);
    }

    let raw: string;
    try {
      raw = fs.readFileSync(absolutePath, 'utf8');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new SkillLoaderError(`Unable to read skill ${relativePath}: ${message}`);
    }

    const { metadata, content } = parseSkillDocument(raw);
    const definition: SkillDefinition = {
      id: reference.id,
      source: reference.source,
      relativePath,
      language: typeof metadata.language === 'string' ? metadata.language : 'mixed',
      content,
      metadata,
    };
    this.cache.set(cacheKey, definition);
    return definition;
  }

  private resolveRelativePath(reference: SkillReference): string {
    if (!reference.id || !/^[a-z0-9][a-z0-9-]*$/i.test(reference.id)) {
      throw new SkillLoaderError(`Invalid skill id: ${reference.id}`);
    }
    if (reference.source !== 'project' && reference.source !== 'vendor') {
      throw new SkillLoaderError(`Invalid skill source: ${reference.source}`);
    }

    const candidate = reference.relativePath ?? `${reference.source}/${reference.id}/SKILL.md`;
    if (
      !candidate ||
      path.isAbsolute(candidate) ||
      /^[a-zA-Z]:[\\/]/.test(candidate) ||
      candidate.includes('\\')
    ) {
      throw new SkillLoaderError(`Invalid skill path: ${candidate}`);
    }

    const normalized = path.posix.normalize(candidate);
    const expectedPrefix = `${reference.source}/`;
    if (
      normalized !== candidate ||
      !normalized.startsWith(expectedPrefix) ||
      normalized.includes('/../') ||
      !normalized.endsWith('/SKILL.md')
    ) {
      throw new SkillLoaderError(`Invalid skill path: ${candidate}`);
    }

    const expectedPath = `${reference.source}/${reference.id}/SKILL.md`;
    if (normalized !== expectedPath) {
      throw new SkillLoaderError(`Skill path does not match id: ${candidate}`);
    }
    return normalized;
  }

  private resolveInsideRoot(relativePath: string): string {
    const root = path.resolve(this.skillsRoot);
    const absolutePath = path.resolve(root, ...relativePath.split('/'));
    const relative = path.relative(root, absolutePath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new SkillLoaderError(`Invalid skill path: ${relativePath}`);
    }
    return absolutePath;
  }
}

function parseSkillDocument(raw: string): { metadata: SkillMetadata; content: string } {
  if (!raw.startsWith('---')) return { metadata: {}, content: raw.trim() };

  const lines = raw.split(/\r?\n/);
  if (lines[0].trim() !== '---') return { metadata: {}, content: raw.trim() };
  const closingIndex = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
  if (closingIndex < 0) return { metadata: {}, content: raw.trim() };

  const metadata: SkillMetadata = {};
  for (const line of lines.slice(1, closingIndex)) {
    const match = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    metadata[key] = parseScalar(rawValue.trim());
  }

  return { metadata, content: lines.slice(closingIndex + 1).join('\n').trim() };
}

function parseScalar(value: string): string | number | boolean {
  const unquoted = value.replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, '$1$2');
  if (unquoted === 'true') return true;
  if (unquoted === 'false') return false;
  if (/^-?\d+(?:\.\d+)?$/.test(unquoted)) return Number(unquoted);
  return unquoted;
}
