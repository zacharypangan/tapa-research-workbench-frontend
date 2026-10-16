import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { API_BASE_URL } from '../config';
import GraphDownload from './knowledge/GraphDownload';
import type { Material, RepositoryFile, ResearchEvidenceNavigation } from './repository/types';
import { GraphExplorer } from './knowledge/GraphExplorer';
import ManualConceptEditor from './knowledge/ManualConceptEditor';
import type { AnnotationBatch, Capabilities, GraphData, OntologySpec, ResearchApi, ResearchRun, ResearchSeed, ReviewDecision, RunList } from './knowledge/types';

const BUTTON = 'rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40';
const PRIMARY = 'rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40';
const INPUT = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100';
const FORMAT = /\.(pdf|txt|md|json|docx)$/i;
const RUNNING = new Set(['created', 'queued', 'running']);
const EMPTY_GRAPH: GraphData = { sources: [], entities: [], evidence: [], assertions: [], alignments: [] };
type SelectedDocument = { material_id: string; file_id: string; title: string; filename: string };
type RunContent = { runId: string; graph: GraphData | null; seeds: ResearchSeed[]; batches: AnnotationBatch[]; ontology: OntologySpec | null; decisions: ReviewDecision[]; sourceLabels: Record<string, string>; metrics: { average_novel_candidates_per_snapshot?: number | null; successful_snapshots?: number; collection_attempts?: Array<Record<string, unknown>> } | null };

function statusText(status: string) {
  return ({ created: 'Ready to start', queued: 'Waiting for the worker', running: 'Processing sources', awaiting_readable_documents: 'Readable text needed', awaiting_annotations: 'Add concepts', awaiting_frontier: 'Add web sources', awaiting_review: 'Ready for review', failed: 'Needs attention', queue_failed: 'Worker unavailable', released: 'Published graph' } as Record<string, string>)[status] || status.replaceAll('_', ' ');
}

function stageNumber(run: ResearchRun) {
  if (run.status === 'released' || run.stage === 'release') return 3;
  if (run.stage === 'augmentation' || run.stage === 'augmented' || run.status === 'awaiting_frontier') return 2;
  return 1;
}

function runDescription(run: ResearchRun) {
  if (run.status === 'awaiting_annotations') return 'Read the source passages below and add the concepts and relationships they support.';
  if (run.status === 'awaiting_frontier') return 'Choose relevant public web pages below, or continue with document evidence only.';
  if (run.status === 'queue_failed') return 'The processing service is unavailable. Your documents are saved; retry when the service is ready.';
  return run.detail;
}

async function responseError(response: Response) {
  const data = await response.json().catch(() => null) as { detail?: unknown } | null;
  if (typeof data?.detail === 'string') return data.detail;
  if (data?.detail && typeof data.detail === 'object' && 'message' in data.detail) return String(data.detail.message);
  if (response.status === 401) return 'Access to the graph service is not authorized. Contact your workspace administrator.';
  if (response.status === 403) return 'The graph service does not allow this action.';
  if (response.status === 404) return 'This graph or service is not available. Refresh or contact your workspace administrator.';
  return `The request could not be completed (${response.status}). Please retry.`;
}

