import type { Explanation, ExplanationCatalog, Finding, SecretCategory } from '@guardrails/shared';

/**
 * The educational content catalog. Every explanation speaks to three experience
 * levels and never shames the user - leaking a secret is easy to do by accident.
 * Content is keyed by secret category so every finding can be explained.
 */
const CATALOG: Record<SecretCategory, Explanation> = {
  'api-key': {
    id: 'api-key',
    title: 'API key',
    what: {
      beginner:
        'This looks like an API key - a password your code uses to talk to another service (like OpenAI or Stripe).',
      intermediate:
        'A provider API key was found. Anyone holding it can call that API as you, on your account.',
      professional:
        'A provider API credential was detected in source. Treat it as compromised if it has been shared or committed.',
    },
    why: {
      beginner:
        "If someone else gets this key, they can use that service and you'll get the bill - a bit like sharing your house key.",
      intermediate:
        'Leaked keys are routinely scraped from repos and abused within minutes, leading to unexpected charges or data access.',
      professional:
        'Exposed keys enable account takeover, data exfiltration, and quota abuse. Rotation and least-privilege scoping are required.',
    },
    fix: [
      'Move the key into an environment variable and read it with process.env.',
      'Rotate (regenerate) the key with the provider - assume the old one is burned.',
      'Add the file that held it to .gitignore, and provide a .env.example without real values.',
    ],
    prevent: [
      'Never hard-code keys; load them from the environment or a secrets manager.',
      'Keep a .env.example so teammates know which variables to set.',
      'Let Guardrails scan before every commit and push.',
    ],
  },
  'cloud-credentials': {
    id: 'cloud-credentials',
    title: 'Cloud credentials',
    what: {
      beginner: 'This looks like a key to a cloud account (like AWS, Google Cloud, or Azure).',
      intermediate:
        'Cloud provider credentials were found. These often grant broad access to infrastructure and data.',
      professional:
        'Long-lived cloud credentials were detected. These frequently carry excessive IAM permissions.',
    },
    why: {
      beginner:
        'Someone with this could read your data, spin up servers, or run up a huge bill in your name.',
      intermediate:
        'Cloud keys are high-value targets; abuse can mean data breaches and large, fast-accruing costs.',
      professional:
        'Compromise can lead to full account takeover, lateral movement, and crypto-mining abuse. Rotate and audit CloudTrail/logs.',
    },
    fix: [
      'Rotate/deactivate the credential in the cloud console immediately.',
      'Use short-lived credentials (SSO, OIDC, instance roles) instead of static keys.',
      'Remove the file from the repo and add it to .gitignore.',
    ],
    prevent: [
      'Prefer role-based, short-lived credentials over static keys.',
      'Store any required static keys in a secrets manager, never in the repo.',
      'Enable provider secret-scanning and Guardrails git hooks.',
    ],
  },
  'private-key': {
    id: 'private-key',
    title: 'Private key',
    what: {
      beginner: 'This is a private key - the secret half of a cryptographic key pair.',
      intermediate:
        'A PEM private key was found. It can decrypt data or impersonate a server/identity.',
      professional:
        'A private key (RSA/EC/OPENSSH/PGP) was detected. Anything it signs or decrypts is now at risk.',
    },
    why: {
      beginner: "The private key is meant to stay secret - it's like the master key to a lock.",
      intermediate:
        'With the private key, an attacker can impersonate you, decrypt traffic, or forge signatures.',
      professional:
        'Exposure undermines TLS/SSH/code-signing trust. Revoke certificates and re-key affected systems.',
    },
    fix: [
      'Generate a new key pair and revoke/replace the exposed one everywhere it is used.',
      'Remove the key file from the repository and its history if it was committed.',
      'Add key file patterns (*.pem, *.key, id_*) to .gitignore.',
    ],
    prevent: [
      'Keep private keys outside the repo, in a keychain or secrets manager.',
      'Never paste keys into config files or code.',
      'Let Guardrails block key files by default.',
    ],
  },
  'ssh-key': {
    id: 'ssh-key',
    title: 'SSH private key',
    what: {
      beginner: 'This looks like an SSH private key - what your computer uses to log into servers.',
      intermediate:
        'An SSH private key was found. It grants access to any host trusting its public half.',
      professional:
        'An SSH private key was detected. It may enable direct shell access to production hosts.',
    },
    why: {
      beginner: 'Anyone with this could log into your servers as you.',
      intermediate: 'Leaked SSH keys allow remote access and lateral movement across your fleet.',
      professional:
        'Compromise enables unauthenticated host access; rotate keys and review authorized_keys.',
    },
    fix: [
      'Generate a new SSH key (ssh-keygen) and remove the old public key from servers.',
      'Delete the private key from the repo and its history.',
      'Add id_rsa, id_ed25519, and .ssh/ to .gitignore.',
    ],
    prevent: [
      'Store SSH keys only in ~/.ssh, never in a project.',
      'Use a passphrase and an ssh-agent.',
      'Rely on Guardrails to block key files.',
    ],
  },
  certificate: {
    id: 'certificate',
    title: 'Certificate / key material',
    what: {
      beginner: 'This looks like certificate or key material used to secure connections.',
      intermediate: 'Certificate/key material was found, which may include a private key.',
      professional:
        'Certificate material was detected; verify whether an associated private key is exposed.',
    },
    why: {
      beginner: 'If it includes a secret key, others could impersonate your service.',
      intermediate: 'Exposed key material weakens the trust that TLS relies on.',
      professional: 'Leaked keys break TLS guarantees; reissue certificates and rotate keys.',
    },
    fix: [
      'Reissue the certificate and rotate any associated private key.',
      'Remove the material from the repository.',
      'Add certificate/key extensions to .gitignore.',
    ],
    prevent: [
      'Keep certificate private keys out of source control.',
      'Automate certificate issuance (e.g. ACME) instead of committing files.',
      'Let Guardrails flag key/cert files.',
    ],
  },
  jwt: {
    id: 'jwt',
    title: 'JSON Web Token (JWT)',
    what: {
      beginner: 'This looks like a login token (a JWT) that proves who someone is to an app.',
      intermediate: 'A JWT was found. If still valid, it can authenticate as the token’s subject.',
      professional:
        'A JWT was detected; assess expiry, audience, and whether it grants live access.',
    },
    why: {
      beginner: 'If the token is still active, someone could use it to act as that user.',
      intermediate:
        'Valid tokens grant access until they expire; long-lived tokens are especially risky.',
      professional:
        'Bearer tokens are replayable; short TTLs and rotation limit blast radius on exposure.',
    },
    fix: [
      'Invalidate the session/token if possible and issue a fresh one.',
      'Remove the token from the repo and any logs.',
      'Avoid logging tokens; store them only in memory or secure storage.',
    ],
    prevent: [
      'Never commit tokens; keep them out of fixtures and logs.',
      'Use short token lifetimes and refresh flows.',
      'Let Guardrails scan for tokens automatically.',
    ],
  },
  'connection-string': {
    id: 'connection-string',
    title: 'Connection string with credentials',
    what: {
      beginner: 'This is a database (or broker) address that includes a username and password.',
      intermediate:
        'A connection string with embedded credentials was found (e.g. postgres://user:pass@host).',
      professional:
        'A credential-bearing URI was detected. It exposes both the endpoint and the password.',
    },
    why: {
      beginner: 'Anyone with this could connect to your database and read or change data.',
      intermediate:
        'Embedded credentials grant direct data access, often bypassing app-level checks.',
      professional:
        'Exposure enables data exfiltration/tampering; rotate credentials and restrict network access.',
    },
    fix: [
      'Move the URL into an environment variable and rotate the password.',
      'Restrict database access by network/IP where possible.',
      'Remove the string from the repo and its history.',
    ],
    prevent: [
      'Store connection strings in the environment, not in code.',
      'Use least-privilege database users.',
      'Let Guardrails redact connection strings before AI tools see them.',
    ],
  },
  password: {
    id: 'password',
    title: 'Password',
    what: {
      beginner: 'This looks like a hard-coded password.',
      intermediate: 'A password literal was found in the code or config.',
      professional: 'A hard-coded password was detected; treat it as compromised.',
    },
    why: {
      beginner: 'Passwords in code can be read by anyone who sees the file - including AI tools.',
      intermediate:
        'Hard-coded passwords are easily leaked and hard to rotate across environments.',
      professional:
        'Static passwords resist rotation and violate least-privilege; centralize in a secrets store.',
    },
    fix: [
      'Move the password to an environment variable or secrets manager.',
      'Change the password wherever it is used.',
      'Remove it from the repo and history.',
    ],
    prevent: [
      'Never store passwords in code or config files.',
      'Use a secrets manager and short-lived credentials.',
      'Let Guardrails catch password assignments before commit.',
    ],
  },
  token: {
    id: 'token',
    title: 'Access token',
    what: {
      beginner: 'This looks like an access token - like a temporary password for a service.',
      intermediate:
        'An access token was found; it can act on your behalf until revoked or expired.',
      professional:
        'An access/bearer token was detected; scope and lifetime determine blast radius.',
    },
    why: {
      beginner: 'Someone with this token could do things in that service as you.',
      intermediate: 'Tokens are frequently over-scoped; leaks lead to account or repo abuse.',
      professional: 'Replayable bearer tokens enable takeover; rotate and scope tightly.',
    },
    fix: [
      'Revoke the token with the provider and issue a new one.',
      'Move it into an environment variable or secret store.',
      'Remove it from the repo and history.',
    ],
    prevent: [
      'Keep tokens out of source and logs.',
      'Prefer fine-grained, short-lived tokens.',
      'Let Guardrails scan and redact tokens.',
    ],
  },
  oauth: {
    id: 'oauth',
    title: 'OAuth client secret',
    what: {
      beginner: 'This looks like an OAuth secret used to sign users in through another provider.',
      intermediate:
        'An OAuth client secret was found; it authenticates your app to the identity provider.',
      professional:
        'An OAuth client secret was detected; exposure allows impersonation of your application.',
    },
    why: {
      beginner: 'With this, someone could pretend to be your app during login.',
      intermediate: 'A leaked client secret can be used to mint tokens or phish your users.',
      professional:
        'Compromise enables token issuance and consent abuse; rotate the secret immediately.',
    },
    fix: [
      'Rotate the client secret in the provider’s console.',
      'Store it in an environment variable or secret manager.',
      'Remove it from the repo and history.',
    ],
    prevent: [
      'Never ship client secrets in frontend or committed code.',
      'Rotate secrets on a schedule.',
      'Let Guardrails flag OAuth secrets.',
    ],
  },
  cookie: {
    id: 'cookie',
    title: 'Session cookie',
    what: {
      beginner: 'This looks like a session cookie - a token that keeps you logged in.',
      intermediate: 'A session cookie value was found; it may allow session hijacking.',
      professional: 'A session cookie was detected; if valid, it enables session replay.',
    },
    why: {
      beginner: 'Someone with this could be logged in as you.',
      intermediate: 'Stolen cookies allow account access without a password.',
      professional:
        'Session fixation/replay risk; invalidate sessions and use HttpOnly/Secure flags.',
    },
    fix: [
      'Invalidate the session and issue a new one.',
      'Never store cookie values in code or logs.',
      'Remove it from the repo.',
    ],
    prevent: [
      'Mark cookies HttpOnly and Secure; keep them out of source.',
      'Use short session lifetimes.',
      'Let Guardrails scan for tokens and cookies.',
    ],
  },
  'generic-secret': {
    id: 'generic-secret',
    title: 'Possible secret',
    what: {
      beginner: 'This looks like it might be a secret - a random-looking value.',
      intermediate: 'A high-entropy or secret-like value was found; it may be sensitive.',
      professional: 'A likely secret was detected heuristically; confirm and handle accordingly.',
    },
    why: {
      beginner: 'If it is a secret, keeping it in code is risky.',
      intermediate: 'Even unrecognized secrets are dangerous once leaked; verify before ignoring.',
      professional: 'Heuristic matches can be false positives - verify, then rotate if real.',
    },
    fix: [
      'Confirm whether this is a real secret.',
      'If it is, move it to the environment and rotate it.',
      'If it is not, you can allow it via a Guardrails policy.',
    ],
    prevent: [
      'Keep secrets out of code regardless of format.',
      'Use allowlists for known false positives.',
      'Let Guardrails scan continuously.',
    ],
  },
  'sensitive-file': {
    id: 'sensitive-file',
    title: 'Sensitive file',
    what: {
      beginner: 'This file usually holds secrets (like a .env file), so it should stay private.',
      intermediate:
        'A sensitive file was detected by name/location; it commonly contains credentials.',
      professional:
        'A sensitive file was flagged; its contents should not be exposed to AI tools or committed.',
    },
    why: {
      beginner: 'These files often contain passwords and keys you don’t want shared.',
      intermediate: 'Such files are frequent sources of accidental leaks.',
      professional:
        'Exposure of these files is a common breach vector; keep them out of AI context and VCS.',
    },
    fix: [
      'Add the file to .gitignore so it is never committed.',
      'Provide a safe example (e.g. .env.example) without real values.',
      'Keep real secrets in the environment or a secrets manager.',
    ],
    prevent: [
      'Gitignore sensitive files from the start.',
      'Share example files, not real ones.',
      'Let Guardrails deny these files to AI tools by default.',
    ],
  },
};

