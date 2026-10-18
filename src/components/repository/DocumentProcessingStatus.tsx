import { useEffect, useRef, useState } from 'react';

interface ProcessingJob {
  job_id: string;
  status: string;
  stage: string;
  detail?: string;
  stage_progress?: Record<string, { indexed_count?: number; pending_count?: number; failed_count?: number; skipped_count?: number }>;
  completed_stages?: Record<string, { result?: { run_id?: string } }>;
}

interface Preparation {
  job: ProcessingJob | null;
  coverage: {
    eligible_segment_count: number;
    embedded_segment_count: number;
    eligible_image_count: number;
    embedded_image_count: number;
    skipped_image_count?: number;
  };
}

const STAGES: Record<string, string> = {
  queued: 'Waiting to start', extract: 'Reading text and OCR', graph: 'Preparing graph draft',
  text_index: 'Indexing text', image_index: 'Describing and indexing images', complete: 'Preparation complete',
};

export function DocumentProcessingStatus({ materialId, request, onComplete, onOpenGraph }: {
  materialId: string;
  request: (path: string, init?: RequestInit) => Promise<Response>;
  onComplete?: () => void;
  onOpenGraph?: () => void;
}) {
  const [data, setData] = useState<Preparation | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const complete = useRef(onComplete);
  const lastCompleted = useRef('');
  useEffect(() => { complete.current = onComplete; }, [onComplete]);
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    setData(null); setError(''); lastCompleted.current = '';
    const load = async () => {
      try {
        const response = await request(`/materials/${materialId}/processing`, { signal: controller.signal });
        if (response.status === 404) return;
        if (!response.ok) throw new Error('Preparation status is unavailable.');
        const next = await response.json() as Preparation;
        if (stopped) return;
        setData(next); setError('');
        if (next.job?.status === 'done' && lastCompleted.current !== next.job.job_id) {
          lastCompleted.current = next.job.job_id;
          complete.current?.();
        }
        timer = setTimeout(() => void load(), ['queued', 'running'].includes(next.job?.status || '') ? 4000 : 15000);
      } catch (cause) {
        if (!stopped) { setError(cause instanceof Error ? cause.message : 'Preparation status is unavailable.'); timer = setTimeout(() => void load(), 15000); }
      }
    };
    void load();
    return () => { stopped = true; controller.abort(); clearTimeout(timer); };
  }, [materialId, request, refresh]);

  const start = async () => {
    setBusy(true); setError('');
    try {
      const retry = data?.job?.status === 'error';
      const response = await request(retry ? `/processing-jobs/${data!.job!.job_id}/retry` : `/materials/${materialId}/process`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        ...(retry ? {} : { body: JSON.stringify({ force: data?.job?.status === 'done' }) }),
      });
      if (!response.ok) throw new Error('Could not start preparation. Your source is saved.');
      setRefresh(value => value + 1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not start preparation.'); }
    finally { setBusy(false); }
  };

  const active = ['queued', 'running'].includes(data?.job?.status || '');
  const graphId = data?.job?.completed_stages?.graph?.result?.run_id;
  return <section className="rounded-lg border border-slate-200 bg-white p-3" aria-label="Document preparation">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h4 className="text-xs font-bold text-slate-700">Document preparation</h4>
      <button type="button" className="rounded border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 disabled:opacity-40" disabled={busy || active} onClick={() => void start()}>
        {busy ? 'Starting…' : data?.job?.status === 'error' ? 'Retry unfinished stages' : data?.job?.status === 'done' ? 'Reprocess source' : 'Process source'}
      </button>
    </div>
    {data && <>
      <p className="mt-2 text-xs text-slate-600" role="status">{data.job?.status === 'error' ? 'Needs attention' : STAGES[data.job?.stage || 'queued'] || data.job?.stage}</p>
      <p className="mt-2 text-xs text-slate-500">Searchable text: {data.coverage.embedded_segment_count}/{data.coverage.eligible_segment_count} · Images: {data.coverage.embedded_image_count}/{data.coverage.eligible_image_count}</p>
      {!!data.coverage.skipped_image_count && <p className="mt-1 text-xs text-slate-500">{data.coverage.skipped_image_count} image(s) skipped by the informative-image check.</p>}
      {data.job?.detail && <p className="mt-2 break-words text-xs text-amber-800">{data.job.detail}</p>}
      {graphId && onOpenGraph && <button type="button" onClick={onOpenGraph} className="mt-2 text-xs font-semibold text-blue-700 underline">Open graph draft and evidence</button>}
      <p className="mt-2 text-xs text-slate-400">Text and OCR feed both search and graph drafts. Graph inclusion and publication remain review steps.</p>
    </>}
    {error && <p className="mt-2 text-xs text-amber-800" role="alert">{error}</p>}
  </section>;
}
