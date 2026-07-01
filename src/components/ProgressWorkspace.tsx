import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useWorkbenchAuth } from '../auth';
import { API_BASE_URL } from '../config';

interface ProgressStatus {
  available: boolean;
  role: string;
  permissions: string[];
}

interface ProgressWorkspaceProps {
  headerNavigation?: ReactNode;
}

export function ProgressWorkspace({ headerNavigation }: ProgressWorkspaceProps) {
  const { apiFetch, displayName } = useWorkbenchAuth();
  const [status, setStatus] = useState<ProgressStatus | null>(null);
  const [error, setError] = useState('');

  const loadStatus = useCallback(async () => {
    setError('');
    try {
      const response = await apiFetch(`${API_BASE_URL}/progress/status`);
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(payload?.detail || `Progress API returned ${response.status}`);
      }
      setStatus((await response.json()) as ProgressStatus);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Progress API is unavailable.');
    }
  }, [apiFetch]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#e7f4ef,_transparent_38%),linear-gradient(135deg,_#f8faf8,_#eef3f0)] text-slate-900">
      <header className="border-b border-emerald-900/10 bg-white/80 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 pr-14">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-700">Research memory</p>
            <h1 className="font-serif text-2xl font-bold tracking-tight">Project Progress & Provenance</h1>
          </div>
          {headerNavigation}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10">
        <section className="overflow-hidden rounded-3xl border border-emerald-950/10 bg-[#173f35] p-8 text-white shadow-xl shadow-emerald-950/10">
          <p className="text-sm text-emerald-100">Signed in as {displayName}</p>
          <h2 className="mt-2 max-w-3xl font-serif text-4xl font-semibold leading-tight">
            Evidence first. Bilingual by design. Built to remember how the research changed.
          </h2>
          <div className="mt-8 flex flex-wrap gap-3 text-xs font-bold uppercase tracking-wider">
            <span className="rounded-full bg-white/10 px-4 py-2">{status?.role || 'Checking role'}</span>
            <span className="rounded-full bg-white/10 px-4 py-2">
              {status ? `${status.permissions.length} permissions` : 'Secure API check'}
            </span>
          </div>
        </section>

        {error && (
          <div className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            {error} Configure Clerk in Vercel and Railway before team use.
          </div>
        )}

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            ['Meetings', 'Sessions, presentations, transcripts, and linked materials'],
            ['Review queue', 'Candidate records with exact evidence and accountable decisions'],
            ['Bilingual search', 'Original Japanese and English, translations, and shared concepts'],
          ].map(([title, description]) => (
            <article key={title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="font-serif text-xl font-bold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
