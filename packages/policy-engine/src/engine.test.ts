import { describe, expect, it } from 'vitest';
import type { Finding, Policy, SecretCategory, Severity } from '@guardrails/shared';
import { PolicyEngine, evaluateRules, failSafeAction, ruleMatches } from './engine.js';
import { createDefaultPolicy } from './default-policy.js';

function finding(category: SecretCategory, severity: Severity): Finding {
  return {
    detectorId: 'test',
    detectorKind: 'regex',
    title: 'x',
    category,
    severity,
    confidence: 'high',
    length: 10,
    redactedPreview: 'p',
    fingerprint: 'fp',
  };
}

describe('ruleMatches', () => {
  it('matches on path glob and extension', () => {
    expect(
      ruleMatches({ id: 'r', action: 'deny', match: { path: '**/*.env' } }, { path: 'a/.env' }),
    ).toBe(true);
    expect(
      ruleMatches({ id: 'r', action: 'deny', match: { extension: 'pem' } }, { path: 'k.pem' }),
    ).toBe(true);
    expect(
      ruleMatches({ id: 'r', action: 'deny', match: { path: '**/*.env' } }, { path: 'a.ts' }),
    ).toBe(false);
  });

  it('matches on tool / project / user / organization', () => {
    const ctx = { tool: 'cursor', project: 'p', user: 'u', organization: 'o' } as const;
    expect(ruleMatches({ id: 'r', action: 'deny', match: { tool: 'cursor' } }, ctx)).toBe(true);
    expect(ruleMatches({ id: 'r', action: 'deny', match: { tool: 'claude-code' } }, ctx)).toBe(
      false,
    );
    expect(ruleMatches({ id: 'r', action: 'deny', match: { organization: 'o' } }, ctx)).toBe(true);
  });

  it('category / minSeverity constraints require a finding', () => {
    const rule = { id: 'r', action: 'deny', categories: ['api-key'] as SecretCategory[] };
    expect(ruleMatches(rule, {})).toBe(false);
    expect(ruleMatches(rule, { finding: finding('api-key', 'high') })).toBe(true);
    expect(ruleMatches(rule, { finding: finding('password', 'high') })).toBe(false);

    const sev = { id: 's', action: 'deny', minSeverity: 'high' as Severity };
    expect(ruleMatches(sev, { finding: finding('api-key', 'medium') })).toBe(false);
    expect(ruleMatches(sev, { finding: finding('api-key', 'critical') })).toBe(true);
  });
});

describe('failSafeAction', () => {
  it('allows when there is no finding', () => {
    expect(failSafeAction(undefined)).toBe('allow');
  });
  it('denies high+, redacts medium, audits lower', () => {
    expect(failSafeAction(finding('api-key', 'critical'))).toBe('deny');
    expect(failSafeAction(finding('generic-secret', 'medium'))).toBe('redact');
    expect(failSafeAction(finding('generic-secret', 'low'))).toBe('audit-only');
  });
});

describe('PolicyEngine with the default policy', () => {
  const engine = new PolicyEngine([createDefaultPolicy()], 'default');

  it('denies sensitive-file findings', () => {
    expect(engine.evaluate({ finding: finding('sensitive-file', 'high') }).action).toBe('deny');
    expect(engine.evaluate({ finding: finding('private-key', 'critical') }).action).toBe('deny');
  });

  it('denies high-severity secrets', () => {
    expect(engine.evaluate({ finding: finding('api-key', 'critical') }).action).toBe('deny');
  });

  it('redacts ambiguous medium findings', () => {
    expect(engine.evaluate({ finding: finding('generic-secret', 'medium') }).action).toBe('redact');
  });

  it('audits low-severity findings', () => {
    expect(engine.evaluate({ finding: finding('generic-secret', 'low') }).action).toBe(
      'audit-only',
    );
  });

  it('allows a plain read with no finding', () => {
    expect(engine.evaluate({ path: 'src/index.ts' }).action).toBe('allow');
  });

  it('carries policy and rule ids for traceability', () => {
    const decision = engine.evaluate({ finding: finding('api-key', 'critical') });
    expect(decision.policyId).toBe('default');
    expect(decision.ruleId).toBe('deny-high-severity');
  });
});

