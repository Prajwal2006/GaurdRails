/**
 * A small, dependency-free glob matcher. Supports `*` (within a path segment),
 * `**` (across segments), and `?`. Kept intentionally tiny and auditable rather
 * than pulling in a third-party matcher - this is security-relevant code.
 */

const REGEX_SPECIAL = new Set(['.', '+', '^', '$', '{', '}', '(', ')', '|', '[', ']', '\\']);

/** Convert a glob to an anchored `RegExp`. */
export function globToRegExp(glob: string): RegExp {
  let re = '';
  for (let i = 0; i < glob.length; i += 1) {
    const char = glob[i];
    if (char === undefined) break;
    if (char === '*') {
      if (glob[i + 1] === '*') {
        i += 1;
        if (glob[i + 1] === '/') {
          i += 1;
          re += '(?:[^/]*/)*'; // `**/` → zero or more path segments
        } else {
          re += '.*'; // `**` → anything, including separators
        }
      } else {
        re += '[^/]*'; // `*` → anything within a segment
      }
    } else if (char === '?') {
      re += '[^/]';
    } else if (REGEX_SPECIAL.has(char)) {
      re += `\\${char}`;
    } else {
      re += char;
    }
  }
  return new RegExp(`^${re}$`);
}

/**
 * Match a glob against a path. Paths are normalised to forward slashes. As a
 * convenience (matching common ignore-file semantics), a glob with no `/` also
 * matches against the path's basename, so `*.env` matches `config/.env`.
 */
export function matchGlob(glob: string, path: string): boolean {
  const normalized = path.replace(/\\/g, '/');
  const re = globToRegExp(glob);
  if (re.test(normalized)) return true;
  if (!glob.includes('/')) {
    const basename = normalized.split('/').pop() ?? normalized;
    return re.test(basename);
  }
  return false;
}

/** True when a path's basename has the given extension (with or without a dot). */
export function hasExtension(path: string, extension: string): boolean {
  const ext = (extension.startsWith('.') ? extension.slice(1) : extension).toLowerCase();
  const basename = path.replace(/\\/g, '/').split('/').pop() ?? '';
  const dot = basename.lastIndexOf('.');
  if (dot <= 0) {
    // Dotfiles like `.env` are treated as having extension `env`.
    return basename.startsWith('.') && basename.slice(1).toLowerCase() === ext;
  }
  return basename.slice(dot + 1).toLowerCase() === ext;
}
