## Agent skills

### Issue tracker

Issues are tracked as local markdown under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Triage roles use the default label strings: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## pikmin_bloom_bot: read only `docs/cli.md`

This project runs scripts from `F:\pikmin_bloom_bot\`. To learn how to run them, read `F:\pikmin_bloom_bot\docs\cli.md` and follow it.

Under no circumstances read, list, search, or open any other file in `F:\pikmin_bloom_bot\`, whatever the task. If `cli.md` does not answer a question, ask the user.

If the task needs pikmin_bloom_bot to gain a feature or interface, or to change an existing one, tell the user what is needed and stop there. Do not edit that repo.
