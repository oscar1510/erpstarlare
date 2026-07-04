# Starflare ERP

Internal ERP for Starflare — influencer marketing, SaaS subscriptions, client billing, HR, finance, tax, contracts, bank records, and operational expenses, in one place.

## Stack

- **Next.js 15** (App Router, Server Actions) + TypeScript + Tailwind CSS
- **Prisma + SQLite** — zero-config file database at `data/starflare.db`. Swap the `DATABASE_URL` in `.env` to point at Postgres later without touching application code.
- **OCR**: shells out to the system `tesseract` binary for images, and `pdftotext`/`pdftoppm` (poppler-utils) for PDFs — `pdftotext` first (instant, exact, for born-digital PDFs like Stripe invoices), falling back to rasterize-and-tesseract for scanned documents.
- **Files**: stored on local disk under `storage/uploads/`, referenced by checksum in the `Document` table (the central archive every other module links into).
- **PDF/Excel export**: `pdfkit` and `exceljs`.
- **Email**: `nodemailer`, only active if `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS` are set — otherwise invoices are still marked "sent" and can be downloaded/sent manually.

## Requirements

The OCR pipeline needs system packages, already assumed present on the host:

```
apt-get install -y tesseract-ocr poppler-utils
```

## Getting started

```bash
npm install
cp .env.example .env
npm run db:push     # create the SQLite schema
npm run db:seed     # optional: load sample Starflare data
npm run dev         # http://localhost:3000
```

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
