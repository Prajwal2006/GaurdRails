import { describe, expect, it } from 'vitest';
import { createDefaultPolicy } from './default-policy.js';
import { parsePolicy } from './loader.js';

describe('createDefaultPolicy', () => {
  it('has a stable shape', () => {
    const policy = createDefaultPolicy();
    expect(policy.id).toBe('default');
    expect(policy.defaultAction).toBe('allow');
    expect(policy.rules).toHaveLength(4);
  });

  it('is itself a valid policy', () => {
    // Round-trips through the same validator external policies use.
    const result = parsePolicy(JSON.parse(JSON.stringify(createDefaultPolicy())));
    expect(result.ok).toBe(true);
  });
});
