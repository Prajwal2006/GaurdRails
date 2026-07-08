# 🛡️ Guardrails - Install & Use It (Step by Step)

This guide takes you from zero to fully protected, in plain language.
No security knowledge needed. Total time: about 5 minutes.

**What Guardrails does for you:**

1. **One command shields every AI tool on your computer.** `guardrails setup`
   finds Claude Code, Cursor, Windsurf, Gemini, Codex, Copilot, and friends, and
   writes each one's secret-protection _for you_ - no config files to edit. Many
   of them get their file reader **blocked** from your `.env` and keys outright.
2. **When an AI assistant tries to read your `.env`** (the file with your
   passwords and API keys), Guardrails steps in. The AI gets a safe copy where
   every value says `<REDACTED>`, plus a note explaining why - or is blocked
   entirely. Your real secrets never leave your computer.
3. **When you accidentally `git commit` or `git push` a `.env`**, Guardrails
   stops it, explains the risk in plain words, and asks you what to do.
4. **Everything runs 100% on your machine.** No account, no cloud, no telemetry.

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

Found 3 AI tools on this computer. Shielding:

  ✓ Claude Code               [secret files: reading blocked]
      • .claude/settings.json - hard deny rules: its Read tool is blocked for secret files
      • .mcp.json - Guardrails MCP server registered (redacted reads for secret files)
      • CLAUDE.md - standing instructions: hands off secrets, use Guardrails
  ✓ Cursor                    [secret files: reading blocked]
      • .cursorignore - Cursor cannot read the listed secret files
      • .cursor/mcp.json - Guardrails MCP server registered (redacted reads for secret files)
  ✓ Claude Desktop            [reads files only through Guardrails]
      • claude_desktop_config.json - Guardrails MCP server registered (redacted reads for secret files)
      → Fully quit and reopen Claude Desktop once.

Done. Restart your AI tools once so they pick up the new config.
```

**What just happened?** In one command Guardrails:

- Created a tiny `.guardrails/` folder in your project (settings + the
  protection policy - you can read it, it's plain JSON).
- Installed two git "hooks" - small checks git runs before a commit or push. From
  now on, git literally cannot ship your secrets without asking you first.
- **Found every AI coding tool on your computer and wrote the strongest
  secret-protection each one supports - for you.** No JSON editing. For Claude
  Code and Cursor that means its file reader is _blocked_ from your `.env` and
  keys; for others it means every read comes back with `<REDACTED>` values.

Re-running `guardrails setup` is always safe (it only updates its own blocks).
Removing the git side is one command: `guardrails git uninstall`.

> **Restart your AI tools once** after setup so they load the new config.

---

## Part 3 - How your secrets are actually protected

This is the important part, so here is exactly what happened per tool - because
a polite note in a config file is _not_ protection. An AI tool can reach a file
two ways: through Guardrails (redacted) or through its **own built-in file
reader** (straight to disk). `guardrails setup` shuts the second door wherever a
tool lets it:

| Your AI tool      | What setup wrote for you                                       | Result                        |
| ----------------- | -------------------------------------------------------------- | ----------------------------- |
| Claude Code       | Hard `deny` rules in `.claude/settings.json` + MCP + CLAUDE.md | Its reader is **blocked**     |
| Cursor            | `.cursorignore` + `.cursor/mcp.json`                           | **Blocked** from secret files |
| Windsurf          | `.codeiumignore` + MCP config                                  | **Blocked** from secret files |
| Gemini CLI        | `.geminiignore` + `.gemini/settings.json`                      | **Blocked** from secret files |
| Claude Desktop    | Registered in `claude_desktop_config.json`                     | Reads come back **redacted**  |
| Codex CLI         | `~/.codex/config.toml` + AGENTS.md instruction                 | Redacted + instructed         |
| Copilot (VS Code) | `.vscode/mcp.json` + copilot-instructions.md                   | Redacted + instructed         |
| Antigravity       | AGENTS.md + a one-time manual step it prints                   | Instructed (see the note)     |

For the last three there is no hard "don't read this" switch the tool exposes to
config yet, so Guardrails is honest: it registers the redacting MCP server, adds
a standing instruction, and **the git hooks are the backstop** - even if such a
tool reads a secret, it can't get committed off your machine. `setup` prints a
`→` manual step for any tool that needs one (e.g. Copilot's repo-level content
exclusion for a hard block).

**Installed a new AI tool later?** Just run `guardrails setup` again - it shields
the newcomer and leaves everything else untouched. You don't even have to
remember: the next time you commit, Guardrails notices the new tool and reminds
you.

### The rare manual case: `guardrails connect`

If a tool keeps its config somewhere unusual, or you want to see the exact
snippet, `guardrails connect <tool>` prints ready-to-paste MCP config with your
machine's paths already filled in:

```bash
guardrails connect                # list supported tools
guardrails connect claude-desktop # copy-paste config for one tool
```

You normally won't need this - `guardrails setup` already did it.

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
