/**
 * @guardrails/secret-detector — a pluggable, multi-layer secret detection
 * engine. Pure and dependency-free (besides @guardrails/shared): content goes
 * in, findings come out, with no filesystem or network access.
 */

export {
  DetectorRegistry,
  defaultDetectors,
  finalizeFindings,
  summarizeFindings,
} from './registry.js';
export type { RegistryOptions, ScanSummary } from './registry.js';

export { shannonEntropy, characterClasses, tokenize } from './entropy.js';
export type { Token } from './entropy.js';

export { makeRegexDetector, makeRegexDetectors } from './detectors/factory.js';
export type { RegexRule } from './detectors/factory.js';

export { filenameDetector, isExampleFile } from './detectors/filename.js';
export { providerDetectors, providerRules } from './detectors/providers.js';
export {
  privateKeyDetector,
  jwtDetector,
  connectionStringDetector,
  basicAuthDetector,
  structuralDetectors,
  isJwt,
} from './detectors/structural.js';
export { keywordAssignmentDetector } from './detectors/keyword-assignment.js';
export { entropyDetector } from './detectors/entropy-detector.js';
export type { EntropyDetectorOptions } from './detectors/entropy-detector.js';
