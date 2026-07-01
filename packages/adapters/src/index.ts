/**
 * @guardrails/adapters — thin translators between specific AI coding tools and
 * Guardrails' neutral request/response shape. Adapters contain no security
 * logic; they only translate formats.
 */

export { normalizeFileRequest } from './normalize.js';
export {
  BUILT_IN_ADAPTERS,
  claudeCodeAdapter,
  codexAdapter,
  copilotAdapter,
  geminiCliAdapter,
  cursorAdapter,
  windsurfAdapter,
} from './adapters.js';
export { AdapterRegistry } from './registry.js';
