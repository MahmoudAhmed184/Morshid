# Python PDF Source Plan

Issue: #33  
Parent: Golden dataset and P0 source readiness  
Owner role: Ingestion/evaluation  
Workstream: Dataset/Source Readiness  
Course: `PYTHON-PROG-P0` / Python Programming  
Target storage: `storage/pdfs/`  
Version: v1, July 9, 2026

## Purpose

This plan defines the clean text-based Python source set for the P0 demo. The
selected PDF materials are stored in `storage/pdfs/` so ingestion and
evaluation work can use the same local files.

## Selected PDF Materials

These four external PDFs were added as the initial P0 source materials. All
are text-extractable with `pdftotext` and do not require OCR.

| ID | Title | Source page | Topic / week metadata | Version label | Local filename | Permission notes | Text quality check | P0 status | Approval needed |
|---|---|---|---|---|---|---|---|---|---|
| `p0-byte-of-python` | A Byte of Python | <https://python.swaroopch.com/> | Weeks 1-4: Python basics, operators, control flow, functions, modules, data structures, problem solving, exceptions | `external-pdf-2026-07-09` | `storage/pdfs/byte-of-python.pdf` | Licensed under Creative Commons Attribution-ShareAlike 4.0 International. Attribution and share-alike requirements apply. Source page links to downloadable PDF releases. | PDF, 130 pages. `pdftotext` extracted about 229k characters locally. No OCR dependency found. | Selected | Human approval should confirm attribution text and share-alike handling before demo distribution. |
| `p0-non-programmers-python3` | Non-Programmer's Tutorial for Python 3 | <https://en.wikibooks.org/wiki/Non-Programmer%27s_Tutorial_for_Python_3> | Weeks 1-4: variables, strings, `while`, `if`, debugging, functions, lists, `for`, booleans, dictionaries, file I/O, errors | `external-pdf-2026-07-09` | `storage/pdfs/non-programmers-tutorial-for-python-3.pdf` | Wikibooks text is available under Creative Commons Attribution-ShareAlike terms. Attribution, Wikibooks terms, and share-alike requirements apply. | PDF, 10 pages. `pdftotext` extracted about 231k characters locally. No OCR dependency found. | Selected | Human approval should confirm attribution text and share-alike handling before demo distribution. |
| `p0-think-python-2e` | Think Python: How to Think Like a Computer Scientist, 2nd Edition | <https://greenteapress.com/wp/think-python-2e/> | Weeks 1-4: variables, expressions, functions, conditionals, recursion, strings, lists, dictionaries, tuples, debugging, program design | `2nd-edition-v2.4.0-2015` | `storage/pdfs/think-python-2e.pdf` | Licensed under Creative Commons Attribution-NonCommercial 3.0 Unported. Attribution is required and non-commercial restrictions apply. | PDF, version 1.5. `pdftotext` extracted about 450k characters locally. No OCR dependency found. | Selected | Human approval required because the license is NonCommercial. |
| `p0-python-programming-halvorsen` | Python Programming | <https://www.halvorsen.blog/documents/programming/python/> | Weeks 1-4: Python setup, variables, arrays, control structures, functions, classes, files, exceptions, debugging, packages, math examples | `2026-06-12-isbn-978-82-691106-4-7` | `storage/pdfs/python-programming-halvorsen.pdf` | Copyright Hans-Petter Halvorsen. The PDF front matter links to the author's Python resource page, but no explicit redistribution license was found in local text extraction. | PDF, 143 pages. `pdftotext` extracted about 124k characters locally. No OCR dependency found. | Selected with warning | Human approval required before demo distribution or committing if redistribution rights are not confirmed. |

## Storage And Naming Conventions

- Store final PDF files in `storage/pdfs/`.
- Use lowercase kebab-case filenames.
- Keep PDFs text-based. Scanned pages and OCR-dependent documents are excluded
  from P0.
- PDF materials in `storage/pdfs/` are tracked for P0 source readiness.
- The source IDs in this plan should be used later in fixture metadata,
  ingestion notes, and retrieval sanity results.

## Excluded From P0

The P0 source set excludes:

- scanned PDFs;
- image-only lecture slides;
- OCR-dependent materials;
- paywalled books or course packs;
- third-party documents with unclear redistribution or classroom-demo rights;
- PDFs whose extracted text loses code indentation or merges examples into
  unreadable paragraphs.

## Licensing And Access Notes

Most selected PDFs use Creative Commons terms. `p0-byte-of-python` and
`p0-non-programmers-python3` use Attribution-ShareAlike terms, so attribution
and share-alike handling must be confirmed before demo distribution outside the
team. `p0-think-python-2e` uses Attribution-NonCommercial terms, so human
approval is required before using it in any setting that could be interpreted as
commercial. `p0-python-programming-halvorsen` is copyrighted and does not expose
an explicit redistribution license in the extracted text, so it requires human
approval before demo distribution or repository commit.

If the team adds another external PDF later, that source must record:

- source URL or owner;
- exact license or permission basis;
- whether local storage in `storage/pdfs/` is allowed;
- whether use in a graduation demo is allowed;
- whether redistribution to reviewers, instructors, or students is allowed.

## Fixture And Scenario Coverage Notes

The selected PDFs support the P0 golden dataset and demo scenarios:

- variables/types: `p0-byte-of-python`, `p0-non-programmers-python3`,
  `p0-think-python-2e`, `p0-python-programming-halvorsen`;
- control flow: `p0-byte-of-python`, `p0-non-programmers-python3`,
  `p0-think-python-2e`, `p0-python-programming-halvorsen`;
- functions/scope: `p0-byte-of-python`, `p0-non-programmers-python3`,
  `p0-think-python-2e`, `p0-python-programming-halvorsen`;
- collections/common errors: `p0-byte-of-python`,
  `p0-non-programmers-python3`, `p0-think-python-2e`,
  `p0-python-programming-halvorsen`;
- debugging Python code: `p0-byte-of-python`,
  `p0-non-programmers-python3`, `p0-think-python-2e`,
  `p0-python-programming-halvorsen`.

Unsupported questions should intentionally have no matching source coverage.
Conflicting-source cases are not included in this v1 source plan unless the
team intentionally authors a small approved conflict fixture later.

Final scenario IDs and fixture names should be aligned with issue #32 once that
mapping is finalized.

## Readiness Checklist

- [x] Lists 3-5 candidate PDFs or internally authored source documents.
- [x] Each source has title, topic/week metadata, version label, and permission
      notes.
- [x] The plan excludes scanned and OCR-dependent documents from P0.
- [x] Licensing and access uncertainty requiring human approval is called out.
- [x] Selected local PDF paths use `storage/pdfs/`.
