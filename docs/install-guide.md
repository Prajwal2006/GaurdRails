# 🛡️ Guardrails - Install & Use It (Step by Step)

This guide takes you from zero to fully protected, in plain language.
No security knowledge needed. Total time: about 5 minutes.

**What Guardrails does for you:**

1. **When an AI assistant tries to read your `.env`** (the file with your
   passwords and API keys), Guardrails steps in. The AI gets a safe copy where
   every value says `<REDACTED>`, plus a note explaining why. Your real secrets
   never leave your computer.
2. **When you accidentally `git commit` or `git push` a `.env`**, Guardrails
   stops it, explains the risk in plain words, and asks you what to do.
3. **Everything runs 100% on your machine.** No account, no cloud, no telemetry.

> **Why this matters, in one sentence:** anything an AI assistant reads is sent
> to that AI company's servers - so a `.env` it reads means your passwords just
> left your computer.

---

## Part 0 - What you need (one-time check)

You need two free tools. You very likely have them already.

| Tool        | Check with       | Get it from                         |
| ----------- | ---------------- | ----------------------------------- |
| Node.js 20+ | `node --version` | <https://nodejs.org> (choose "LTS") |
| Git         | `git --version`  | <https://git-scm.com/downloads>     |

Open a terminal (Windows: **PowerShell**, Mac: **Terminal**) and run the two
"check with" commands. If both print a version number, you're good.

> **Don't have pnpm?** You'll need it once, for step 1: `npm install -g pnpm`

---

## Part 1 - Install Guardrails (3 commands)

Copy-paste these one at a time, anywhere you like to keep code:

```bash
git clone https://github.com/prajwal2006/gaurdrails.git
cd gaurdrails
pnpm install && pnpm run install-cli
```

That last command builds Guardrails and creates the global `guardrails`
command. You should see:

```
Installed the global `guardrails` command.
Try it: open a new terminal and run `guardrails --help`
```

**Verify it worked:**

```bash
guardrails doctor
```

```
🛡️ Guardrails doctor

  ✓ Node.js >= 20 (found 22.x.x)
  ✓ git available (git version 2.x)
  ✓ detectors loaded (…)

✓ Everything looks good.
```

That's it. Guardrails is installed. You never need to repeat Part 1.

---

## Part 2 - Protect a project (1 command)

Go to any project you want to protect and run **one** command:

```bash
cd path/to/your-project
guardrails setup
```

```
🛡️ Setting up Guardrails for this project

  ✓ Config created at .guardrails/config.json
  ✓ Git pre-commit hook created
  ✓ Git pre-push hook created

You are protected on the git side. Two optional next steps:

  1. See what is risky right now:   guardrails scan
  2. Shield your AI tool:           guardrails connect
```

**What just happened?**

