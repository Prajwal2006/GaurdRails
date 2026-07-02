/**
 * @guardrails/policy-engine - deterministic allow/deny/redact/audit decisions.
 * Pure; depends only on @guardrails/shared. Given a context (path, tool, user,
 * finding) it resolves the winning rule - honouring scope, categories, severity,
 * priority, and `extends` inheritance - and falls back to fail-safe defaults.
 */

export {
  PolicyEngine,
  evaluateRules,
  ruleMatches,
  failSafeAction,
  type EvaluationContext,
} from './engine.js';
export { createDefaultPolicy } from './default-policy.js';
export { parsePolicy, parsePolicyJson } from './loader.js';
export { globToRegExp, matchGlob, hasExtension } from './glob.js';
