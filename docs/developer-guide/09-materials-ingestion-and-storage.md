# 09. Materials Ingestion, Processing & Document Storage

Morshid ingests course reference documents (PDFs), extracts and normalizes textual content, segments text into semantically cohesive overlapping chunks, generates 1,536-dimensional vector embeddings, and persists them in PostgreSQL with `pgvector`.

---

## 1. Document Storage Platform (`server/src/platform/document-storage/`)

Document storage is abstracted behind the [`PdfStorage`](file:///home/mahmoud-ahmed/Projects/Morshid/server/src/platform/document-storage/pdf-storage.ts) interface:

```typescript
export const PDF_STORAGE = Symbol('PdfStorage')
export const MAX_PDF_OBJECT_BYTES = 100 * 1024 * 1024 // 100MB Hard Operational Ceiling

export interface PdfStorage {
  create(contents: Buffer): Promise<string>
  read(storagePath: string): Promise<Buffer>
  exists(storagePath: string): Promise<boolean>
  delete(storagePath: string): Promise<void>
}
```

### Local Storage Implementation ([`LocalPdfStorageAdapter`](file:///home/mahmoud-ahmed/Projects/Morshid/server/src/platform/document-storage/local-pdf-storage.adapter.ts))
- **Path Storage**: Files are saved in `PDF_STORAGE_PATH` (default: `storage/pdfs/`).
- **Filename Format**: UUID v4 filenames matching `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/i` (e.g. `d3b07384-d113-40a2-9e29-873b8a3e9c12.pdf`).
- **POSIX Safety & Permissions**:
  - Opened with `O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW`.
  - Mode set to `0o600` (read/write restricted strictly to the process owner).
  - Explicitly invokes `handle.sync()` before returning to guarantee filesystem durability.
  - Verifies canonical path resolution (`fs.realpath`) to prevent directory traversal attacks.

---

## 2. Ingestion & Upload Validation

Uploads are received at `POST /api/v1/courses/:courseId/materials` and validated through a multi-stage filter:

```mermaid
flowchart TD
    Req[Multipart File Upload] --> Interceptor[PdfUploadInterceptor: Validate courseId UUID]
    Interceptor --> Multer[Multer Memory Storage: Max 10MB]
    Multer --> Validator{PdfUploadValidator}
    
    Validator -->|Title Empty or > 180 chars| Err400A[400 Bad Request]
    Validator -->|File > PDF_MAX_UPLOAD_BYTES| Err400B[400 Payload Too Large]
    Validator -->|Extension != .pdf| Err422A[422 Invalid File Extension]
    Validator -->|MIME != application/pdf| Err422B[422 Invalid MIME Type]
    Validator -->|Magic bytes != %PDF-| Err422C[422 Corrupt / Fake PDF]
    
    Validator -->|Valid PDF| Service[MaterialsService.uploadMaterial]
    Service --> AuthCheck{CourseAccess.authorize}
    AuthCheck -->|Instructor / Admin Enrolled| Save[Save File & Queue Processing]
    AuthCheck -->|Unauthorized| Err403[403 Forbidden]
```

### Validation Constraints ([`pdf-upload.validator.ts`](file:///home/mahmoud-ahmed/Projects/Morshid/server/src/modules/materials/upload/pdf-upload.validator.ts)):
- **Supported Formats**: Single PDF documents only. (Zip archives, raw Markdown, and scanned image containers are rejected).
- **Magic Bytes Signature**: Validates that `buffer.subarray(0, 5)` equals `Buffer.from('%PDF-')`.
- **Payload Ceiling**: Defaults to 10 MB (`10,485,760` bytes), configurable up to 100 MB via `PDF_MAX_UPLOAD_BYTES`.

---

## 3. End-to-End Processing Pipeline

The ingestion pipeline converts a stored PDF into searchable, vector-indexed chunks:

```mermaid
sequenceDiagram
    autonumber
    participant Scheduler as DurableMaterialProcessingScheduler
    participant Svc as MaterialProcessingService
    participant Storage as LocalPdfStorageAdapter
    participant Extractor as PdfJsTextExtractor
    participant Chunker as MaterialTextChunker
    participant Embedder as MaterialChunkEmbeddingService
    participant Repo as MaterialsRepository
    participant DB as PostgreSQL (pgvector)

    Note over Scheduler: Polls material_processing_commands every 1000ms
    Scheduler->>Repo: claimMaterialProcessing(batchSize=10, lease=5min)
    Repo->>DB: SELECT FOR UPDATE on command row -> Set processingAttemptId
    Scheduler->>Svc: processMaterial(materialId, attemptId)
    
    Svc->>Storage: read(storagePath)
    Storage-->>Svc: PDF Buffer
    
    Svc->>Extractor: extract(pdfBuffer)
    Note over Extractor: pdfjs-dist extracts text page-by-page
    Extractor-->>Svc: Extracted text (or PARTIAL_PAGE_TEXT warning)
    
    Svc->>Chunker: chunk(normalizedText, materialTitle)
    Note over Chunker: NFKC normalization, 1200 char window, 200 overlap
    Chunker-->>Svc: MaterialChunkDraft[]
    
    Svc->>Embedder: embedMaterialChunks(chunks, title)
    Embedder->>Embedder: Upstream Embedding Provider (1536 dimensions)
    Embedder-->>Svc: Float arrays [vector(1536)]
    
    Svc->>Repo: completeMaterialProcessing(materialId, chunks, embeddings)
    Repo->>DB: BEGIN Tx -> INSERT into material_chunks (vector(1536))
    Repo->>DB: UPDATE materials SET status = READY (or WARNING), chunkCount = N
    Repo->>DB: DELETE FROM material_processing_commands WHERE material_id = id
    Repo->>DB: COMMIT Tx
    Svc-->>Scheduler: Processing Complete
```

---

## 4. Text Extraction & Chunking Strategy

### 4.1 Text Extraction ([`pdf-text-extractor.ts`](file:///home/mahmoud-ahmed/Projects/Morshid/server/src/modules/materials/processing/pdf-text-extractor.ts))
- Uses `pdfjs-dist/legacy/build/pdf.mjs`.
- Iterates page-by-page extracting raw text items.
- Detects empty or scanned pages: if `0 < pagesWithoutText < pageCount`, flags the material with a `PARTIAL_PAGE_TEXT` warning.
- Throws `NO_EXTRACTABLE_TEXT` if zero text is found across all pages (scanned image PDFs without OCR are not supported).

### 4.2 Text Normalization & Chunking ([`material-text-chunker.ts`](file:///home/mahmoud-ahmed/Projects/Morshid/server/src/modules/materials/processing/material-text-chunker.ts))
- **Normalization**:
  - Applies Unicode NFKC normalization: `text.normalize('NFKC')`.
  - Strips NUL bytes (`\u0000`) and carriage returns (`\r\n` -> `\n`, `\r` -> `\n`).
  - Replaces repeated inline whitespace with single spaces (`[\t\f\v ]+` -> `' '`).
  - Collapses excessive line breaks (`\n{3,}` -> `\n\n`).
- **Sliding Window Chunking**:
  - **Target Chunk Size**: `1,200` characters (`MATERIAL_CHUNK_TARGET_CHARACTERS`).
  - **Overlap Size**: `200` characters (`MATERIAL_CHUNK_OVERLAP_CHARACTERS`).
  - **Boundary Heuristic**: Searches for natural semantic break points (`\n\n`, `\n`, or space `' '`) within the window range `[start + 600, start + 1200]`.
  - Advances window: `nextStart = boundaryIndex - 200`.

---

## 5. Material Lifecycle States

Materials transition through the following states in the `materials` table:

```mermaid
stateDiagram-v2
    [*] --> PROCESSING: Upload Received & Command Queued
    
    PROCESSING --> READY: Text extracted, chunked & 100% embedded
    PROCESSING --> WARNING: Text extracted with non-fatal warnings (e.g. Partial Page Text)
    PROCESSING --> FAILED: Fatal error (Corrupt PDF, Scanned/No Text, Embedding Failure)
    
    READY --> [*]: Active for RAG
    WARNING --> [*]: Active for RAG (with warning badge)
    FAILED --> [*]: Blocked from RAG
```

### Lifecycle Enums & Meanings:
- **`PROCESSING`**: Document is saved on disk; waiting in `material_processing_commands` queue or actively being parsed/embedded.
- **`READY`**: Extracted text length > 0, chunks generated, embeddings persisted, zero warnings. Active for Socratic tutoring.
- **`WARNING`**: Extracted text length > 0 and embeddings persisted, but non-fatal issues occurred (e.g. some pages contained images without extractable text). Still eligible for retrieval.
- **`FAILED`**: Ingestion terminated. The `error_message` column contains actionable diagnostics (e.g. `"No extractable text was found. Scanned PDFs are not supported."`, `"PDF is password protected."`, or `"Storage read failed."`).
