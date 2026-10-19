import { useEffect, useId, useMemo, useState } from 'react';
import { API_BASE_URL } from '../../config';
import GraphDownload from './GraphDownload';
import type { GraphData, ResearchApi, ResearchRun, RunList } from './types';

interface NetworkMaterial {
  material_id: string;
  title: string;
  file_count: number;
  extracted_segment_count: number;
  covered_file_count?: number;
  partial_extraction?: boolean;
  files?: Array<{ file_id: string; original_filename: string; included_in_graph: boolean }>;
  run_id: string | null;
  status: 'included' | 'no_saved_graph' | 'no_extracted_text';
  detail?: string;
}

export interface GraphNetwork {
  network_id: string;
  title: string;
  scope: 'selected' | 'library';
  created_at: string;
  run_ids: string[];
  version?: string;
  counts: { sources: number; entities: number; evidence: number; assertions: number; alignments: number; inferred_connections: number; supported_relationships?: number };
  quality_report?: {
    reported: { concepts_with_edges: number; isolated_concepts: number; document_web_claims: number };
    combined: { concepts_with_edges: number; isolated_concepts: number; document_web_claims: number };
  };
  coverage: {
    material_count: number;
    materials_with_graph: number;
    materials_without_graph: number;
    file_count: number;
    files_with_extraction: number;
    covered_file_count?: number;
    materials: NetworkMaterial[];
  };
}

export interface NetworkContent { network: GraphNetwork; graph: GraphData }
interface NetworkList { items: GraphNetwork[]; total: number; limit: number; offset: number }

const BUTTON = 'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40';
const INPUT = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100';

