import { describe, expect, it } from 'vitest';
import { createDetectionContext } from '@guardrails/shared';
import { providerDetectors } from './providers.js';
import type { Finding } from '@guardrails/shared';

function scanAll(content: string): Finding[] {
  const ctx = createDetectionContext({ content });
  return providerDetectors.flatMap((d) => d.detect(ctx));
}

interface Case {
  readonly name: string;
  readonly content: string;
  readonly detectorId: string;
}

// Fixtures are synthetic: fixed prefixes plus filler of the exact required
// length, so no real credentials are embedded and lengths are never miscounted.
const positives: readonly Case[] = [
  { name: 'OpenAI', content: 'sk-' + 'a'.repeat(40), detectorId: 'openai-api-key' },
  { name: 'OpenAI project', content: 'sk-proj-' + 'a'.repeat(40), detectorId: 'openai-api-key' },
  { name: 'Anthropic', content: 'sk-ant-api03-' + 'a'.repeat(40), detectorId: 'anthropic-api-key' },
  { name: 'AWS access key', content: 'AKIAIOSFODNN7EXAMPLE', detectorId: 'aws-access-key-id' },
  {
    name: 'AWS secret',
    content: 'aws_secret_access_key = ' + 'A'.repeat(40),
    detectorId: 'aws-secret-access-key',
  },
  { name: 'GitHub token', content: 'ghp_' + 'a'.repeat(36), detectorId: 'github-token' },
  {
    name: 'GitHub fine-grained PAT',
    content: 'github_pat_' + 'a'.repeat(30),
    detectorId: 'github-fine-grained-pat',
  },
  { name: 'GitLab', content: 'glpat-' + 'a'.repeat(20), detectorId: 'gitlab-token' },
  { name: 'Stripe live', content: 'sk_live_' + 'a'.repeat(24), detectorId: 'stripe-live-key' },
  { name: 'Stripe test', content: 'sk_test_' + 'a'.repeat(24), detectorId: 'stripe-test-key' },
  {
    name: 'Slack',
    content: 'xoxb-123456789012-1234567890123-' + 'a'.repeat(24),
    detectorId: 'slack-token',
  },
  {
    name: 'Slack webhook',
    content: 'https://hooks.slack.com/services/T00000000/B11111111/' + 'a'.repeat(20),
    detectorId: 'slack-webhook',
  },
  { name: 'Google API key', content: 'AIza' + 'a'.repeat(35), detectorId: 'google-api-key' },
  {
    name: 'Google OAuth secret',
    content: 'GOCSPX-' + 'a'.repeat(28),
    detectorId: 'google-oauth-secret',
  },
  {
    name: 'SendGrid',
    content: 'SG.' + 'a'.repeat(22) + '.' + 'b'.repeat(43),
    detectorId: 'sendgrid-key',
  },
  { name: 'npm token', content: 'npm_' + 'a'.repeat(36), detectorId: 'npm-token' },
  { name: 'DigitalOcean', content: 'dop_v1_' + 'a'.repeat(64), detectorId: 'digitalocean-token' },
  { name: 'Doppler', content: 'dp.pt.' + 'a'.repeat(42), detectorId: 'doppler-token' },
  { name: 'Shopify', content: 'shpat_' + 'a'.repeat(32), detectorId: 'shopify-token' },
  { name: 'Square', content: 'sq0atp-' + 'a'.repeat(22), detectorId: 'square-token' },
  { name: 'Hugging Face', content: 'hf_' + 'a'.repeat(34), detectorId: 'huggingface-token' },
  { name: 'Telegram', content: '123456789:' + 'a'.repeat(35), detectorId: 'telegram-bot-token' },
  { name: 'Mailgun', content: 'key-' + '0'.repeat(32), detectorId: 'mailgun-key' },
  { name: 'Twilio SID', content: 'AC' + 'a'.repeat(32), detectorId: 'twilio-account-sid' },
  {
    name: 'age secret key',
    content: 'AGE-SECRET-KEY-1' + 'A'.repeat(58),
    detectorId: 'age-secret-key',
  },
  {
    name: 'Bearer token',
    content: 'Authorization: Bearer ' + 'a'.repeat(40),
    detectorId: 'bearer-token',
  },
];

describe('provider detectors', () => {
  for (const { name, content, detectorId } of positives) {
    it(`detects ${name}`, () => {
      const found = scanAll(content);
      expect(found.map((f) => f.detectorId)).toContain(detectorId);
    });
  }

  it('does not confuse OpenAI and Anthropic keys', () => {
    const anthropic = scanAll('sk-ant-api03-' + 'a'.repeat(40));
    const ids = anthropic.map((f) => f.detectorId);
    expect(ids).toContain('anthropic-api-key');
    expect(ids).not.toContain('openai-api-key');
  });

  it('respects word boundaries (no mid-token match)', () => {
    const found = scanAll('XAKIAIOSFODNN7EXAMPLE');
    expect(found.map((f) => f.detectorId)).not.toContain('aws-access-key-id');
  });

  it('produces findings that never contain the raw value', () => {
    const secret = 'sk-' + 'a'.repeat(40);
    const found = scanAll(secret);
    expect(JSON.stringify(found)).not.toContain(secret);
    expect(found.every((f) => f.length > 0)).toBe(true);
  });

  it('marks the correct severity for critical providers', () => {
    const [finding] = scanAll('ghp_' + 'a'.repeat(36));
    expect(finding?.severity).toBe('critical');
    expect(finding?.confidence).toBe('high');
  });
});
