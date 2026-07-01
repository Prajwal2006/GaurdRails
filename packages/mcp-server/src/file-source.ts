import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

/** Supplies the set of files the server may expose and reads their contents. */
export interface FileSource {
  /** Candidate paths, relative to the root, using forward slashes. */
  list(): Promise<string[]>;
  /** Read a path's content, or undefined if it is missing/unreadable/outside root. */
  read(path: string): Promise<string | undefined>;
}

const IGNORE_DIRS: ReadonlySet<string> = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'out',
  'coverage',
  '.next',
  '.turbo',
  '.cache',
]);

const MAX_FILE_SIZE = 512 * 1024;

async function* walk(dir: string): AsyncGenerator<string> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      yield* walk(full);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

/** True when `target` resolves to a location inside `root` (no traversal out). */
function isInsideRoot(root: string, target: string): boolean {
  const rel = relative(root, target);
  return rel.length > 0 && !rel.startsWith('..') && !/^([A-Za-z]:)?[\\/]/.test(rel);
}

/**
 * A `FileSource` backed by a directory on disk. Refuses to read outside the
 * root (path-traversal guard) and skips oversized files.
 */
export function diskFileSource(rootDir: string): FileSource {
  const root = resolve(rootDir);
  return {
    async list(): Promise<string[]> {
      const paths: string[] = [];
      for await (const file of walk(root)) {
        paths.push(relative(root, file).replace(/\\/g, '/'));
      }
      return paths;
    },
    async read(path: string): Promise<string | undefined> {
      const target = resolve(root, path);
      if (!isInsideRoot(root, target)) return undefined;
      try {
        const info = await stat(target);
        if (!info.isFile() || info.size > MAX_FILE_SIZE) return undefined;
        return await readFile(target, 'utf8');
      } catch {
        return undefined;
      }
    },
  };
}
