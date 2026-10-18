import { useEffect, useRef, useState } from 'react';
import { parseErrorResponse } from './formatters';
import type { RepositoryFile } from './types';

interface Coverage { total: number; done: number; failed: number; pending: number }
interface TranslationJob {
  job_id: string;
  file_id?: string | null;
  status: 'queued' | 'running' | 'done' | 'partial' | 'error' | 'superseded';
  coverage: Coverage;
  stale?: boolean;
  detail?: string;
  error?: string;
}
interface TranslationArtifact {
  label: string;
  coverage: Coverage;
  stale?: boolean;
  warnings: string[];
  units: Array<{
    unit_id: string;
    filename: string;
    locator: string;
    page_index?: number;
    original_text: string;
    original_sha256: string;
    translation_text: string;
    status: string;
    error?: string;
    provenance: { model: string };
  }>;
}

const STATUS: Record<TranslationJob['status'], string> = {
  queued: 'Waiting to translate', running: 'Translating into English', done: 'English translation ready',
  partial: 'Translation partly ready', error: 'Translation needs attention', superseded: 'Source changed — translate again',
};

export function DocumentTranslation({ materialId, title, files, request }: {
  materialId: string;
  title: string;
  files: RepositoryFile[];
  request: (path: string, init?: RequestInit) => Promise<Response>;
}) {
  const [fileId, setFileId] = useState('');
  const [job, setJob] = useState<TranslationJob | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [artifact, setArtifact] = useState<TranslationArtifact | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [artifactBusy, setArtifactBusy] = useState(false);
  const [downloadBusy, setDownloadBusy] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const viewRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    setJob(null); setError(''); setArtifact(null); setDialogOpen(false);
    const load = async () => {
      try {
        const response = await request(`/materials/${materialId}/translations`, { signal: controller.signal });
        if (response.status === 404) return;
        if (!response.ok) throw new Error(await parseErrorResponse(response, 'Translation status is unavailable'));
        const data = await response.json() as { jobs: TranslationJob[] };
        if (stopped) return;
        const next = data.jobs.find(item => (item.file_id || '') === fileId) || null;
        setJob(next); setError('');
        if (next && ['queued', 'running'].includes(next.status)) timer = setTimeout(() => void load(), 3000);
      } catch (cause) {
        if (!stopped) {
          setError(cause instanceof Error ? cause.message : 'Translation status is unavailable.');
          timer = setTimeout(() => void load(), 10000);
        }
      }
    };
    void load();
    return () => { stopped = true; controller.abort(); clearTimeout(timer); };
  }, [materialId, fileId, request, refresh]);

  useEffect(() => {
    if (!dialogOpen) return;
    const opener = viewRef.current;
    closeRef.current?.focus();
    return () => opener?.focus();
  }, [dialogOpen]);

  const start = async () => {
    setBusy(true); setError('');
    try {
      const retry = job && !job.stale && ['partial', 'error'].includes(job.status);
      const response = await request(retry ? `/translation-jobs/${job.job_id}/retry` : `/materials/${materialId}/translations`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        ...(retry ? {} : { body: JSON.stringify(fileId ? { file_id: fileId } : {}) }),
      });
      if (!response.ok) throw new Error(await parseErrorResponse(response, 'Could not start translation'));
      setJob(await response.json() as TranslationJob);
      setRefresh(value => value + 1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not start translation.'); }
    finally { setBusy(false); }
  };

  const view = async () => {
    if (!job) return;
    setArtifactBusy(true); setError('');
    try {
      const response = await request(`/translation-jobs/${job.job_id}/artifact`);
      if (!response.ok) throw new Error(await parseErrorResponse(response, 'Could not open translation'));
      setArtifact(await response.json() as TranslationArtifact); setDialogOpen(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not open translation.'); }
    finally { setArtifactBusy(false); }
  };

  const download = async () => {
    if (!job) return;
    setDownloadBusy(true); setError('');
    try {
      const response = await request(`/translation-jobs/${job.job_id}/artifact?format=text`);
      if (!response.ok) throw new Error(await parseErrorResponse(response, 'Could not download translation'));
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url; link.download = `${title.replace(/[^\p{L}\p{N}_-]+/gu, '_').slice(0, 100) || 'document'}_English.txt`;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not download translation.'); }
    finally { setDownloadBusy(false); }
  };

  const active = job && !job.stale && ['queued', 'running'].includes(job.status);
  const ready = (job?.coverage?.done || 0) > 0;
  return <section className="rounded-lg border border-slate-200 bg-white p-3" aria-label="English translation">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h4 className="text-xs font-bold text-slate-700">English translation</h4>
      <button type="button" onClick={() => void start()} disabled={busy || !!active || !files.length} className="rounded border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 disabled:opacity-40">
        {busy ? 'Starting…' : active ? 'Translating…' : job?.stale || job?.status === 'done' ? 'Update translation' : job && ['partial', 'error'].includes(job.status) ? 'Retry unfinished pages' : 'Translate to English'}
      </button>
    </div>
    {files.length > 1 && <label className="mt-2 block text-xs text-slate-600">Source
      <select value={fileId} disabled={busy} onChange={event => setFileId(event.target.value)} className="mt-1 w-full rounded border border-slate-200 bg-white p-1.5 text-xs">
        <option value="">All attached documents</option>
        {files.map(file => <option key={file.id} value={file.id}>{file.original_filename}</option>)}
      </select>
    </label>}
    <p className="mt-2 text-xs leading-relaxed text-slate-500">Creates a separate English reading copy. Original text, citations and graph evidence stay linked to the source.</p>
    {job && <>
      <p className="mt-2 text-xs text-slate-600" role="status">{job.stale ? 'Previous translation' : STATUS[job.status]} · {job.coverage?.done || 0}/{job.coverage?.total || 0} sections ready{job.coverage?.failed ? ` · ${job.coverage.failed} need attention` : ''}</p>
      {job.stale && <p className="mt-2 text-xs text-amber-800">The source or translation method has changed. This saved copy is historical; update the translation to use the current source.</p>}
      {(job.detail || job.error) && <p className="mt-1 break-words text-xs text-amber-800">{job.detail || job.error}</p>}
    </>}
    {ready && <div className="mt-2 flex flex-wrap gap-3">
      <button ref={viewRef} type="button" disabled={artifactBusy} onClick={() => void view()} className="text-xs font-semibold text-blue-700 underline disabled:opacity-40">{artifactBusy ? 'Opening…' : job?.stale ? 'Read previous translation' : 'Read English translation'}</button>
      <button type="button" disabled={downloadBusy} onClick={() => void download()} className="text-xs font-semibold text-blue-700 underline disabled:opacity-40">{downloadBusy ? 'Downloading…' : job?.stale ? 'Download previous English text' : 'Download English text'}</button>
    </div>}
    {error && <p className="mt-2 text-xs text-amber-800" role="alert">{error}</p>}
    {dialogOpen && artifact && <div className="fixed inset-0 z-[96] flex items-center justify-center bg-slate-950/50 p-4" onClick={event => { if (event.target === event.currentTarget) setDialogOpen(false); }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="translation-heading" className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl" onKeyDown={event => {
        if (event.key === 'Escape') setDialogOpen(false);
        if (event.key === 'Tab') {
          const controls = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], summary, [tabindex="0"]');
          if (!controls?.length) return;
          const first = controls[0]; const last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
      }}>
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div><h3 id="translation-heading" className="text-sm font-bold text-slate-700">English reading copy</h3><p className="text-xs text-slate-500">{title}</p></div>
          <button ref={closeRef} type="button" onClick={() => setDialogOpen(false)} className="rounded border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600">Close</button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-auto p-5">
          {artifact.stale && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Historical reading copy: the source or translation method has changed since this version was created. Its text refers to the saved original below; update the translation for the current source.</p>}
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">{artifact.label || 'Machine translation — requires review'}. Check the original before quoting or interpreting specialist terms. {artifact.coverage.done}/{artifact.coverage.total} sections ready.</p>
          {artifact.warnings?.map((warning, index) => <p key={index} className="text-xs text-amber-800">{warning}</p>)}
          {artifact.units.map(unit => <article key={unit.unit_id} className="rounded-lg border border-slate-200 p-4">
            <h4 className="break-words text-xs font-semibold text-slate-700">{unit.filename} · {unit.locator || (unit.page_index != null ? `Page ${unit.page_index + 1}` : 'Source section')}</h4>
            {unit.status === 'done' ? <p lang="en" className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{unit.translation_text}</p> : <p className="mt-3 text-xs text-amber-800">{unit.error || 'This section has not been translated yet.'}</p>}
            <details className="mt-3 text-xs text-slate-500"><summary className="cursor-pointer font-semibold">Original text and translation source</summary>
              <p className="mt-2 whitespace-pre-wrap leading-relaxed text-slate-700">{unit.original_text}</p>
              <p className="mt-2 break-all">Translation model: {unit.provenance?.model || 'Recorded in translation artifact'} · Original SHA-256: {unit.original_sha256}</p>
            </details>
          </article>)}
        </div>
      </div>
    </div>}
  </section>;
}
