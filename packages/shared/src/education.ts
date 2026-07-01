/**
 * The educational content model. One of Guardrails' most important features is
 * explaining risk in language a beginner understands — without ever shaming the
 * user. Explanations are keyed by id and tailored to experience level.
 */

export const EXPERIENCE_LEVELS = ['beginner', 'intermediate', 'professional'] as const;
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

/** Text tailored to each experience level. */
export type LeveledText = Readonly<Record<ExperienceLevel, string>>;

export interface Explanation {
  readonly id: string;
  readonly title: string;
  /** What happened, per experience level. */
  readonly what: LeveledText;
  /** Why it matters, per experience level. */
  readonly why: LeveledText;
  /** Concrete remediation steps. */
  readonly fix: readonly string[];
  /** How to avoid it next time. */
  readonly prevent: readonly string[];
}

/** A rendered explanation for a specific experience level. */
export interface RenderedExplanation {
  readonly title: string;
  readonly what: string;
  readonly why: string;
  readonly fix: readonly string[];
  readonly prevent: readonly string[];
}

export function renderExplanation(
  explanation: Explanation,
  level: ExperienceLevel = 'beginner',
): RenderedExplanation {
  return {
    title: explanation.title,
    what: explanation.what[level],
    why: explanation.why[level],
    fix: explanation.fix,
    prevent: explanation.prevent,
  };
}

/** A read-only catalog of explanations, keyed by id. */
export interface ExplanationCatalog {
  get(id: string): Explanation | undefined;
  all(): readonly Explanation[];
}
