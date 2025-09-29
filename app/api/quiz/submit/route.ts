import { NextRequest, NextResponse } from 'next/server';

import { getSupabaseAdminClient } from '@/lib/supabaseServerClient';

type Answer = {
  id: string;
  choice: string;
};

type QuestionSchema = {
  questions: Array<{ id: string }>;
  archetypes: Array<{ key: string; name: string }>;
  scoring: { map: Record<string, Record<string, string>> };
};

function pickArchetype(schema: QuestionSchema, answers: Answer[]) {
  const tally: Record<string, number> = {};

  for (const question of schema.questions) {
    const response = answers.find((answer) => answer.id === question.id);
    if (!response) continue;

    const archetypeKey = schema.scoring.map[question.id]?.[response.choice];
    if (!archetypeKey) continue;

    tally[archetypeKey] = (tally[archetypeKey] ?? 0) + 1;
  }

  const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1]);
  const key = sorted[0]?.[0] ?? schema.archetypes[0]?.key ?? 'unknown';
  const name = schema.archetypes.find((arc) => arc.key === key)?.name ?? key;

  return { key, name };
}

export async function POST(req: NextRequest) {
  const { email, categorySlug, affiliateHandle, answers = [] } = await req.json();

  if (!email || !categorySlug) {
    return NextResponse.json({ error: 'Missing email or categorySlug' }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();

  const { data: user, error: userError } = await supabase
    .from('users')
    .upsert({ email }, { onConflict: 'email' })
    .select('*')
    .single();

  if (userError || !user) {
    return NextResponse.json({ error: 'Unable to upsert user' }, { status: 500 });
  }

  const { data: category, error: categoryError } = await supabase
    .from('categories')
    .select('id')
    .eq('slug', categorySlug)
    .single();

  if (categoryError || !category) {
    return NextResponse.json({ error: 'Unknown category' }, { status: 404 });
  }

  const { data: questionSet, error: questionSetError } = await supabase
    .from('question_sets')
    .select('id, json_schema')
    .eq('category_id', category.id)
    .order('version', { ascending: false })
    .limit(1)
    .single();

  if (questionSetError || !questionSet) {
    return NextResponse.json({ error: 'Question set not found' }, { status: 404 });
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

  const schema = questionSet.json_schema as QuestionSchema;
  const { key, name } = pickArchetype(schema, answers as Answer[]);

  const teaserHtml = `
    <h2>${name}</h2>
    <p>You default to ${name} patterns under pressure. One quick win: 60-second nasal inhale/exhale (4:6) before big decisions. The full report covers stress triggers, habit stack, and a 7-day plan.</p>
  `;

  const { data: attempt, error: attemptError } = await supabase
    .from('quiz_attempts')
    .insert({
      user_id: user.id,
      category_id: category.id,
      affiliate_id: affiliateQuery.data?.id ?? null,
      question_set_id: questionSet.id,
      answers,
      archetype: key,
      teaser_html: teaserHtml.trim(),
      status: 'teaser_shown',
    })
    .select('id')
    .single();

  if (attemptError || !attempt) {
    return NextResponse.json({ error: 'Unable to create attempt' }, { status: 500 });
  }

  const response = NextResponse.json({
    attemptId: attempt.id,
    archetypeKey: key,
    archetypeName: name,
    teaserHtml: teaserHtml.trim(),
  });

  response.cookies.set({
    name: 'last_attempt_id',
    value: attempt.id,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}
