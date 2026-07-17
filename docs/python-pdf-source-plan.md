# Python PDF Source Plan

Issue: #33  
Parent: Golden dataset and P0 source readiness  
Owner role: Ingestion/evaluation  
Workstream: Dataset/Source Readiness  
Course: `PYTHON-PROG-P0` / Python Programming  
Committed source location: `fixtures/sources/`  
Version: v3, July 9, 2026 (v3 replaced the individual chapter PDFs of v2 and the
full-book candidates of v1 with five grouped part PDFs)

## Purpose

This plan defines the clean text-based Python source set for the P0 demo. The
source set now uses five grouped Python part PDFs instead of individual chapter
PDFs or full books, so ingestion and retrieval can target stable course units
while keeping the source set small.

## Selected Python Part PDFs

The selected materials are five grouped PDFs covering the Python P0 topics. They
are committed under `fixtures/sources/` (the conventional location for committed
source fixtures per `docs/fixture-update-conventions.md`), are text-extractable
with `pdftotext`, and do not require OCR. The runtime upload directory
`storage/pdfs/` stays git-ignored; these fixtures are copied/seeded into it (or
into the `morshid-pdf-storage` volume) for local runs.

Source page: <https://en.wikibooks.org/wiki/Non-Programmer%27s_Tutorial_for_Python_3>  
Permission basis: Wikibooks content is available under the Creative Commons
Attribution-ShareAlike 4.0 International license (CC BY-SA 4.0,
<https://creativecommons.org/licenses/by-sa/4.0/>). Because this repository is
public, committing these PDFs already redistributes CC BY-SA material, so
attribution and a share-alike/modification notice are required **now**, not only
before demo distribution. See `fixtures/sources/ATTRIBUTION.md`.

| ID | Title | Topic / week metadata | Version label | Local filename | Text quality check | P0 status | Approval needed |
|---|---|---|---|---|---|---|---|
| `p0-npt-part-01` | Python Part 1 | Week 1: Hello World; Input and Variables; Count to 10 (ends mid Count to 10) | `part-pdf-2026-07-09` | `fixtures/sources/Python_Part_1.pdf` | 16 pages; `pdftotext -layout` preserves code indentation. | Selected | Confirm CC BY-SA 4.0 attribution. |
| `p0-npt-part-02` | Python Part 2 | Week 2: Decisions; Debugging; Defining Functions (begins with end of Count to 10) | `part-pdf-2026-07-09` | `fixtures/sources/Python_Part_2.pdf` | 18 pages; `pdftotext -layout` preserves code indentation. | Selected | Confirm CC BY-SA 4.0 attribution. |
| `p0-npt-part-03` | Python Part 3 | Week 3: Lists; For Loops; Boolean Expressions | `part-pdf-2026-07-09` | `fixtures/sources/Python_Part_3.pdf` | 20 pages; `pdftotext -layout` preserves code indentation. | Selected | Confirm CC BY-SA 4.0 attribution. |
| `p0-npt-part-04` | Python Part 4 | Week 4: Dictionaries; Using Modules; More on Lists (begins with end of Boolean Expressions) | `part-pdf-2026-07-09` | `fixtures/sources/Python_Part_4.pdf` | 14 pages; `pdftotext -layout` preserves code indentation. | Selected | Confirm CC BY-SA 4.0 attribution. |
| `p0-npt-part-05` | Python Part 5 | Week 4 extension: More on Lists (conclusion); Strings; File I/O (begins with end of More on Lists) | `part-pdf-2026-07-09` | `fixtures/sources/Python_Part_5.pdf` | 14 pages; `pdftotext -layout` preserves code indentation. | Selected | Confirm CC BY-SA 4.0 attribution. |

Note: the parts were split on page (not chapter) boundaries, so some parts carry
over the tail of the previous chapter and the "Topic / week metadata" cells above
flag those carried-over sections. Retrieval citations should key on the actual
extracted content, not only a part's labeled topics.

### Provenance

- Upstream artifact: the PDF/print export of *Non-Programmer's Tutorial for
  Python 3* (Wikibooks contributors).
- Date retrieved: 2026-07-09 (matches the `part-pdf-2026-07-09` version label).
- Split tool: `pypdf` (the PDFs' `Producer` per `pdfinfo`), splitting the upstream
  compiled PDF into five part PDFs on page boundaries.
- Chapter ranges per part:
  - Part 1: chapters 3–5 (Hello World; Who Goes There?; Count to 10).
  - Part 2: chapters 6–8 (Decisions; Debugging; Defining Functions).
  - Part 3: chapters 10–12 (Lists; For Loops; Boolean Expressions).
  - Part 4: chapters 13–15 (Dictionaries; Using Modules; More on Lists).
  - Part 5: chapters 16–17 (Revenge of the Strings; File I/O).
- Intentional omissions from P0: chapter 9 ("Advanced Functions Example") is
  excluded (it falls between Part 2 and Part 3), as are the upstream end-matter
  chapters (error handling, recursion, object-oriented programming, and the
  Python standard-library tour).

## Storage And Naming Conventions

- Commit final PDF files under `fixtures/sources/` and treat them as committed
  source fixtures.
- Keep `storage/pdfs/` as git-ignored runtime upload storage only; copy/seed the
  fixtures into it (or into the `morshid-pdf-storage` Docker volume) for local
  runs. Do not commit runtime uploads.
- Use the grouped source filenames `Python_Part_1.pdf` through
  `Python_Part_5.pdf`.
- Keep part PDFs text-based. Scanned pages and OCR-dependent documents are
  excluded from P0.
- Ingestion must use layout-preserving extraction (`pdftotext -layout` or an
  equivalent parser setting) so code indentation is retained, per the exclusion
  rule in "Excluded From P0".
- The source IDs in this plan should be used later in fixture metadata,
  ingestion notes, and retrieval sanity results.

## Excluded From P0

The P0 source set excludes:

- full book PDFs when focused part PDFs are available;
- individual chapter PDFs replaced by the grouped part PDFs;
- scanned PDFs;
- image-only lecture slides;
- OCR-dependent materials;
- paywalled books or course packs;
- third-party documents with unclear redistribution or classroom-demo rights;
- PDFs whose extracted text loses code indentation or merges examples into
  unreadable paragraphs.

## Licensing And Access Notes

The selected part PDFs come from Wikibooks-derived materials under CC BY-SA 4.0
and require attribution plus share-alike handling. Because these PDFs are already
committed to a public repository, the attribution and modification notice in
`fixtures/sources/ATTRIBUTION.md` is required immediately. Human approval should
confirm:

- that the committed attribution notice in `fixtures/sources/ATTRIBUTION.md` is
  sufficient;
- required attribution text wording;
- whether demo distribution to reviewers, instructors, or students is allowed;
- whether any generated derivative material needs share-alike handling.

If the team adds another external PDF later, that source must record:

- source URL or owner;
- exact license or permission basis (name and version);
- whether committed storage under `fixtures/sources/` is allowed;
- whether use in a graduation demo is allowed;
- whether redistribution to reviewers, instructors, or students is allowed.

## Fixture And Scenario Coverage Notes

The selected part PDFs support the P0 golden dataset and demo scenarios:

- variables/types: `p0-npt-part-01`;
- control flow: `p0-npt-part-01`, `p0-npt-part-02`,
  `p0-npt-part-03`;
- functions/scope: `p0-npt-part-02`;
- collections/common errors: `p0-npt-part-03`, `p0-npt-part-04`,
  `p0-npt-part-05`;
- debugging Python code: `p0-npt-part-02`;
- modules and file handling extension coverage: `p0-npt-part-04`,
  `p0-npt-part-05`.

Extracted text still contains wiki-navigation and formatting artifacts (interwiki
lines such as `ca:Python 3 per a no programadors/...`, footnote markers merged
into words, duplicated exercise text, and `»>` chevrons instead of `>>>` in some
REPL examples). Chunking should strip or tolerate these; no PDF regeneration is
required.

Unsupported questions should intentionally have no matching source coverage.
Conflicting-source cases are not included in this v3 source plan unless the
team intentionally authors a small approved conflict fixture later.

## Crosswalk To Demo Scenario Mapping

The demo scenario mapping (`docs/demo-scenario-mapping.md`, Issue #32) is
finalized and merged. It references sources by the recommended titles in
`docs/morshid-decisions.md:39-45` and the version label `p0-v1`. This plan
groups the same material into part PDFs. The `part-pdf-2026-07-09` labels are the
canonical version labels for these committed fixtures; fixture records may carry
`p0-v1` as an alias to the scenario mapping until that mapping is updated. The
crosswalk from decisions-doc/scenario titles to this plan's part IDs:

| Decisions-doc / scenario title | Scenario rows | Covering part IDs |
|---|---|---|
| `Python Basics - Variables and Types` | SCN-003 | `p0-npt-part-01` |
| `Control Flow - If Statements and Loops` | SCN-002 | `p0-npt-part-01`, `p0-npt-part-02`, `p0-npt-part-03` |
| `Functions and Scope` | SCN-002, SCN-005 | `p0-npt-part-02` |
| `Lists, Dictionaries, and Common Errors` | SCN-001, SCN-004 | `p0-npt-part-03`, `p0-npt-part-04`, `p0-npt-part-05` |
| `Debugging Python Code` | SCN-005 | `p0-npt-part-02` |

## Readiness Checklist

- [x] Lists the selected grouped Python part PDF materials.
- [x] Each source has title, topic/week metadata, version label, and permission
      notes.
- [x] The plan excludes scanned and OCR-dependent documents from P0.
- [x] Licensing and access uncertainty requiring human approval is called out.
- [x] Selected local PDF paths use `fixtures/sources/`.
