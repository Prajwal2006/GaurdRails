/**
 * @guardrails/redaction - structure-preserving redaction of detected secrets.
 * Depends only on @guardrails/shared. Guarantees the redacted output never
 * contains the original value of any redacted span.
 */

export { redactContent, redactEnvContent, redactValue, Redactor } from './redactor.js';
export type { RedactionOptions, RedactionResult } from './redactor.js';
