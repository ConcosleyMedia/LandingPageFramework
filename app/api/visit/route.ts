import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomUUID, createHash } from 'crypto';

import { getSupabaseAdminClient } from '@/lib/supabaseServerClient';

const SESSION_COOKIE = 'sid';

export async function POST(req: NextRequest) {
  const { categorySlug, affiliateHandle } = await req.json();

  if (!categorySlug) {
    return NextResponse.json({ error: 'Missing categorySlug' }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value ?? randomUUID();
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '0.0.0.0';
  const ua = req.headers.get('user-agent') ?? 'unknown';

  const { data: category, error: categoryError } = await supabase
    .from('categories')
    .select('id')
    .eq('slug', categorySlug)
    .single();

  if (categoryError || !category) {
    return NextResponse.json({ error: 'Unknown category' }, { status: 404 });
  }

  const affiliateQuery = affiliateHandle
    ? await supabase
        .from('affiliates')
        .select('id')
        .eq('handle', affiliateHandle)
        .maybeSingle()
    : { data: null, error: null };

  if (affiliateQuery.error) {
    return NextResponse.json({ error: 'Affiliate lookup failed' }, { status: 500 });
  }

  const ipHash = createHash('sha256').update(ip).digest('hex').slice(0, 32);
  const uaHash = createHash('sha256').update(ua).digest('hex').slice(0, 32);

  const { error: insertError } = await supabase.from('visits').insert({
    category_id: category.id,
    affiliate_id: affiliateQuery.data?.id ?? null,
    session_id: sessionId,
    ip_hash: ipHash,
    ua_hash: uaHash,
  });

  if (insertError) {
    return NextResponse.json({ error: 'Failed to record visit' }, { status: 500 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: SESSION_COOKIE,
    value: sessionId,
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
  });

  return res;
}
