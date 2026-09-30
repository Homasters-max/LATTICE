# 04. Catalog

## Purpose

Who may change what: namespaces, owners, participants, sessions, owner acts, several projects.

## Namespaces

| ID | Rule |
|---|---|
| CT-N01 | A namespace is an entity with an owner and a policy; it is the `id` prefix (`namespace/slug`). |
| CT-N02 | A project store holds `core` (genesis), `std` (data package of the LATTICE version) and one or more project namespaces. Only project namespaces are writable by proposals; `core` changes only with a new kernel version (LG-G03), `std` only through `upgrade` (LG-G02). |
| CT-N03 | Namespace policy is minimal: `owner` (a human participant), `writers` (who may author intents — by participant or by kind), `owner_acts` (which intent kinds require an owner act, CT-A02). This is the only place that says which writes need an owner act; types never do (OM-T02). Precision targets, thresholds and the like are data of decision points, not policy. |
| CT-N04 | In v1 ownership exists only at namespace level. The owner of a decision point, bench set or type is the owner of its namespace. A different owner means a separate namespace. |
| CT-N05 | The project namespace is created by store init: after genesis (LG-G01) and `std` (LG-G02), the third commit creates it with the owner from the init configuration (LG-G04). The owner reaches apply through the `init` adapter of the `acts` port (LG-A04), so this is an ordinary owner act, not an exception to CT-A03. Afterwards ownership moves only by an owner act (CT-A02). |
| CT-N06 | Policy and owner are read as they stood at the `seq` of the record being judged. A later change of policy never changes what an earlier record needed or whether it is in force (TR-I01). |

## Participants and sessions

| ID | Rule |
|---|---|
| CT-P01 | `by` is a session. The host opens it and records it as an event: participant, participant kind, software and version, `purpose` (the closed list in TR-B02), and how the kind was established (CT-P03). |
| CT-P02 | Participant kinds: `human`, `agent` (LLM), `machine` (deterministic code). Kind and purpose set the basis of a record by the table in TR-B02. |
| CT-P03 | In `knowledge` the proposal carries the session event, and the host declares the participant kind. The PR login cannot tell a human from an agent — an agent opens the PR under the human's login — so a declared `human` holds only when confirmed by an act (CT-A05); an unconfirmed `human` counts as `agent`. `machine` sessions are those opened by LATTICE itself: service commands and runs (PL-E02). |
| CT-P04 | Identity in `knowledge` is the GitHub login of the PR author and of the owner acting in the PR, verified by CI. Identity in `runtime` is local and unverified; `runtime` records gain weight only through `knowledge` (LG-R04). |
| CT-P05 | A `machine` participant is a program name without a version. A new version of the program is a new session of the same participant, never a new voice (TR-V02). |

## Owner acts

| ID | Rule |
|---|---|
| CT-A01 | An intent that needs the owner is marked `act: owner`. The agent may prepare it; only the owner's act makes it. |
| CT-A02 | Default `owner_acts`: write or revoke the status facts reserved for the owner — `retired`, `alias`, `live`, `calibration`, `dismissed` (TR-F06); new revision of a bench set (DP-C05); new revision of a type or of a project capability (PL-C03); change `setup` (PL-A01); an `upgrade` of `std` (LG-G02); change namespace policy or transfer ownership. A transfer takes two acts in the same PR: the old owner proposes, the new owner accepts. An ordinary block write needs no owner act. |
| CT-A03 | An owner act is an issue comment or review in the PR, by the owner's login, naming the intent id — the same way WARRANT accepts UNKNOWN decisions. The `github` adapter of the `acts` port (LG-A04) checks author, text and PR number once, at admission; the comment URL is written into the commit (LG-A05). This works even when the PR author and the owner are the same person (a GitHub approval of one's own PR is impossible). |
| CT-A04 | A `runtime` record cited in a calibration or bench proposal (LG-R04) gains weight only when the owner has acted on that proposal (CT-A03). |
| CT-A05 | A human confirms authorship of intents the same way as CT-A03: a comment or review in the PR, by a login listed in `writers`, naming the intent ids. The session's `human` kind then holds for those intents. An owner act is a special case of it. |

## Several projects

| ID | Rule |
|---|---|
| CT-M01 | In v1 the stores of different projects (LG-S03: each a pair `knowledge` + `runtime`) are independent; only `core` and `std` are shared. There are no references across projects; inside a project `runtime` references `knowledge` (LG-S04). |
| CT-M02 | Knowledge of another project enters through a source adapter: imported into own blocks with basis `derived` and a reference to the source (commit and path in that project). |
| CT-M03 | References across projects are a question after the first slice (LT-17). |

## Depends on (not yet designed)

| Topic | Document |
|---|---|
| bases (`derived`, `inferred`, …), "what is in force", verdict weight | resolved: [05-trust](05-trust.md) TR-B01…B03, TR-I01, TR-V02 |

## History

- 2026-09-30 — grilled (12 questions); CT-A03 replaced the formal-approval variant because an author cannot approve their own PR.
- 2026-10-01 — unified-architecture review, grilled: owner-act requirement only in namespace policy (CT-N03), store init through the `acts` port (CT-N05), basis from TR-B02 (CT-P01, CT-P02), owner acts as status facts (CT-A02), acts checked once (CT-A03), `runtime` weight through LG-R04 (CT-A04), stores per project (CT-M01).
- 2026-10-01 — design v0.6 audit, grilled: policy at the record's `seq` (CT-N06), `human` only when confirmed by an act (CT-P03, CT-A05), `machine` participant without version (CT-P05), two-sided transfer and `upgrade` (CT-A02), `std` path (CT-N02).