// Aliases so `guardrails explain <term>` accepts friendly words.
const ALIASES: Record<string, SecretCategory> = {
  openai: 'api-key',
  anthropic: 'api-key',
  stripe: 'api-key',
  key: 'api-key',
  apikey: 'api-key',
  aws: 'cloud-credentials',
  gcp: 'cloud-credentials',
  google: 'cloud-credentials',
  azure: 'cloud-credentials',
  cloud: 'cloud-credentials',
  ssh: 'ssh-key',
  pem: 'private-key',
  privatekey: 'private-key',
  cert: 'certificate',
  github: 'token',
  gitlab: 'token',
  slack: 'token',
  bearer: 'token',
  jwt: 'jwt',
  database: 'connection-string',
  db: 'connection-string',
  postgres: 'connection-string',
  mysql: 'connection-string',
  mongo: 'connection-string',
  redis: 'connection-string',
  url: 'connection-string',
  password: 'password',
  passwd: 'password',
  secret: 'generic-secret',
  entropy: 'generic-secret',
  env: 'sensitive-file',
  dotenv: 'sensitive-file',
  file: 'sensitive-file',
  oauth: 'oauth',
  cookie: 'cookie',
};

/** The default, read-only catalog of explanations. */
export const defaultCatalog: ExplanationCatalog = {
  get(id: string): Explanation | undefined {
    return (CATALOG as Record<string, Explanation>)[id];
  },
  all(): readonly Explanation[] {
    return Object.values(CATALOG);
  },
};

/** Explain a finding using its category. Always returns something. */
export function explainFinding(finding: Finding): Explanation {
  return CATALOG[finding.category];
}

/** Resolve a free-text term (category, id, or alias) to an explanation. */
export function resolveExplanation(term: string): Explanation | undefined {
  const key = term.trim().toLowerCase();
  if (key in CATALOG) return CATALOG[key as SecretCategory];
  const aliased = ALIASES[key.replace(/[\s_-]/g, '')];
  return aliased ? CATALOG[aliased] : undefined;
}
