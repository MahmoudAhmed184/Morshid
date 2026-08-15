# 09. Materials ingestion, processing, and document storage

Morshid ingests course reference PDFs, extracts and normalizes text, splits it into overlapping chunks, generates 1,536-dimensional vector embeddings, and stores them in PostgreSQL with `pgvector`.

---

## 1. Document storage platform (`server/src/platform/document-storage/`)

The [`PdfStorage`](file:///home/mahmoud-ahmed/Projects/Morshid/server/src/platform/document-storage/pdf-storage.ts) interface defines document storage operations:

```typescript
export const PDF_STORAGE = Symbol('PdfStorage')
export const MAX_PDF_OBJECT_BYTES = 100 * 1024 * 1024

export interface PdfStorage {
  create(contents: Buffer): Promise<string>
  read(storagePath: string): Promise<Buffer>
  exists(storagePath: string): Promise<boolean>
  delete(storagePath: string): Promise<void>
}
```

### Local storage implementation ([`LocalPdfStorageAdapter`](file:///home/mahmoud-ahmed/Projects/Morshid/server/src/platform/document-storage/local-pdf-storage.adapter.ts))
- **File location.** Files are saved in `PDF_STORAGE_PATH` (defaults to `storage/pdfs/`).
- **Filename format.** UUID v4 filenames matching `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/i` (for example, `d3b07384-d113-40a2-9e29-873b8a3e9c12.pdf`).
- **POSIX safety and permissions.**
  - Opens files with `O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW`.
  - Sets mode to `0o600` (read and write restricted to the process owner).
  - Calls `handle.sync()` before returning to flush data to disk.
  - Verifies canonical paths with `fs.realpath` to prevent directory traversal.

---

## 2. Ingestion and upload validation

The API receives uploads at `POST /api/v1/courses/:courseId/materials` and validates them through a series of checks:

```mermaid
flowchart TD
    Req["Multipart File Upload"] --> Interceptor["PdfUploadInterceptor: Validate courseId UUID"]
    Interceptor --> Multer["Multer Memory Storage: Max 10 MB"]
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

### Validation constraints ([`pdf-upload.validator.ts`](file:///home/mahmoud-ahmed/Projects/Morshid/server/src/modules/materials/upload/pdf-upload.validator.ts))
- **Supported formats.** Single PDF documents only. Zip archives, raw Markdown, and scanned image containers fail validation.
- **Magic bytes signature.** Verifies that `buffer.subarray(0, 5)` matches `Buffer.from('%PDF-')`.
- **Payload limit.** Defaults to 10 MB (`10,485,760` bytes), configurable up to 100 MB with `PDF_MAX_UPLOAD_BYTES`.

---

## 3. End-to-end processing pipeline

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
    Chunker-->>Svc: MaterialTextChunk[]
    
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

## 4. Text extraction and chunking strategy

### 4.1 Text extraction ([`pdf-text-extractor.ts`](file:///home/mahmoud-ahmed/Projects/Morshid/server/src/modules/materials/processing/pdf-text-extractor.ts))
- Uses `pdfjs-dist/legacy/build/pdf.mjs`.
- Iterates page by page to extract text items.
- Detects pages without text. If `0 < pagesWithoutText < pageCount`, it marks the material with a `PARTIAL_PAGE_TEXT` warning.
- Throws `PdfExtractionError` when no extractable text is found on any page. Scanned PDFs without OCR are not supported.

### 4.2 Text normalization and chunking ([`material-text-chunker.ts`](file:///home/mahmoud-ahmed/Projects/Morshid/server/src/modules/materials/processing/material-text-chunker.ts))
- **Normalization.**
  - Applies Unicode NFKC normalization (`text.normalize('NFKC')`).
  - Strips NUL bytes (`\u0000`) and carriage returns (`\r\n` and `\r` become `\n`).
  - Replaces repeated inline whitespace with single spaces (`[\t\f\v ]+` becomes `' '`).
  - Collapses three or more consecutive line breaks into two (`\n{3,}` becomes `\n\n`).
- **Sliding window chunking.**
  - **Target chunk size.** `1,200` characters (`MATERIAL_CHUNK_TARGET_CHARACTERS`).
  - **Overlap size.** `200` characters (`MATERIAL_CHUNK_OVERLAP_CHARACTERS`).
  - **Boundary search.** Looks for natural break points (`\n\n`, `\n`, or `' '`) within `[start + 600, start + 1200]`.
  - **Window advancement.** Sets `nextStart = boundaryIndex - 200`.

---

## 5. Material lifecycle states

Materials move through these states in the `materials` table:

```mermaid
stateDiagram-v2
    [*] --> PROCESSING: Upload Received & Command Queued
    
    PROCESSING --> READY: Text extracted, chunked & 100% embedded
    PROCESSING --> WARNING: Text extracted with non-fatal warnings (e.g., partial page text)
    PROCESSING --> FAILED: Fatal error (corrupt PDF, scanned or no text, embedding failure)
    
    READY --> [*]: Active for RAG
    WARNING --> [*]: Active for RAG (with warning badge)
    FAILED --> [*]: Blocked from RAG
```

### Lifecycle states
- **`PROCESSING`**. The document is saved on disk and waiting in the `material_processing_commands` queue or actively being parsed and embedded.
- **`READY`**. Text extracted, chunks generated, embeddings persisted, and zero warnings reported. The material is active for tutoring retrieval.
- **`WARNING`**. Text extracted and embeddings persisted, but non-fatal issues occurred (such as pages containing images without extractable text). The material remains eligible for retrieval.
- **`FAILED`**. Ingestion failed. The `error_message` column contains diagnostic details (such as `"No extractable text was found. Scanned PDFs are not supported."`, `"PDF is password protected."`, or `"Storage read failed."`).
