import { describe, expect, it } from 'vitest';
import { isAuditable, isBlocking, isExposing } from './policy.js';

describe('policy decision helpers', () => {
  it('isBlocking is true only for deny actions', () => {
    expect(isBlocking('deny')).toBe(true);
    expect(isBlocking('always-deny')).toBe(true);
    expect(isBlocking('allow')).toBe(false);
    expect(isBlocking('redact')).toBe(false);
  });

  it('isExposing is the inverse of isBlocking', () => {
    expect(isExposing('allow')).toBe(true);
    expect(isExposing('redact')).toBe(true);
    expect(isExposing('deny')).toBe(false);
  });

  it('isAuditable records everything except a plain allow', () => {
    expect(isAuditable('allow')).toBe(false);
    expect(isAuditable('allow-once')).toBe(true);
    expect(isAuditable('deny')).toBe(true);
    expect(isAuditable('redact')).toBe(true);
    expect(isAuditable('audit-only')).toBe(true);
  });
});
