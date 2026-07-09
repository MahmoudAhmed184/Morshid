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
final PDFs should be placed in `storage/pdfs/` for local ingestion. That folder
is runtime storage and PDF binaries are intentionally ignored by Git, so this
document is the tracked source readiness record.

## P0 Source Candidates

These five sources are planned as internally authored course PDFs. Internal
authorship keeps licensing simple for P0 and lets the team shape each source
around the golden dataset and demo scenarios.

| ID | Title | Topic / week metadata | Version label | Target local filename | Permission notes | Text quality requirement | P0 status | Approval needed |
|---|---|---|---|---|---|---|---|---|
| `p0-python-basics` | Python Basics - Variables and Types | Week 1: values, variables, primitive types, expressions, `print`, basic input | `p0-v1-2026-07-09` | `storage/pdfs/python-basics-variables-types-p0-v1.pdf` | Internally authored by the Morshid/ThinkFirst team for the P0 demo. Allowed for local demo ingestion after instructor content approval. | Must be exported from text source; selectable text; no scanned pages; no OCR dependency. | Recommended | Instructor approval for content accuracy before upload. No external licensing approval expected if internally authored. |
| `p0-control-flow` | Control Flow - If Statements and Loops | Week 1-2: comparisons, boolean logic, `if`/`elif`/`else`, `for`, `while`, `range`, loop control | `p0-v1-2026-07-09` | `storage/pdfs/control-flow-if-loops-p0-v1.pdf` | Internally authored by the Morshid/ThinkFirst team for the P0 demo. Allowed for local demo ingestion after instructor content approval. | Must be exported from text source; selectable text; no scanned pages; no OCR dependency. | Recommended | Instructor approval for content accuracy before upload. No external licensing approval expected if internally authored. |
| `p0-functions-scope` | Functions and Scope | Week 2: defining functions, parameters, return values, local/global scope, docstrings, simple decomposition | `p0-v1-2026-07-09` | `storage/pdfs/functions-and-scope-p0-v1.pdf` | Internally authored by the Morshid/ThinkFirst team for the P0 demo. Allowed for local demo ingestion after instructor content approval. | Must be exported from text source; selectable text; no scanned pages; no OCR dependency. | Recommended | Instructor approval for content accuracy before upload. No external licensing approval expected if internally authored. |
| `p0-data-structures-errors` | Lists, Dictionaries, and Common Errors | Week 3: lists, dictionaries, indexing, mutation, iteration patterns, `KeyError`, `IndexError`, `TypeError` | `p0-v1-2026-07-09` | `storage/pdfs/lists-dictionaries-common-errors-p0-v1.pdf` | Internally authored by the Morshid/ThinkFirst team for the P0 demo. Allowed for local demo ingestion after instructor content approval. | Must be exported from text source; selectable text; no scanned pages; no OCR dependency. | Recommended | Instructor approval for content accuracy before upload. No external licensing approval expected if internally authored. |
| `p0-debugging-python` | Debugging Python Code | Week 3-4: reading tracebacks, syntax/runtime/logic errors, small-code diagnosis, incremental testing, no-solution guidance | `p0-v1-2026-07-09` | `storage/pdfs/debugging-python-code-p0-v1.pdf` | Internally authored by the Morshid/ThinkFirst team for the P0 demo. Allowed for local demo ingestion after instructor content approval. | Must be exported from text source; selectable text; no scanned pages; no OCR dependency. | Recommended | Instructor approval for content accuracy before upload. No external licensing approval expected if internally authored. |

## Storage And Naming Conventions

- Store final local PDF files in `storage/pdfs/`.
- Use lowercase kebab-case filenames with the source topic and version suffix:
  `<topic-slug>-p0-v1.pdf`.
- Keep each PDF text-based by exporting from Markdown, Google Docs, Word, or
  another editable text source.
- Do not commit PDF binaries unless the repository policy changes. The current
  `.gitignore` keeps `storage/pdfs/*` local-only except `.gitkeep`.
- The tracked source ID in this plan should be used later in fixture metadata,
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

The recommended P0 path is to use internally authored PDFs only. If the team
replaces any planned internal source with an external PDF, that source needs
human approval before ingestion and must record:

- source URL or owner;
- exact license or permission basis;
- whether local storage in `storage/pdfs/` is allowed;
- whether use in a graduation demo is allowed;
- whether redistribution to reviewers, instructors, or students is allowed.

No external licensing uncertainty is expected for the five recommended internal
sources after instructor approval confirms the team owns or is authorized to use
the content.

## Fixture And Scenario Coverage Notes

This source set is intended to support the P0 golden dataset and demo scenarios:

- conceptual Python questions should cite `p0-python-basics`,
  `p0-control-flow`, `p0-functions-scope`, or
  `p0-data-structures-errors`;
- problem-like requests and hint-ladder checks should use examples from the
  basics, control-flow, functions, and data-structures sources;
- code diagnosis fixtures should cite `p0-debugging-python` plus the relevant
  topic source for the bug;
- unsupported questions should intentionally have no matching source coverage;
- conflicting-source cases are not included in this v1 source plan unless the
  team intentionally authors a small approved conflict fixture later.

Final scenario IDs and fixture names should be aligned with issue #32 once that
mapping is finalized.

## Readiness Checklist

- [x] Lists 3-5 candidate PDFs or internally authored source documents.
- [x] Each source has title, topic/week metadata, version label, and permission
      notes.
- [x] The plan excludes scanned and OCR-dependent documents from P0.
- [x] Licensing and access uncertainty requiring human approval is called out.
- [x] Planned local PDF paths use `storage/pdfs/`.
