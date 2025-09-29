# Category-Agnostic Quiz→Report Micro-Funnel Engine Blueprint

Perfect. You’re building a **category-agnostic quiz→report micro-funnel engine**. Here’s a lean V1 that actually ships, scales, and won’t paint you into a corner.

# Architecture (V1)

**Stack:** Next.js (App Router) + Supabase (Auth/DB/Storage) + Whop (checkout + affiliates) + n8n (or simple queue) to orchestrate AI (GPT for text, image gen as needed) + Resend/Sendgrid for email.

**Domain model:** each **Category** = its own lander + question set + prompts + pricing. Each **Affiliate** gets a **tracking link** that maps to that category.

---

# Data Model (Supabase)

## Core tables

* **categories**

  * id (uuid, pk)
  * slug (text, unique) — e.g., `brain`, `astrology`, `iq`
  * name, description
  * pricing_low (int cents) — e.g., 700
  * pricing_high (int cents) — e.g., 2900
  * is_active (bool)

* **question_sets**

  * id (uuid, pk)
  * category_id (fk → categories)
  * version (int) — bump when you change questions
  * json_schema (jsonb) — questions/answers/options
  * created_at

* **prompts**

  * id (uuid, pk)
  * category_id (fk)
  * type (enum: `teaser`, `mini_report`, `full_report`, `image_prompt`)
  * template (text) — your prompt with handlebars: `{{archetype}}`, `{{answers}}`, etc.
  * model (text) — e.g., `gpt-4o-mini`, `gpt-image`

* **affiliates**

  * id (uuid, pk)
  * handle (text, unique) — used in the URL, e.g., `?a=brainfacts`
  * source (text) — tiktok/ig
  * whop_affiliate_id (text) — for payouts mapping
  * is_active (bool)

* **visits**

  * id (bigint, pk)
  * category_id (fk)
  * affiliate_id (fk, nullable)
  * session_id (uuid) — first-party cookie
  * ip_hash (text)
  * ua_hash (text)
  * arrived_at (timestamptz)

* **users** *(lightweight, not Supabase Auth unless you want it)*

  * id (uuid, pk)
  * email (text, unique)
  * created_at

* **quiz_attempts**

  * id (uuid, pk)
  * user_id (fk)
  * category_id (fk)
  * affiliate_id (fk, nullable)
  * question_set_id (fk)
  * answers (jsonb)
  * archetype (text) — computed
  * teaser_html (text) — 10% preview
  * status (enum: `started`,`teaser_shown`,`mini_paid`,`full_paid`)
  * created_at

* **orders**

  * id (uuid, pk)
  * user_id (fk)
  * category_id (fk)
  * affiliate_id (fk, nullable)
  * quiz_attempt_id (fk)
  * product (enum: `mini_report`,`full_assessment`)
  * amount (int cents)
  * provider (enum: `whop`)
  * provider_order_id (text)
  * payout_status (enum: `pending`,`paid`)
  * created_at

* **reports**

  * id (uuid, pk)
  * quiz_attempt_id (fk)
  * type (enum: `mini`,`full`)
  * html (text)
  * pdf_url (text) — Supabase Storage
  * images (jsonb) — generated image URLs
  * audio_url (text) — ElevenLabs, for “human intervention” vibe
  * created_at

---

# URL & Tracking

**Public lander:**
`/{category}?a={affiliate_handle}`

* On load: create `visits` row (server action), set `session_id` cookie.
* Click “Start Free Test” → open quiz modal/pages.
* Email capture before showing teaser.

**Why this works:** one domain, many categories, affiliate clarity, first-party analytics (you own it). You can still host per-category on subdomains later; the schema doesn’t change.

---

# User Flow (exact)

1. **Visit** `/{category}?a=brainfacts` → record `visits`.
2. **Start quiz** (5–7 Qs).
3. **Email gate** → create `users` row if new.
4. **Compute archetype** (fast local logic) → render **teaser_html** (store in `quiz_attempts`).
5. Show 10% of result on screen; CTA: **Unlock full report – $7**.
6. On click → **Whop checkout** with metadata: `{quiz_attempt_id, category_id, affiliate_id}` (pass through).
7. **Webhook from Whop** → create `orders` row, kick **report generation job** (n8n/queue).
8. **Report generation**:

   * Build payload `{answers, archetype, prompts}` → call LLM to produce `html`.
   * Optional images via image model (if needed).
   * Render PDF (server-side HTML→PDF), upload to Supabase Storage.
   * Optional ElevenLabs TTS for summary → store `audio_url`.
   * Insert `reports` row.