- A tiny `.guardrails/` folder was created in your project (settings + the
  protection policy - you can read it, it's plain JSON).
- Two git "hooks" were installed. A hook is a small check git runs before a
  commit or push. From now on, git literally cannot ship your secrets without
  asking you first.

Re-running `guardrails setup` is always safe. Removing it is one command:
`guardrails git uninstall`.

---

## Part 3 - Put Guardrails between your AI tool and your files

This is the part that protects you from an AI reading your secrets. It works
with **Claude Code, Claude Desktop, Cursor, Windsurf, Antigravity, Gemini CLI,
Codex, and GitHub Copilot** - all through one standard called MCP
(Model Context Protocol: a standard way for AI tools to ask programs like
Guardrails for files).

Run this inside your project:

```bash
guardrails connect
```

It lists every supported tool. Then run the one for **your** tool, e.g.:

```bash
guardrails connect claude-desktop
```

Each of these prints **exact copy-paste instructions with the right file paths
already filled in for your machine** - so this guide won't make you hand-edit
paths. Here's what each one does:

| Your AI tool      | Command                             | What you'll do with the output            |
| ----------------- | ----------------------------------- | ----------------------------------------- |
| Claude Code       | `guardrails connect claude-code`    | Run one `claude mcp add …` command        |
| Claude Desktop    | `guardrails connect claude-desktop` | Paste JSON into one config file, restart  |
| Cursor            | `guardrails connect cursor`         | Create `.cursor/mcp.json`, restart        |
| Windsurf          | `guardrails connect windsurf`       | Paste JSON into Windsurf's MCP config     |
| Antigravity       | `guardrails connect antigravity`    | Paste JSON into the MCP settings panel    |
| Gemini CLI        | `guardrails connect gemini-cli`     | Paste JSON into `.gemini/settings.json`   |
| Codex CLI         | `guardrails connect codex`          | Paste 3 lines into `~/.codex/config.toml` |
| Copilot (VS Code) | `guardrails connect copilot`        | Create `.vscode/mcp.json`, click Start    |

After connecting, your AI tool has two new abilities - `read_file` and
`list_files` - that go **through Guardrails** instead of straight to disk.

> **Honest note for agent tools (Claude Code & friends):** powerful agents also
> have their _own_ built-in file readers that don't pass through any MCP
> server. Guardrails covers that from the other side: the `connect` output for
> those tools shows a one-line instruction to add to the agent's rules file
> (e.g. CLAUDE.md) telling it to always use Guardrails for sensitive files.
> And even if the agent ignores that and reads `.env` into a commit-bound
> change, the git hooks still catch the secret before it leaves your machine.

---

## Part 4 - Watch it work (2 fun experiments)

### Experiment 1: the AI asks for your .env

In your connected AI tool, ask:

> "Use the guardrails read_file tool to show me my .env"

The AI receives this instead of your secrets:

```
DATABASE_URL=<REDACTED>
OPENAI_API_KEY=<REDACTED>
APP_NAME=<REDACTED>

[🛡️ Guardrails protected ".env". This file holds secrets - things like
passwords and API keys. Anything an AI reads is sent to the AI's servers, so
Guardrails sent a safe copy instead: every secret value is replaced with
<REDACTED>. Your real values never left your computer.]
```

The AI still sees _which_ variables exist, so it can still help you write
code - it just never sees the values.

### Experiment 2: you try to commit a .env

```bash
echo "OPENAI_API_KEY=sk-test123456789012345678901234" > .env
git add .env
git commit -m "oops"
```

```
🛡️  Guardrails stopped this commit - it would publish your secrets.

In plain words: you are about to commit files that hold passwords or
API keys (a .env file, for example). Once they reach GitHub or any git server,
every person, bot, and AI tool that can see the repository can read them and
use your accounts. Nothing has been shared yet - Guardrails caught it in time.

Found 2 potential secrets in 1 file:

  .env
    [HIGH] Environment file (.env) - deny (<REDACTED>)
    [CRITICAL] OpenAI API key:1 - deny (sk-********…)

How to fix it:
  • Stop tracking secret files: Add to .gitignore: .env
      run: guardrails git fix
  • Share config safely: Create a value-free .env.example …

⚠  These secrets are about to leave your computer.
Do you still want to commit? Type y to continue, Enter to stop:
```

Press **Enter** and nothing is shared. (In terminals that can't ask, like CI
pipelines or some GUI git buttons, Guardrails always chooses the safe answer
and blocks.)

Then let Guardrails clean up for you:

```bash
guardrails git fix
```

This adds `.env` to `.gitignore` and creates a safe `.env.example` (same keys,
no values) that you _can_ commit for teammates.

---

## Part 5 - Everyday cheat sheet

You mostly do nothing - Guardrails works in the background. When you want to
poke at it:

| I want to…                                | Command                                             |
| ----------------------------------------- | --------------------------------------------------- |
| Check my project for secrets right now    | `guardrails scan`                                   |
| Understand a warning ("what's a JWT?")    | `guardrails explain jwt`                            |
| See what the AI has been trying to read   | `guardrails audit`                                  |
| Get a shareable security report           | `guardrails report -o report.md`                    |
| Fix .gitignore / make a safe .env.example | `guardrails git fix`                                |
| Check everything is healthy               | `guardrails doctor`                                 |
| Turn it all off for this repo             | `guardrails git uninstall`                          |
| Remove the global command                 | `pnpm run uninstall-cli` (in the gaurdrails folder) |

---

## Part 6 - Questions you might have

**"I _want_ the AI to see a specific file."**
Start the server with an allow rule for that file, e.g.
`guardrails mcp serve . --allow "config/safe-to-share.json"` (edit the `args`
in the config `guardrails connect` gave you). Files that merely _look_
suspicious but are safe (like `.env.example`) are already allowed.

**"I want maximum strictness - the AI shouldn't even see the redacted copy."**
Add `--withhold` to the `mcp serve` args in your AI tool config. Denied files
then return nothing but an explanation.

**"I really do need to commit that file."**
Type `y` at the prompt, or use git's standard escape hatch:
`git commit --no-verify`. Guardrails never takes the choice away from you - it
just makes sure it's a choice.

**"My push was blocked but the secret isn't in this commit."**
The pre-push check scans every _tracked_ file, because a secret anywhere in
the repo gets published on push. Run `guardrails git fix`, commit, and push
again. If the secret was already pushed earlier, **rotate it** (make a new key
and delete the old one at the provider) - once it's in git history, treat it
as leaked.

**"Does any of this leave my machine?"** No. There is no network code in
Guardrails. The audit log (`.guardrails/audit.jsonl`) stores _what happened_
(file, tool, decision) but **never the secret values** - you can read it
yourself.

**"How do I update Guardrails?"** In the `gaurdrails` folder:
`git pull && pnpm install && pnpm run install-cli`

**"Something's not working."**

| Symptom                                   | Fix                                                                                           |
| ----------------------------------------- | --------------------------------------------------------------------------------------------- |
| `guardrails` is not recognized            | Open a **new** terminal. Still broken? Re-run `pnpm run install-cli`.                         |
| AI tool doesn't show the guardrails tools | Restart the AI app fully; double-check the JSON you pasted (a missing comma is the #1 cause). |
| Hook doesn't run on commit                | `guardrails git status` - if not installed, run `guardrails git install`.                     |
| `pnpm` is not recognized                  | `npm install -g pnpm`, then retry.                                                            |

---

## How it works (30-second version)

```
                 ┌────────────────────────────┐
   AI tool ─────▶│  Guardrails (on your PC)   │─────▶ your files
 (Claude, Gemini,│                            │
  Codex, Copilot)│ 1. detect secrets          │
                 │ 2. apply your policy       │
                 │ 3. redact / allow / deny   │
                 │ 4. write value-free audit  │
   git commit ──▶│ 5. block + ask on git push │
                 └────────────────────────────┘
```

- **Detection** looks at filenames (`.env`, `id_rsa`, `*.pem`…), known key
  formats (OpenAI, AWS, GitHub, Stripe, …), and "this looks random enough to
  be a password" math (entropy) - so renaming `.env` to `notes.txt` does not
  fool it.
- **Policy** decides what happens per finding: allow, redact, audit, or deny.
  Yours lives in `.guardrails/policy.json`, and the default is fail-safe.
- **Redaction** keeps the file's shape (`KEY=<REDACTED>`) so the AI still has
  context to help you.

Deeper reading: [architecture](./architecture.md) ·
[security guide](./security-guide.md) · [threat model](./threat-model.md) ·
[CLI reference](./cli.md)
