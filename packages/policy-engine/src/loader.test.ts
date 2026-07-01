import { describe, expect, it } from 'vitest';
import { parsePolicy, parsePolicyJson } from './loader.js';

describe('parsePolicy', () => {
  it('accepts a valid policy', () => {
    const result = parsePolicy({
      id: 'team',
      description: 'Team policy',
      defaultAction: 'allow',
      extends: ['base'],
      rules: [
        {
          id: 'deny-env',
          description: 'no env files',
          action: 'deny',
          priority: 10,
          match: { path: '**/*.env', tool: 'cursor' },
          minSeverity: 'medium',
          categories: ['api-key', 'password'],
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.id).toBe('team');
      expect(result.value.rules).toHaveLength(1);
    }
  });

  const invalids: ReadonlyArray<[string, unknown]> = [
    ['not an object', 42],
    ['missing id', { rules: [] }],
    ['rules not array', { id: 'p', rules: {} }],
    ['rule missing id', { id: 'p', rules: [{ action: 'deny' }] }],
    ['invalid action', { id: 'p', rules: [{ id: 'r', action: 'nuke' }] }],
    ['invalid severity', { id: 'p', rules: [{ id: 'r', action: 'deny', minSeverity: 'huge' }] }],
    ['invalid category', { id: 'p', rules: [{ id: 'r', action: 'deny', categories: ['nope'] }] }],
    ['bad scope type', { id: 'p', rules: [{ id: 'r', action: 'deny', match: { path: 5 } }] }],
    ['bad priority', { id: 'p', rules: [{ id: 'r', action: 'deny', priority: 'high' }] }],
    ['bad extends', { id: 'p', rules: [], extends: [5] }],
    ['bad defaultAction', { id: 'p', rules: [], defaultAction: 'maybe' }],
  ];

  for (const [name, input] of invalids) {
    it(`rejects: ${name}`, () => {
      const result = parsePolicy(input);
      expect(result.ok).toBe(false);
    });
  }
});

describe('parsePolicyJson', () => {
  it('parses valid JSON', () => {
    const result = parsePolicyJson('{"id":"p","rules":[]}');
    expect(result.ok).toBe(true);
  });

  it('reports invalid JSON', () => {
    const result = parsePolicyJson('{ not json');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('invalid JSON');
  });
});
