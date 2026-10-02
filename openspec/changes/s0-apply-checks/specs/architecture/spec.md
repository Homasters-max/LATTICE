# Spec Delta

## MODIFIED Requirements

### Requirement: Every rejection rule of apply has a fixture
<!-- id: REQ-AR-011 -->

The rule IDs that apply can name in a rejection SHALL form one closed list — the list of REQ-LG-002 —, exported by the
ledger module; a rejection naming a rule outside the list cannot be built. For every rule ID of the list there SHALL be
a fixture folder `test/fixtures/rules/<RULE-ID>/` holding `ledger.jsonl` (a whole ledger from its first commit,
possibly empty), `proposal.json` (a proposal), `expected.json` (the expected rejections without their `message`, at
least one) and, only where the rule needs it, `moved.jsonl` (the commits another writer appends after `ledger.jsonl`
was opened, REQ-LG-004). `ledger.jsonl`, and `ledger.jsonl` followed by `moved.jsonl`, SHALL each open as a ledger
(REQ-CL-004, **Opening**); a fixture whose ledger does not open fails the test, naming the folder.

A test reads the proposal (REQ-LG-001) and applies it to the ledger of `ledger.jsonl` (REQ-LG-003); when apply answers
a commit, it checks that commit against the ledger of `ledger.jsonl` followed by `moved.jsonl`, or of `ledger.jsonl`
alone when there is no `moved.jsonl` (REQ-LG-004). It SHALL get exactly the expected rejections, compared on every
field but `message`, every one naming the rule ID of its folder, every `message` non-empty. A rule ID of the list
without a fixture folder, and a fixture folder whose name is not on the list, SHALL fail the test, naming the rule ID
or the folder.

Implements: LG-A02, ST-A01

#### Scenario: Each rule of apply is triggered by its fixture
<!-- id: SCN-AR-017 -->
- **WHEN** the rule test runs on the project, then on a declared list holding a rule ID that has no fixture folder,
  then with a fixture folder whose name is not on the declared list, then on a copy of the folder `LG-P02` whose
  `expected.json` is `[]`, then on that copy with the original `expected.json` and a `ledger.jsonl` that does not open
- **THEN** on the project every rule ID of the declared list has exactly one folder and every folder names a declared
  rule ID, every fixture gives exactly its expected rejections, each naming the rule of its folder; the missing folder
  is reported with its rule ID; the extra folder is reported with its name; both copies fail, naming the folder