9. **Email user** with link to hosted report + PDF.
10. **Thank-you page** concurrently offers **$29 deep assessment** (30 Qs) → same loop.

---

# Payments (Whop)

* **One Whop product per category per tier** (or dynamic pricing via metadata—start simple).
* Pass `affiliate_handle`, `quiz_attempt_id` in Whop **checkout metadata**.
* On **Whop webhook**:

  * Verify signature.
  * Upsert `orders`, attach affiliate mapping for payout.
  * Trigger generation job.

**Affiliates:** you can manage commissions in Whop; your internal `affiliates` table maps clicks/visits to revenue for sanity checks and conversion rate reporting.

---

# Analytics (what you asked to see first)

Minimal **Conversion Dashboard** (you can throw in a Next.js route w/ RLS-safe views):

* **Landing views**: `count(visits where category_id=...)`
* **Quiz starts / completes**: `count(quiz_attempts by status)`
* **Free → $7 conversion**: `orders where product='mini_report' ÷ quiz_attempts.teaser_shown`
* **$7 → $29 conversion**: `orders 'full_assessment' ÷ orders 'mini_report'`
* **By affiliate**: same metrics grouped by `affiliate_id`.

You only care about **views** today → `visits` gets you there immediately, with breakdown by `{category, affiliate}`.

---

# Frontend (mobile-first, fast)

* **One React layout** per category reading from `question_sets.json_schema`.
* Quiz is **single screen per question**, big tappable cards, progress bar, <60s total.
* Teaser result renders **instantly** from an archetype lookup; no AI call until paid.
* All copy + prompts live in DB so new categories don’t need redeploy.

---

# Report Generation (reliable + cheap)

* **Mini report ($7):**

  * No images by default (keep COGS near $0).
  * Pure HTML (10–15 paragraphs), converted to PDF.
* **Full assessment ($29):**

  * Structured sections (overview, 7 dimensions, stress response, habits, action plan).
  * Optional: 2–3 generated images (or stock + dynamic captions).
  * 2–3 min TTS summary via ElevenLabs.

**Template strategy:**

* Keep **strict section IDs** in the prompt; render to HTML with a lightweight template (Tailwind styles inline or CSS file).
* You can cache common archetype chunks to reduce tokens.

---

# Security & Compliance (lightweight)

* Hash IP/UA in `visits` for privacy.
* Rate-limit quiz submissions by `session_id`.
* RLS: partition `reports`/`orders` by `user_id` if you later expose a user portal.
* Clear disclaimers: educational, not medical advice.

---

# Shipping Order (2 weeks)

**Day 1–2**

* Create Supabase tables.
* Seed `categories` (brain/astrology/iq), v1 `question_sets` (brain only).
* Build lander + quiz UI (mobile-first).

**Day 3–4**

* Email capture + teaser screen + `quiz_attempts` writes.
* `visits` tracking + affiliate param handling.

**Day 5–6**

* Whop product + checkout link with metadata.
* Webhook endpoint → `orders` + job enqueue.

**Day 7–9**

* n8n (or simple queue) flow to call LLM → HTML → PDF (store) → email.
* Thank-you page with $29 upsell.

**Day 10–12**

* Minimal analytics dashboard (views, CVR by affiliate).
* QA mobile experience; tighten copy.

**Day 13–14**

* Onboard 3–5 creators manually (DM → give `?a=handle` links).
* Watch numbers; iterate.

---

# Copy Blocks (plug-and-play)

**Lander H1 (Brain/Behavior):**
“Find your Brain Type in 60 Seconds”
Sub: “Why you shut down under stress — and how to fix it. Free test.”

**Teaser Paywall CTA:**
“You’re a **Calm Strategist**. Unlock your full report (stress triggers, habit plan, quick wins) — **$7**.”

**Full Upsell CTA:**
“Get your complete 7-dimension brain profile (30 questions) + PDF + audio summary — **$29**.”

---

# What I’ll do next (unless you object)

* Draft **SQL for the tables** above (ready to paste into Supabase).
* Provide **Next.js route skeletons**: `/api/visit`, `/api/quiz/submit`, `/api/whop/webhook`, `/api/report/:id`.
* Give you a **JSON schema** example for `question_sets` and a **prompt template** for mini/full reports.

If you want me to just hand you those now, say the word and I’ll drop the code and schema so you can spin V1 immediately.
