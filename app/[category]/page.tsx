import { notFound } from 'next/navigation';

import { getSupabaseAdminClient } from '@/lib/supabaseServerClient';
import QuizFlow from './QuizFlow';

export const dynamic = 'force-dynamic';

type QuestionOption = string;

type Question = {
  id: string;
  text: string;
  options: QuestionOption[];
};

type QuestionSchema = {
  title: string;
  questions: Question[];
};

type CategoryPageProps = {
  params: Promise<{ category: string }>;
  searchParams?: Promise<Record<string, string | string[]>>;
};

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  const supabase = getSupabaseAdminClient();

  const { data: category, error: categoryError } = await supabase
    .from('categories')
    .select('id, slug, name, description')
    .eq('slug', resolvedParams.category)
    .maybeSingle();

  if (categoryError || !category) {
    notFound();
  }

  const { data: questionSet, error: questionError } = await supabase
    .from('question_sets')
    .select('json_schema')
    .eq('category_id', category.id)
    .order('version', { ascending: false })
    .limit(1)
    .single();

  if (questionError || !questionSet?.json_schema) {
    notFound();
  }

  const affiliateHandleParam = resolvedSearchParams?.a;
  const affiliateHandle = Array.isArray(affiliateHandleParam)
    ? affiliateHandleParam[0]
    : affiliateHandleParam ?? null;

  const schema = questionSet.json_schema as QuestionSchema;

  const heroTitle = `Find your ${category.name} type in 60 seconds`;
  const heroSubtitle =
    category.description ??
    'Understand your default patterns under pressure and get a tailored action plan in minutes — no fluff, just insight.';

  const benefits = [
    'Pinpoint how you show up when work, relationships, and stress collide.',
    'Unlock a 7-day plan built from your exact responses — not generic advice.',
    'Upgrade with the full assessment for deeper coaching, PDFs, and audio summaries.',
  ];

  const testimonials = [
    {
      quote: '“Took 2 minutes. Felt called out in the best way — the follow-up plan has me calmer in meetings already.”',
      name: 'Maya L., Product Lead',
    },
    {
      quote: '“Sold a $7 report in under an hour of posting. My audience keeps asking for more.”',
      name: 'Coach Avery (Affiliate Partner)',
    },
  ];

  return (
    <div className="bg-slate-50">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-16 px-6 py-16">
        <section className="grid gap-10 md:grid-cols-[1.2fr,1fr] md:items-center">
          <div className="space-y-6">
            <p className="text-sm uppercase tracking-[0.2em] text-indigo-500">{category.slug}</p>
            <h1 className="text-4xl font-semibold leading-tight text-slate-900 md:text-5xl">{heroTitle}</h1>
            <p className="text-lg text-slate-600 md:text-xl">{heroSubtitle}</p>
            <ul className="space-y-3">
              {benefits.map((benefit) => (
                <li key={benefit} className="flex gap-3 text-slate-700">
                  <span className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-600">✓</span>
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-4">
              <a
                href="#quiz"
                className="inline-flex items-center justify-center rounded-full bg-indigo-600 px-6 py-3 text-base font-semibold text-white transition hover:bg-indigo-500"
              >
                Start the free test
              </a>
              <p className="text-sm text-slate-500">60 seconds • no signup until teaser</p>
            </div>
          </div>

          <div className="space-y-4">
            {testimonials.map((testimonial) => (
              <blockquote key={testimonial.name} className="rounded-2xl border border-indigo-100 bg-white p-6 shadow-sm">
                <p className="text-base italic text-slate-700">{testimonial.quote}</p>
                <footer className="mt-4 text-sm font-semibold text-slate-600">{testimonial.name}</footer>
              </blockquote>
            ))}
          </div>
        </section>

        <section id="quiz">
          <QuizFlow
            categorySlug={category.slug}
            categoryName={category.name}
            description={category.description ?? ''}
            questionSchema={schema}
            affiliateHandle={affiliateHandle}
          />
        </section>
      </div>
    </div>
  );
}
