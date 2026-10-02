# Spec Delta

## MODIFIED Requirements

### Requirement: Every rejection rule of apply has a fixture
<!-- id: REQ-AR-011 -->

The rule IDs that apply can name in a rejection SHALL form one closed list, exported by the ledger module; a rejection
naming a rule outside the list cannot be built. For every rule ID of the list there SHALL be a fixture folder
`test/fixtures/rules/<RULE-ID>/` holding `ledger.jsonl` (a whole ledger from its first commit, possibly empty),
`proposal.json` (a proposal), `expected.json` (the expected rejections without their `message`) and, only where the
rule needs it, `moved.jsonl` (the commits another writer appends after `ledger.jsonl` was opened, REQ-LG-004). A test
reads the proposal and applies it to the ledger of `ledger.jsonl` (REQ-LG-001, REQ-LG-003); when apply answers a
commit, it checks that commit against the tail of `ledger.jsonl` followed by `moved.jsonl` (REQ-LG-004). It SHALL get
exactly the expected rejections, compared on every field but `message`, every one naming the rule ID of its folder,
every `message` non-empty. A rule ID of the list without a fixture folder, and a fixture folder whose name is not on
the list, SHALL fail the test, naming the rule ID or the folder. The list itself is not enumerated here: each rule is
defined by the requirement that names it, and a Change that adds a rule adds its fixture.

Implements: LG-A02, ST-A01

#### Scenario: Each rule of apply is triggered by its fixture
<!-- id: SCN-AR-017 -->
- **WHEN** the rule test runs on the project, then on a declared list holding a rule ID that has no fixture folder,
  then with a fixture folder whose name is not on the declared list
- **THEN** on the project every rule ID of the declared list has exactly one folder and every folder names a declared
  rule ID, every fixture gives exactly its expected rejections, each naming the rule of its folder; the missing folder
  is reported with its rule ID; the extra folder is reported with its name
