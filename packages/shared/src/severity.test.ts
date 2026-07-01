import { describe, expect, it } from 'vitest';
import {
  compareConfidence,
  compareSeverity,
  maxSeverity,
  meetsSeverity,
  severityRank,
  SEVERITIES,
} from './severity.js';

describe('severity ordering', () => {
  it('ranks severities from info to critical', () => {
    const ranks = SEVERITIES.map(severityRank);
    const sorted = [...ranks].sort((a, b) => a - b);
    expect(ranks).toEqual(sorted);
    expect(severityRank('critical')).toBeGreaterThan(severityRank('info'));
  });

  it('compareSeverity is usable as a sort comparator', () => {
    const shuffled = ['high', 'info', 'critical', 'low'] as const;
    const sorted = [...shuffled].sort(compareSeverity);
    expect(sorted).toEqual(['info', 'low', 'high', 'critical']);
  });

  it('maxSeverity returns the more severe of two', () => {
    expect(maxSeverity('low', 'high')).toBe('high');
    expect(maxSeverity('critical', 'medium')).toBe('critical');
    expect(maxSeverity('info', 'info')).toBe('info');
  });

  it('meetsSeverity is inclusive of the threshold', () => {
    expect(meetsSeverity('high', 'medium')).toBe(true);
    expect(meetsSeverity('medium', 'medium')).toBe(true);
    expect(meetsSeverity('low', 'medium')).toBe(false);
  });
});

describe('confidence ordering', () => {
  it('orders low < medium < high', () => {
    expect(compareConfidence('low', 'high')).toBeLessThan(0);
    expect(compareConfidence('high', 'low')).toBeGreaterThan(0);
    expect(compareConfidence('medium', 'medium')).toBe(0);
  });
});
