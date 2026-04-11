# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Artifacts

### PDF Tools App (`artifacts/pdf-merger`)
- React + Vite single-page app at preview path `/`
- Full bilingual support (English + Bengali) via i18n context
- Tools available:
  - **Merge PDF** (`/merge`) — combine multiple PDFs and images (JPG/PNG) into one document
  - **JPG to PDF** (`/jpg-to-pdf`) — convert JPG/PNG images into a single PDF
  - **PDF to JPG** (`/pdf-to-jpg`) — convert every PDF page into high-quality JPG images, downloaded as ZIP
  - **Split PDF** (`/split`) — split into individual pages (ZIP) or extract a page range
  - **Compress PDF** (`/compress`) — compress PDFs using Ghostscript with low/medium/high quality

### API Server (`artifacts/api-server`)
- Express 5 backend at `/api` (port 8080)
- Routes:
  - `GET  /api/healthz` — health check
  - `POST /api/pdf/merge` — multipart `files[]` (PDF/JPG/PNG), returns merged PDF
  - `POST /api/pdf/info` — multipart `file` (PDF), returns `{pageCount}`
  - `POST /api/pdf/jpg-to-pdf` — multipart `files[]` (JPG/PNG), returns PDF
  - `POST /api/pdf/pdf-to-jpg` — multipart `file` (PDF), returns ZIP of JPGs; uses `pdftoppm`
  - `POST /api/pdf/split` — multipart `file` + `mode` (all/range) + `from`/`to`; returns ZIP or PDF
  - `POST /api/pdf/compress` — multipart `file` + `quality` (low/medium/high); uses Ghostscript
- Uses `pdf-lib` for PDF operations, `multer` for file uploads, `JSZip` for archives
- System tools required: `gs` (Ghostscript) for compress, `pdftoppm` (Poppler) for PDF-to-JPG

## Important Bug Fix (Applied)

**JPG/PNG embedding in pdf-lib**: Node.js `Buffer` objects from multer use a shared memory pool and may have a non-zero `byteOffset` within their underlying `ArrayBuffer`. The `pdf-lib` JPEG/PNG embedders read from `imageData.buffer` using `DataView`, which starts at offset 0 of the raw `ArrayBuffer` — ignoring `byteOffset`. This caused `"SOI not found in JPEG"` / `"Invalid PNG"` errors.

**Fix**: In `imageToPdfPage()`, create a zero-offset copy: `new Uint8Array(file.buffer)` before passing to `embedJpg`/`embedPng`.

## Frontend → Backend Connectivity

In development (Vite dev server), API calls to `/api/*` are proxied to `http://localhost:8080` via Vite's `server.proxy` config in `artifacts/pdf-merger/vite.config.ts`.

In production, the path router sends `/api/*` requests directly to the API server.

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
