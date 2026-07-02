/**
 * What "keep AI away from secrets" means, concretely, for each mechanism.
 * These lists mirror the filename detector's high-signal rules.
 */

/** gitignore-style patterns for AI ignore files (.cursorignore, .geminiignore, …). */
export const SECRET_IGNORE_PATTERNS: readonly string[] = [
  '.env',
  '.env.*',
  '!.env.example',
  '!.env.sample',
  '!.env.template',
  '*.pem',
  '*.key',
  '*.p12',
  '*.pfx',
  '*.ppk',
  '*.jks',
  '*.keystore',
  'id_rsa*',
  'id_dsa*',
  'id_ecdsa*',
  'id_ed25519*',
  '.netrc',
  '.pgpass',
  'secrets.json',
  'secrets.yaml',
  'secrets.yml',
  'secrets.toml',
];

/**
 * Hard deny rules for Claude Code's permission system. These are enforced by
 * the Claude Code harness itself - the model cannot bypass them - and block
 * its built-in Read tool for secret files. (Deny rules have no `!` negation,
 * so `.env.example` is blocked here too; the Guardrails MCP `read_file`
 * still serves it, redacted-or-clean, when the AI needs it.)
 */
export const CLAUDE_DENY_RULES: readonly string[] = [
  'Read(./.env)',
  'Read(./.env.*)',
  'Read(**/.env)',
  'Read(**/.env.*)',
  'Read(**/*.pem)',
  'Read(**/*.key)',
  'Read(**/*.p12)',
  'Read(**/*.pfx)',
  'Read(**/*.ppk)',
  'Read(**/id_rsa*)',
  'Read(**/id_dsa*)',
  'Read(**/id_ecdsa*)',
  'Read(**/id_ed25519*)',
  'Read(**/.netrc)',
  'Read(**/.pgpass)',
  'Read(**/secrets.json)',
  'Read(**/secrets.yaml)',
  'Read(**/secrets.yml)',
  'Read(**/.aws/credentials)',
];

/** The advisory block written into agent rules files (CLAUDE.md, AGENTS.md, …). */
export const ADVISORY_LINES: readonly string[] = [
  '## 🛡️ Guardrails - secret safety rules',
  '',
  '- Never read, print, or copy secret files: `.env` and its variants, private',
  '  keys (`*.pem`, `*.key`, `id_rsa*`), cloud credentials, tokens, or anything',
  '  similar - not with file tools and not with shell commands (`cat`, `type`).',
  '- When you need to know what variables a secret file defines, use the',
  '  `guardrails` MCP tools (`read_file` / `list_files`). They return a safe',
  '  copy with every value replaced by `<REDACTED>`.',
  '- Never paste secret values into chat, commits, logs, or generated code.',
];
