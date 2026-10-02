# Spec Delta

## Purpose

The `md` format of the codec (LG-B05): the document form in which the design is written, how each of its forms maps to
blocks (LG-B06) on import and back on export, and the round trip that proves it. The skeleton form — one table with
IDs, read and written by `lattice import-md` and `lattice export` — is specified with those commands (REQ-CL-003,
REQ-CL-005); this spec adds the document form beside it.

## ADDED Requirements

### Requirement: The document form: lines, elements and layout
<!-- id: REQ-CD-001 -->

The codec SHALL read a file in the **document form** with `importDocument(text, file name, namespace, session)`, where
`text` is the file decoded as UTF-8, and SHALL refuse every file that deviates from it, never repairing one: the
refusal names the line of the first deviation (line 0 for the file name and the encoding) and a message, and nothing
else is returned. The checks run in four steps, each over the whole file before the next:
1. the file name is `<stem>.md` as step 1 of REQ-CL-003 requires;
2. the text has no byte order mark; lines end with a line feed, the last line too, and no line holds a carriage
   return (decoding the bytes as strict UTF-8 is the caller's, as for the skeleton form);
3. every line is in NFC — a line whose NFC form differs is refused, never repaired (OM-H02) — and holds only code
   points the kernel admits (REQ-KR-009: assigned code points of Unicode 16.0);
4. the elements, read from the top in order, as below and as REQ-CD-002 … REQ-CD-006 state for each kind; the first
   element that breaks a rule is refused at the line where it breaks it, and a rule that compares an element with an
   earlier one (a repeated ID or heading) is refused at the line of the later one.

The file is a sequence of **elements**, separated by exactly one empty line: after the last line of an element comes
either the end of the file or one empty line and then the first line of the next element. The first line of an element
gives its kind:
- **title** — `# ` and a non-empty text, the rest of the line; the first element of the file is a title, and no other
  element is;
- **heading** — `## ` and a non-empty text, the rest of the line;
- **fence** — a line starting with three backticks (REQ-CD-005);
- **table** — a line starting with `|`; the table continues over every following line that starts with `|`
  (REQ-CD-003, REQ-CD-004);
- **list** — a line starting with `- `; the list continues over every following line that starts with `- `
  (REQ-CD-004);
- **paragraph** — any other line, which must start with an ID and `. ` (REQ-CD-002).

A line starting with `#` that is neither a title nor a heading — a heading of level 3 or deeper, `#text` — is refused.
A table or a list followed directly by a line that is not empty and does not continue it is refused at that line. An
empty line at the start of the file, two empty lines in a row and an empty line at the end of the file are refused.

An **ID** of the document form matches `[A-Z][A-Z0-9]+-[A-Z0-9]+` — at least two characters before the hyphen — and has
at most 128 characters. Each ID written in a row (REQ-CD-003), at the start of a paragraph (REQ-CD-002) or in a fence
(REQ-CD-005) names one block, whose entity `id` is `<namespace>/<ID in lower case>` (LG-B06: `DP-B01` →
`lattice/dp-b01`). The IDs of a file are unique in it, and no ID in lower case equals `<stem>` in lower case.

A **cell** of the document form holds no line feed or carriage return, holds `|` only as `\|` (the escaped pipe of a
table cell, kept as written), and neither starts nor ends with a space. A **table line** is written exactly as `| ` +
its cells joined by ` | ` + ` |`: a line is a table line only when splitting it at ` | ` between the leading `| ` and
the trailing ` |` gives cells that render it back.

Implements: LG-B05, LG-B06, LG-B04, LG-B03, OM-H02, OM-I05

#### Scenario: Input outside the document form is refused
<!-- id: SCN-CD-001 -->
- **WHEN** `importDocument` runs on copies of the fixture `sections.md` of REQ-CD-008 (title on line 1, a paragraph on
  line 3, the heading `## Purpose` on line 5) changed one way each: the title line and the empty line after it removed;
  an empty line inserted before line 5; line 5 replaced by `### Deeper`; line 5 replaced by `Free text without an ID.`;
  the last line without its line feed; a carriage return at the end of line 3; a byte order mark at the start; `e`
  followed by U+0301 (not NFC) in line 3; and on the unchanged fixture named `notes .md`
- **THEN** each call is refused with the line of the deviation — line 1 for the missing title (the first element is a
  paragraph), line 5 for the second empty line, the deeper heading and the paragraph without an ID, the last line for
  the missing line feed, line 3 for the carriage return and for the NFC, line 0 for the byte order mark and the file
  name — and returns no proposal

### Requirement: Paragraphs with an ID are blocks
<!-- id: REQ-CD-002 -->

A paragraph SHALL start with an ID followed by `. ` and at least one more character on its first line. It continues
over every following line that is not empty and does not start with `#`, `|`, `- ` or three backticks; such a line
directly after a paragraph is refused. The paragraph is the block of its ID — a rule (`DP-R06. …`) or a prose block
whose ID has the letter `Z` (`DP-Z01. …`, written once by normalization, LG-B04) alike. Its **text** is the paragraph
after `<ID>. `, its lines joined by line feeds, kept verbatim: emphasis, code spans, links, references to sections and
documents ("01 Model", "(04, 05)") and every other character are text, never parsed into anything but the references
of REQ-CD-006.

The block's entity intent has type `<namespace>/paragraph@1` and the body `{"text": <text>, "refs": [<references>]}`
(REQ-CD-006), with the field of REQ-CD-004 when the paragraph owns one.

Implements: LG-B06, LG-B04, LG-B03

#### Scenario: Paragraphs and prose blocks become paragraph blocks
<!-- id: SCN-CD-002 -->
- **WHEN** the fixtures `paragraphs.md` and `prose.md` of REQ-CD-008 are imported in namespace `lattice` —
  `paragraphs.md` with the rule paragraphs `FX-R01. …` and `FX-R02. …`, the second of two lines; `prose.md` with the
  prose paragraphs `FX-Z01. …` before the first heading, `FX-Z02. …` under a heading, and `FX-Z03. …` of two lines after
  a table —; then a copy of `paragraphs.md` with a line `| x |` right after the last line of `FX-R02`
- **THEN** each paragraph gives one entity intent of type `lattice/paragraph@1` with the `id` of its ID in lower case,
  `base` 0, and a body whose `text` is the paragraph without `<ID>. ` — for `FX-R02` and `FX-Z03` their two lines joined
  by one line feed —; the round trip of REQ-CD-008 gives each fixture back byte for byte; the copy is refused at the
  line of `| x |`

### Requirement: Tables with IDs give one block per row
<!-- id: REQ-CD-003 -->

A table SHALL have a header line, a separator line and at least one row. Every line but the separator is a table line
(REQ-CD-001); the separator is `|` followed by `---|` once per header cell (`|---|---|` for two cells); every row has as
many cells as the header.

A table whose first header cell is `ID` is a **table with IDs**: its other header cells — the columns — satisfy step 5
of REQ-CL-003 (non-empty, distinct, none is `ID` or starts with `$`, distinct non-empty slugs, `table.<slugs>` of at
most 128 characters), and none of them is `refs`, `table` or `list`; the first cell of every row is an ID. Each row is
the block of its ID: an entity intent of type `<namespace>/table.<slugs>@1` — one type per distinct header (LG-B06) —
whose body has one field per column, named by the column and holding the row's cell as written, and the field `refs`
(REQ-CD-006), with the field of REQ-CD-004 when the row owns one. The table itself is an item of its section or
document (REQ-CD-007), never a block.

A table whose first header cell is not `ID` is a table without IDs: a field (REQ-CD-004).

Implements: LG-B06

#### Scenario: Rows under two headers become blocks of two types
<!-- id: SCN-CD-003 -->
- **WHEN** the fixture `tables.md` of REQ-CD-008 is imported in namespace `lattice` — a table `| ID | Rule |`, a table
  `| ID | Term | Meaning |`, a second table `| ID | Rule |` under another heading, each with the separator `|---|…|`,
  and a cell holding `` `a` \| `b` ``
- **THEN** every row gives one entity intent with the `id` of its ID in lower case: the rows of both `| ID | Rule |`
  tables have type `lattice/table.rule@1` and bodies `{"Rule": <cell>, "refs": […]}`, the rows of the other table type
  `lattice/table.term.meaning@1` with the fields `Term` and `Meaning`; the cell with the escaped pipe is stored as
  written, `\|` included; and the round trip of REQ-CD-008 gives the fixture back byte for byte

### Requirement: Tables and lists without IDs are fields of the block before them
<!-- id: REQ-CD-004 -->

A table without IDs or a list SHALL be accepted only as the element right after a block whose text ends with `:` — a
paragraph whose text ends with `:`, or a table with IDs whose last row's last cell ends with `:` (LG-B06). It is then a
**field** of that block (of the last row, for a table with IDs) and of no other: one field per block. A table without
IDs or a list after any other element — a title, a heading, a fence, another field, a block whose text does not end
with `:` — is refused at its first line: normalization (LG-B04) writes a lead prose block before such an element, and
the codec never does.

A field table has the rules of REQ-CD-003 for its lines, separator and widths; its cells are any cells of the document
form. A list is one or more lines `- <item>`, each item the non-empty rest of its line, kept verbatim.

The owner's body holds the field as `"table": {"header": [<header cells>], "rows": [[<cells of a row>], …]}` or as
`"list": [<items>]`. A field is not an item of the section or document; it is written back right after its owner.

Implements: LG-B06, LG-B04

#### Scenario: A table and a list become fields of their lead blocks
<!-- id: SCN-CD-004 -->
- **WHEN** the fixture `fields.md` of REQ-CD-008 is imported — a paragraph `FX-Z01. Terms and their rules:` followed by
  a table `| Term | Defined by |`, a paragraph `FX-Z02. The conventions:` followed by a list of two items, and a table
  with IDs whose last row's cell ends with `:` followed by a table `| In md | Block |` —; then a copy without the
  paragraph `FX-Z02` and the empty line after it, so the list follows the field table of `FX-Z01`; then a copy whose
  paragraph `FX-Z01` on line 3 ends with `.` instead of `:`
- **THEN** the first import gives `FX-Z01` the body field `table` with the header and rows as written, `FX-Z02` the
  field `list` with the two items, and the last row the field `table`; no field is an item of its section or document;
  the round trip of REQ-CD-008 gives the fixture back byte for byte; the second import is refused at the first line of
  the list and the third at line 5, the first line of the table after line 3

### Requirement: Fenced code is an example block kept verbatim
<!-- id: REQ-CD-005 -->

A fence SHALL open with a line of three backticks, a language matching `[A-Za-z0-9][A-Za-z0-9_+.-]*`, one space and an
ID (`` ```json DP-Z04 ``, written once by normalization, LG-B04), and close with the first following line that is
exactly three backticks. A fence without a closing line is refused at its opening line, and an opening line in any other
form — no language, no ID, more than three backticks — at that line. The lines between are its content, verbatim: they
may be empty and may start with `#`, `|` or `- `; nothing in them is parsed, references included.

The fence is the block of its ID: an entity intent of type `<namespace>/example@1` (the type `example` of LG-B06 and
OM-L02, in the project namespace until `std` carries it) with the body `{"language": <language>, "text": <content>}`,
where `text` is every content line followed by a line feed, concatenated — the empty string for a fence without content.

Implements: LG-B06, OM-L02

#### Scenario: A fenced example keeps its bytes
<!-- id: SCN-CD-005 -->
- **WHEN** the fixture `examples.md` of REQ-CD-008 is imported — a fence `` ```json FX-Z02 `` whose content holds an
  empty line, a line starting with `|`, a line starting with `#` and the text `FX-R01`; a fence `` ```text FX-Z03 `` of
  one line; and, last in the file, a fence `` ```text FX-Z04 `` without content —; then a copy without the last line
  (the closing line of `FX-Z04`); then a copy whose opening line of `FX-Z03` is `` ```text `` (no ID)
- **THEN** the first import gives each fence an entity intent of type `lattice/example@1` whose `language` is `json` or
  `text` and whose `text` is the content lines each with its line feed (`""` for `FX-Z04`), and no reference is taken
  from the content; the round trip of REQ-CD-008 gives the fixture back byte for byte; the second import is refused at
  the opening line of `FX-Z04` and the third at the opening line of `FX-Z03`

### Requirement: IDs mentioned in the text are floating references
<!-- id: REQ-CD-006 -->

The codec SHALL extract from the text of a block every ID it mentions, as a floating reference (OM-R01, OM-R02), and
keep the text verbatim: export writes the text back and never regenerates it from the references (LG-B06).

- The text of a block is: for a paragraph, its text; for a row, its cells after the ID, in column order; and then, for
  either, its field — the header and row cells of a field table, row by row, or the items of a list. Headings, the
  title and the content of a fence are never searched.
- A **mention** is a run of characters matching the ID grammar of REQ-CD-001, taken as long as it matches, that is
  neither preceded nor followed by a character in `[A-Za-z0-9-]` (so `REQ-CL-003` mentions nothing) and does not lie
  inside a code span. A **code span** opens with a run of backticks and closes with the next run of exactly as many
  backticks in the same paragraph text, cell or list item; a run with no such closing run is an ordinary character.
- A **range** is a mention followed directly by `…` (U+2026) and an end: either a run `[A-Z]*[0-9]+` not followed by a
  character in `[A-Za-z0-9-]` (`DP-C01…C05`), or a mention with the same part before the hyphen (`ST-A01…ST-A04`). The
  start and the end each split, after the hyphen, into letters and a final run of digits; the range is valid when both
  have the same letters and the same number of digits and the start's number is less than the end's, and it mentions
  every ID from the start to the end, the number written with that many digits (`DP-C01…C03` mentions `DP-C01`,
  `DP-C02`, `DP-C03`). A mention followed by `…` and a character in `[A-Z0-9]` that is not a valid range is refused at
  its line.

The block's field `refs` is the list of the entity `id`s (`<namespace>/<ID in lower case>`) of the IDs it mentions, in
the order of their first mention, each once, without the block's own `id` — the empty list when it mentions none. A
mentioned ID need not name a block of the same file or of any file: a floating reference may point to a block written
later or elsewhere.

Implements: LG-B06, OM-R01, OM-R02, OM-R05

#### Scenario: Mentions, ranges and code spans
<!-- id: SCN-CD-006 -->
- **WHEN** the fixture `references.md` of REQ-CD-008 is imported — a paragraph mentioning `(FX-A01)`, `FX-A01` again,
  `FX-B01…B03`, `FX-C01…FX-C02`, `` `FX-D01` `` in a code span, `REQ-FX-001`, `I-JSON` and its own ID, all on line 3;
  a row of a table `| ID | Rule | Note |` whose two cells mention `FX-A02` and `FX-A01`; a paragraph ending with `:`
  whose list item mentions `FX-E01` —; then a copy with `FX-B03…B01` in place of `FX-B01…B03`, and one with
  `FX-B01…C03`
- **THEN** the first paragraph's `refs` are `lattice/fx-a01`, `lattice/fx-b01`, `lattice/fx-b02`, `lattice/fx-b03`,
  `lattice/fx-c01`, `lattice/fx-c02` in that order; the row's `refs` are `lattice/fx-a02`, `lattice/fx-a01`; the lead
  paragraph's `refs` hold `lattice/fx-e01`; every text is stored as written; the round trip of REQ-CD-008 gives the
  fixture back byte for byte; both copies are refused at line 3

### Requirement: Sections and the document are compositions
<!-- id: REQ-CD-007 -->

A heading SHALL open a **section**: the elements after it up to the next heading or the end of the file. The section
is a composition (OM-C01) — an entity intent of type `<namespace>/section@1`, `id` `<namespace>/<stem>.<slug>`, where
`<slug>` is the slug of its heading text (the slug of REQ-CL-003: lower case, every run outside `[a-z0-9]` as `-`, no
leading or trailing `-`), with the body `{"heading": <heading text>, "items": [<items>]}`. The slug is non-empty, the
slugs of a file are distinct, and `<stem>.<slug>` has at most 128 characters; a heading that breaks this is refused.

The file is the **document**: an entity intent of type `<namespace>/document@1`, `id` `<namespace>/<stem in lower
case>`, with the body `{"file": <file name>, "title": <title text>, "items": [<items>]}`, whose items are the elements
between the title and the first heading, then one item per section.

The items of a composition, in the order of its elements, are: for a paragraph or a fence, the `id` of its block; for a
table with IDs, `{"columns": [<columns>], "rows": [<the id of each row's block>]}`; for a section (in the document
only), the `id` of the section. A field is not an item (REQ-CD-004). A composition holds only these references and
structural labels — the file name, the title, the heading and the columns —, never the text of a block (OM-C01, LG-B03);
every reference in it is floating (OM-R02).

`importDocument` SHALL return a proposal (LG-P01) holding the session event of the import — the event given by the
caller in the form of REQ-CL-003: type `core/session@1`, body `{"of": {}, "participant": "lattice", "kind": "machine",
"purpose": "import"}` (LG-B07) — and one entity intent per block, section and document, each with `base` 0 and `by` the
`id` of the session event.

Implements: OM-C01, OM-C02, OM-R02, LG-B06, LG-B07, LG-P01

#### Scenario: Sections and the document hold references and labels only
<!-- id: SCN-CD-007 -->
- **WHEN** the fixture `sections.md` of REQ-CD-008 is imported in namespace `lattice` — a title `# 99. Sections`, a
  prose paragraph before the first heading, a heading `## Purpose` with one paragraph, a heading `## Rules and notes`
  with a table with IDs, a paragraph and a fence, and an empty section `## Empty` on the last line —; then a copy whose
  last line is `## Purpose!`
- **THEN** the first import gives the document `lattice/sections` of type `lattice/document@1` with the file name, the
  title `99. Sections` and the items: the `id` of the first paragraph, then `lattice/sections.purpose`,
  `lattice/sections.rules-and-notes` and `lattice/sections.empty`; the section `lattice/sections.rules-and-notes` of
  type `lattice/section@1` holds the items `{"columns": ["Rule"], "rows": [<row ids>]}`, the paragraph's `id` and the
  fence's `id`, in that order; `lattice/sections.empty` holds no item; the proposal holds the session event and every
  entity intent with `base` 0 and `by` its `id`; the round trip of REQ-CD-008 gives the fixture back byte for byte; the
  second import is refused at the last line (the slug `purpose` repeats)

### Requirement: Export renders documents back from the latest revisions
<!-- id: REQ-CD-008 -->

`exportDocuments(view, namespace)` SHALL read entities only through the read view of the latest-revision projection
(LG-J01, PL-K05) and render every entity of type `<namespace>/document@1` in it as the file named by its `file`: the
title line `# <title>`; then each item, as an element; elements separated by one empty line; and one line feed at the
end. An item renders as:
- a string naming an entity of type `<namespace>/paragraph@1` — `<ID>. <text>`, where `<ID>` is the local part of its
  `id` in upper case, then its field when it has one;
- a string naming an entity of type `<namespace>/example@1` — the opening line `` ``` `` + language + space + `<ID>`,
  the text, and the closing line `` ``` ``;
- a string naming an entity of type `<namespace>/section@1`, as an item of the document — `## <heading>`, then each of
  the section's items;
- `{"columns", "rows"}` — the table with IDs: the header `ID` and the columns, the separator, and for each row `id` the
  row `<ID>` followed by the value of each column's field of that entity's body, then the field of the last row when it
  has one;
- a field `table` — its header, the separator and its rows; a field `list` — one line `- <item>` per item.
A floating reference resolves to the latest revision of the entity (OM-R01).

Before it returns anything, export SHALL import every file it rendered again (REQ-CD-001 … REQ-CD-007) and compare the
entity intents with the view: every block, section and document the rendering read must come back with the same `id`,
type and body, and the import must give no other entity. A document that cannot be rendered — a body or an item not of
the shapes above with exactly their keys, a reference naming no entity or an entity of another type, a section inside a section — or whose
rendering is refused by import or reads back into other entities, SHALL be refused, naming the document and the
reason; so are two documents naming the same `file` compared in lower case. Export returns either every rendered file,
in the order of the `file` names (UTF-16 code units), or the first refusal and no file.

The **round trip** of a file is: `importDocument` with a session in namespace `lattice`; the proposal written as a
proposal file and read back (REQ-CL-003, REQ-LG-001); applied to an empty ledger (REQ-LG-003) as one commit; the ledger
opened with that commit and its latest-revision projection; `exportDocuments` on it. For every form of LG-B06 there
SHALL be a fixture `md` under `test/fixtures/md/forms/` — `paragraphs.md`, `prose.md`, `tables.md`, `fields.md`,
`examples.md`, `references.md`, `sections.md`, `verbatim.md` — whose round trip gives exactly one file, byte-identical to
the fixture; a test SHALL check this for every fixture, so CI checks it on every pull request.

Implements: LG-B05, LG-B06, LG-J01, OM-R01, SL-S0

#### Scenario: Every form round-trips on its own fixture
<!-- id: SCN-CD-008 -->
- **WHEN** the round trip runs on each fixture of `test/fixtures/md/forms/`, among them `verbatim.md`, whose blocks
  hold emphasis, inline code, a link, references to sections and documents ("01 Model", "(04, 05)"), a trailing `:` on
  a paragraph not followed by a field, `\|` in a cell and characters outside ASCII
- **THEN** for each fixture the proposal is applied as one commit, export returns exactly one file named as the
  fixture, and its text is byte-identical to the fixture

#### Scenario: A document that would not read back is refused
<!-- id: SCN-CD-009 -->
- **WHEN** after the round trip of `sections.md` a second commit changes, one at a time in separate ledgers: the text of
  a paragraph to `a`, a line feed and `## x`; a row cell to one ending with a space; the `refs` of a paragraph to
  `[]` while its text mentions an ID; an item of the document to an `id` naming no entity; and when a second document of
  the same namespace names the file `Sections.md`
- **THEN** each export is refused naming the document `lattice/sections` (or the second document) and returns no file
