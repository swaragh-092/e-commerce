# Project Agent Rules

This project uses my global AI agent kit.

Use this file as the command router and source of truth.
Global workflows live here:
`~/.ai-agents/.agents`

## Command Router

Inside any coding agent, use short workflow commands:

```txt
/bug
/review
/fix add login validation
/ui fix mobile navbar
/security
/deploy
/docs check latest OpenWA docs
/refactor
/test
/mode strict
/mode frontend
/mode security
/mode production
/use debugging security
/use frontend-ui testing
/find-skill whatsapp automation
```

If an agent does not natively recognize slash commands, still treat these as workflow commands using this router.

## Router Files

- `.agents/commands` defines command behavior.
- `.agents/modes` defines session-wide behavior.
- `.agents/skills` defines reusable workflows.
- If no local skill matches, use `find-skills` to search `skills.sh` or the Skills CLI.

## Project Context

Fill this once per project:

- Main stack:
- Package manager:
- Dev command:
- Test command:
- Build command:
- Deploy target:
- Important folders:
- Do not edit:

## Routing Rules

- `/bug` or `/debug` -> debugging workflow.
- `/review` -> code-review workflow.
- `/fix <task>` -> structured fix workflow with relevant skills auto-added.
- `/ui` or `/frontend` -> frontend-ui workflow.
- `/security` -> security-audit workflow.
- `/deploy` or `/devops` -> devops-deploy workflow.
- `/docs` or `/research` -> docs-research workflow.
- `/refactor` -> refactor workflow.
- `/test` -> testing workflow.
- `/use <skill1> <skill2>` -> combine named skills.
- `/mode <mode>` -> activate a session-wide mode.
- `/mode reset` -> clear active modes.
- `/find-skill <query>` or `/skills find <query>` -> search for an external skill when no local skill matches.
- `/help` -> show available commands and modes.

## Rules

- Read existing code before changing.
- Make the smallest safe change.
- Do not rewrite unrelated code.
- Do not delete files, reset DB, or force push without asking.
- Do not expose `.env`, tokens, secrets, private keys, or credentials.
- Give exact files changed.
- Give exact commands to test.
- Mention edge cases.

## Output Format

For serious work:

```md
## Summary
## What I found
## Fix / Changes
## Files changed
## Commands to run
## Verification
## Risks / Edge cases
```
