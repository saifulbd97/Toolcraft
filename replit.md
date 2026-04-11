# Workspace

## Overview

Single-package Node.js/TypeScript project with React+Vite frontend and Express backend. No database or authentication required.

## Stack

- **Package manager**: npm (single root package.json, no workspaces)
- **Node.js version**: 24
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Validation**: Zod
- **Build**: `node build.mjs` — runs Vite (frontend) then esbuild (backend)

## Artifacts

### Frontend (`artifacts/pdf-merger`)
- React + Vite SPA at preview path `/`
- Full bilingual support (English + Bengali) via i18n context
- **Route structure:**
  - `/` — Landing page
  - `/pdf` — PDF tools dashboard (grid of all 5 tools)
  - `/pdf/merge` — Merge PDF: combine multiple PDFs and images into one document
  - `/pdf/jpg-to-pdf` — JPG to PDF: convert JPG/PNG images into a single PDF
  - `/pdf/pdf-to-jpg` — PDF to JPG: convert every PDF page into high-quality JPG images (ZIP)
  - `/pdf/split` — Split PDF: split into individual pages (ZIP) or extract a page range
  - `/pdf/compress` — Compress PDF: compress PDFs using Ghostscript (low/medium/high)

### API Server (`artifacts/api-server`)
- Express 5 backend at `/api` (port from `process.env.PORT`, default 3000)
- **No auth, no sessions, no database**
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

## Key Commands

```
npm run build   # builds frontend (vite) + backend (esbuild) → artifacts/*/dist/
npm start       # node artifacts/api-server/dist/index.mjs
```

## Important Bug Fix (Applied)

**JPG/PNG embedding in pdf-lib**: Multer buffers use a shared memory pool with non-zero `byteOffset`. `pdf-lib`'s embedders read from `buffer.buffer` (the raw ArrayBuffer) starting at offset 0, ignoring `byteOffset`, causing `"SOI not found in JPEG"` / `"Invalid PNG"` errors.

**Fix**: Always use `new Uint8Array(file.buffer)` before passing to `embedJpg`/`embedPng`.

## Frontend → Backend Connectivity

In development (Vite dev server), API calls to `/api/*` are proxied to `http://localhost:8080` via Vite's `server.proxy` config in `artifacts/pdf-merger/vite.config.ts`.

In production, the Express server serves the built React frontend and handles SPA routing for all non-API paths.

## Render Deployment

`render.yaml` deploys a single web service:
- Build: `npm install && npm run build`
- Start: `npm start`
- Health check: `/api/healthz`
- Env vars needed: `NODE_ENV=production`, `PORT=10000`
- **No database required**
