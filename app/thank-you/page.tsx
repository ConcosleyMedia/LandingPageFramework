import { Suspense } from 'react';
import Link from 'next/link';
import { cookies } from 'next/headers';

import ReportPoller from './report-poller';
import { getSupabaseAdminClient } from '@/lib/supabaseServerClient';

export const dynamic = 'force-dynamic';

type ThankYouProps = {
  searchParams: Promise<Record<string, string | string[]>>;
};

const parseParam = (value: string | string[] | undefined) => {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
};

const ATTEMPT_ID_REGEX = /^[0-9a-fA-F-]{10,}$/;

export default async function ThankYouPage({ searchParams }: ThankYouProps) {
  const params = await searchParams;
  const cookieStore = await cookies();

  const attemptId = parseParam(params?.attemptId);
  let product = parseParam(params?.product) ?? 'mini_report';
  const checkoutStatus = parseParam(params?.checkout_status);
  const receiptId = parseParam(params?.receipt_id);

  let resolvedAttemptId = attemptId;
  let fallbackMessage: string | null = null;

  const supabase = getSupabaseAdminClient();

  if ((!resolvedAttemptId || !ATTEMPT_ID_REGEX.test(resolvedAttemptId)) && receiptId) {
    const { data: order, error } = await supabase
      .from('orders')
      .select('quiz_attempt_id, product')
      .eq('provider_order_id', receiptId)
      .maybeSingle();

    if (!error && order?.quiz_attempt_id && ATTEMPT_ID_REGEX.test(order.quiz_attempt_id)) {
      resolvedAttemptId = order.quiz_attempt_id;
      product = order.product ?? product;
    } else {
      fallbackMessage = 'We are waiting for your payment to sync. Refresh in a few seconds or check back from the email once it arrives.';
    }
  }

  if (!resolvedAttemptId || !ATTEMPT_ID_REGEX.test(resolvedAttemptId)) {
    const lastAttemptCookie = cookieStore.get('last_attempt_id')?.value;
    if (lastAttemptCookie && ATTEMPT_ID_REGEX.test(lastAttemptCookie)) {
      resolvedAttemptId = lastAttemptCookie;
    }
  }

  const hasAttempt = Boolean(resolvedAttemptId && ATTEMPT_ID_REGEX.test(resolvedAttemptId));

  if (hasAttempt && receiptId) {
    await ensureOrderForReceipt({
      receiptId,
      attemptId: resolvedAttemptId!,
      product,
      supabase,
    });
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-8 px-6 py-16">
      <header className="space-y-4 text-center">
        <p className="text-sm uppercase tracking-[0.2em] text-indigo-500">Order Received</p>
        <h1 className="text-4xl font-semibold text-slate-900">We&apos;re building your report</h1>
        <p className="text-base text-slate-600">
          Your answers are en route to our AI writer, PDF renderer, and optional audio engine. This usually takes 30–90 seconds.
        </p>
        {receiptId ? (
          <p className="text-xs text-slate-500">Whop receipt: {receiptId}</p>
        ) : null}
        {checkoutStatus === 'success' ? null : (
          <p className="text-xs text-amber-600">Checkout status not marked success — if you didn&apos;t finish payment, head back and try again.</p>
        )}
        {!hasAttempt ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
            <p className="font-semibold">Missing attempt identifier</p>
            <p>
              We didn&apos;t receive a valid quiz attempt ID. Double-check your Whop redirect URL uses <code>{'{metadata.quiz_attempt_id}'}</code> (single braces) so the value is injected.
            </p>
            {receiptId ? (
              <p className="mt-2 text-xs">
                Receipt <span className="font-semibold">{receiptId}</span> is logged but not linked yet. {fallbackMessage}
              </p>
            ) : null}
          </div>
        ) : null}
      </header>

      {hasAttempt && resolvedAttemptId ? (
        <Suspense
          fallback={
            <div className="rounded-3xl border border-indigo-100 bg-white p-6 shadow-sm">
              <p className="text-base text-slate-600">Locking in your insights…</p>
            </div>
          }
        >
          <ReportPoller attemptId={resolvedAttemptId} product={product} />
        </Suspense>
      ) : null}

      <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-900">Ready to go deeper?</h2>
        <p className="text-sm text-slate-600">
          Upgrade to the full assessment for the 30-question deep dive, 7 dimensions, printable PDF, and audio summary.
        </p>
        <FullUpsellButton attemptId={resolvedAttemptId} product="full_assessment" />
      </section>

      <footer className="space-y-2 text-center text-xs text-slate-500">
        <p>Need help? Reply to the email that delivers your report — we read every response.</p>
        <Link href="/" className="text-indigo-500 hover:text-indigo-600">Back to categories</Link>
      </footer>
    </main>
  );
}

type FullUpsellButtonProps = {
  attemptId?: string;
};

function FullUpsellButton({ attemptId }: FullUpsellButtonProps) {
  const fullUrl = process.env.NEXT_PUBLIC_WHOP_FULL_URL;

  if (!fullUrl) {
    return (
      <p className="text-xs text-amber-600">
        Configure <code>NEXT_PUBLIC_WHOP_FULL_URL</code> to enable the $29 upsell checkout link.
      </p>
    );
  }

  if (!attemptId || attemptId === '{{metadata.quiz_attempt_id}}') {
    return (
      <button
        type="button"
        disabled
        className="w-full cursor-not-allowed rounded-full bg-slate-200 px-6 py-3 text-sm font-semibold text-slate-500"
      >
        Waiting for quiz attempt…
      </button>
    );
  }

  let href = '#';
  try {
    const url = new URL(fullUrl);
    url.searchParams.set('metadata[quiz_attempt_id]', attemptId);
    url.searchParams.set('metadata[product]', 'full_assessment');
    href = url.toString();
  } catch (error) {
    console.error('Invalid full Whop URL', error);
  }

  return (
    <a
      href={href}
      className="block w-full rounded-full bg-slate-900 px-6 py-3 text-center text-base font-semibold text-white transition hover:bg-slate-800"
    >
      Upgrade to the full assessment – $29
    </a>
  );
}

async function ensureOrderForReceipt({
  receiptId,
  attemptId,
  product,
  supabase,
}: {
  receiptId: string;
  attemptId: string;
  product: string;
  supabase: ReturnType<typeof getSupabaseAdminClient>;
}) {
  const existingOrder = await supabase
    .from('orders')
    .select('id')
    .eq('provider_order_id', receiptId)
    .maybeSingle();

  if (existingOrder.data?.id) return;

  const { data: attempt } = await supabase
    .from('quiz_attempts')
    .select('id, user_id, category_id, affiliate_id')
    .eq('id', attemptId)
    .maybeSingle();

  if (!attempt) return;

  const amount = product === 'full_assessment' ? 2900 : 700;

  await supabase.from('orders').insert({
    user_id: attempt.user_id,
    category_id: attempt.category_id,
    affiliate_id: attempt.affiliate_id,
    quiz_attempt_id: attempt.id,
    product: product === 'full_assessment' ? 'full_assessment' : 'mini_report',
    amount,
    provider: 'whop',
    provider_order_id: receiptId,
    payout_status: 'pending',
  });

  await supabase
    .from('quiz_attempts')
    .update({ status: product === 'full_assessment' ? 'full_paid' : 'mini_paid' })
    .eq('id', attempt.id);
}
