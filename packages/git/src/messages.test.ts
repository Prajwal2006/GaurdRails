import { describe, expect, it } from 'vitest';
import { Guardrails } from '@guardrails/core';
import { formatBlockMessage } from './messages.js';
import { scanStaged } from './scanner.js';
import type { GitRepo } from './git.js';

const OPENAI = 'sk-' + 'a'.repeat(40);

function repoFor(files: Record<string, string>): GitRepo {
  const paths = Object.keys(files);
  return {
    root: '/repo',
    hooksDir: () => Promise.resolve('/repo/.git/hooks'),
    listStagedFiles: () => Promise.resolve(paths),
    readStagedContent: (p) => Promise.resolve(files[p]),
    listTrackedFiles: () => Promise.resolve(paths),
    readWorkingContent: (p) => Promise.resolve(files[p]),
  };
}

describe('formatBlockMessage', () => {
  it('explains the block, lists findings, and never leaks the secret', async () => {
    const repo = repoFor({ '.env': `OPENAI_API_KEY=${OPENAI}\n` });
    const result = await scanStaged(repo, new Guardrails());
    const text = formatBlockMessage(result, 'pre-commit').join('\n');

    expect(text).toContain('Guardrails blocked this commit');
    expect(text).toContain('.env');
    expect(text).toContain('How to fix it');
    expect(text).toContain('--no-verify');
    expect(text).not.toContain(OPENAI);
  });

  it('uses push wording for the pre-push hook', async () => {
    const repo = repoFor({ '.env': `OPENAI_API_KEY=${OPENAI}\n` });
    const result = await scanStaged(repo, new Guardrails());
    const text = formatBlockMessage(result, 'pre-push').join('\n');
    expect(text).toContain('Guardrails blocked this push');
  });
});