export function KnowledgeWorkspace({ headerNavigation, initialMaterial, active, onOpenResearchEvidence }: {
  headerNavigation?: ReactNode;
  initialMaterial?: { materialId?: string; requestId: number } | null;
  active: boolean;
  onOpenResearchEvidence?: (target: Omit<ResearchEvidenceNavigation, 'request_id'>) => void;
}) {
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [runs, setRuns] = useState<ResearchRun[]>([]);
  const [runTotal, setRunTotal] = useState(0);
  const [runOffset, setRunOffset] = useState(0);
  const [run, setRun] = useState<ResearchRun | null>(null);
  const [runId, setRunId] = useState<string | null>(() => {
    const value = new URLSearchParams(window.location.search).get('graph');
    return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value) ? value : null;
  });
  const [content, setContent] = useState<RunContent | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [materialTotal, setMaterialTotal] = useState(0);
  const [sourceRefresh, setSourceRefresh] = useState(0);
  const [materialQuery, setMaterialQuery] = useState('');
  const [materialDetail, setMaterialDetail] = useState<Material | null>(null);
  const [documents, setDocuments] = useState<SelectedDocument[]>([]);
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('tapa barkcloth manufacture archaeology');
  const [mode, setMode] = useState('manual');
  const [augment, setAugment] = useState(true);
  const [pageBudget, setPageBudget] = useState(5);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [seedQuery, setSeedQuery] = useState('');
  const [chosenSeeds, setChosenSeeds] = useState<string[]>([]);
  const [webUrl, setWebUrl] = useState('');
  const [frontier, setFrontier] = useState<Array<{ url: string; seed_ids: string[]; question: string; discovery_method: string }>>([]);
  const [loading, setLoading] = useState(true);
  const selection = useRef<string | null>(runId);
  const materialRequest = useRef(0);
  const runListRequest = useRef(0);
  const idempotency = useRef<string | null>(null);
  const uploadRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!active) return;
    const url = new URL(window.location.href);
    url.searchParams.set('view', 'knowledge');
    if (runId) url.searchParams.set('graph', runId);
    else url.searchParams.delete('graph');
    window.history.replaceState(null, '', url);
  }, [active, runId]);

  const api: ResearchApi = useCallback(async <T,>(path: string, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    if (init?.body && typeof init.body === 'string') headers.set('Content-Type', 'application/json');
    const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
    if (!response.ok) throw new Error(await responseError(response));
    return response.json() as Promise<T>;
  }, []);

  const artifact = useCallback(<T,>(id: string, name: string, signal?: AbortSignal) =>
    api<T>(`/research-runs/${id}/artifacts/${name.split('/').map(encodeURIComponent).join('/')}`, { signal }), [api]);

  const refreshRuns = useCallback(async (signal?: AbortSignal) => {
    const request = ++runListRequest.current;
    const data = await api<RunList>(`/research-runs?limit=20&offset=${runOffset}`, { signal });
    if (request !== runListRequest.current || signal?.aborted) return;
    setRuns(data.items);
    setRunTotal(data.total);
  }, [api, runOffset]);

  const loadRun = useCallback(async (id: string, signal?: AbortSignal) => {
    const updated = await api<ResearchRun>(`/research-runs/${id}`, { signal });
    if (selection.current !== id || signal?.aborted) return;
    const files = new Set(updated.artifacts);
    const graphFile = updated.status === 'released' && updated.release_path ? `${updated.release_path}/graph.json` : 'graph_input.json';
    const batchFile = files.has('augmented_batches.json') ? 'augmented_batches.json' : 'primary_batches.json';
    const sourceFile = batchFile === 'augmented_batches.json' && files.has('web.json') ? 'web.json' : 'ingest.json';
    const [graph, seeds, batches, inputs, decisions, metrics, ingest] = await Promise.all([
      files.has(graphFile) ? artifact<GraphData>(id, graphFile, signal) : null,
      files.has('seeds.json') ? artifact<ResearchSeed[]>(id, 'seeds.json', signal) : [],
      files.has(batchFile) && (updated.status === 'awaiting_annotations' || updated.status === 'failed') ? artifact<AnnotationBatch[]>(id, batchFile, signal) : [],
      updated.status === 'awaiting_annotations' || updated.status === 'failed' ? artifact<{ config: { ontology: OntologySpec } }>(id, 'inputs.json', signal) : null,
      files.has('decisions.json') ? artifact<ReviewDecision[]>(id, 'decisions.json', signal) : [],
      files.has('augmentation_metrics.json') ? artifact<RunContent['metrics']>(id, 'augmentation_metrics.json', signal) : null,
      files.has(sourceFile) && (updated.status === 'awaiting_annotations' || updated.status === 'failed') ? artifact<{ sources: Array<{ source_id: string; title: string }> }>(id, sourceFile, signal) : null,
    ]);
    if (selection.current !== id || signal?.aborted) return;
    setContent((previous) => {
      const keepDrafts = RUNNING.has(updated.status) && previous?.runId === id;
      return { runId: id, graph, seeds, batches: (keepDrafts ? previous.batches : batches).filter((batch) => !files.has(`processed/${batch.batch_id}.json`)), ontology: inputs?.config.ontology || (keepDrafts ? previous.ontology : null),
        decisions: graph?.decisions || decisions, sourceLabels: ingest ? Object.fromEntries(ingest.sources.map((source) => [source.source_id, source.title])) : keepDrafts ? previous.sourceLabels : {}, metrics };
    });
    setRun(updated);
    setRuns((current) => current.map((item) => item.run_id === id ? { ...item, ...updated } : item));
  }, [api, artifact]);

  useEffect(() => {
    const controller = new AbortController();
    api<Capabilities>('/research-runs/capabilities', { signal: controller.signal })
      .then((available) => { if (!controller.signal.aborted) { setCapabilities(available); setMode(available.extraction.default_mode); setAugment(available.collection?.available ?? true); setLoading(false); } })
      .catch((cause: unknown) => { if (!controller.signal.aborted) { setError(cause instanceof Error ? cause.message : 'Could not load graph projects.'); setLoading(false); } });
    return () => controller.abort();
  }, [api]);

  useEffect(() => {
    const controller = new AbortController();
    refreshRuns(controller.signal).catch((cause: unknown) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not load graph projects.'); });
    return () => controller.abort();
  }, [refreshRuns]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      api<{ materials: Material[]; total?: number }>(`/repository/materials?limit=100&q=${encodeURIComponent(materialQuery)}`, { signal: controller.signal })
        .then((data) => { if (!controller.signal.aborted) { setMaterials(data.materials); setMaterialTotal(data.total ?? data.materials.length); } })
        .catch((cause: unknown) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not load sources.'); });
    }, 200);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [api, materialQuery, sourceRefresh]);

  useEffect(() => {
    if (!initialMaterial?.materialId) return;
    const controller = new AbortController();
    const id = initialMaterial.materialId;
    api<Material>(`/repository/materials/${id}`, { signal: controller.signal }).then((data) => {
      if (!controller.signal.aborted) { setMaterialDetail(data); setRunId(null); selection.current = null; setRun(null); setContent(null); }
    }).catch((cause: unknown) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not open the source.'); });
    return () => controller.abort();
  }, [api, initialMaterial]);

  useEffect(() => {
    if (!runId || !active) return;
    const controller = new AbortController();
    loadRun(runId, controller.signal).catch((cause: unknown) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not open the graph project.'); });
    return () => controller.abort();
  }, [runId, active, loadRun]);

  useEffect(() => {
    if (!runId || !run || !RUNNING.has(run.status) || !active) return;
    let pending = false;
    const controller = new AbortController();
    const timer = window.setInterval(async () => {
      if (pending) return;
      pending = true;
      try { await loadRun(runId, controller.signal); } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not check progress.'); }
      finally { pending = false; }
    }, 2500);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [runId, run, active, loadRun]);

  const action = async (name: string, operation: () => Promise<void>) => {
    setBusy(name); setError(''); setNotice('');
    try { await operation(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'The action could not be completed.'); }
    finally { setBusy(''); }
  };

  const selectRun = (id: string) => { selection.current = id; setRunId(id); setRun(null); setContent(null); setError(''); setNotice(''); setChosenSeeds([]); setFrontier([]); };
  const newProject = () => { selection.current = null; setRunId(null); setRun(null); setContent(null); setDocuments([]); setTitle(''); setChosenSeeds([]); setFrontier([]); setError(''); setNotice(''); idempotency.current = null; };

  const addDocument = (material: Material, file: RepositoryFile) => {
    if (documents.some((entry) => entry.file_id === file.id)) return;
    setDocuments((current) => [...current, { material_id: material.id, file_id: file.id, title: material.title, filename: file.original_filename }]);
    idempotency.current = null;
  };

  const selectMaterial = async (id: string) => {
    const request = ++materialRequest.current;
    await action('source', async () => {
      const data = await api<Material>(`/repository/materials/${id}`);
      if (request === materialRequest.current) setMaterialDetail(data);
    });
  };

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    await action('upload', async () => {
      if (files.length + documents.length > 20) throw new Error('Choose up to 20 documents for one graph.');
      for (const file of Array.from(files)) {
        if (!FORMAT.test(file.name)) throw new Error('Use PDF, Word, text, Markdown or JSON documents.');
        if (file.size > 50 * 1024 * 1024) throw new Error('Each document must be smaller than 50 MB.');
        const material = await api<Material>('/repository/materials', { method: 'POST', body: JSON.stringify({ title: file.name, source_type: file.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'other' }) });
        const response = await fetch(`${API_BASE_URL}/repository/materials/${material.id}/files?filename=${encodeURIComponent(file.name)}&process=false`, { method: 'POST', body: file });
        if (!response.ok) throw new Error(await responseError(response));
        const detail = await api<Material>(`/repository/materials/${material.id}`);
        const added = detail.files?.find((entry) => entry.original_filename === file.name);
        if (!added) throw new Error('The file was uploaded but could not be selected. Choose it from your saved sources.');
        addDocument(detail, added);
      }
      setSourceRefresh((value) => value + 1);
      window.dispatchEvent(new CustomEvent('tapa-workbench:sources-updated'));
      setNotice('Documents saved to Sources and selected for this graph.');
    });
    if (uploadRef.current) uploadRef.current.value = '';
  };

  const start = async () => action('start', async () => {
    if (!documents.length) throw new Error('Choose at least one document.');
    idempotency.current ||= crypto.randomUUID();
    const created = await api<ResearchRun>('/research-runs', { method: 'POST', headers: { 'Idempotency-Key': idempotency.current }, body: JSON.stringify({
      title: title.trim() || documents[0].title,
      documents: documents.map(({ material_id, file_id }) => ({ material_id, file_id })),
      config: { research_topic: topic, processing: { mode }, augmentation: { enabled: augment, max_pages: pageBudget } },
    }) });
    selectRun(created.run_id); setRun(created); await refreshRuns();
  });

  const resume = async () => action('resume', async () => { if (!runId) return; await api(`/research-runs/${runId}/resume`, { method: 'POST' }); await loadRun(runId); await refreshRuns(); });

  const submitAnnotations = async (batchId: string, response: { entities: Record<string, unknown>[]; assertions: Record<string, unknown>[] }) => {
    if (!runId) return;
    setBusy('annotations'); setError('');
    try {
      await api(`/research-runs/${runId}/annotations`, { method: 'POST', body: JSON.stringify({ responses: { [batchId]: response } }) });
      await api(`/research-runs/${runId}/resume`, { method: 'POST' });
      await loadRun(runId); setNotice('Your source-based annotations were saved. Processing will continue.');
    } catch (cause) { const message = cause instanceof Error ? cause.message : 'Could not save concepts.'; setError(message); throw new Error(message); }
    finally { setBusy(''); }
  };

  const addWebSource = () => {
    try {
      const url = new URL(webUrl);
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.hash) throw new Error('Use a public web page URL without a fragment or sign-in details.');
      if (!chosenSeeds.length) throw new Error('Choose which document concepts this page will enrich.');
      const budget = run?.max_pages || pageBudget;
      if (frontier.length >= budget) throw new Error(`This project allows ${budget} web sources.`);
      if (frontier.some((entry) => entry.url === url.href)) throw new Error('This web page is already in the list.');
      const relevant = content?.seeds.filter((seed) => chosenSeeds.includes(seed.seed_id)) || [];
      setFrontier((current) => [...current, { url: url.href, seed_ids: chosenSeeds, question: relevant.map((seed) => seed.question).join(' '), discovery_method: 'workbench_researcher_selection' }]);
      setWebUrl(''); setChosenSeeds([]); setError('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Check the web page URL.'); }
  };

  const collect = async () => action('collect', async () => {
    if (!runId || !frontier.length) throw new Error('Add at least one web page linked to a document concept.');
    await api(`/research-runs/${runId}/frontier`, { method: 'POST', body: JSON.stringify({ frontier }) });
    await api(`/research-runs/${runId}/resume`, { method: 'POST' }); await loadRun(runId); await refreshRuns();
  });

  const skipEnrichment = async () => action('skip', async () => {
    if (!runId) return;
    await api(`/research-runs/${runId}/skip-enrichment`, { method: 'POST', body: JSON.stringify({ reason: 'User chose to continue with document evidence only in the Workbench.' }) });
    await api(`/research-runs/${runId}/resume`, { method: 'POST' });
    await loadRun(runId); await refreshRuns();
  });

  const review = async (candidateIds: string[], decision: 'accept' | 'reject', rationale: string) => {
    if (!runId) return;
    setBusy('review'); setError('');
    try {
      await api(`/research-runs/${runId}/review`, { method: 'POST', body: JSON.stringify({ decisions: candidateIds.map((candidate_id) => ({ candidate_id, decision, rationale })) }) });
      await loadRun(runId); setNotice(decision === 'accept' ? 'Included in the graph. Specialist validation remains separate.' : 'Excluded from the published graph.');
    } catch (cause) { const message = cause instanceof Error ? cause.message : 'Could not save the review.'; setError(message); throw new Error(message); }
    finally { setBusy(''); }
  };

  const release = async (allowPending: boolean) => action('release', async () => {
    if (!runId) return;
    await api(`/research-runs/${runId}/release`, { method: 'POST', body: JSON.stringify({ allow_pending: allowPending }) });
    await loadRun(runId); await refreshRuns(); setNotice(allowPending ? 'Preview ready to download. Pending items are labelled.' : 'Your reviewed graph has been published as an immutable version.');
  });

  const data = content?.runId === runId ? content : null;
  const latestDecisions = useMemo(() => new Map((data?.decisions || []).map((decision) => [decision.candidate_id, decision.decision])), [data?.decisions]);
  const accepted = [...latestDecisions.values()].filter((decision) => decision === 'accept').length;
  const filteredSeeds = data?.seeds.filter((seed) => `${seed.label} ${seed.entity_type}`.toLocaleLowerCase('en').includes(seedQuery.toLocaleLowerCase('en'))) || [];
  const canWrite = !!capabilities?.can_write;
  const canReview = !!capabilities?.can_review && run?.status === 'awaiting_review';
  const steps = ['Documents', 'Concepts', 'Web enrichment', 'Review and graph'];

  return (
    <main className="min-h-screen bg-slate-50 text-slate-800">
      <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-3">
        <div className="flex flex-wrap items-center gap-4"><h1 className="text-sm font-bold">Research Workbench</h1>{headerNavigation}</div>
        <button className={BUTTON} disabled={!canWrite || !!busy} onClick={newProject}>New graph</button>
      </header>
      <div className="mx-auto max-w-[1600px] p-4 md:p-6">
        <div className="mb-5"><h2 className="text-2xl font-bold">Knowledge graph</h2><p className="mt-1 max-w-3xl text-sm text-slate-600">Connect ideas across your documents and web sources. Each connection keeps the quotation that supports it.</p></div>
        {error && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}<button className="ml-3 underline" onClick={() => { setError(''); if (runId) void loadRun(runId).catch((cause: Error) => setError(cause.message)); else void refreshRuns().catch((cause: Error) => setError(cause.message)); }}>Refresh</button></div>}
        {notice && <p role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
        <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="self-start rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="mb-3 font-semibold">Your graph projects</h3>
            {loading ? <p className="text-sm text-slate-500">Loading projects…</p> : runs.length === 0 ? <p className="text-sm text-slate-500">Your first graph will appear here. Projects are saved to your workspace.</p> : <div className="space-y-2">{runs.map((item) => <button key={item.run_id} onClick={() => selectRun(item.run_id)} disabled={!!busy} className={`w-full rounded-lg border p-3 text-left ${runId === item.run_id ? 'border-blue-300 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}><span className="block break-words text-sm font-semibold">{item.title || 'Research graph'}</span><span className="mt-1 block text-xs text-slate-500">{statusText(item.status)}</span><span className="mt-1 block text-xs text-slate-400">{new Date(item.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}</span></button>)}</div>}
            {runTotal > 20 && <div className="mt-3 flex items-center justify-between text-xs"><button disabled={!!busy || runOffset === 0} onClick={() => setRunOffset((value) => Math.max(0, value - 20))}>Previous</button><span>{runOffset + 1}–{Math.min(runOffset + 20, runTotal)}</span><button disabled={!!busy || runOffset + 20 >= runTotal} onClick={() => setRunOffset((value) => value + 20)}>Next</button></div>}
          </aside>
          <section className="min-w-0 space-y-4">
            <ol aria-label="Graph workflow" className="grid grid-cols-2 gap-2 sm:grid-cols-4">{steps.map((step, index) => <li key={step} aria-current={index === (run ? stageNumber(run) : 0) ? 'step' : undefined} className={`rounded-lg border px-3 py-3 text-sm ${index === (run ? stageNumber(run) : 0) ? 'border-blue-300 bg-blue-50 font-semibold text-blue-800' : 'border-slate-200 bg-white text-slate-500'}`}><span className="mr-2">{index + 1}.</span>{step}</li>)}</ol>
            {!runId && <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="text-lg font-semibold">Start with your documents</h3><p className="mt-1 text-sm text-slate-500">Choose saved files or upload new ones. PDF, Word, text, Markdown and JSON are supported.</p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div><label className="mb-1 block text-sm font-medium" htmlFor="kg-project-title">Graph name</label><input id="kg-project-title" className={INPUT} value={title} maxLength={200} placeholder="For example, Barkcloth tools and production" onChange={(event) => { setTitle(event.target.value); idempotency.current = null; }} /></div>
                <div><label className="mb-1 block text-sm font-medium" htmlFor="kg-topic">Research topic</label><input id="kg-topic" className={INPUT} value={topic} maxLength={500} onChange={(event) => { setTopic(event.target.value); idempotency.current = null; }} /></div>
              </div>
              <div className="mt-5 grid gap-5 md:grid-cols-2"><div>
                <label className="mb-1 block text-sm font-medium" htmlFor="kg-source-search">Find a saved source</label><input id="kg-source-search" className={INPUT} placeholder="Search titles or keywords" value={materialQuery} onChange={(event) => setMaterialQuery(event.target.value)} />
                <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-slate-200">{materials.filter((material) => material.file_count > 0).map((material) => <button key={material.id} disabled={!!busy} onClick={() => void selectMaterial(material.id)} className={`block w-full border-b border-slate-100 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-blue-50 ${materialDetail?.id === material.id ? 'bg-blue-50' : ''}`}>{material.title}<span className="ml-2 text-xs text-slate-400">{material.file_count} file(s)</span></button>)}</div>
                {materialTotal > 100 && <p className="mt-1 text-xs text-slate-500">Showing the first 100 results. Search to find a specific source.</p>}
                {materialDetail && <div className="mt-3 space-y-2"><p className="text-sm font-semibold">Choose files from {materialDetail.title}</p>{(materialDetail.files || []).map((file) => <button key={file.id} className={`${BUTTON} flex w-full items-center justify-between gap-2 text-left`} disabled={!FORMAT.test(file.original_filename) || !!busy || documents.some((entry) => entry.file_id === file.id) || documents.length >= 20} onClick={() => addDocument(materialDetail, file)}><span className="break-all">{file.original_filename}</span><span className="shrink-0 text-xs">{documents.some((entry) => entry.file_id === file.id) ? 'Added' : FORMAT.test(file.original_filename) ? '+ Add' : 'Unsupported'}</span></button>)}</div>}
                <input ref={uploadRef} type="file" multiple accept=".pdf,.txt,.md,.json,.docx" className="hidden" aria-label="Upload graph documents" onChange={(event) => void upload(event.target.files)} /><button className={`${BUTTON} mt-3`} disabled={!canWrite || !!busy} onClick={() => uploadRef.current?.click()}>{busy === 'upload' ? 'Saving documents…' : 'Upload documents'}</button>
              </div><div className="rounded-lg bg-slate-50 p-4"><h4 className="text-sm font-semibold">Selected documents ({documents.length}/20)</h4>{!documents.length && <p className="mt-2 text-sm text-slate-500">Add files from the list or upload them.</p>}<ul className="mt-3 space-y-2">{documents.map((document) => <li key={document.file_id} className="flex items-start justify-between gap-2 rounded-lg bg-white p-3 text-sm"><span className="break-words">{document.filename}</span><button className="text-xs font-semibold text-slate-500 hover:text-red-600" disabled={!!busy} aria-label={`Remove ${document.filename}`} onClick={() => { setDocuments((current) => current.filter((entry) => entry.file_id !== document.file_id)); idempotency.current = null; }}>Remove</button></li>)}</ul></div></div>
              <div className="mt-5 flex flex-wrap items-center gap-4"><label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={!canWrite || !!busy || capabilities?.collection?.available === false} checked={augment} onChange={(event) => { setAugment(event.target.checked); idempotency.current = null; }} />Enrich with web sources after reading the documents</label></div>
              <details className="mt-4 text-sm"><summary className="cursor-pointer text-slate-600">Analysis options</summary><div className="mt-3 grid max-w-xl gap-3 sm:grid-cols-2"><label className="block">Concept extraction<select className={`${INPUT} mt-1`} value={mode} onChange={(event) => { setMode(event.target.value); idempotency.current = null; }}><option value="manual">Add concepts myself</option><option value="ollama" disabled={!capabilities?.extraction.configured}>Assisted extraction{!capabilities?.extraction.configured ? ' — unavailable' : ''}</option></select></label><label className="block">Maximum web pages<input className={`${INPUT} mt-1`} type="number" min={1} max={25} value={pageBudget} onChange={(event) => { setPageBudget(Math.max(1, Math.min(25, Number(event.target.value) || 1))); idempotency.current = null; }} /></label></div><p className="mt-2 text-xs text-slate-500">Concepts and relationships are proposed from quotations. You decide what to include in the graph.</p></details>
              {!capabilities?.extraction.configured && !loading && <p className="mt-4 text-sm text-slate-500">Assisted extraction is not configured. You can select concepts and connections directly from your document text.</p>}
              <button className={`${PRIMARY} mt-5`} disabled={!canWrite || !documents.length || !!busy} onClick={() => void start()}>{busy === 'start' ? 'Starting…' : 'Start analysis'}</button>
            </div>}
            {runId && !run && <p role="status" className="rounded-xl bg-white p-5 text-sm text-slate-500">Loading graph project…</p>}
            {run && <div className="rounded-xl border border-slate-200 bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-lg font-semibold">{run.title || 'Research graph'}</h3><p className="mt-1 text-sm text-slate-600" aria-live="polite">{statusText(run.status)}</p></div><button className={BUTTON} disabled={!!busy} onClick={() => void action('refresh', async () => { await loadRun(run.run_id); await refreshRuns(); })}>Refresh</button></div>
              {RUNNING.has(run.status) && <p className="mt-3 text-sm text-slate-500">This project runs in the background. You can leave this page and return later.</p>}
              {runDescription(run) && <p className="mt-3 text-sm text-slate-600">{runDescription(run)}</p>}
              {(run.status === 'failed' || run.status === 'queue_failed') && <button className={`${BUTTON} mt-3`} disabled={!canWrite || !!busy} onClick={() => void resume()}>Retry processing</button>}
              {run.status === 'awaiting_readable_documents' && <p className="mt-3 text-sm text-slate-600">The files contain no readable text. Upload an OCR or text version and start a new graph.</p>}
            </div>}
            {run && data?.ontology && data.batches.length > 0 && (run.status === 'awaiting_annotations' || run.status === 'failed' || RUNNING.has(run.status)) && <div className="rounded-xl border border-slate-200 bg-white p-5"><h3 className="text-lg font-semibold">Find concepts in the source text</h3><p className="mt-1 mb-4 text-sm text-slate-500">Keep the original words and their quotation. Add connections when the passage describes them.</p>{canWrite ? <ManualConceptEditor batches={data.batches} ontology={data.ontology} sourceLabels={data.sourceLabels} busy={!!busy || RUNNING.has(run.status)} onSubmit={submitAnnotations} /> : <p className="text-sm text-slate-500">A workspace contributor can add concepts to continue this project.</p>}</div>}
            {run?.status === 'awaiting_frontier' && data && <div className="rounded-xl border border-slate-200 bg-white p-5"><h3 className="text-lg font-semibold">Enrich document concepts with web sources</h3><p className="mt-1 text-sm text-slate-500">Choose an idea from the documents, then add a relevant public page. Web evidence stays connected to that idea.</p><div className="mt-4 grid gap-4 md:grid-cols-2"><div><label htmlFor="kg-seed-search" className="mb-1 block text-sm font-medium">Document concepts</label><input id="kg-seed-search" className={INPUT} value={seedQuery} placeholder="Find a concept" onChange={(event) => setSeedQuery(event.target.value)} /><div className="mt-2 max-h-60 overflow-y-auto rounded-lg border border-slate-200 p-2">{filteredSeeds.slice(0, 100).map((seed) => <label key={seed.seed_id} className="flex cursor-pointer items-start gap-2 rounded-lg p-2 text-sm hover:bg-slate-50"><input className="mt-1" type="checkbox" checked={chosenSeeds.includes(seed.seed_id)} disabled={!canWrite || !!busy} onChange={(event) => setChosenSeeds((current) => event.target.checked ? [...current, seed.seed_id] : current.filter((id) => id !== seed.seed_id))} /><span>{seed.label}<span className="block text-xs text-slate-400">{seed.entity_type.replace(/([a-z])([A-Z])/g, '$1 $2')}</span></span></label>)}</div>{filteredSeeds.length > 100 && <p className="mt-1 text-xs text-slate-500">Search to narrow these {filteredSeeds.length} concepts.</p>}</div><div><label className="mb-1 block text-sm font-medium" htmlFor="kg-web-url">Relevant web page</label><input id="kg-web-url" className={INPUT} type="url" value={webUrl} placeholder="https://…" onChange={(event) => setWebUrl(event.target.value)} /><button className={`${BUTTON} mt-3`} disabled={!canWrite || !!busy || !webUrl || !chosenSeeds.length} onClick={addWebSource}>Add web source</button>{chosenSeeds.length > 0 && <div className="mt-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-900"><p className="font-semibold">Search ideas</p>{data.seeds.filter((seed) => chosenSeeds.includes(seed.seed_id)).slice(0, 3).map((seed) => <p key={seed.seed_id} className="mt-1 break-words">{seed.queries[0]}</p>)}</div>}<ul className="mt-4 space-y-2">{frontier.map((entry) => <li key={entry.url} className="flex justify-between gap-2 rounded-lg bg-slate-50 p-3 text-sm"><span className="break-all">{entry.url}<span className="block text-xs text-slate-500">Linked to {entry.seed_ids.length} document concept(s)</span></span><button className="text-xs text-slate-500" disabled={!!busy} onClick={() => setFrontier((current) => current.filter((item) => item.url !== entry.url))}>Remove</button></li>)}</ul></div></div><button className={`${PRIMARY} mt-4`} disabled={!canWrite || !!busy || !frontier.length || capabilities?.collection?.available === false} onClick={() => void collect()}>{busy === 'collect' ? 'Starting collection…' : frontier.length ? `Read ${frontier.length} web source${frontier.length === 1 ? '' : 's'}` : 'Read web sources'}</button><button className={`${BUTTON} ml-3 mt-4`} disabled={!canWrite || !!busy} onClick={() => void skipEnrichment()}>Continue with documents only</button>{capabilities?.collection && !capabilities.collection.available && <p className="mt-3 text-sm text-amber-800">Web collection is unavailable in this workspace. You can continue with your saved document concepts.</p>}</div>}
            {data?.graph && <GraphExplorer key={runId} graph={data.graph || EMPTY_GRAPH} decisions={data.decisions} onReview={review} canReview={canReview} busy={!!busy} onOpenResearchEvidence={onOpenResearchEvidence} />}
            {run?.status === 'awaiting_review' && <div className="rounded-xl border border-slate-200 bg-white p-5"><h3 className="font-semibold">Save a graph version</h3><p className="mt-1 text-sm text-slate-500">A preview shows pending items. A published version contains only items you have included, with their source evidence.</p>{capabilities?.can_review ? <div className="mt-4 flex flex-wrap gap-3"><button className={BUTTON} disabled={!!busy} onClick={() => void release(true)}>Create preview</button><button className={PRIMARY} disabled={!!busy || accepted === 0} onClick={() => void release(false)}>Publish reviewed graph</button><span className="self-center text-xs text-slate-500">{accepted} item(s) included</span></div> : <p className="mt-3 text-sm text-slate-500">A workspace reviewer can publish a graph version.</p>}</div>}
            {run?.release_path && <div className="rounded-xl border border-slate-200 bg-white p-5"><h3 className="font-semibold">{run.status === 'released' ? 'Published graph' : 'Graph preview'} downloads</h3><div className="mt-3 flex flex-wrap gap-3">{[['graph.json', 'Graph data (JSON)'], ['graph.ttl', 'Graph data (RDF)'], ['manifest.json', 'Source and version manifest']].map(([filename, label]) => <GraphDownload key={filename} className={BUTTON} filename={filename} url={`${API_BASE_URL}/research-runs/${run.run_id}/artifacts/${run.release_path}/${filename}`}>{label}</GraphDownload>)}</div></div>}
            {data?.metrics && <details className="rounded-xl border border-slate-200 bg-white p-4 text-sm"><summary className="cursor-pointer font-semibold">Collection results</summary><p className="mt-3 text-slate-600">{data.metrics.successful_snapshots || 0} saved web page(s). Average new candidate concepts per page: {data.metrics.average_novel_candidates_per_snapshot?.toFixed(2) ?? 'Not available'}.</p><p className="mt-1 text-xs text-slate-500">Candidate yield measures collection output. It does not measure scientific accuracy or completeness.</p>{(data.metrics.collection_attempts || []).map((attempt, index) => <p key={index} className="mt-2 break-words text-xs text-slate-500">{String(attempt.url || attempt.requested_url || 'Web source')} · {String(attempt.status || attempt.reason || 'Recorded attempt').replaceAll('_', ' ')}</p>)}</details>}
          </section>
        </div>
      </div>
    </main>
  );
}
