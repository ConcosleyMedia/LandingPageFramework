import { NextRequest, NextResponse } from 'next/server';

import { getSupabaseAdminClient } from '@/lib/supabaseServerClient';

const supabase = getSupabaseAdminClient();

export async function POST(req: NextRequest) {
  // Signature validation requires the raw request body; wire this up when deploying behind a custom server.
  // See Whop docs for the expected HMAC verification flow.

  const event = await req.json();
  console.log('Whop raw payload:', JSON.stringify(event, null, 2));
  const eventType = event?.type ?? event?.event ?? event?.action;
  console.log('Whop webhook event type:', eventType);
  console.log('Whop webhook metadata:', event?.data?.metadata ?? event?.metadata);
  console.log('Whop webhook order id:', event?.data?.id ?? event?.id, 'amount_cents:', event?.data?.amount_cents ?? event?.amount_cents);
  if (!['order.completed', 'payment.succeeded'].includes(eventType)) {
    return NextResponse.json({ ok: true });
  }

  const metadata = event.data?.metadata ?? event.metadata ?? {};
  let quizAttemptId = metadata.quiz_attempt_id;
  let product = metadata.product ?? 'mini_report';
  const amountCents = event.data?.amount_cents ?? event.data?.final_amount ?? 700;
  const providerOrderId = event.data?.id ?? event.id;

  let resolvedAttempt:
    | { id: string; user_id: string; category_id: string; affiliate_id: string | null }
    | null = null;

  if (!quizAttemptId && event.data?.user_email) {
    console.log('Attempt ID missing, falling back to latest attempt for email', event.data.user_email);
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('email', event.data.user_email)
      .maybeSingle();

    if (user?.id) {
      const { data: attempt } = await supabase
        .from('quiz_attempts')
        .select('id, status, category_id, affiliate_id, user_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (attempt?.id) {
        quizAttemptId = attempt.id;
        resolvedAttempt = attempt;
        console.log('Resolved attempt via email lookup', quizAttemptId);
      }
    }
  }

  if (!quizAttemptId || !providerOrderId) {
    console.warn('Whop webhook missing identifiers', {
      quizAttemptId,
      providerOrderId,
      metadata,
    });
    return NextResponse.json({ error: 'Missing quiz_attempt_id or order id' }, { status: 400 });
  }

  let attempt = resolvedAttempt;
  if (!attempt) {
    const { data, error } = await supabase
      .from('quiz_attempts')
      .select('id, user_id, category_id, affiliate_id')
      .eq('id', quizAttemptId)
      .single();

    attempt = data ?? null;
    if (error || !attempt) {
      return NextResponse.json({ error: 'Quiz attempt not found' }, { status: 404 });
    }
  }

  const { error: orderError } = await supabase.from('orders').insert({
    user_id: attempt.user_id,
    category_id: attempt.category_id,
    affiliate_id: attempt.affiliate_id,
    quiz_attempt_id: quizAttemptId,
    product,
    amount: amountCents,
    provider: 'whop',
    provider_order_id: providerOrderId,
  });

  if (orderError) {
    console.error('Order insert failed', orderError);
    return NextResponse.json({ error: 'Failed to record order' }, { status: 500 });
  }

  const { error: statusError } = await supabase
    .from('quiz_attempts')
    .update({ status: product === 'mini_report' ? 'mini_paid' : 'full_paid' })
    .eq('id', quizAttemptId);

  if (statusError) {
    console.error('Attempt status update failed', statusError);
    return NextResponse.json({ error: 'Failed to update attempt status' }, { status: 500 });
  }

  if (process.env.QUEUE_URL) {
    await fetch(process.env.QUEUE_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ quiz_attempt_id: quizAttemptId, product }),
    });
  }

  return NextResponse.json({ ok: true });
}
