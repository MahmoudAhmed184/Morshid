# Python PDF Source Plan

Issue: #33  
Parent: Golden dataset and P0 source readiness  
Owner role: Ingestion/evaluation  
Workstream: Dataset/Source Readiness  
Course: `PYTHON-PROG-P0` / Python Programming  
Target storage: `storage/pdfs/`  
Version: v3, July 9, 2026

## Purpose

This plan defines the clean text-based Python source set for the P0 demo. The
source set now uses five grouped Python part PDFs instead of individual chapter
PDFs or full books, so ingestion and retrieval can target stable course units
while keeping the source set small.

## Selected Python Part PDFs

The selected materials are five grouped PDFs covering the Python P0 topics. They
are stored in `storage/pdfs/`, are text-extractable with `pdftotext`, and do not
require OCR.

Source page: <https://en.wikibooks.org/wiki/Non-Programmer%27s_Tutorial_for_Python_3>  
Permission basis: Wikibooks content is available under Creative Commons
Attribution-ShareAlike terms. Attribution and share-alike handling must be
confirmed before demo distribution outside the team.

| ID | Title | Topic / week metadata | Version label | Local filename | Text quality check | P0 status | Approval needed |
|---|---|---|---|---|---|---|---|
| `p0-npt-part-01` | Python Part 1 | Week 1: Hello World; Input and Variables; Count to 10 | `part-pdf-2026-07-09` | `storage/pdfs/Python_Part_1.pdf` | 16 pages; `pdftotext` succeeds. | Selected | Confirm CC BY-SA attribution. |
| `p0-npt-part-02` | Python Part 2 | Week 2: Decisions; Debugging; Defining Functions | `part-pdf-2026-07-09` | `storage/pdfs/Python_Part_2.pdf` | 18 pages; `pdftotext` succeeds. | Selected | Confirm CC BY-SA attribution. |
| `p0-npt-part-03` | Python Part 3 | Week 3: Lists; For Loops; Boolean Expressions | `part-pdf-2026-07-09` | `storage/pdfs/Python_Part_3.pdf` | 20 pages; `pdftotext` succeeds. | Selected | Confirm CC BY-SA attribution. |
| `p0-npt-part-04` | Python Part 4 | Week 4: Dictionaries; Using Modules; More on Lists | `part-pdf-2026-07-09` | `storage/pdfs/Python_Part_4.pdf` | 14 pages; `pdftotext` succeeds. | Selected | Confirm CC BY-SA attribution. |
| `p0-npt-part-05` | Python Part 5 | Week 4 extension: Strings; File I/O | `part-pdf-2026-07-09` | `storage/pdfs/Python_Part_5.pdf` | 14 pages; `pdftotext` succeeds. | Selected | Confirm CC BY-SA attribution. |

## Storage And Naming Conventions

- Store final PDF files in `storage/pdfs/`.
- Use the grouped source filenames `Python_Part_1.pdf` through
  `Python_Part_5.pdf`.
- Keep part PDFs text-based. Scanned pages and OCR-dependent documents are
  excluded from P0.
- PDF materials in `storage/pdfs/` are tracked for P0 source readiness.
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

The selected part PDFs come from Wikibooks-derived materials and require Creative Commons
Attribution-ShareAlike handling. Human approval should confirm:

- required attribution text;
- whether committing the part PDFs to the repository is acceptable;
- whether demo distribution to reviewers, instructors, or students is allowed;
- whether any generated derivative material needs share-alike handling.

If the team adds another external PDF later, that source must record:

- source URL or owner;
- exact license or permission basis;
- whether local storage in `storage/pdfs/` is allowed;
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

Unsupported questions should intentionally have no matching source coverage.
Conflicting-source cases are not included in this v3 source plan unless the
team intentionally authors a small approved conflict fixture later.

Final scenario IDs and fixture names should be aligned with issue #32 once that
mapping is finalized.

## Readiness Checklist

- [x] Lists the selected grouped Python part PDF materials.
- [x] Each source has title, topic/week metadata, version label, and permission
      notes.
- [x] The plan excludes scanned and OCR-dependent documents from P0.
- [x] Licensing and access uncertainty requiring human approval is called out.
- [x] Selected local PDF paths use `storage/pdfs/`.
