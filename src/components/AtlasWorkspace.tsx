import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { API_BASE_URL } from '../config';
import { useWorkbenchAuth } from '../auth-context';
import { SemanticAtlasCanvas } from './repository/graph/SemanticAtlasCanvas';
import { SemanticGraphDetailPanel } from './repository/graph/SemanticGraphDetailPanel';
import {
  adaptSemanticGraph,
  semanticRelationToInteractive,
} from './repository/graph/semanticGraphAdapter';
import type {
  GraphSelection,
  InteractiveGraphEdge,
  InteractiveGraphNode,
  InteractiveGraphPayload,
  SemanticAtlasLens,
  SemanticEntityDetail,
  SemanticEntityEvidence,
  SemanticEvidenceFocus,
  SemanticGraphBuildResult,
  SemanticGraphPayload,
  SemanticRelationEvidence,
} from './repository/graph/graphTypes';
import type {
  KnowledgeGraphEvidenceRef,
  KnowledgeGraphMap,
  KnowledgeGraphMapFeature,
  KnowledgeGraphMapLayer,
  KnowledgeGraphTimeline,
  ResearchEvidenceNavigation,
} from './repository/types';

interface AtlasWorkspaceProps {
  headerNavigation?: ReactNode;
  onOpenResearchEvidence: (
    target: Omit<ResearchEvidenceNavigation, 'request_id'>,
  ) => void;
}

type Availability = 'checking' | 'available' | 'unavailable';

type TimedKnowledgeGraphMapFeature = KnowledgeGraphMapFeature & {
  properties: KnowledgeGraphMapFeature['properties'] & {
    time_year?: number | null;
  };
};

const filenameToken = (query: string) =>
  query
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60) || 'semantic_atlas';

const responseError = async (response: Response, fallback: string) => {
  const text = await response.text();
  if (!text) return fallback;
  try {
    const payload = JSON.parse(text) as { detail?: unknown };
    if (typeof payload.detail === 'string') return payload.detail;
  } catch {
    return text;
  }
  return fallback;
};

