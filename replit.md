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

### PDF Merger (`artifacts/pdf-merger`)
- React + Vite single-page app at preview path `/`
- Allows users to upload multiple PDFs, reorder them, and merge into one downloadable PDF
- Uses drag-and-drop with Framer Motion for file upload and reordering

### API Server (`artifacts/api-server`)
- Express 5 backend at `/api`
- PDF merge route: `POST /api/pdf/merge` — accepts multipart/form-data with `files[]` field
- Uses `pdf-lib` for PDF merging and `multer` for file uploads

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
