# Starflare ERP

Internal ERP for Starflare — influencer marketing, SaaS subscriptions, client billing, HR, finance, tax, contracts, bank records, and operational expenses, in one place.

## Stack

This app is built to run on **Vercel** (serverless): no local disk, no system binaries.

- **Next.js 15** (App Router, Server Actions) + TypeScript + Tailwind CSS
- **Prisma + Postgres** — any provider works (Vercel Postgres, Neon, Supabase). Every page that reads data is marked `export const dynamic = "force-dynamic"` so Next never runs a DB query at build time.
- **OCR**: `tesseract.js` (WASM, no native binary) for images, with the English language model bundled in the repo at `assets/tessdata/` so there's no CDN dependency at request time. PDFs are read via `pdfjs-dist` (actively maintained; the more common `pdf-parse` package was tried first and rejected — it bundles a long-abandoned pdf.js v1.10 that fails to parse plenty of real-world PDFs). A scanned PDF with no embedded text layer has no OCR path in this deployment (see Known limitations) — it's saved and marked "needs review" rather than lost.
- **Files**: uploaded to **Vercel Blob** (`@vercel/blob`) when `BLOB_READ_WRITE_TOKEN` is set, referenced by checksum in the `Document` table (the central archive every other module links into). Falls back to local disk when that token is absent, purely so local development doesn't need a live Blob store — that fallback does not persist on Vercel and must not be relied on in production.
- **PDF/Excel export**: `pdfkit` and `exceljs`. `pdfkit`, `fontkit`, `tesseract.js`, and `pdfjs-dist` are all marked `serverExternalPackages` in `next.config.mjs` — each reads binary assets (font metrics, WASM) from disk relative to its own package directory at runtime, and letting webpack bundle them breaks that path resolution.
- **Email**: `nodemailer`, only active if `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS` are set — otherwise invoices are still marked "sent" and can be downloaded/sent manually.

## Deploying on Vercel

1. Provision a Postgres database (Vercel Postgres, Neon, or Supabase) and set `DATABASE_URL` (pooled) and `DIRECT_URL` (direct) as project env vars.
2. Create a Blob store from the Storage tab and connect it to the project — this injects `BLOB_READ_WRITE_TOKEN` automatically.
3. Deploy. The build runs `prisma generate && prisma migrate deploy && next build`, so the schema is applied automatically on every deploy — no manual migration step.
4. Optionally set `SMTP_*` env vars to enable outgoing invoice emails.

## Getting started locally

```bash
npm install
cp .env.example .env   # point DATABASE_URL/DIRECT_URL at a local or hosted Postgres
npm run db:migrate     # apply migrations (creates them the first time, prompts for a name)
npm run db:seed        # optional: load sample Starflare data
npm run dev            # http://localhost:3000
```

Without `BLOB_READ_WRITE_TOKEN` set, uploads are written to `storage/uploads/` on disk instead — fine for local dev, not for Vercel.

## Architecture notes

- **`src/lib/ocr/`** — the OCR engine (`engine.ts`) and the per-document-type field extractors (`extractors.ts`), built on shared regex heuristics (`parse-helpers.ts`) that always return a value *and* a confidence score. Nothing is ever silently trusted: low-confidence fields are flagged in the UI (`ConfidenceBadge`) and the source document is marked `NEEDS_REVIEW` when OCR fails or confidence is low — the file is still saved either way.
- **`src/lib/documents.ts`** — `ingestDocument()` is the single entry point every module uses to save + OCR + extract a file. It's also where duplicate-checksum detection happens.
- **`src/lib/deadlines.ts`** — `upsertAutoDeadline()` is called by every module whenever a record has a due/expiry/renewal date, keyed on `(sourceModule, sourceId, category)` so edits update the same deadline instead of duplicating it, and never resurrects a deadline the user already completed/cancelled.
- **`src/lib/audit.ts`** — `logAudit()` records who did what, called from every server action that mutates data.
- **No auth / roles**: per spec, this is intentionally not a permissions system. Every record that needs "who did this" instead uses a lightweight actor picker (`ActorSelect`) — Oscar, Cristina, employee, freelancer, intern, contractor, vendor, client, or other — optionally linked to a full HR profile.

## Module map (matches the spec's navigation order)

1. `/` — KPI Dashboard
2. `/expenses/scan` — Quick Expense Scanner
3. `/billing` — Client invoices + Stripe invoice → Starflare invoice conversion
4. `/clients` — Clients, purchases, subscriptions
5. `/payments` — Payments & reconciliation
6. `/received-invoices` — Supplier/vendor invoices
7. `/bank` — Bank statements, transactions, bank documents
8. `/ledger` — General ledger, P&L, cashflow
9. `/hr` — People, documents, compensation, reimbursements
10. `/admin-tax` — Licenses, FTA/VAT, corporate tax
11. `/rent` — Lease/office records
12. `/contracts/{received,sent,policies}` — Contracts and platform policies
13. `/deadlines` — Deadline calendar (auto-populated from every module above)
14. `/documents` — Central document archive with OCR full-text search
15. `/audit-log` — Activity history
16. `/reports` — Exportable business/finance/admin reports
17. `/search` — Global search across everything

## Known limitations (intentional, per Phase 1 scope)

- No approval workflows, no complex role-based permissions.
- No live credit-balance tracking for clients — only purchase history.
- Bank statement transaction parsing is heuristic (regex over OCR/text output); always spot-check parsed transactions since bank PDF layouts vary widely.
- Email sending requires SMTP env vars; without them, invoices are still marked "sent" for record-keeping.
- **Scanned PDFs (no embedded text layer) can't be OCR'd in this deployment.** Serverless has no system binary to rasterize a PDF page to an image, so a scanned PDF is saved and marked "needs review" instead. Photos/images of the same document work fine (tesseract.js handles those). If this matters a lot in practice, the clean fix is a hosted OCR API (Google Document AI, AWS Textract, Azure Document Intelligence) — `src/lib/ocr/engine.ts` is the single place that would change.
