import type {
  DetectionContext,
  Detector,
  Finding,
  SecretCategory,
  Severity,
} from '@guardrails/shared';

interface FilenameRule {
  readonly id: string;
  readonly title: string;
  readonly category: SecretCategory;
  readonly severity: Severity;
  readonly explanationId: string;
  /** Given the basename and the normalized (forward-slash) path, does it match? */
  readonly test: (basename: string, path: string) => boolean;
}

/** Example/sample/template files are safe to expose - never flag them. */
export function isExampleFile(basename: string): boolean {
  return /(?:^|[._-])(?:example|sample|template|dist|tmpl|placeholder)(?:\.[^.]+)?$/i.test(
    basename,
  );
}

const rules: readonly FilenameRule[] = [
  {
    id: 'dotenv',
    title: 'Environment file (.env)',
    category: 'sensitive-file',
    severity: 'high',
    explanationId: 'dotenv-file',
    test: (basename) => /^\.env(?:\.[A-Za-z0-9_-]+)?$/.test(basename),
  },
  {
    id: 'ssh-key',
    title: 'SSH private key file',
    category: 'ssh-key',
    severity: 'high',
    explanationId: 'ssh-key',
    test: (basename, path) =>
      /^id_(?:rsa|dsa|ecdsa|ed25519)$/.test(basename) ||
      (/(?:^|\/)\.ssh\//.test(path) &&
        !basename.endsWith('.pub') &&
        basename !== 'known_hosts' &&
        basename !== 'config'),
  },
  {
    id: 'key-file',
    title: 'Private key or certificate file',
    category: 'private-key',
    severity: 'high',
    explanationId: 'private-key',
    test: (basename) => /\.(?:pem|key|pkcs12|p12|pfx|keystore|jks|ppk|asc)$/i.test(basename),
  },
  {
    id: 'aws-credentials',
    title: 'AWS credentials file',
    category: 'cloud-credentials',
    severity: 'high',
    explanationId: 'aws-credentials',
    test: (_basename, path) => /(?:^|\/)\.aws\/credentials$/.test(path),
  },
  {
    id: 'gcp-credentials',
    title: 'Google Cloud credentials file',
    category: 'cloud-credentials',
    severity: 'high',
    explanationId: 'gcp-credentials',
    test: (basename, path) =>
      /(?:^|\/)\.config\/gcloud\/.*\.json$/.test(path) ||
      basename === 'application_default_credentials.json',
  },
  {
    id: 'service-account',
    title: 'Service account key file',
    category: 'cloud-credentials',
    severity: 'high',
    explanationId: 'service-account',
    test: (basename) =>
      /(?:service[-_]?account|serviceaccount|firebase[-_]?admin(?:sdk)?).*\.json$/i.test(basename),
  },
  {
    id: 'kubeconfig',
    title: 'Kubernetes config',
    category: 'cloud-credentials',
    severity: 'high',
    explanationId: 'kubeconfig',
    test: (basename, path) => basename === 'kubeconfig' || /(?:^|\/)\.kube\/config$/.test(path),
  },
  {
    id: 'tfvars',
    title: 'Terraform variables file',
    category: 'sensitive-file',
    severity: 'medium',
    explanationId: 'tfvars',
    test: (basename) => /\.tfvars(?:\.json)?$/.test(basename),
  },
  {
    id: 'npmrc',
    title: 'npm configuration (.npmrc)',
    category: 'sensitive-file',
    severity: 'medium',
    explanationId: 'npmrc',
    test: (basename) => basename === '.npmrc',
  },
  {
    id: 'netrc',
    title: 'Credentials file (.netrc / .pgpass)',
    category: 'password',
    severity: 'high',
    explanationId: 'netrc',
    test: (basename) => basename === '.netrc' || basename === '.pgpass',
  },
  {
    id: 'htpasswd',
    title: 'Apache htpasswd file',
    category: 'password',
    severity: 'medium',
    explanationId: 'htpasswd',
    test: (basename) => basename === '.htpasswd',
  },
  {
    id: 'docker-config',
    title: 'Docker registry credentials',
    category: 'sensitive-file',
    severity: 'medium',
    explanationId: 'docker-config',
    test: (basename, path) =>
      basename === '.dockercfg' || /(?:^|\/)\.docker\/config\.json$/.test(path),
  },
  {
    id: 'secrets-file',
    title: 'Secrets file',
    category: 'sensitive-file',
    severity: 'medium',
    explanationId: 'secrets-file',
    test: (basename) => /^secrets?\.(?:ya?ml|json|toml|env)$/i.test(basename),
  },
  {
    id: 'gpg-key',
    title: 'GPG/PGP key file',
    category: 'private-key',
    severity: 'medium',
    explanationId: 'gpg',
    test: (basename) => basename === 'secring.gpg' || /\.(?:gpg|pgp)$/i.test(basename),
  },
];

/**
 * File-level detector: flags a file as sensitive based on its name, extension,
 * or location, independent of its content. Returns at most one finding per file
 * (the first matching rule).
 */
export const filenameDetector: Detector = {
  id: 'filename',
  title: 'Sensitive file',
  kind: 'filename',
  description: 'Flags files that are sensitive by name, extension, or location.',
  detect(ctx: DetectionContext): Finding[] {
    const path = ctx.path;
    if (path === undefined || path.length === 0) return [];
    const normalized = path.replace(/\\/g, '/');
    const basename = normalized.split('/').pop() ?? normalized;
    if (isExampleFile(basename)) return [];

    for (const matched of rules) {
      if (matched.test(basename, normalized)) {
        return [
          ctx.finding({
            detectorId: `filename:${matched.id}`,
            detectorKind: 'filename',
            title: matched.title,
            category: matched.category,
            severity: matched.severity,
            confidence: 'high',
            explanationId: matched.explanationId,
          }),
        ];
      }
    }
    return [];
  },
};
