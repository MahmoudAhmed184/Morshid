# Python PDF Source Plan

Issue: #33  
Parent: Golden dataset and P0 source readiness  
Owner role: Ingestion/evaluation  
Workstream: Dataset/Source Readiness  
Course: `PYTHON-PROG-P0` / Python Programming  
Target storage: `storage/pdfs/`  
Version: v2, July 9, 2026

## Purpose

This plan defines the clean text-based Python source set for the P0 demo. The
source set now uses smaller chapter-level PDFs instead of full books so
ingestion, retrieval sanity checks, citations, and golden fixtures can target
stable units of Python coverage.

## Selected Chapter PDFs

The selected materials are 14 chapter PDFs from Non-Programmer's Tutorial for
Python 3. They are stored in `storage/pdfs/`, are text-extractable with
`pdftotext`, and do not require OCR.

Source page: <https://en.wikibooks.org/wiki/Non-Programmer%27s_Tutorial_for_Python_3>  
Permission basis: Wikibooks content is available under Creative Commons
Attribution-ShareAlike terms. Attribution and share-alike handling must be
confirmed before demo distribution outside the team.

| ID | Title | Topic / week metadata | Version label | Local filename | Text quality check | P0 status | Approval needed |
|---|---|---|---|---|---|---|---|
| `p0-npt-ch01-hello-world` | Hello, World | Week 1: running Python, printing output, saving and executing a program | `chapter-pdf-2026-07-09` | `storage/pdfs/01-hello-world.pdf` | 6 pages; `pdftotext` extracted about 8k characters. | Selected | Confirm CC BY-SA attribution. |
| `p0-npt-ch02-input-variables` | Input and Variables | Week 1: `input()`, variables, assignment, simple output | `chapter-pdf-2026-07-09` | `storage/pdfs/02-input-and-variables.pdf` | 5 pages; `pdftotext` extracted about 8k characters. | Selected | Confirm CC BY-SA attribution. |
| `p0-npt-ch03-count-to-10` | Count to 10 | Week 1-2: `while` loops, counters, loop updates | `chapter-pdf-2026-07-09` | `storage/pdfs/03-count-to-10.pdf` | 5 pages; `pdftotext` extracted about 6k characters. | Selected | Confirm CC BY-SA attribution. |
| `p0-npt-ch04-decisions` | Decisions | Week 2: conditionals, passwords, branching, indentation | `chapter-pdf-2026-07-09` | `storage/pdfs/04-decisions.pdf` | 6 pages; `pdftotext` extracted about 6k characters. | Selected | Confirm CC BY-SA attribution. |
| `p0-npt-ch05-debugging` | Debugging | Week 2: reading failures, tracing state, debugging small programs | `chapter-pdf-2026-07-09` | `storage/pdfs/05-debugging.pdf` | 6 pages; `pdftotext` extracted about 8k characters. | Selected | Confirm CC BY-SA attribution. |
| `p0-npt-ch06-defining-functions` | Defining Functions | Week 2: function definitions, calls, parameters, return behavior | `chapter-pdf-2026-07-09` | `storage/pdfs/06-defining-functions.pdf` | 6 pages; `pdftotext` extracted about 9k characters. | Selected | Confirm CC BY-SA attribution. |
| `p0-npt-ch07-lists` | Lists | Week 3: list values, indexing, list operations, containers | `chapter-pdf-2026-07-09` | `storage/pdfs/07-lists.pdf` | 8 pages; `pdftotext` extracted about 12k characters. | Selected | Confirm CC BY-SA attribution. |
| `p0-npt-ch08-for-loops` | For Loops | Week 3: `for` loops, iteration over collections, loop exercises | `chapter-pdf-2026-07-09` | `storage/pdfs/08-for-loops.pdf` | 4 pages; `pdftotext` extracted about 5k characters. | Selected | Confirm CC BY-SA attribution. |
| `p0-npt-ch09-boolean-expressions` | Boolean Expressions | Week 3: booleans, comparisons, compound conditions, duplicate checks | `chapter-pdf-2026-07-09` | `storage/pdfs/09-boolean-expressions.pdf` | 8 pages; `pdftotext` extracted about 13k characters. | Selected | Confirm CC BY-SA attribution. |
| `p0-npt-ch10-dictionaries` | Dictionaries | Week 3: dictionaries, keys, values, lookup/update patterns | `chapter-pdf-2026-07-09` | `storage/pdfs/10-dictionaries.pdf` | 6 pages; `pdftotext` extracted about 7k characters. | Selected | Confirm CC BY-SA attribution. |
| `p0-npt-ch11-using-modules` | Using Modules | Week 4: imports, modules, organizing reusable code | `chapter-pdf-2026-07-09` | `storage/pdfs/11-using-modules.pdf` | 4 pages; `pdftotext` extracted about 5k characters. | Selected | Confirm CC BY-SA attribution. |
| `p0-npt-ch12-more-on-lists` | More on Lists | Week 4: list methods, list mutation, additional list patterns | `chapter-pdf-2026-07-09` | `storage/pdfs/12-more-on-lists.pdf` | 4 pages; `pdftotext` extracted about 6k characters. | Selected | Confirm CC BY-SA attribution. |
| `p0-npt-ch13-strings` | Strings | Week 4: strings, indexing, slicing, text processing | `chapter-pdf-2026-07-09` | `storage/pdfs/13-strings.pdf` | 6 pages; `pdftotext` extracted about 11k characters. | Selected | Confirm CC BY-SA attribution. |
| `p0-npt-ch14-file-io` | File I/O | Week 4: reading files, writing files, simple file-processing patterns | `chapter-pdf-2026-07-09` | `storage/pdfs/14-file-io.pdf` | 8 pages; `pdftotext` extracted about 11k characters. | Selected | Confirm CC BY-SA attribution. |

