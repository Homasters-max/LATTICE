# Tasks

## 1. Judge, scripts, rule

- [ ] 1.1 The maintainer's patch (design D-2): `.github/workflows/warrant.yml` — `@v0.10.1`, `warrant: v0.10.1`;
  `.claude/skills/slice/{act-rules.mjs,act-rules.test.mjs,act.mjs,judge.mjs,SKILL.md,change.md}`;
  `.warrant/local/rules/process.json`; check — the patch commit names exactly these paths, the workflow diff is two
  lines, the rule diff one `text` line
- [ ] 1.2 `warrant sync` with CLI `0.10.1` (design D-1 p. 3): lock kernel `0.10.1`,
  `.warrant/schemas/waiver.1.schema.json`, `AGENTS.md`; check — `warrant validate` and `warrant sync --check` green,
  `AGENTS.md` carries the rework sentence of rule `process`

## 2. Tests and the guard

- [ ] 2.1 Tests (design D-4): check — `warrant check pin-v0-10-1 tests-passed` `PROVEN`, `npm run typecheck` green,
  `node --test .claude/skills/slice/*.test.mjs` green
- [x] 2.2 The guard probe (design D-5): check — both writes denied, no file created; the deny reasons in an `I-N` row

## 3. Check

- [ ] 3.1 `warrant verify pin-v0-10-1`; check — succeeds
- [ ] 3.2 After the `VERIFYING` commit, before the push — `node .claude/skills/slice/judge.mjs`; check — no violation of
  the PR
