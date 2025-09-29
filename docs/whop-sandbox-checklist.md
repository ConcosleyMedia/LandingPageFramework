# Whop Sandbox Validation Checklist

Use this flow to confirm metadata, webhook handling, and report generation end-to-end. Complete the steps in order for each category/product.

## Prerequisites
- Whop sandbox product configured with metadata passthrough enabled.
- Whop webhook URL pointing to your deployed `/api/whop/webhook` route.
- Supabase service role and queue worker (n8n or custom) running with access to `QUEUE_URL`.
- Browser with a clean session (or clear the `sid` cookie before testing).

## Steps
1. **Open a category landing page**
   - Navigate to `https://<your-domain>/<category>?a=testhandle`.
   - Confirm hero copy loads and the visit endpoint responds 200 (check network tab for `/api/visit`).

2. **Complete the free quiz**
   - Answer all questions.
   - Submit a test email. Confirm `/api/quiz/submit` returns a JSON payload with `attemptId`.
   - Verify Supabase has a `quiz_attempts` row in the SQL editor.

3. **Trigger Whop checkout**
   - Click “Unlock the full report – $7”.
   - Ensure the Whop checkout URL contains the three metadata keys:
     - `metadata[quiz_attempt_id]`
     - `metadata[category_slug]`
     - `metadata[affiliate]` (if provided in the query string)
   - In Whop, set the success redirect to `http://localhost:3000/thank-you?attemptId={metadata.quiz_attempt_id}&product=mini_report` while testing (single braces — Whop replaces them).

4. **Complete sandbox purchase**
   - Use Whop’s sandbox payment method to complete the checkout.
   - Copy the order ID displayed on the confirmation page.

5. **Verify webhook delivery**
   - In Whop dashboard → Developers → Webhooks, confirm the event shows `200 OK`.
   - In Supabase, check that an `orders` row exists with the captured metadata and amount.
   - Confirm the linked `quiz_attempts.status` updated to `mini_paid`.

6. **Confirm queue/job trigger**
   - Inspect your queue or n8n execution log to ensure it received `{ quiz_attempt_id, product }`.
   - Run the report generation worker manually if needed and insert the report row.

7. **Poll report endpoint**
   - Hit `/api/report/<attemptId>` from the browser or curl. Expect `{ ready: false }` until the worker completes, then `{ ready: true, report: {...} }`.

8. **Email delivery check**
   - Verify your Email provider (Resend/SendGrid) logs show an email sent to the test address with the hosted report link.

9. **Repeat for full assessment**
   - Swap the checkout link to your $29 product and ensure metadata, webhook, and status updates set `full_paid`.

## Troubleshooting Notes
- If the webhook fails due to signature mismatch, log the raw request body and enable HMAC verification before retrying.
- Use Supabase SQL editor to manually clear test data (`delete from orders where created_at < now() - interval '1 hour';`) between runs.
- Check Vercel/host logs for `/api/whop/webhook` to capture payloads during early debugging.
