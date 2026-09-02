import { Injectable } from '@nestjs/common';

import { InvariantExtractor } from './invariant.extractor';
import type {
  InvariantToken,
  InvariantValidationInput,
  InvariantValidationResult,
  InvariantViolation,
} from './invariant.types';

@Injectable()
// eslint-disable-next-line @darraghor/nestjs-typed/injectable-should-be-provided -- registered through a factory with the module-owned extractor.
export class InvariantValidator {
  constructor(private readonly extractor = new InvariantExtractor()) {}

  validate(input: InvariantValidationInput): InvariantValidationResult {
    const original = this.extractor.extract(input.original);
    const revised = this.extractor.extract(input.revised);
    const requirements = this.extractor.extract(input.userRequirements ?? '');
    const violations = input.profile === 'polish-strict'
      ? this.validatePolish(original, revised)
      : this.validateRevision(original, revised, requirements);
    const errors = violations.filter((violation) => violation.severity === 'ERROR').length;
    const warnings = violations.length - errors;
    return {
      status: errors > 0 ? 'ERROR' : warnings > 0 ? 'WARN' : 'PASS',
      violations,
      summary: { errors, warnings },
    };
  }

  private validatePolish(original: InvariantToken[], revised: InvariantToken[]): InvariantViolation[] {
    return this.compareCounts(original, revised, (type) => type === 'figure/table' ? 'WARN' : 'ERROR', false);
  }

  private validateRevision(
    original: InvariantToken[],
    revised: InvariantToken[],
    requirements: InvariantToken[],
  ): InvariantViolation[] {
    const violations: InvariantViolation[] = [];
    const allowed = new Set([...original, ...requirements].map(tokenKey));
    const revisedKeys = new Set(revised.map(tokenKey));
    for (const token of revised) {
      const key = tokenKey(token);
      if (allowed.has(key)) continue;
      violations.push({
        type: token.type,
        severity: 'ERROR',
        revisedValue: token.value,
        message: `UNSUPPORTED_NEW_VALUE: ${token.value} is not supported by the source or user requirements`,
      });
    }

    const originalKeys = new Set(original.map(tokenKey));
    for (const key of originalKeys) {
      if (revisedKeys.has(key)) continue;
      const token = parseKey(key);
      violations.push({
        type: token.type,
        severity: 'WARN',
        originalValue: token.value,
        message: `REMOVED_INVARIANT: ${token.value} no longer appears in the revision`,
      });
    }
    return violations;
  }

  private compareCounts(
    original: InvariantToken[],
    revised: InvariantToken[],
    severityFor: (type: InvariantToken['type']) => 'WARN' | 'ERROR',
    includeRemoved: boolean,
  ): InvariantViolation[] {
    const violations: InvariantViolation[] = [];
    const originalCounts = countTokens(original);
    const revisedCounts = countTokens(revised);
    const keys = new Set([...originalCounts.keys(), ...revisedCounts.keys()]);
    for (const key of keys) {
      const originalCount = originalCounts.get(key) ?? 0;
      const revisedCount = revisedCounts.get(key) ?? 0;
      if (originalCount === revisedCount) continue;
      const token = parseKey(key);
      if (revisedCount > originalCount) {
        for (let i = 0; i < revisedCount - originalCount; i += 1) {
          violations.push({
            type: token.type,
            severity: severityFor(token.type),
            revisedValue: token.value,
            message: `ADDED_INVARIANT: ${token.value} was not present in the original`,
          });
        }
      } else if (includeRemoved || originalCount > revisedCount) {
        for (let i = 0; i < originalCount - revisedCount; i += 1) {
          violations.push({
            type: token.type,
            severity: severityFor(token.type),
            originalValue: token.value,
            message: `REMOVED_INVARIANT: ${token.value} is missing from the revision`,
          });
        }
      }
    }
    return violations;
  }
}

function countTokens(tokens: InvariantToken[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const token of tokens) {
    const key = `${token.type}\u0000${token.value}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function tokenKey(token: InvariantToken): string {
  return `${token.type}\u0000${token.value}`;
}

function parseKey(key: string): InvariantToken {
  const separator = key.indexOf('\u0000');
  return { type: key.slice(0, separator) as InvariantToken['type'], value: key.slice(separator + 1) };
}