export function GraphNetworksPanel({ api, active, canWrite, disabled, currentRunId, networkId, content, onSelect, onLoad, onBusyChange }: {
  api: ResearchApi;
  active: boolean;
  canWrite: boolean;
  disabled: boolean;
  currentRunId: string | null;
  networkId: string | null;
  content: NetworkContent | null;
  onSelect: (id: string | null) => void;
  onLoad: (content: NetworkContent) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const prefix = useId();
  const [expanded, setExpanded] = useState(false);
  const [scope, setScope] = useState<'selected' | 'library'>('selected');
  const [title, setTitle] = useState('');
  const [inferConnections, setInferConnections] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>(() => currentRunId ? [currentRunId] : []);
  const [runs, setRuns] = useState<ResearchRun[]>([]);
  const [networks, setNetworks] = useState<GraphNetwork[]>([]);
  const [networkTotal, setNetworkTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [query, setQuery] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [networkError, setNetworkError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!active || (!expanded && !networkId)) return;
    const controller = new AbortController();
    const signal = controller.signal;
    void (async () => {
      setLoading(true);
      try {
        const fetchRuns = async () => {
          const items: ResearchRun[] = [];
          let nextOffset = 0;
          let total = 1;
          while (nextOffset < total) {
            const page = await api<RunList>(`/research-runs?limit=100&offset=${nextOffset}`, { signal });
            items.push(...page.items);
            total = page.total;
            if (!page.items.length) break;
            nextOffset += page.items.length;
          }
          return items;
        };
        const [available, saved] = await Promise.all([
          fetchRuns(), api<NetworkList>(`/graph-networks?limit=20&offset=${offset}`, { signal }),
        ]);
        if (signal.aborted) return;
        setRuns(available); setNetworks(saved.items); setNetworkTotal(saved.total); setError('');
      } catch (cause) {
        if (!signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not load saved networks.');
      } finally { if (!signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [api, active, expanded, networkId, offset, refresh]);

  useEffect(() => {
    if (!active || !networkId) return;
    const controller = new AbortController();
    setNetworkError('');
    Promise.all([
      api<GraphNetwork>(`/graph-networks/${networkId}`, { signal: controller.signal }),
      api<GraphData>(`/graph-networks/${networkId}/graph`, { signal: controller.signal }),
    ]).then(([network, graph]) => {
      if (!controller.signal.aborted) onLoad({ network, graph });
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setNetworkError(cause instanceof Error ? cause.message : 'Could not open this network.');
    });
    return () => controller.abort();
  }, [api, active, networkId, onLoad, refresh]);

  const filteredRuns = useMemo(() => runs.filter(run => `${run.title || ''} ${run.documents?.map(document => document.title).join(' ') || ''}`.toLocaleLowerCase('en').includes(query.toLocaleLowerCase('en'))), [runs, query]);
  const selected = content?.network.network_id === networkId ? content.network : null;
  const build = async (singleRunId?: string) => {
    setBusy(true); onBusyChange(true); setError(''); setNotice('');
    try {
      const chosenScope = singleRunId ? 'selected' : scope;
      const created = await api<GraphNetwork>('/graph-networks', { method: 'POST', body: JSON.stringify({
        title: singleRunId ? `${runs.find(run => run.run_id === singleRunId)?.title || 'Document graph'} — suggested connections` : title.trim() || (chosenScope === 'library' ? 'Document library network' : 'Combined research network'),
        run_ids: singleRunId ? [singleRunId] : chosenScope === 'selected' ? selectedIds : [],
        scope: chosenScope, infer_connections: singleRunId ? true : inferConnections,
      }) });
      setOffset(0); setRefresh(value => value + 1); setExpanded(false); onSelect(created.network_id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not build this network.'); }
    finally { setBusy(false); onBusyChange(false); }
  };
  const update = async () => {
    if (!networkId) return;
    setBusy(true); onBusyChange(true); setError(''); setNotice('');
    try {
      const updated = await api<GraphNetwork>(`/graph-networks/${networkId}/refresh`, { method: 'POST' });
      setRefresh(value => value + 1); onSelect(updated.network_id);
      setNotice(updated.network_id === networkId ? 'This network already uses the current saved graphs and connection methods.' : 'Updated network saved. The previous snapshot remains available.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not update this network.'); }
    finally { setBusy(false); onBusyChange(false); }
  };

  return <div className="rounded-xl border border-slate-200 bg-white p-5">
    {currentRunId && !networkId && <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><p className="max-w-2xl text-sm text-slate-600">Suggest additional connections for this graph, or combine it with other saved networks below.</p><button className={BUTTON} disabled={busy || disabled || !canWrite} onClick={() => void build(currentRunId)}>{busy ? 'Building suggestions…' : 'Suggest more connections'}</button></div>}
    {error && <p role="alert" className="mb-3 text-sm text-red-700">{error} <button className="underline" onClick={() => { setExpanded(true); setRefresh(value => value + 1); }}>Retry</button></p>}
    {notice && <p role="status" className="mb-3 text-sm text-emerald-800">{notice}</p>}
    <details open={expanded} onToggle={event => setExpanded(event.currentTarget.open)}>
      <summary className="cursor-pointer text-base font-semibold">Combine graphs and explore the document library</summary>
      <p className="mt-3 text-sm text-slate-600">Connect saved graph drafts without changing their sources. Inferred connections are labelled proposals for review.</p>
      <fieldset className="mt-4 space-y-2" disabled={busy || disabled || !canWrite}>
        <legend className="mb-2 text-sm font-medium">Include</legend>
        <label className="flex items-start gap-2 text-sm"><input type="radio" name={`${prefix}-scope`} value="selected" checked={scope === 'selected'} onChange={() => setScope('selected')} /><span>Choose saved graphs</span></label>
        <label className="flex items-start gap-2 text-sm"><input type="radio" name={`${prefix}-scope`} value="library" checked={scope === 'library'} onChange={() => setScope('library')} /><span>Entire document library<span className="block text-xs text-slate-500">One saved graph per document, plus a register of documents still awaiting a graph.</span></span></label>
      </fieldset>
      {scope === 'selected' && <div className="mt-4">
        <label htmlFor={`${prefix}-search`} className="mb-1 block text-sm font-medium">Find graphs</label>
        <input id={`${prefix}-search`} className={INPUT} value={query} onChange={event => setQuery(event.target.value)} placeholder="Search graph or document titles" />
        <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-slate-200 p-2">
          {loading && !runs.length ? <p className="p-2 text-sm text-slate-500">Loading graphs…</p> : !filteredRuns.length ? <p className="p-2 text-sm text-slate-500">No matching saved graphs.</p> : filteredRuns.map(run => <label key={run.run_id} className="flex cursor-pointer items-start gap-2 rounded-lg p-2 text-sm hover:bg-slate-50">
            <input type="checkbox" className="mt-1" checked={selectedIds.includes(run.run_id)} disabled={busy || disabled || !canWrite || (selectedIds.length >= 200 && !selectedIds.includes(run.run_id))} onChange={event => setSelectedIds(current => event.target.checked ? [...current, run.run_id] : current.filter(id => id !== run.run_id))} />
            <span className="min-w-0 break-words">{run.title || 'Research graph'}<span className="block text-xs text-slate-500">{new Date(run.created_at).toLocaleDateString('en')} · {run.has_saved_candidates ? 'Saved candidates' : 'No saved candidate hint — prepare a graph before combining'}</span></span>
          </label>)}
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500"><span>{selectedIds.length} selected · maximum 200</span>{currentRunId && !selectedIds.includes(currentRunId) && <button disabled={busy || disabled || !canWrite || selectedIds.length >= 200} onClick={() => setSelectedIds(current => [...current, currentRunId])} className="underline">Add current graph</button>}<button disabled={busy || disabled || !selectedIds.length} onClick={() => setSelectedIds([])} className="underline">Clear selection</button></div>
      </div>}
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="min-w-56 flex-1 text-sm font-medium" htmlFor={`${prefix}-title`}>Network title<input id={`${prefix}-title`} className={`${INPUT} mt-1`} maxLength={200} value={title} placeholder={scope === 'library' ? 'Document library network' : 'Combined research network'} onChange={event => setTitle(event.target.value)} /></label>
        <button className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40" disabled={busy || disabled || !canWrite || (scope === 'selected' && !selectedIds.length)} onClick={() => void build()}>{busy ? 'Building saved network…' : scope === 'library' ? 'Build library network' : 'Build combined network'}</button>
      </div>
      <label className="mt-3 flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={inferConnections} disabled={busy || disabled || !canWrite} onChange={event => setInferConnections(event.target.checked)} /><span>Suggest connections between concepts<span className="block text-xs text-slate-500">Uses recorded evidence and transparent rules. Shared wording or context does not establish historical identity.</span></span></label>
      <p className="mt-3 text-xs text-slate-500">This creates a saved snapshot from available graphs. Continue document processing separately to include more passages, then build an updated network.</p>
      <div className="mt-5 border-t border-slate-200 pt-4">
        <h3 className="text-sm font-semibold">Saved combined networks</h3>
        {!networks.length && !loading && <p className="mt-2 text-sm text-slate-500">Your combined networks will appear here.</p>}
        <div className="mt-2 flex flex-wrap gap-2">{networks.map(network => <button key={network.network_id} disabled={busy || disabled} className={`${BUTTON} ${networkId === network.network_id ? 'border-blue-300 bg-blue-50' : ''}`} onClick={() => onSelect(network.network_id)} aria-pressed={networkId === network.network_id}>{network.title}<span className="block text-xs font-normal text-slate-500">{network.counts.entities} concepts · {network.counts.inferred_connections} suggested connections</span></button>)}</div>
        {networkTotal > 20 && <div className="mt-3 flex gap-3 text-xs"><button disabled={loading || offset === 0} onClick={() => setOffset(value => Math.max(0, value - 20))}>Previous</button><span>{offset + 1}–{Math.min(offset + 20, networkTotal)} of {networkTotal}</span><button disabled={loading || offset + 20 >= networkTotal} onClick={() => setOffset(value => value + 20)}>Next</button></div>}
      </div>
    </details>
    {networkId && <div className="mt-4 border-t border-slate-200 pt-4">
      {networkError ? <p role="alert" className="text-sm text-red-700">{networkError} <button className="underline" onClick={() => setRefresh(value => value + 1)}>Retry</button></p> : !selected ? <p role="status" className="text-sm text-slate-500">Opening saved network…</p> : <>
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-semibold">{selected.title}</h3><p className="mt-1 text-xs text-slate-500">Saved {new Date(selected.created_at).toLocaleString('en')} · Read-only derived draft</p></div><GraphDownload className={BUTTON} filename={`network-${selected.network_id}.json`} url={`${API_BASE_URL}/graph-networks/${selected.network_id}/export`}>Download network and document register</GraphDownload></div>
        <p className="mt-3 text-sm text-slate-700">{selected.counts.entities} concepts · {selected.counts.assertions} source statements · {selected.counts.alignments} proposed comparisons · {selected.counts.inferred_connections} inferred connections · {selected.counts.evidence} quotations</p>
        {!!selected.counts.supported_relationships && <p className="mt-2 text-sm text-slate-600">{selected.counts.supported_relationships} source statements also have a recovered concept-to-concept representation; their original literal records remain available.</p>}
        {selected.quality_report && <p className="mt-2 text-sm text-slate-600">Concepts linked by reported relationships: {selected.quality_report.reported.concepts_with_edges}. Including analytical suggestions: {selected.quality_report.combined.concepts_with_edges}. {selected.quality_report.combined.isolated_concepts} concepts have no traversable connection. These counts describe structure, not scientific accuracy.</p>}
        <p className="mt-2 text-sm text-slate-600">Graphs cover {selected.coverage.materials_with_graph} of {selected.coverage.material_count} documents{selected.coverage.covered_file_count !== undefined ? ` and ${selected.coverage.covered_file_count} of ${selected.coverage.file_count} files` : ''}. {selected.coverage.files_with_extraction} of {selected.coverage.file_count} files have extracted text.</p>
        <p className="mt-2 text-sm text-amber-900">Inferred connections are research suggestions. Inspect their rule and supporting concepts; they are separate from relationships reported by a source.</p>
        <p className="mt-2 text-xs text-slate-500">{selected.scope === 'library' ? 'Update selects current saved drafts across the library.' : 'Update rereads these selected drafts. To include a newly generated draft, choose it in Combine graphs above.'} The previous snapshot stays available.</p>
        <details className="mt-3 text-sm"><summary className="cursor-pointer font-medium">Document coverage and missing graphs ({selected.coverage.materials_without_graph})</summary><ul className="mt-2 max-h-56 space-y-2 overflow-y-auto">{selected.coverage.materials.map(material => <li key={material.material_id} className="rounded-lg bg-slate-50 p-3"><span className="font-medium">{material.title}</span><span className={`ml-2 text-xs ${material.status === 'included' && !material.partial_extraction ? 'text-emerald-800' : 'text-amber-800'}`}>{material.status === 'included' ? material.partial_extraction ? 'Partial draft included' : 'Included' : material.status === 'no_extracted_text' ? 'Readable text needed' : 'Saved graph needed'}</span><span className="mt-1 block text-xs text-slate-500">{material.covered_file_count !== undefined ? `${material.covered_file_count} of ` : ''}{material.file_count} file(s) represented · {material.extracted_segment_count} extracted section(s){material.detail ? ` · ${material.detail}` : ''}</span>{material.files?.some(file => !file.included_in_graph) && <span className="mt-1 block break-words text-xs text-amber-800">Files not yet represented: {material.files.filter(file => !file.included_in_graph).map(file => file.original_filename).join('; ')}</span>}</li>)}</ul></details>
      </>}
      <button className={`${BUTTON} mt-4 mr-2`} disabled={busy || disabled || !canWrite || !selected} onClick={() => void update()}>{busy ? 'Updating saved network…' : 'Update connections and coverage'}</button>
      <button className={`${BUTTON} mt-4`} disabled={busy || disabled} onClick={() => onSelect(null)}>Return to individual graphs</button>
    </div>}
  </div>;
}
