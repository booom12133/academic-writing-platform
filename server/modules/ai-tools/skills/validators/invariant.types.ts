export type InvariantType =
  | 'number'
  | 'percentage'
  | 'p-value'
  | 'citation'
  | 'doi'
  | 'unit'
  | 'formula'
  | 'technical-identifier'
  | 'figure/table';

export interface InvariantToken {
  type: InvariantType;
  value: string;
}

export type InvariantSeverity = 'WARN' | 'ERROR';

export interface InvariantViolation {
  type: InvariantType;
  severity: InvariantSeverity;
  originalValue?: string;
  revisedValue?: string;
  message: string;
}

export interface InvariantValidationResult {
  status: 'PASS' | 'WARN' | 'ERROR';
  violations: InvariantViolation[];
  summary: { errors: number; warnings: number };
}

export interface InvariantValidationInput {
  profile: 'polish-strict' | 'revision-conservative';
  original: string;
  revised: string;
  userRequirements?: string;
}
