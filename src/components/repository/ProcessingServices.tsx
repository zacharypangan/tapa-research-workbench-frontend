import { useId, useState } from 'react';
import type { AIStatus, ProcessingServiceStatus } from './types';

const SERVICES = [
  ['ocr', 'OCR and transcription'],
  ['generation', 'Assisted review'],
  ['embeddings', 'Semantic and image search'],
  ['translation', 'Document translation'],
  ['graph_extraction', 'Graph extraction'],
  ['image_description', 'Image descriptions'],
  ['keyword_search', 'Exact text search'],
] as const;

function servicePresentation(service?: ProcessingServiceStatus) {
  if (service?.ready === true) return { label: 'Ready', className: 'border-emerald-200 bg-emerald-50 text-emerald-800' };
  if (service?.state === 'not_configured') return { label: 'Not configured', className: 'border-slate-200 bg-slate-50 text-slate-600' };
  if (service?.state === 'partial') return { label: 'Limited support', className: 'border-amber-200 bg-amber-50 text-amber-900' };
  if (service?.state === 'blocked') return { label: 'Blocked', className: 'border-amber-200 bg-amber-50 text-amber-900' };
  if (service?.ready === false) return { label: 'Unavailable', className: 'border-amber-200 bg-amber-50 text-amber-900' };
  return { label: service ? 'Not verified' : 'Unknown', className: 'border-slate-200 bg-slate-50 text-slate-600' };
}

export function ProcessingServices({ status, unavailable, onRefresh }: {
  status: AIStatus | null;
  unavailable: boolean;
  onRefresh: () => Promise<boolean>;
}) {
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState('');
  const detailsId = useId();
  const services = status?.services;
  const counts = SERVICES.reduce((result, [key]) => {
    const service = services?.[key];
    if (service?.ready === true) result.ready += 1;
    else if (service?.ready === false || ['partial', 'blocked', 'unavailable', 'not_configured'].includes(service?.state || '')) result.attention += 1;
    else result.unverified += 1;
    return result;
  }, { ready: 0, attention: 0, unverified: 0 });
  const refresh = async () => {
    setRefreshing(true);
    setError('');
    try {
      if (!await onRefresh()) throw new Error('Service status is unavailable.');
    } catch {
      setError('Could not refresh service status. Previous results may be out of date.');
    } finally {
      setRefreshing(false);
    }
  };

  return <section aria-label="Processing services" className="mb-3 rounded-xl border border-slate-200 bg-white p-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h3 className="text-xs font-bold text-slate-700">Processing services</h3>
        <p aria-live="polite" className="mt-1 text-[11px] text-slate-500">{counts.ready} ready · {counts.attention} need attention · {counts.unverified} unverified</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" aria-expanded={expanded} aria-controls={detailsId} onClick={() => setExpanded(value => !value)} className="rounded border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50">
          {expanded ? 'Hide services' : 'Show services'}
        </button>
        <button type="button" disabled={refreshing} onClick={() => void refresh()} className="rounded border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40">
          {refreshing ? 'Checking…' : 'Refresh status'}
        </button>
      </div>
    </div>
    {unavailable ? <p role="status" className="mt-2 text-xs text-amber-800">Backend service status is unavailable. Previous results may be out of date.</p> : null}
    <div id={detailsId} hidden={!expanded}>
      <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {SERVICES.map(([key, label]) => {
        const service = services?.[key];
        const presentation = servicePresentation(service);
        return <div key={key} className={`rounded-lg border p-2 ${presentation.className}`}>
          <div className="flex flex-wrap items-center justify-between gap-1">
            <span className="text-xs font-semibold">{label}</span>
            <span className="text-[11px]">{presentation.label}</span>
          </div>
          {service ? <details className="mt-1 text-[11px] leading-relaxed">
            <summary className="cursor-pointer">Details</summary>
            <p className="mt-1 break-words">{service.detail}</p>
            {(service.provider || service.model) && <p className="mt-1 break-words">{[service.provider, service.model].filter(Boolean).join(' · ')}</p>}
          </details> : null}
        </div>;
      })}
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
        {services ? 'Ready reflects a service check, not document completion. Not verified means that specific operation has not been checked. Status checks may be cached.' : status ? 'This backend does not report individual service checks. Availability cannot be confirmed here.' : 'Waiting for backend service checks.'}
      </p>
    </div>
    {error ? <p role="alert" className="mt-2 text-xs text-amber-800">{error}</p> : null}
  </section>;
}
