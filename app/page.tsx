import Link from 'next/link';

const quickCategories = [
  { slug: 'brain', label: 'Brain Type' },
  { slug: 'astrology', label: 'Astrology Archetype' },
  { slug: 'iq', label: 'IQ Snapshot' },
];

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col justify-center gap-12 px-6 py-20 text-center">
      <section className="space-y-6">
        <p className="text-sm uppercase tracking-[0.2em] text-indigo-500">Micro-funnel engine</p>
        <h1 className="text-4xl font-semibold text-slate-900 md:text-5xl">Spin up quiz → AI report funnels in minutes</h1>
        <p className="mx-auto max-w-2xl text-lg text-slate-600">
          Choose a category, run a 60-second quiz, charge for deeper insight. One domain, infinite niches. Drop into a category below or add your own inside Supabase.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          {quickCategories.map((category) => (
            <Link
              key={category.slug}
              href={`/${category.slug}`}
              className="inline-flex items-center justify-center rounded-full border border-indigo-100 bg-white px-5 py-2 text-sm font-semibold text-indigo-600 shadow-sm transition hover:border-indigo-400 hover:text-indigo-700"
            >
              {category.label}
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