## Storage And Naming Conventions

- Store final PDF files in `storage/pdfs/`.
- Use two-digit chapter prefixes and lowercase kebab-case filenames:
  `NN-topic-slug.pdf`.
- Keep chapter PDFs text-based. Scanned pages and OCR-dependent documents are
  excluded from P0.
- PDF materials in `storage/pdfs/` are tracked for P0 source readiness.
- The source IDs in this plan should be used later in fixture metadata,
  ingestion notes, and retrieval sanity results.

## Excluded From P0

The P0 source set excludes:

- full book PDFs when chapter PDFs are available;
- scanned PDFs;
- image-only lecture slides;
- OCR-dependent materials;
- paywalled books or course packs;
- third-party documents with unclear redistribution or classroom-demo rights;
- PDFs whose extracted text loses code indentation or merges examples into
  unreadable paragraphs.

## Licensing And Access Notes

The selected chapter PDFs come from Wikibooks and require Creative Commons
Attribution-ShareAlike handling. Human approval should confirm:

- required attribution text;
- whether committing the chapter PDFs to the repository is acceptable;
- whether demo distribution to reviewers, instructors, or students is allowed;
- whether any generated derivative material needs share-alike handling.

If the team adds another external PDF later, that source must record:

- source URL or owner;
- exact license or permission basis;
- whether local storage in `storage/pdfs/` is allowed;
- whether use in a graduation demo is allowed;
- whether redistribution to reviewers, instructors, or students is allowed.

## Fixture And Scenario Coverage Notes

The selected chapter PDFs support the P0 golden dataset and demo scenarios:

- variables/types: `p0-npt-ch01-hello-world`,
  `p0-npt-ch02-input-variables`;
- control flow: `p0-npt-ch03-count-to-10`, `p0-npt-ch04-decisions`,
  `p0-npt-ch08-for-loops`, `p0-npt-ch09-boolean-expressions`;
- functions/scope: `p0-npt-ch06-defining-functions`;
- collections/common errors: `p0-npt-ch07-lists`,
  `p0-npt-ch10-dictionaries`, `p0-npt-ch12-more-on-lists`,
  `p0-npt-ch13-strings`;
- debugging Python code: `p0-npt-ch05-debugging`;
- modules and file handling extension coverage: `p0-npt-ch11-using-modules`,
  `p0-npt-ch14-file-io`.

Unsupported questions should intentionally have no matching source coverage.
Conflicting-source cases are not included in this v2 source plan unless the
team intentionally authors a small approved conflict fixture later.

Final scenario IDs and fixture names should be aligned with issue #32 once that
mapping is finalized.

## Readiness Checklist

- [x] Lists the selected chapter-level Python PDF materials.
- [x] Each source has title, topic/week metadata, version label, and permission
      notes.
- [x] The plan excludes scanned and OCR-dependent documents from P0.
- [x] Licensing and access uncertainty requiring human approval is called out.
- [x] Selected local PDF paths use `storage/pdfs/`.
