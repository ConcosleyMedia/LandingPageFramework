import { NextRequest, NextResponse } from 'next/server';

import { getSupabaseAdminClient } from '@/lib/supabaseServerClient';

export async function GET(_req: NextRequest, { params }: { params: { attemptId: string } }) {
  const supabase = getSupabaseAdminClient();

  const { data: report, error } = await supabase
    .from('reports')
    .select('*')
    .eq('quiz_attempt_id', params.attemptId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
  }

  if (!report) {
    return NextResponse.json({ ready: false }, { status: 202 });
  }

  return NextResponse.json({ ready: true, report });
}
