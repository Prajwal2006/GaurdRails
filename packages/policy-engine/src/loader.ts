import {
  DECISION_ACTIONS,
  SECRET_CATEGORIES,
  SEVERITIES,
  err,
  ok,
  type DecisionAction,
  type Policy,
  type PolicyRule,
  type Result,
  type Scope,
  type SecretCategory,
  type Severity,
} from '@guardrails/shared';

// A dependency-free, auditable validator. We deliberately avoid a schema library
// here to keep the security-relevant core free of third-party runtime code.

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isDecisionAction(value: unknown): value is DecisionAction {
  return typeof value === 'string' && (DECISION_ACTIONS as readonly string[]).includes(value);
}

function isSeverity(value: unknown): value is Severity {
  return typeof value === 'string' && (SEVERITIES as readonly string[]).includes(value);
}

function isCategory(value: unknown): value is SecretCategory {
  return typeof value === 'string' && (SECRET_CATEGORIES as readonly string[]).includes(value);
}

function parseScope(value: unknown, path: string): Result<Scope, string> {
  if (!isRecord(value)) return err(`${path} must be an object`);
  const scope: Scope = {};
  for (const key of ['project', 'path', 'extension', 'tool', 'user', 'organization'] as const) {
    const v = value[key];
    if (v === undefined) continue;
    if (typeof v !== 'string') return err(`${path}.${key} must be a string`);
    (scope as Record<string, string>)[key] = v;
  }
  return ok(scope);
}

function parseRule(value: unknown, path: string): Result<PolicyRule, string> {
  if (!isRecord(value)) return err(`${path} must be an object`);
  if (typeof value.id !== 'string' || value.id.length === 0) {
    return err(`${path}.id is required and must be a non-empty string`);
  }
  if (!isDecisionAction(value.action)) {
    return err(`${path}.action must be one of ${DECISION_ACTIONS.join(', ')}`);
  }

  const rule: {
    id: string;
    action: DecisionAction;
    description?: string;
    priority?: number;
    match?: Scope;
    minSeverity?: Severity;
    categories?: SecretCategory[];
  } = { id: value.id, action: value.action };

  if (value.description !== undefined) {
    if (typeof value.description !== 'string') return err(`${path}.description must be a string`);
    rule.description = value.description;
  }
  if (value.priority !== undefined) {
    if (typeof value.priority !== 'number' || !Number.isFinite(value.priority)) {
      return err(`${path}.priority must be a finite number`);
    }
    rule.priority = value.priority;
  }
  if (value.match !== undefined) {
    const scope = parseScope(value.match, `${path}.match`);
    if (!scope.ok) return scope;
    rule.match = scope.value;
  }
  if (value.minSeverity !== undefined) {
    if (!isSeverity(value.minSeverity)) {
      return err(`${path}.minSeverity must be one of ${SEVERITIES.join(', ')}`);
    }
    rule.minSeverity = value.minSeverity;
  }
  if (value.categories !== undefined) {
    if (!Array.isArray(value.categories) || !value.categories.every(isCategory)) {
      return err(`${path}.categories must be an array of valid secret categories`);
    }
    rule.categories = value.categories;
  }
  return ok(rule);
}

/** Validate and parse an unknown value into a `Policy`. */
export function parsePolicy(input: unknown): Result<Policy, string> {
  if (!isRecord(input)) return err('policy must be an object');
  if (typeof input.id !== 'string' || input.id.length === 0) {
    return err('policy.id is required and must be a non-empty string');
  }
  if (!Array.isArray(input.rules)) return err('policy.rules must be an array');

  const rules: PolicyRule[] = [];
  for (let i = 0; i < input.rules.length; i += 1) {
    const parsed = parseRule(input.rules[i], `policy.rules[${i}]`);
    if (!parsed.ok) return parsed;
    rules.push(parsed.value);
  }

  const policy: {
    id: string;
    rules: PolicyRule[];
    description?: string;
    defaultAction?: DecisionAction;
    extends?: string[];
  } = { id: input.id, rules };

  if (input.description !== undefined) {
    if (typeof input.description !== 'string') return err('policy.description must be a string');
    policy.description = input.description;
  }
  if (input.defaultAction !== undefined) {
    if (!isDecisionAction(input.defaultAction)) {
      return err(`policy.defaultAction must be one of ${DECISION_ACTIONS.join(', ')}`);
    }
    policy.defaultAction = input.defaultAction;
  }
  if (input.extends !== undefined) {
    if (!Array.isArray(input.extends) || !input.extends.every((e) => typeof e === 'string')) {
      return err('policy.extends must be an array of policy ids');
    }
    policy.extends = input.extends;
  }
  return ok(policy);
}

/** Parse a JSON string into a `Policy`. */
export function parsePolicyJson(json: string): Result<Policy, string> {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch (error) {
    return err(`invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  return parsePolicy(value);
}
