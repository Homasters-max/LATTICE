# Spec Delta

## ADDED Requirements

### Requirement: The acts port and its contract
<!-- id: REQ-AC-001 -->

Identity and acts SHALL reach apply only through the `acts` port (LG-A04): `actsOn(hash)` answers the acts an adapter
knows of for the proposal of that hash. An act is `{login, names, ref}`: `login` the login that made it, `names` what
it names — the hash of a proposal, or `id`s of intents (CT-A05) —, `ref` where it was read (the URL of a comment or a
review, LG-A05). A name holding `/` is an intent `id`; any other name is a proposal hash.

Every adapter of the port SHALL answer, for every hash: a list of acts, each with a non-empty string `login`, a non-empty
list `names` of non-empty strings and a non-empty string `ref`; the list and its acts deeply frozen; the same list,
by content, on every call with the same hash; and never an act whose names are all hashes other than the asked one.
Whether an act confirms an intent of the proposal is decided by apply (REQ-LG-003), which knows the intents.

The adapters are `init`, `fixture`, `recorded` and `github` (LG-A04), each in its own folder
`src/adapters/acts-<name>/`. One contract test (ST-T01) SHALL run the rules above against all four, each set up on
the same case: a proposal hash `H`, another hash `K`, the owner `Homasters-max`, and acts of `Homasters-max` naming `H`,
naming `K`, and naming the intent `lattice/fx-a01`, in the form each adapter reads them.

Implements: LG-A04, CT-A05, ST-T01

#### Scenario: Every adapter keeps the contract
<!-- id: SCN-AC-001 -->
- **WHEN** the contract test asks each of the four adapters, set up on the case above, for `H`, for `K` and for a third
  hash `J`, each twice
- **THEN** every answer is a deeply frozen list of acts of the form above, equal by content on both calls; no answer for
  `H` holds the act naming only `K`; no answer for `J` holds an act naming only `H` or only `K`; the answer of every
  adapter for `H` holds at least one act naming `H`

### Requirement: The init adapter gives the owner's act of store init
<!-- id: REQ-AC-002 -->

`initActs(owner)` SHALL answer, for every hash `h`, exactly one act `{"login": owner, "names": [h], "ref":
"store/lattice.json"}`: the owner of the init configuration acts on each proposal of store init (CT-N05, LG-G04), and
the commit names the init configuration as the place of the act. Only store init (REQ-CL-002) uses this adapter.

Implements: LG-A04, CT-N05

#### Scenario: The init adapter answers the owner
<!-- id: SCN-AC-002 -->
- **WHEN** `initActs("Homasters-max")` is asked for `H` and for `K`
- **THEN** it answers `[{"login":"Homasters-max","names":["H"],"ref":"store/lattice.json"}]` and the same with `K`

### Requirement: The fixture adapter answers acts written in a test
<!-- id: REQ-AC-003 -->

`fixtureActs(acts)` SHALL answer, for a hash `h`, the given acts whose `names` include `h` or an intent `id`, in the
given order. It is the adapter of tests (LG-A04); an act outside the form of REQ-AC-001 is refused when the adapter is
built, with an error naming its position.

Implements: LG-A04

#### Scenario: Fixture acts by hash and by intent
<!-- id: SCN-AC-003 -->
- **WHEN** `fixtureActs` is built from the acts `a` naming `H`, `b` naming `K` and `c` naming `lattice/fx-a01`, and
  asked for `H` and for `K`; then built from a list holding an act with `names` `[]`
- **THEN** it answers `[a, c]` and `[b, c]`; the last build throws an error naming position 0

### Requirement: The recorded adapter reads the act records of stored commits
<!-- id: REQ-AC-004 -->

`recordedActs(commits)` SHALL be built from the texts of stored commits (REQ-LG-003) and answer, for a hash `h`, the
acts of the act record (`acts`) of every commit whose `proposal` is `h`, in ledger order; a commit without `acts`, or a
text that is not a JSON object, contributes nothing. It never calls GitHub or any other service: re-applying a commit
(LG-P05 (2)), opening a store and rebuilding projections read acts through it (LG-A05).