describe('inheritance and precedence', () => {
  const base: Policy = {
    id: 'base',
    rules: [{ id: 'deny-env', action: 'deny', match: { path: '**/*.env' }, priority: 10 }],
  };
  const team: Policy = {
    id: 'team',
    extends: ['base'],
    rules: [
      { id: 'allow-dockerfile', action: 'allow', match: { path: '**/Dockerfile' }, priority: 5 },
    ],
  };

  it('inherits rules from extended policies', () => {
    const engine = new PolicyEngine([base, team], 'team');
    expect(engine.evaluate({ path: 'config/.env' }).action).toBe('deny');
    expect(engine.evaluate({ path: 'app/Dockerfile' }).action).toBe('allow');
  });

  it('own rules win ties against inherited rules', () => {
    const parent: Policy = { id: 'p', rules: [{ id: 'inherit', action: 'deny', priority: 5 }] };
    const child: Policy = {
      id: 'c',
      extends: ['p'],
      rules: [{ id: 'own', action: 'allow', priority: 5 }],
    };
    const engine = new PolicyEngine([parent, child], 'c');
    const decision = engine.evaluate({ path: 'anything' });
    expect(decision.action).toBe('allow');
    expect(decision.ruleId).toBe('own');
  });

  it('higher priority always wins', () => {
    const policy: Policy = {
      id: 'p',
      rules: [
        { id: 'low', action: 'allow', priority: 1 },
        { id: 'high', action: 'deny', priority: 100 },
      ],
    };
    expect(new PolicyEngine([policy]).evaluate({ path: 'x' }).action).toBe('deny');
  });

  it('guards against inheritance cycles', () => {
    const a: Policy = { id: 'a', extends: ['b'], rules: [{ id: 'ra', action: 'deny' }] };
    const b: Policy = { id: 'b', extends: ['a'], rules: [{ id: 'rb', action: 'allow' }] };
    const engine = new PolicyEngine([a, b], 'a');
    // Should terminate and produce a decision rather than looping forever.
    expect(['deny', 'allow']).toContain(engine.evaluate({ path: 'x' }).action);
  });
});

describe('PolicyEngine management', () => {
  it('falls back to fail-safe for an unknown policy', () => {
    const engine = new PolicyEngine([createDefaultPolicy()]);
    const decision = engine.evaluate({ finding: finding('api-key', 'high') }, 'nope');
    expect(decision.action).toBe('deny');
    expect(decision.policyId).toBeUndefined();
  });

  it('supports addPolicy / setActivePolicy / getActivePolicyId', () => {
    const engine = new PolicyEngine([]);
    engine.addPolicy(createDefaultPolicy());
    expect(engine.getActivePolicyId()).toBe('default');
    engine.addPolicy({ id: 'other', rules: [] });
    engine.setActivePolicy('other');
    expect(engine.getActivePolicyId()).toBe('other');
    expect(() => engine.setActivePolicy('missing')).toThrow();
  });

  it('evaluateFindings returns one decision per finding', () => {
    const engine = new PolicyEngine([createDefaultPolicy()], 'default');
    const results = engine.evaluateFindings([
      finding('api-key', 'critical'),
      finding('generic-secret', 'medium'),
    ]);
    expect(results.map((r) => r.decision.action)).toEqual(['deny', 'redact']);
  });
});

describe('evaluateRules', () => {
  it('uses the policy default when no rule matches', () => {
    const decision = evaluateRules(
      [{ id: 'r', action: 'deny', match: { path: '*.env' } }],
      { path: 'index.ts' },
      { id: 'p', defaultAction: 'allow' },
    );
    expect(decision.action).toBe('allow');
  });

  it('uses fail-safe when there is no matching rule and no default', () => {
    const decision = evaluateRules([], { finding: finding('api-key', 'high') }, { id: 'p' });
    expect(decision.action).toBe('deny');
  });
});
