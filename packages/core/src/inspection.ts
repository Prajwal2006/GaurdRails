import {
  isBlocking,
  type AgentId,
  type Decision,
  type DecisionAction,
  type Finding,
} from '@guardrails/shared';
import { DetectorRegistry, summarizeFindings, type ScanSummary } from '@guardrails/secret-detector';
import { PolicyEngine, createDefaultPolicy } from '@guardrails/policy-engine';
import { redactContent } from '@guardrails/redaction';

export interface InspectionInput {
  readonly path?: string;
  readonly content: string;
  readonly tool?: AgentId;
  readonly project?: string;
  readonly user?: string;
  readonly organization?: string;
}

export interface DecidedFinding {
  readonly finding: Finding;
  readonly decision: Decision;
}

/** The overall verdict for a piece of content - the worst decision wins. */
export type Outcome = 'clean' | 'audit' | 'redact' | 'deny';

export interface InspectionResult {
  readonly path: string | undefined;
  readonly findings: readonly Finding[];
  readonly decided: readonly DecidedFinding[];
  readonly summary: ScanSummary;
  readonly outcome: Outcome;
}

export interface RedactionOutcome {
  readonly content: string;
  readonly redactions: number;
  readonly result: InspectionResult;
}

const OUTCOME_RANK: Record<Outcome, number> = { clean: 0, audit: 1, redact: 2, deny: 3 };

function actionOutcome(action: DecisionAction): Outcome {
  switch (action) {
    case 'deny':
    case 'always-deny':
      return 'deny';
    case 'redact':
      return 'redact';
    case 'audit-only':
      return 'audit';
    case 'allow':
    case 'allow-once':
      return 'clean';
  }
}

function worse(a: Outcome, b: Outcome): Outcome {
  return OUTCOME_RANK[a] >= OUTCOME_RANK[b] ? a : b;
}

export interface GuardrailsOptions {
  readonly registry?: DetectorRegistry;
  readonly engine?: PolicyEngine;
}

/**
 * The high-level facade that ties Guardrails together: it detects secrets,
 * asks the policy engine what to do with each, and can redact accordingly. It is
 * pure - it performs no I/O. Give it content, get a verdict.
 */
export class Guardrails {
  private readonly registry: DetectorRegistry;
  private readonly engine: PolicyEngine;

  constructor(options: GuardrailsOptions = {}) {
    this.registry = options.registry ?? DetectorRegistry.withDefaults();
    this.engine = options.engine ?? new PolicyEngine([createDefaultPolicy()], 'default');
  }

  get detectorRegistry(): DetectorRegistry {
    return this.registry;
  }

  get policyEngine(): PolicyEngine {
    return this.engine;
  }

  /** Detect secrets and decide what to do with each. */
  inspect(input: InspectionInput): InspectionResult {
    const findings = this.registry.scan(
      input.path === undefined
        ? { content: input.content }
        : { path: input.path, content: input.content },
    );

    const base = {
      ...(input.path !== undefined ? { path: input.path } : {}),
      ...(input.tool !== undefined ? { tool: input.tool } : {}),
      ...(input.project !== undefined ? { project: input.project } : {}),
      ...(input.user !== undefined ? { user: input.user } : {}),
      ...(input.organization !== undefined ? { organization: input.organization } : {}),
    };

    const decided: DecidedFinding[] = findings.map((finding) => ({
      finding,
      decision: this.engine.evaluate({ ...base, finding }),
    }));

    const outcome = decided.reduce<Outcome>(
      (worst, d) => worse(worst, actionOutcome(d.decision.action)),
      'clean',
    );

    return { path: input.path, findings, decided, summary: summarizeFindings(findings), outcome };
  }

  /**
   * Inspect and produce a redacted copy of the content. Any finding whose policy
   * decision is `redact` or a block is masked; audited/allowed content is left
   * as-is.
   */
  redact(input: InspectionInput): RedactionOutcome {
    const result = this.inspect(input);
    const toRedact = result.decided
      .filter((d) => d.decision.action === 'redact' || isBlocking(d.decision.action))
      .map((d) => d.finding);
    const { content, redactions } = redactContent(input.content, toRedact);
    return { content, redactions, result };
  }
}