Re-applying the intents of a commit to the ledger before it, with the acts this adapter answers for the commit's
`proposal`, SHALL give that commit again, byte for byte.

Implements: LG-A05, LG-A04

#### Scenario: A commit re-applied with its recorded acts gives the same bytes
<!-- id: SCN-AC-004 -->
- **WHEN** the four commits of store init (SCN-LG-011) are given to `recordedActs`, which is asked for the `proposal` of
  commit 3 and for the `proposal` of commit 1; and the intents of each of commits 2, 3 and 4 — an entity intent with
  `base` `rev` − 1 per entity record, an event intent per event record — are applied to the ledger of the commits
  before it with the acts `recordedActs` answers for its `proposal`
- **THEN** the first answer is the act record of commit 3, `[{"login":"Homasters-max","names":[<its proposal>],"ref":"store/lattice.json"}]`;
  the second is empty; each re-apply gives the commit text it started from

### Requirement: The github adapter reads acts from a pull request
<!-- id: REQ-AC-005 -->

`githubActs({repo, pr, logins, transport})` SHALL read the acts of pull request `pr` of repository `repo` (`owner/name`)
— the way WARRANT accepts the decisions on UNKNOWNs (CT-A03): `transport(path)` answers the parsed JSON of a GET of the
GitHub REST API at `path`, or throws. On its first call the adapter reads, page by page from page 1 until a page holds
fewer than 100 items, `/repos/<repo>/issues/<pr>/comments?per_page=100&page=<n>` and
`/repos/<repo>/pulls/<pr>/reviews?per_page=100&page=<n>`, and keeps what it read: the acts are checked once (LG-A05).

An issue comment or a review is an act when, all of:
- its author `user.login` equals one of `logins` (code units) — the writers listed by name (CT-A05, REQ-CT-001);
- it belongs to `pr`: a comment's `issue_url` ends with `/issues/<pr>`, a review's `pull_request_url` with
  `/pulls/<pr>`;
- its text `body` names something: for the asked hash `h`, `h` when the body holds it with no letter or digit right
  before or after it; and every identifier of the kernel grammar (REQ-KR-012) the body holds as a whole token, without
  a trailing `.`.

The act is `{"login": <author>, "names": <what it names, the hash first, then the identifiers in order of first
appearance, each once>, "ref": <its html_url>}`; the answer lists the acts in order of `ref` (UTF-16 code units). An
item without a string `body`, `html_url` or author login is skipped. A failing `transport` throws from `actsOn`; the
caller refuses the command. In CI and in tests the transport answers recorded JSON; the network is never called there
(LG-R03).

Implements: CT-A03, CT-A05, LG-A04, LG-A05

#### Scenario: Comments and reviews become acts by author, text and pull request
<!-- id: SCN-AC-005 -->
- **WHEN** `githubActs` with `repo` `Homasters-max/LATTICE`, `pr` 7 and `logins` `["Homasters-max"]` is asked for `H`
  over a recorded transport whose comments are: by `Homasters-max` on `/issues/7` with the body `act H` (`ref` `c1`);
  by `homasters` on `/issues/7` with the body `act H` (`c2`); by `Homasters-max` on `/issues/8` with the body `act H`
  (`c3`); by `Homasters-max` on `/issues/7` with the body `ok lattice/fx-a01.` (`c4`); by `Homasters-max` on `/issues/7`
  with the body `xH` (`c5`) — and whose one review, by `Homasters-max` on `/pulls/7`, has the body `H, lattice/fx-a02`
  (`r1`); then a transport whose first comments page holds 100 comments and whose second holds one; then a transport
  that throws
- **THEN** the first answer is, in order of `ref`, `{"login":"Homasters-max","names":["H"],"ref":"c1"}`,
  `{"login":"Homasters-max","names":["lattice/fx-a01"],"ref":"c4"}`, `{"login":"Homasters-max","names":["H","lattice/fx-a02"],"ref":"r1"}`;
  the second adapter reads both pages and a second call reads nothing more; the third throws
