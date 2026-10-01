# Tasks

## 0. Precondition

- [ ] 0.1 The docs PR #63 (`docs/sw-milestone`: SL-T07…SL-T09, the launch record) is merged before this spec-PR is
  marked `SPECIFIED` (design, Context); verified by `gh pr view 63 --json state` = `MERGED`

## 1. Policy paths and generated files

- [ ] 1.1 The maintainer's patch (design D-2…D-5), applied with `git apply --index`: `.github/workflows/test.yml`,
  `.warrant/local/openspec/rules.json`, `.warrant/local/rules/{env,maintainer-acts,process,tracking}.json`,
  `.warrant/local/areas.json`; verified by `git apply --check` on the patch and `git diff --cached --name-only` naming
  exactly these seven paths
- [ ] 1.2 `warrant sync` (design D-1 p. 3): `openspec/config.yaml`, `AGENTS.md`, `.warrant/warrant.lock.json`; verified
  by `warrant validate` and `warrant sync --check` green, `config.yaml` carrying `Language: English`, `AGENTS.md`
  carrying the four English rule texts of the design Appendix

## 2. Process test

- [ ] 2.1 `test/process/baseline.test.ts` (design D-6): the form of `test.yml` (triggers, `contents: read`, Node 22,
  steps), the language context, the AREA map, all tests inside `describe()`; verified by
  `warrant check infra-baseline tests-passed` `PROVEN` and `npm run typecheck` green

## 3. Verification

- [ ] 3.1 `warrant verify infra-baseline`; verified by a successful exit
- [ ] 3.2 After push of the impl-PR — the check `test / test` on it is green (design D-1 p. 5); verified by
  `gh pr checks <impl-PR>`
- [ ] 3.3 The body of the impl-PR carries `Closes #28`; verified by `gh pr view <impl-PR> --json body`
