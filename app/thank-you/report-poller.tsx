'use client';

import { useEffect, useMemo, useState } from 'react';

type Report = {
  id: string;
  type: 'mini_report' | 'full_assessment' | string;
  html: string;
  pdf_url?: string | null;
  audio_url?: string | null;
  images?: string[] | null;
};

type PollerProps = {
  attemptId: string;
  product: string;
};

const POLL_INTERVAL = 4000;

export default function ReportPoller({ attemptId, product }: PollerProps) {
  const [status, setStatus] = useState<'pending' | 'ready' | 'error'>('pending');
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pollCount, setPollCount] = useState(0);

  useEffect(() => {
    let timeout: NodeJS.Timeout | null = null;
    let cancelled = false;

    const poll = async () => {
      try {
        setPollCount((count) => count + 1);
        const response = await fetch(`/api/report/${attemptId}`, {
          headers: { 'cache-control': 'no-cache' },
        });

        if (!response.ok && response.status !== 202) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error || 'Report lookup failed');
        }

        if (response.status === 202) {
          if (!cancelled) {
            timeout = setTimeout(poll, POLL_INTERVAL);
          }
          return;
        }

        const payload = (await response.json()) as { ready: boolean; report: Report };
        if (payload.ready) {
          setReport(payload.report);
          setStatus('ready');
        }
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : 'Unexpected error');
        setStatus('error');
      }
    };

    timeout = setTimeout(poll, 1000);

    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
    };
  }, [attemptId]);

  const progressCopy = useMemo(() => {
    if (status === 'ready') return 'Report ready';
    if (status === 'error') return 'We hit a snag generating your report.';
    if (pollCount > 6) return 'Still cooking — complex answers can take another moment.';
    if (pollCount > 2) return 'Almost there. Rendering PDF and audio if requested…';
    return 'Generating insights…';
  }, [pollCount, status]);

  if (status === 'error') {
    return (
      <div className="space-y-4 rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">
        <p className="text-lg font-semibold">Something went wrong</p>
        <p className="text-sm">{error}</p>
        <p className="text-xs">We&apos;re on it. If this persists, reply to the receipt email and we&apos;ll regenerate manually.</p>
      </div>
    );
  }

  if (status === 'ready' && report) {
    return (
      <div className="space-y-6 rounded-3xl border border-indigo-100 bg-white p-6 shadow-sm">
        <header className="space-y-2">
          <p className="text-sm uppercase tracking-[0.2em] text-indigo-500">{product === 'full_assessment' ? 'Full assessment ready' : 'Mini report ready'}</p>
          <h2 className="text-2xl font-semibold text-slate-900">Your personalized results</h2>
        </header>
        <article className="prose prose-slate max-w-none" dangerouslySetInnerHTML={{ __html: report.html }} />
        <div className="flex flex-wrap gap-3 text-sm">
          {report.pdf_url ? (
            <a
              href={report.pdf_url}
              className="inline-flex items-center rounded-full bg-indigo-600 px-4 py-2 font-semibold text-white transition hover:bg-indigo-500"
            >
              Download PDF
            </a>
          ) : null}
          {report.audio_url ? (
            <a
              href={report.audio_url}
              className="inline-flex items-center rounded-full border border-slate-200 px-4 py-2 font-semibold text-slate-700 transition hover:border-slate-300"
            >
              Listen to summary
            </a>
          ) : null}
        </div>
        {report.images && report.images.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {report.images.map((src) => (
              <img key={src} src={src} alt="Report visual" className="rounded-lg border border-slate-200" />
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-3xl border border-indigo-100 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="h-12 w-12 animate-pulse rounded-full bg-indigo-200" />
        <div>
          <p className="text-base font-medium text-slate-700">{progressCopy}</p>
          <p className="text-xs text-slate-500">Hang tight — we refresh every few seconds.</p>
        </div>
      </div>
    </div>
  );
}