const downloadFile = (filename: string, content: string, type: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const escapeCsvCell = (value: unknown) => {
  const text = value == null ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
};

const downloadCsv = (filename: string, rows: Array<Array<unknown>>) => {
  downloadFile(
    filename,
    rows.map((row) => row.map(escapeCsvCell).join(',')).join('\n'),
    'text/csv;charset=utf-8',
  );
};

export function AtlasWorkspace({
  headerNavigation,
  onOpenResearchEvidence,
}: AtlasWorkspaceProps) {
  const { apiFetch } = useWorkbenchAuth();
  const [availability, setAvailability] = useState<Availability>('checking');
  const [semanticPayload, setSemanticPayload] =
    useState<SemanticGraphPayload | null>(null);
  const [graph, setGraph] = useState<InteractiveGraphPayload | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [lens, setLens] = useState<SemanticAtlasLens>('documents');
  const [includeRejected, setIncludeRejected] = useState(false);
  const [selection, setSelection] = useState<GraphSelection>(null);
  const [detailsByEntity, setDetailsByEntity] = useState<
    Record<string, SemanticEntityDetail | undefined>
  >({});
  const [evidenceByEntity, setEvidenceByEntity] = useState<
    Record<string, SemanticEntityEvidence | undefined>
  >({});
  const [evidenceFocus, setEvidenceFocus] =
    useState<SemanticEvidenceFocus | null>(null);
  const [relationEvidence, setRelationEvidence] =
    useState<SemanticRelationEvidence | null>(null);
  const [expandedDocumentId, setExpandedDocumentId] =
    useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildResult, setBuildResult] = useState<SemanticGraphBuildResult | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [loadingEntityId, setLoadingEntityId] = useState<string | null>(null);
  const [loadingEvidenceId, setLoadingEvidenceId] =
    useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [timeline, setTimeline] = useState<KnowledgeGraphTimeline | null>(null);
  const [map, setMap] = useState<KnowledgeGraphMap | null>(null);
  const [isLoadingDataTools, setIsLoadingDataTools] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [gisStatus, setGisStatus] = useState('');

  const repositoryFetch = useCallback(
    async (path: string, init?: RequestInit) => {
      if (!API_BASE_URL) {
        throw new Error('Backend API is not configured for this deployment.');
      }
      const urls = [
        `${API_BASE_URL}/repository${path}`,
        `${API_BASE_URL}${path}`,
      ];
      let lastResponse: Response | null = null;
      for (const url of urls) {
        const response = await apiFetch(url, init);
        if (response.status !== 404) return response;
        lastResponse = response;
      }
      return lastResponse ?? apiFetch(urls[0], init);
    },
    [apiFetch],
  );

  const clearFocus = useCallback(() => {
    setSelection(null);
    setRelationEvidence(null);
    setEvidenceFocus(null);
  }, []);

  const loadGraph = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const query = submittedQuery.trim();
      const params = new URLSearchParams({
        view: 'overview',
        include_generic: String(query.length >= 2),
        include_rejected: String(includeRejected),
        limit: '220',
      });
      if (query.length >= 2) params.set('query', query);
      const response = await repositoryFetch(`/graph/semantic?${params}`);
      if (!response.ok) {
        throw new Error(
          await responseError(response, 'Semantic Atlas is unavailable.'),
        );
      }
      const payload = (await response.json()) as SemanticGraphPayload;
      setSemanticPayload(payload);
      setGraph(adaptSemanticGraph(payload));
      setAvailability('available');
      clearFocus();
      setExpandedDocumentId(null);
      setDetailsByEntity({});
      setEvidenceByEntity({});
    } catch (loadError) {
      setAvailability('unavailable');
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Semantic Atlas is unavailable.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [clearFocus, includeRejected, repositoryFetch, submittedQuery]);

  useEffect(() => {
    void loadGraph();
  }, [loadGraph]);

  const loadDataTools = useCallback(async () => {
    setIsLoadingDataTools(true);
    setError('');
    try {
      const query = submittedQuery.trim();
      const timelineParams = new URLSearchParams({ limit: '100' });
      const mapParams = new URLSearchParams({ limit: '100' });
      if (query.length >= 2) {
        timelineParams.set('query', query);
        mapParams.set('query', query);
      }
      const [timelineResponse, mapResponse] = await Promise.all([
        repositoryFetch(`/graph/semantic/timeline?${timelineParams}`),
        repositoryFetch(`/graph/semantic/map?${mapParams}`),
      ]);
      if (!timelineResponse.ok) {
        throw new Error(
          await responseError(timelineResponse, 'Timeline export failed.'),
        );
      }
      if (!mapResponse.ok) {
        throw new Error(
          await responseError(mapResponse, 'Map export failed.'),
        );
      }
      setTimeline((await timelineResponse.json()) as KnowledgeGraphTimeline);
      setMap((await mapResponse.json()) as KnowledgeGraphMap);
      setGisStatus('');
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Atlas data tools failed.',
      );
    } finally {
      setIsLoadingDataTools(false);
    }
  }, [repositoryFetch, submittedQuery]);

  const loadEntity = useCallback(
    async (entityId: string) => {
      setIsLoadingDetail(true);
      setLoadingEntityId(entityId);
      try {
        const response = await repositoryFetch(
          `/graph/entity/${encodeURIComponent(entityId)}?include_rejected=${includeRejected}`,
        );
        if (!response.ok) {
          throw new Error(
            await responseError(response, 'Semantic entity detail failed.'),
          );
        }
        const detail = (await response.json()) as SemanticEntityDetail;
        setDetailsByEntity((current) => ({
          ...current,
          [entityId]: detail,
        }));
        return detail;
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Semantic entity detail failed.',
        );
        return null;
      } finally {
        setIsLoadingDetail(false);
        setLoadingEntityId((current) =>
          current === entityId ? null : current,
        );
      }
    },
    [includeRejected, repositoryFetch],
  );

  const loadEntityEvidence = useCallback(
    async (entityId: string) => {
      const cached = evidenceByEntity[entityId];
      if (cached) return cached;
      setLoadingEvidenceId(entityId);
      try {
        const response = await repositoryFetch(
          `/graph/entity/${encodeURIComponent(entityId)}/evidence?limit=80`,
        );
        if (!response.ok) {
          throw new Error(
            await responseError(response, 'Semantic evidence failed.'),
          );
        }
        const evidence = (await response.json()) as SemanticEntityEvidence;
        setEvidenceByEntity((current) => ({
          ...current,
          [entityId]: evidence,
        }));
        return evidence;
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Semantic evidence failed.',
        );
        return null;
      } finally {
        setLoadingEvidenceId((current) =>
          current === entityId ? null : current,
        );
      }
    },
    [evidenceByEntity, repositoryFetch],
  );

  const handleNodeSelect = useCallback(
    async (node: InteractiveGraphNode) => {
      setSelection({ kind: 'node', node });
      setRelationEvidence(null);
      setEvidenceFocus(null);
      await Promise.all([loadEntity(node.id), loadEntityEvidence(node.id)]);
    },
    [loadEntity, loadEntityEvidence],
  );

  const handleEdgeSelect = useCallback(
    async (edge: InteractiveGraphEdge) => {
      setSelection({ kind: 'edge', edge });
      setRelationEvidence(null);
      setEvidenceFocus(null);
      if (!edge.semantic_relation) return;
      setIsLoadingDetail(true);
      try {
        const response = await repositoryFetch(
          `/graph/relation/${encodeURIComponent(edge.id)}/evidence?limit=20`,
        );
        if (!response.ok) {
          throw new Error(
            await responseError(response, 'Relation evidence failed.'),
          );
        }
        setRelationEvidence(
          (await response.json()) as SemanticRelationEvidence,
        );
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Relation evidence failed.',
        );
      } finally {
        setIsLoadingDetail(false);
      }
    },
    [repositoryFetch],
  );

  const handleDocumentToggle = useCallback(
    async (document: InteractiveGraphNode) => {
      if (expandedDocumentId === document.id) {
        setExpandedDocumentId(null);
        return;
      }
      setExpandedDocumentId(document.id);
      setSelection({ kind: 'node', node: document });
      setRelationEvidence(null);
      setEvidenceFocus(null);
      await Promise.all([
        loadEntity(document.id),
        loadEntityEvidence(document.id),
      ]);
    },
    [expandedDocumentId, loadEntity, loadEntityEvidence],
  );

  const reviewSemantic = async (
    kind: 'relations' | 'candidates',
    itemId: string,
    status: 'accepted' | 'needs_review' | 'rejected',
  ) => {
    setReviewingId(itemId);
    setError('');
    try {
      const response = await repositoryFetch(
        `/graph/semantic/${kind}/${encodeURIComponent(itemId)}/review`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ review_status: status }),
        },
      );
      if (!response.ok) {
        throw new Error(
          await responseError(response, 'Semantic review failed.'),
        );
      }
      await loadGraph();
    } catch (reviewError) {
      setError(
        reviewError instanceof Error
          ? reviewError.message
          : 'Semantic review failed.',
      );
    } finally {
      setReviewingId(null);
    }
  };

  const buildAtlas = async () => {
    setIsBuilding(true);
    setBuildResult(null);
    setError('');
    try {
      const response = await repositoryFetch('/graph/semantic/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true }),
      });
      if (!response.ok) {
        throw new Error(
          await responseError(response, 'Semantic Atlas build failed.'),
        );
      }
      setBuildResult((await response.json()) as SemanticGraphBuildResult);
      await Promise.all([loadGraph(), loadDataTools()]);
    } catch (buildError) {
      setError(
        buildError instanceof Error
          ? buildError.message
          : 'Semantic Atlas build failed.',
      );
    } finally {
      setIsBuilding(false);
    }
  };

  const openEvidence = (ref: KnowledgeGraphEvidenceRef) => {
    if (!ref.material_id) return;
    onOpenResearchEvidence({
      ...ref,
      view: ref.image_id
        ? 'images'
        : ref.observation_id
          ? 'observations'
          : 'segments',
    });
  };

  const openMaterialView = (
    materialId: string,
    view: 'segments' | 'images' | 'observations',
  ) => {
    onOpenResearchEvidence({ material_id: materialId, view });
  };

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmittedQuery(searchTerm.trim());
  };

  const resetAtlas = () => {
    setSearchTerm('');
    setSubmittedQuery('');
    setLens('documents');
    setIncludeRejected(false);
    setExpandedDocumentId(null);
    clearFocus();
  };

  const exportVisible = () => {
    if (!graph) return;
    downloadFile(
      `${filenameToken(submittedQuery)}_visible_atlas.json`,
      JSON.stringify(
        {
          query: submittedQuery || null,
          lens,
          nodes: graph.nodes,
          edges: graph.edges,
          hidden_summary: semanticPayload?.hidden_summary,
          evidence_note: semanticPayload?.evidence_note,
        },
        null,
        2,
      ),
      'application/json;charset=utf-8',
    );
  };

  const exportAll = () => {
    if (!semanticPayload) return;
    downloadFile(
      `${filenameToken(submittedQuery)}_semantic_atlas.json`,
      JSON.stringify(semanticPayload, null, 2),
      'application/json;charset=utf-8',
    );
  };

  const downloadTimelineCsv = () => {
    if (!timeline) return;
    const rows = [...timeline.items, ...timeline.unresolved].map((item) => [
      item.time_label,
      item.sort_year ?? '',
      item.source_label,
      item.source_type,
      item.edge.review_status,
      item.edge.confidence,
      item.edge.evidence_ref.material_title ?? '',
      item.edge.evidence_ref.page_ref ?? '',
      item.edge.evidence_ref.source_locator ?? '',
      item.edge.evidence_ref.snippet ?? '',
    ]);
    downloadCsv(`${filenameToken(submittedQuery)}_timeline.csv`, [
      [
        'time_label',
        'sort_year',
        'source_label',
        'source_type',
        'review_status',
        'confidence',
        'material_title',
        'page_ref',
        'source_locator',
        'snippet',
      ],
      ...rows,
    ]);
  };

  const downloadMapGeoJson = () => {
    if (!map) return;
    downloadFile(
      `${filenameToken(submittedQuery)}_map.geojson`,
      JSON.stringify(map.geojson, null, 2),
      'application/geo+json;charset=utf-8',
    );
  };

  const downloadMapCsv = () => {
    if (!map) return;
    const resolved = map.geojson.features.map((feature) => [
      feature.properties.place_label,
      feature.geometry.coordinates[1],
      feature.geometry.coordinates[0],
      feature.properties.source_label,
      feature.properties.source_type,
      feature.properties.review_status,
      feature.properties.confidence,
      feature.properties.evidence_ref.material_title ?? '',
      feature.properties.evidence_ref.page_ref ?? '',
      feature.properties.evidence_ref.source_locator ?? '',
    ]);
    downloadCsv(`${filenameToken(submittedQuery)}_map.csv`, [
      [
        'place_label',
        'latitude',
        'longitude',
        'source_label',
        'source_type',
        'review_status',
        'confidence',
        'material_title',
        'page_ref',
        'source_locator',
      ],
      ...resolved,
    ]);
  };

  const timelineYears = useMemo(() => {
    const years = new Set<number>();
    timeline?.items.forEach((item) => {
      if (typeof item.sort_year === 'number' && Number.isFinite(item.sort_year)) {
        years.add(item.sort_year);
      }
    });
    return Array.from(years).sort((left, right) => left - right);
  }, [timeline]);

  const minYear = timelineYears[0] ?? null;
  const maxYear =
    timelineYears.length > 0 ? timelineYears[timelineYears.length - 1] : null;

  useEffect(() => {
    if (selectedYear == null) return;
    if (minYear == null || maxYear == null) {
      setSelectedYear(null);
      return;
    }
    if (selectedYear < minYear || selectedYear > maxYear) {
      setSelectedYear(maxYear);
    }
  }, [maxYear, minYear, selectedYear]);

  const timelineYearByEdgeId = useMemo(() => {
    const years = new Map<string, number | null>();
    [...(timeline?.items || []), ...(timeline?.unresolved || [])].forEach(
      (item) => years.set(item.edge.id, item.sort_year ?? null),
    );
    return years;
  }, [timeline]);

  const timelineYearByMaterialId = useMemo(() => {
    const years = new Map<string, number>();
    timeline?.items.forEach((item) => {
      const materialId = item.edge.evidence_ref.material_id;
      if (
        !materialId ||
        typeof item.sort_year !== 'number' ||
        !Number.isFinite(item.sort_year)
      ) {
        return;
      }
      const existing = years.get(materialId);
      if (existing == null || item.sort_year < existing) {
        years.set(materialId, item.sort_year);
      }
    });
    return years;
  }, [timeline]);

  const timedMapFeatures = useMemo<TimedKnowledgeGraphMapFeature[]>(
    () =>
      (map?.geojson.features || []).map((feature) => ({
        ...feature,
        properties: {
          ...feature.properties,
          time_year:
            timelineYearByEdgeId.get(feature.properties.edge_id) ??
            (feature.properties.evidence_ref.material_id
              ? timelineYearByMaterialId.get(
                  feature.properties.evidence_ref.material_id,
                )
              : null) ??
            null,
        },
      })),
    [map, timelineYearByEdgeId, timelineYearByMaterialId],
  );

  const filteredMapFeatures = useMemo(
    () =>
      selectedYear == null
        ? timedMapFeatures
        : timedMapFeatures.filter(
            (feature) =>
              typeof feature.properties.time_year !== 'number' ||
              feature.properties.time_year <= selectedYear,
          ),
    [selectedYear, timedMapFeatures],
  );

  const stageGisLayer = () => {
    if (!map) return;
    const rows = filteredMapFeatures.map((feature) => ({
      id: feature.properties.edge_id,
      place_label: feature.properties.place_label,
      latitude: feature.geometry.coordinates[1],
      longitude: feature.geometry.coordinates[0],
      source_label: feature.properties.source_label,
      source_type: feature.properties.source_type,
      review_status: feature.properties.review_status,
      confidence: feature.properties.confidence,
      time_year: feature.properties.time_year ?? null,
      material_title: feature.properties.evidence_ref.material_title || '',
      page_ref: feature.properties.evidence_ref.page_ref || '',
      source_locator: feature.properties.evidence_ref.source_locator || '',
      snippet: feature.properties.evidence_ref.snippet || '',
    }));
    const layer: KnowledgeGraphMapLayer = {
      id: `semantic-atlas-${Date.now()}`,
      name:
        selectedYear == null
          ? 'Semantic Atlas spatial evidence'
          : `Semantic Atlas spatial evidence through ${selectedYear}`,
      dataset: 'Semantic Atlas',
      type: 'geojson',
      source: 'repository_knowledge_graph',
      visible: true,
      opacity: 0.9,
      color: [217, 119, 6],
      coords: { lat: 'latitude', lon: 'longitude' },
      data: rows,
      filteredData: rows,
      geoData: { ...map.geojson, features: filteredMapFeatures },
      isSpatial: true,
      pointSize: 6,
      displayField: 'place_label',
      tooltipFields: [
        'place_label',
        'source_label',
        'review_status',
        'confidence',
        'time_year',
      ],
      staged_at: new Date().toISOString(),
    };
    window.sessionStorage.setItem(
      'tapa-workbench:semantic-atlas-layer',
      JSON.stringify(layer),
    );
    window.dispatchEvent(
      new CustomEvent('tapa-workbench:semantic-atlas-layer', {
        detail: layer,
      }),
    );
    setGisStatus(
      `${rows.length} resolved place ${rows.length === 1 ? 'point' : 'points'} staged for GIS.`,
    );
  };

  const canvasNodes = graph?.nodes || [];
  const canvasEdges = graph?.edges || [];

  return (
    <div className="fixed inset-0 z-[80] bg-slate-950/60 backdrop-blur-sm">
      <div className="flex h-full w-full flex-col bg-slate-50 text-slate-900">
        <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-5">
          <div className="flex min-w-0 items-center gap-4 overflow-x-auto">
            <h2 className="hidden shrink-0 text-sm font-black uppercase tracking-[0.18em] lg:block">
              Semantic Atlas
            </h2>
            {headerNavigation}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadGraph()}
              disabled={isLoading}
              className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-xs font-black uppercase tracking-wider hover:bg-slate-100 disabled:opacity-50"
            >
              {isLoading ? 'Refreshing' : 'Refresh'}
            </button>
            <button
              type="button"
              onClick={() => void buildAtlas()}
              disabled={isBuilding || availability === 'unavailable'}
              className="h-10 rounded-lg bg-amber-700 px-4 text-xs font-black uppercase tracking-wider text-white hover:bg-amber-800 disabled:opacity-50"
            >
              {isBuilding ? 'Building' : 'Build Atlas'}
            </button>
          </div>
        </header>

        {availability === 'unavailable' ? (
          <main className="grid min-h-0 flex-1 place-items-center overflow-auto p-6">
            <section className="w-full max-w-xl rounded-2xl border border-amber-200 bg-white p-8 text-center shadow-sm">
              <div className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">
                Atlas unavailable
              </div>
              <h1 className="mt-3 text-2xl font-black text-slate-900">
                The Semantic Atlas backend could not be reached.
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-slate-500">
                {error ||
                  'Start the backend with the semantic graph routes enabled, then retry.'}
              </p>
              <button
                type="button"
                onClick={() => {
                  setAvailability('checking');
                  void loadGraph();
                }}
                className="mt-6 rounded-lg bg-slate-900 px-5 py-3 text-xs font-black uppercase tracking-wider text-white hover:bg-slate-700"
              >
                Retry
              </button>
            </section>
          </main>
        ) : (
          <main className="min-h-0 flex-1 overflow-auto p-4">
            <section
              className={
                isExpanded
                  ? 'fixed inset-3 z-[95] overflow-auto rounded-xl bg-slate-50 p-4 shadow-2xl'
                  : 'space-y-3'
              }
            >
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
                <form
                  onSubmit={handleSearch}
                  className="flex min-w-[260px] flex-1 items-center gap-2"
                >
                  <input
                    type="search"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Focus documents, entities, or evidence"
                    aria-label="Search the Semantic Atlas"
                    className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-amber-600"
                  />
                  <button
                    type="submit"
                    className="h-9 rounded-lg bg-slate-900 px-4 text-[10px] font-black uppercase tracking-wider text-white hover:bg-slate-700"
                  >
                    Search
                  </button>
                </form>
                <label className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-[10px] font-black uppercase tracking-wider text-slate-500">
                  <input
                    type="checkbox"
                    checked={includeRejected}
                    onChange={(event) =>
                      setIncludeRejected(event.target.checked)
                    }
                    className="accent-amber-700"
                  />
                  Rejected
                </label>
                <button
                  type="button"
                  onClick={resetAtlas}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-black uppercase tracking-wider text-slate-500 hover:bg-slate-50"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={exportVisible}
                  disabled={!graph}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-black uppercase tracking-wider text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                >
                  Visible JSON
                </button>
                <button
                  type="button"
                  onClick={exportAll}
                  disabled={!semanticPayload}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-black uppercase tracking-wider text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                >
                  All JSON
                </button>
                <button
                  type="button"
                  onClick={() => setIsExpanded((current) => !current)}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-black uppercase tracking-wider text-slate-500 hover:bg-slate-50"
                >
                  {isExpanded ? 'Exit Full Screen' : 'Full Screen'}
                </button>
              </div>

              {buildResult && (
                <div role="status" className={`rounded-lg border px-4 py-3 text-sm ${(buildResult.legacy_identity_review_count ?? 0) > 0 ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-blue-200 bg-blue-50 text-blue-900'}`}>
                  <p className="font-bold">Atlas rebuilt from repository evidence.</p>
                  {(buildResult.legacy_identity_review_count ?? 0) > 0 && (
                    <p className="mt-1">
                      {buildResult.legacy_identity_review_count} older entity {buildResult.legacy_identity_review_count === 1 ? 'record needs' : 'records need'} a name review.
                      {' '}Earlier text normalization may have combined different source forms. These records remain available for reference;
                      rebuilt relationships preserve original scripts and accents. Review the original sources before carrying earlier interpretations forward.
                    </p>
                  )}
                </div>
              )}

              {error && (
                <div
                  role="alert"
                  className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
                >
                  {error}
                </div>
              )}

              {availability === 'checking' && !graph ? (
                <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">
                  Loading Semantic Atlas…
                </div>
              ) : (
                <div className="grid gap-3 2xl:grid-cols-[minmax(0,1fr)_340px]">
                  <SemanticAtlasCanvas
                    nodes={canvasNodes}
                    edges={canvasEdges}
                    selected={selection}
                    evidenceFocus={evidenceFocus}
                    lens={lens}
                    searchTerm={searchTerm}
                    expandedDocumentId={expandedDocumentId}
                    detailsByEntity={detailsByEntity}
                    evidenceByEntity={evidenceByEntity}
                    hiddenSummary={semanticPayload?.hidden_summary}
                    loadingDetailId={loadingEntityId}
                    loadingEvidenceId={loadingEvidenceId}
                    onLensChange={(nextLens) => {
                      setLens(nextLens);
                      setExpandedDocumentId(null);
                      clearFocus();
                    }}
                    onNodeSelect={(node) => void handleNodeSelect(node)}
                    onEdgeSelect={(edge) => void handleEdgeSelect(edge)}
                    onDocumentToggle={(document) =>
                      void handleDocumentToggle(document)
                    }
                    onEvidenceSelect={(document, item) => {
                      setSelection({ kind: 'node', node: document });
                      setEvidenceFocus({ document, item });
                    }}
                    onOpenMaterialView={openMaterialView}
                  />
                  <SemanticGraphDetailPanel
                    selection={selection}
                    detail={
                      selection?.kind === 'node'
                        ? detailsByEntity[selection.node.id] || null
                        : null
                    }
                    evidenceFocus={evidenceFocus}
                    entityEvidence={
                      selection?.kind === 'node'
                        ? evidenceByEntity[selection.node.id] || null
                        : null
                    }
                    relationEvidence={relationEvidence}
                    isLoading={
                      isLoadingDetail ||
                      (selection?.kind === 'node' &&
                        loadingEvidenceId === selection.node.id)
                    }
                    reviewingId={reviewingId}
                    onOpenEvidence={openEvidence}
                    onOpenMaterialView={openMaterialView}
                    expandedDocumentId={expandedDocumentId}
                    onToggleDocument={(document) =>
                      void handleDocumentToggle(document)
                    }
                    onRelationSelect={(relation) =>
                      void handleEdgeSelect(
                        semanticRelationToInteractive(relation),
                      )
                    }
                    onReviewRelation={(relationId, status) =>
                      reviewSemantic('relations', relationId, status)
                    }
                    onReviewCandidate={(candidateId, status) =>
                      reviewSemantic('candidates', candidateId, status)
                    }
                    onClearFocus={() => {
                      clearFocus();
                      setExpandedDocumentId(null);
                    }}
                  />
                </div>
              )}

              <details className="rounded-xl border border-slate-200 bg-white">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                  <span>
                    <span className="block text-[10px] font-black uppercase tracking-widest text-slate-500">
                      Timeline, map, and GIS exports
                    </span>
                    <span className="mt-1 block text-xs text-slate-400">
                      Prepare time-aware and spatial evidence handoffs.
                    </span>
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Data tools
                  </span>
                </summary>
                <div className="border-t border-slate-100 p-4">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void loadDataTools()}
                      disabled={isLoadingDataTools}
                      className="h-9 rounded-lg border border-slate-200 px-3 text-[10px] font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                    >
                      {isLoadingDataTools ? 'Syncing' : 'Sync data'}
                    </button>
                    <button
                      type="button"
                      onClick={downloadTimelineCsv}
                      disabled={!timeline}
                      className="h-9 rounded-lg border border-slate-200 px-3 text-[10px] font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                    >
                      Timeline CSV
                    </button>
                    <button
                      type="button"
                      onClick={downloadMapGeoJson}
                      disabled={!map}
                      className="h-9 rounded-lg border border-slate-200 px-3 text-[10px] font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                    >
                      Map GeoJSON
                    </button>
                    <button
                      type="button"
                      onClick={downloadMapCsv}
                      disabled={!map}
                      className="h-9 rounded-lg border border-slate-200 px-3 text-[10px] font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                    >
                      Map CSV
                    </button>
                    <button
                      type="button"
                      onClick={stageGisLayer}
                      disabled={filteredMapFeatures.length === 0}
                      className="h-9 rounded-lg bg-amber-700 px-3 text-[10px] font-black uppercase tracking-wider text-white hover:bg-amber-800 disabled:opacity-40"
                    >
                      Stage GIS layer
                    </button>
                  </div>

                  <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(260px,380px)_1fr]">
                    {minYear != null && maxYear != null ? (
                      <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
                          GIS time range
                          <button
                            type="button"
                            onClick={() => setSelectedYear(null)}
                            className="text-amber-700 hover:text-amber-900"
                          >
                            All years
                          </button>
                        </div>
                        <input
                          type="range"
                          aria-label="Latest year included in the staged GIS layer"
                          min={minYear}
                          max={maxYear}
                          value={selectedYear ?? maxYear}
                          onChange={(event) =>
                            setSelectedYear(Number(event.target.value))
                          }
                          className="mt-3 w-full accent-amber-700"
                        />
                        <div className="mt-1 flex justify-between text-[11px] font-bold text-slate-400">
                          <span>{minYear}</span>
                          <span className="text-slate-600">
                            {selectedYear == null
                              ? 'All resolved years'
                              : `Through ${selectedYear}`}
                          </span>
                          <span>{maxYear}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs text-slate-400">
                        Sync data to prepare time-aware GIS exports.
                      </div>
                    )}
                    <div className="flex flex-wrap content-start gap-2 rounded-lg border border-slate-100 bg-slate-50 p-3 text-[10px] font-black uppercase tracking-wider">
                      <span className="rounded-full bg-violet-100 px-2 py-1 text-violet-700">
                        {timeline?.summary?.valid_time_count || 0} valid periods
                      </span>
                      <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-700">
                        {map?.summary?.resolved_coordinate_count || 0} mapped
                        places
                      </span>
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-800">
                        {(timeline?.summary?.review_time_count || 0) +
                          (map?.summary?.unresolved_place_mentions || 0)}{' '}
                        review items
                      </span>
                    </div>
                  </div>
                  {gisStatus && (
                    <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-xs font-bold text-emerald-700">
                      {gisStatus}
                    </div>
                  )}
                </div>
              </details>
            </section>
          </main>
        )}
      </div>
    </div>
  );
}
