'use client';

import { useEffect, useMemo, useState } from 'react';

type Answer = {
  id: string;
  choice: string;
};

type Question = {
  id: string;
  text: string;
  options: string[];
};

type QuestionSchema = {
  title: string;
  questions: Question[];
};

type QuizFlowProps = {
  categorySlug: string;
  categoryName: string;
  description: string;
  questionSchema: QuestionSchema;
  affiliateHandle: string | null;
};

type SubmitResponse = {
  attemptId: string;
  archetypeKey: string;
  archetypeName: string;
  teaserHtml: string;
};

const FIRST_PARTY_VISIT_ENDPOINT = '/api/visit';
const QUIZ_SUBMIT_ENDPOINT = '/api/quiz/submit';

const extractChoiceKey = (option: string) => option.split(')')[0]?.trim();

export default function QuizFlow({
  categorySlug,
  categoryName,
  description,
  questionSchema,
  affiliateHandle,
}: QuizFlowProps) {
  const [phase, setPhase] = useState<'quiz' | 'email' | 'teaser'>('quiz');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [teaser, setTeaser] = useState<SubmitResponse | null>(null);
  const [visitStatus, setVisitStatus] = useState<'idle' | 'pending' | 'recorded' | 'failed'>('idle');

  const questionCount = questionSchema.questions.length;
  const currentQuestion = questionSchema.questions[currentIndex];

  useEffect(() => {
    const recordVisit = async () => {
      setVisitStatus('pending');
      try {
       await fetch(FIRST_PARTY_VISIT_ENDPOINT, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            categorySlug,
            affiliateHandle,
          }),
        });
        setVisitStatus('recorded');
      } catch (err) {
        console.error('Failed to record visit', err);
        setVisitStatus('failed');
      }
    };

    recordVisit();
  }, [categorySlug, affiliateHandle]);

  const handleOptionClick = (option: string) => {
    if (phase !== 'quiz') return;

    const choiceKey = extractChoiceKey(option);
    if (!choiceKey || !currentQuestion) return;

    const nextAnswers = [...answers.filter((ans) => ans.id !== currentQuestion.id), { id: currentQuestion.id, choice: choiceKey }];
    setAnswers(nextAnswers);

    if (currentIndex + 1 < questionCount) {
      setCurrentIndex((idx) => idx + 1);
    } else {
      setPhase('email');
    }
  };

  const submitQuiz = async () => {
    try {
      setIsSubmitting(true);
      setError(null);

      const response = await fetch(QUIZ_SUBMIT_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email,
          categorySlug,
          affiliateHandle,
          answers,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Unable to process quiz');
      }

      const data = (await response.json()) as SubmitResponse;
      setTeaser(data);
      setPhase('teaser');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error');
      setPhase('email');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email) {
      setError('Please enter your email to continue');
      return;
    }

    void submitQuiz();
  };

  const progress = Math.round(((currentIndex + (phase === 'quiz' ? 1 : questionCount)) / questionCount) * 100);

  const whopMiniUrl = process.env.NEXT_PUBLIC_WHOP_MINI_URL;
  const whopFullUrl = process.env.NEXT_PUBLIC_WHOP_FULL_URL;
  const checkoutUrl = useMemo(() => {
    if (!teaser?.attemptId || !whopMiniUrl) return '#';
    try {
      const url = new URL(whopMiniUrl);
      url.searchParams.set('metadata[quiz_attempt_id]', teaser.attemptId);
      url.searchParams.set('metadata[category_slug]', categorySlug);
      if (affiliateHandle) {
        url.searchParams.set('metadata[affiliate]', affiliateHandle);
      }
      return url.toString();
    } catch (err) {
      console.error('Invalid WHOP URL', err);
      return '#';
    }
  }, [teaser?.attemptId, affiliateHandle, categorySlug, whopMiniUrl]);

  const fullUpsellUrl = useMemo(() => {
    if (!teaser?.attemptId || !whopFullUrl) return '#';
    try {
      const url = new URL(whopFullUrl);
      url.searchParams.set('metadata[quiz_attempt_id]', teaser.attemptId);
      url.searchParams.set('metadata[category_slug]', categorySlug);
      if (affiliateHandle) {
        url.searchParams.set('metadata[affiliate]', affiliateHandle);
      }
      return url.toString();
    } catch (err) {
      console.error('Invalid WHOP URL', err);
      return '#';
    }
  }, [teaser?.attemptId, affiliateHandle, categorySlug, whopFullUrl]);

  return (
    <div className="mx-auto w-full max-w-3xl rounded-3xl bg-white px-6 py-10 shadow-xl shadow-indigo-100">
      <header className="space-y-2 text-center">
        <p className="text-sm uppercase tracking-wide text-indigo-500">{categoryName}</p>
        <h2 className="text-3xl font-semibold text-slate-900">{questionSchema.title}</h2>
        {description ? <p className="text-sm text-slate-600">{description}</p> : null}
        <div className="mt-4 h-2 w-full rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${progress}%` }} />
        </div>
        {visitStatus === 'failed' ? (
          <p className="text-xs text-amber-600">Visit tracking hiccup — quiz still works, but analytics may miss this session.</p>
        ) : null}
      </header>

      {phase === 'quiz' && currentQuestion ? (
        <section className="space-y-4">
          <p className="text-lg font-medium">{currentQuestion.text}</p>
          <div className="grid gap-3">
            {currentQuestion.options.map((option) => (
              <button
                key={option}
                type="button"
                className="rounded-lg border border-slate-200 bg-white px-4 py-4 text-left text-base font-medium shadow-sm transition hover:border-indigo-400 hover:shadow-md"
                onClick={() => handleOptionClick(option)}
              >
                {option}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {phase === 'email' ? (
        <section className="space-y-4">
          <p className="text-lg font-medium">Unlock your preview</p>
          <p className="text-sm text-slate-600">Drop your email to see the first slice of your brain type.</p>
          <form onSubmit={handleEmailSubmit} className="space-y-3">
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-indigo-500 focus:outline-none"
              required
            />
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-base font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-indigo-300"
            >
              {isSubmitting ? 'Processing…' : 'Show my brain type' }
            </button>
            {isSubmitting ? <p className="text-xs text-slate-500">Crunching your responses…</p> : null}
          </form>
        </section>
      ) : null}

      {phase === 'teaser' && teaser ? (
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">You are a {teaser.archetypeName}</h2>
          <article className="rounded-lg border border-slate-200 bg-white p-4 text-slate-700" dangerouslySetInnerHTML={{ __html: teaser.teaserHtml }} />
          <a
            href={checkoutUrl}
            className="block w-full rounded-lg bg-emerald-600 px-4 py-3 text-center text-base font-semibold text-white transition hover:bg-emerald-500"
          >
            Unlock the full report – $7
          </a>
          {!whopMiniUrl ? (
            <p className="text-xs text-slate-500">Set NEXT_PUBLIC_WHOP_MINI_URL to your Whop checkout link.</p>
          ) : null}
          {!teaser?.attemptId ? (
            <p className="text-xs text-red-500">No quiz attempt detected. Please reload and try again.</p>
          ) : null}
        </section>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
