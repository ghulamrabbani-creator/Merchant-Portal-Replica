# Geidea Merchant Portal — Design Reference Replica

A visual/functional replica of the Geidea merchant portal (MPGS/CYBS gateway), 
built for internal use as:
1. A visual reference for developers when requesting UI changes
2. A design sandbox for prototyping enhancements

This is **not** connected to any real backend. All data in `src/lib/mock-data.ts`
is placeholder/dummy data — no real merchant, transaction, or customer data.

## Stack
- Next.js 15 (App Router) + TypeScript
- Tailwind CSS v4 (design tokens in `src/app/globals.css`)
- recharts (dashboard charts), lucide-react (icons)

## Pages
- `/dashboard` — overview, metric cards, trend chart, top stores/schemes, transaction type breakdown
- `/transactions` — list with filters/search/export, expandable rows
- `/transactions/[id]` — full transaction detail
- `/payouts` — payouts list with expandable rows
- `/pay-by-link/payment-links` — list + Create Payment Link modal (Quick/Standard link, live preview)
- `/pay-by-link/payment-links/[id]` — payment link detail with timeline
- `/pay-by-link/static-links` — static links list
- `/pay-by-link/recurring-payments` — recurring payments list
- `/pay-by-link/bulk-uploads` — CSV/XLSX bulk upload UI

## Local development
```bash
npm install
npm run dev
```
Visit http://localhost:3000

## Editing content
- Mock data: `src/lib/mock-data.ts`
- Design tokens (colors): `src/app/globals.css` (`:root` and `@theme inline`)
- Layout/nav: `src/components/layout/Sidebar.tsx`, `Topbar.tsx`
- Shared UI: `src/components/ui/`

## Deploying to Vercel

**Option A — GitHub (recommended for ongoing dev work):**
1. Push this folder to a new GitHub repo:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Geidea portal design reference"
   git branch -M main
   git remote add origin <your-repo-url>
   git push -u origin main
   ```
2. Go to https://vercel.com/new, import the repo, keep default settings (Next.js
   is auto-detected), click Deploy.
3. Every future push to `main` auto-deploys.

**Option B — Vercel CLI (fastest, no GitHub needed):**
```bash
npm install -g vercel
vercel login
vercel        # deploy a preview
vercel --prod # deploy to production URL
```
