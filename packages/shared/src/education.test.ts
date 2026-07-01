import { describe, expect, it } from 'vitest';
import { renderExplanation, type Explanation } from './education.js';

const explanation: Explanation = {
  id: 'demo',
  title: 'Demo',
  what: { beginner: 'B-what', intermediate: 'I-what', professional: 'P-what' },
  why: { beginner: 'B-why', intermediate: 'I-why', professional: 'P-why' },
  fix: ['do this'],
  prevent: ['avoid that'],
};

describe('renderExplanation', () => {
  it('defaults to the beginner level', () => {
    const rendered = renderExplanation(explanation);
    expect(rendered.what).toBe('B-what');
    expect(rendered.why).toBe('B-why');
  });

  it('renders the requested level', () => {
    expect(renderExplanation(explanation, 'professional').what).toBe('P-what');
    expect(renderExplanation(explanation, 'intermediate').why).toBe('I-why');
  });

  it('passes through fix and prevent steps', () => {
    const rendered = renderExplanation(explanation);
    expect(rendered.fix).toEqual(['do this']);
    expect(rendered.prevent).toEqual(['avoid that']);
    expect(rendered.title).toBe('Demo');
  });
});
