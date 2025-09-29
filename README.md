# Funnel Engine

Next.js + Supabase micro-funnel for quiz → AI report products.

## Getting Started

1. Install dependencies (already done if you ran `npm install`):
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env.local` and fill in Supabase + Whop keys.
3. Run the dev server:
   ```bash
   npm run dev
   ```
4. Open `http://localhost:3000/brain?a=test_aff` after seeding Supabase with the `brain` category and question set.

## Useful Scripts
- `npm run dev` – Start Next.js in development mode.
- `npm run build` – Create a production build.
- `npm run start` – Run the production server.
- `npm run lint` – Execute Next.js linting.

Refer to `docs/whop-sandbox-checklist.md` to validate the Whop checkout flow end-to-end.
