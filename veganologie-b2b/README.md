# Veganologie · B2B Corporate Order & Profitability Tool

A lightweight, single-screen **quotation calculator** for Veganologie B2B /
corporate orders. Select products → add quantities → apply discounts → add
extra costs → see the **real profit margin** on a live gauge → generate a
professional PDF quotation.

It is intentionally **not** a CRM/ERP. There is **no backend and no database** —
everything runs in the browser and is saved to `localStorage`. That is what
makes it trivial to deploy on Vercel.

## Features

- **Import products** from two Excel/CSV files (retail price + production cost),
  matched by SKU when present, otherwise by product name (with a manual
  cost-override screen for anything that doesn't auto-match).
- **One screen**: Customer → Products (qty + per-line discount) → Options
  (packaging / logo / shipping) → Profitability.
- **Live profitability gauge** (POOR → EXCELLENT) plus Revenue / Cost / Profit /
  Margin, Retail Value and Total Discount — all internal only.
- **Generate Quotation** as a branded PDF with 5% UAE VAT, lead times,
  what's-included, materials & certifications and terms.
- **Save / Open / Edit / Duplicate / Delete** orders.

Production cost, total cost, profit, margin and the gauge are **internal** and
never appear on the customer PDF.

## Run locally

```bash
cd veganologie-b2b
npm install
npm run dev      # http://localhost:5173
npm run build    # production build into dist/
```

## Deploy on Vercel

This app lives in the `veganologie-b2b/` subfolder of the repo, so point
Vercel at that folder:

1. Push this branch to GitHub.
2. On [vercel.com](https://vercel.com) → **Add New… → Project** → import this
   repository.
3. In the project setup, set **Root Directory** to `veganologie-b2b`.
4. Framework preset is auto-detected as **Vite** (Build `npm run build`,
   Output `dist`). No environment variables are needed.
5. Click **Deploy**.

Or via CLI:

```bash
npm i -g vercel
cd veganologie-b2b
vercel        # follow prompts; accept the Vite defaults
vercel --prod
```

No database, no secrets, no server functions — a pure static deploy.
