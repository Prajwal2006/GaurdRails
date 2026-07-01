/**
 * @guardrails/core - the orchestration layer. Composes detection, policy, and
 * redaction into a single `Guardrails` facade, hosts the educational content
 * catalog, and provides filesystem scanning.
 */

export { Guardrails } from './inspection.js';
export type {
  GuardrailsOptions,
  InspectionInput,
  InspectionResult,
  DecidedFinding,
  RedactionOutcome,
  Outcome,
} from './inspection.js';

export { defaultCatalog, explainFinding, resolveExplanation } from './education.js';

export { scanPath } from './fs-scan.js';
export type { ScanOptions, FileScan, ProjectScanResult } from './fs-scan.js';

// Re-export the pieces most consumers need, so the CLI can depend on core alone.
export { DetectorRegistry, summarizeFindings, type ScanSummary } from '@guardrails/secret-detector';
export {
  PolicyEngine,
  createDefaultPolicy,
  parsePolicy,
  parsePolicyJson,
} from '@guardrails/policy-engine';
export { redactContent, redactValue } from '@guardrails/redaction';
