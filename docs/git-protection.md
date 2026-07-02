# Git protection

Guardrails can stop secrets before they ever leave your machine by installing
git hooks that scan what you commit and push.

## Install

```bash
guardrails git install          # adds pre-commit and pre-push hooks
guardrails git install --force  # back up and replace foreign hooks
guardrails git uninstall        # remove them (restores any backup)
```

Installation is **idempotent** and **reversible**. If you already have a hook
that Guardrails didn't write, it is left untouched unless you pass `--force`, in
which case it is backed up to `<hook>.pre-guardrails` and restored on uninstall.

## What the hooks do

- **pre-commit** runs `guardrails git verify --staged`, scanning the _staged
  content_ (exactly what would be committed).
- **pre-push** runs `guardrails git verify`, scanning the working tree.

If a real secret is found the operation is blocked with a friendly explanation:

```
🛡️ Hold on — we paused this to keep you safe.

We found something that looks like a secret in what you're about to share.
That's easy to do by accident, so nothing has left your machine yet.

  .env
    [CRITICAL] OpenAI API key:1  blocked
        sk-********…

Why this matters
  If someone else gets this key, they can use that service and you'll get the bill …

How to fix it
  → Move the key into an environment variable …
```

## Fixing and overriding

```bash
guardrails git verify --staged --fix   # add flagged sensitive files to .gitignore
```

To bypass a hook once (not recommended), use git's standard flag:

```bash
git commit --no-verify
```

## Manual invocation

`guardrails git verify` works outside the hooks too — handy in CI:

```bash
guardrails git verify            # scan the working tree; non-zero exit if blocked
guardrails git verify --staged   # scan the index
```
