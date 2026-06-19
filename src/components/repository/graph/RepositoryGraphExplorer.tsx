import { useCallback, useEffect, useMemo, useState } from 'react';
import { GraphCanvas } from './GraphCanvas';
import { GraphControls } from './GraphControls';
import { GraphDetailPanel } from './GraphDetailPanel';
import { SemanticAtlasCanvas } from './SemanticAtlasCanvas';
import { SemanticGraphDetailPanel } from './SemanticGraphDetailPanel';
import { filterInteractiveGraph } from './graphFiltering';
import { mergeGraphPayloads } from './graphLayout';
import {
  adaptSemanticGraph,
  filterSemanticGraph,
  semanticFilters,
  semanticRelationToInteractive,
  semanticViewForLevel,
} from './semanticGraphAdapter';
import type {
  GraphEvidenceOpener,
  GraphExplorerMode,
  GraphFilters,
  GraphSelection,
  InteractiveGraphEdge,
  InteractiveGraphLevel,
  InteractiveGraphNode,
  InteractiveGraphNodeDetail,
  InteractiveGraphPayload,
  RepositoryFetch,
  SemanticAtlasLens,
  SemanticEntityDetail,
  SemanticEntityEvidence,
  SemanticEvidenceFocus,
  SemanticGraphPayload,
  SemanticRelationEvidence,
} from './graphTypes';
import { DEFAULT_GRAPH_FILTERS, graphLevelLabel } from './graphTypes';

interface RepositoryGraphExplorerProps {
  repositoryFetch: RepositoryFetch;
  activeQuery: string;
  isBuilding: boolean;
  reviewingEdgeId: string | null;
  onBuildSemanticGraph: () => Promise<void>;
  onBuildEvidenceGraph: () => Promise<void>;
  onReviewEvidenceEdge: (edgeId: string, status: 'accepted' | 'rejected' | 'needs_review') => Promise<void>;
  onOpenEvidence: GraphEvidenceOpener;
  onOpenMaterialView: (materialId: string, view: 'segments' | 'images' | 'observations') => void;
}

const downloadJsonFile = (filename: string, data: unknown) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const parseGraphError = async (response: Response, fallback: string) => {
  const text = await response.text();
  if (!text) return fallback;
  try {
    const data = JSON.parse(text) as { detail?: unknown };
    if (typeof data.detail === 'string') return data.detail;
  } catch {
    return text;
  }
  return fallback;
};

const filenameToken = (query: string) =>
  query
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60) || 'research_atlas';

export function RepositoryGraphExplorer({
  repositoryFetch,
  activeQuery,
  isBuilding,
  reviewingEdgeId,
  onBuildSemanticGraph,
  onBuildEvidenceGraph,
  onReviewEvidenceEdge,
  onOpenEvidence,
  onOpenMaterialView,
}: RepositoryGraphExplorerProps) {
  const [graph, setGraph] = useState<InteractiveGraphPayload | null>(null);
  const [semanticPayload, setSemanticPayload] = useState<SemanticGraphPayload | null>(null);
  const [mode, setMode] = useState<GraphExplorerMode>('semantic');
  const [level, setLevel] = useState<InteractiveGraphLevel>('overview');
  const [semanticLens, setSemanticLens] = useState<SemanticAtlasLens>('documents');
  const [searchTerm, setSearchTerm] = useState(activeQuery);
  const [submittedQuery, setSubmittedQuery] = useState(activeQuery);
  const [filters, setFilters] = useState<GraphFilters>(() => semanticFilters());
  const [includeRejected, setIncludeRejected] = useState(false);
  const [selection, setSelection] = useState<GraphSelection>(null);
  const [nodeDetail, setNodeDetail] = useState<InteractiveGraphNodeDetail | null>(null);
  const [semanticDetailsByEntity, setSemanticDetailsByEntity] = useState<
    Record<string, SemanticEntityDetail | undefined>
  >({});
  const [semanticEvidenceByEntity, setSemanticEvidenceByEntity] = useState<
    Record<string, SemanticEntityEvidence | undefined>
  >({});
  const [semanticEvidenceFocus, setSemanticEvidenceFocus] = useState<SemanticEvidenceFocus | null>(null);
  const [relationEvidence, setRelationEvidence] = useState<SemanticRelationEvidence | null>(null);
  const [expandedNodeIds, setExpandedNodeIds] = useState<string[]>([]);
  const [expandedDocumentId, setExpandedDocumentId] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [loadingSemanticEntityId, setLoadingSemanticEntityId] = useState<string | null>(null);
  const [loadingEvidenceId, setLoadingEvidenceId] = useState<string | null>(null);
  const [reviewingSemanticId, setReviewingSemanticId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSearchTerm(activeQuery);
    setSubmittedQuery(activeQuery);
  }, [activeQuery]);

  const clearSelection = useCallback(() => {
    setSelection(null);
    setNodeDetail(null);
    setRelationEvidence(null);
    setSemanticEvidenceFocus(null);
  }, []);

  const loadGraph = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const query = submittedQuery.trim();
      if (mode === 'semantic') {
        const params = new URLSearchParams({
          view: semanticViewForLevel(level),
          include_generic: String(query.length >= 2),
          include_rejected: String(includeRejected),
          limit: '220',
        });
        if (query.length >= 2) params.set('query', query);
        const response = await repositoryFetch(`/graph/semantic?${params}`);
        if (!response.ok) throw new Error(await parseGraphError(response, 'Semantic Atlas failed'));
        const payload = (await response.json()) as SemanticGraphPayload;
        setSemanticPayload(payload);
        setGraph(adaptSemanticGraph(payload));
      } else {
        const params = new URLSearchParams({
          level,
          include_rejected: String(includeRejected),
          limit: '700',
        });
        if (query.length >= 2) params.set('query', query);
        const response = await repositoryFetch(`/graph/interactive?${params}`);
        if (!response.ok) throw new Error(await parseGraphError(response, 'Evidence Graph failed'));
        setSemanticPayload(null);
        setGraph((await response.json()) as InteractiveGraphPayload);
      }
      clearSelection();
      setExpandedNodeIds([]);
      setExpandedDocumentId(null);
      setSemanticDetailsByEntity({});
      setSemanticEvidenceByEntity({});
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Research Atlas failed');
    } finally {
      setIsLoading(false);
    }
  }, [clearSelection, includeRejected, level, mode, repositoryFetch, submittedQuery]);

  useEffect(() => {
    void loadGraph();
  }, [loadGraph]);

  const loadSemanticEntity = useCallback(
    async (entityId: string) => {
      setIsLoadingDetail(true);
      setLoadingSemanticEntityId(entityId);
      try {
        const response = await repositoryFetch(
          `/graph/entity/${encodeURIComponent(entityId)}?include_rejected=${includeRejected}`,
        );
        if (!response.ok) throw new Error(await parseGraphError(response, 'Semantic entity detail failed'));
        const detail = (await response.json()) as SemanticEntityDetail;
        setSemanticDetailsByEntity((current) => ({ ...current, [entityId]: detail }));
        return detail;
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Semantic entity detail failed');
        return null;
      } finally {
        setIsLoadingDetail(false);
        setLoadingSemanticEntityId((current) => (current === entityId ? null : current));
      }
    },
    [includeRejected, repositoryFetch],
  );

  const loadSemanticEvidence = useCallback(
    async (entityId: string) => {
      const cached = semanticEvidenceByEntity[entityId];
      if (cached) return cached;
      setLoadingEvidenceId(entityId);
      try {
        const response = await repositoryFetch(
          `/graph/entity/${encodeURIComponent(entityId)}/evidence?limit=80`,
        );
        if (!response.ok) throw new Error(await parseGraphError(response, 'Semantic evidence failed'));
        const evidence = (await response.json()) as SemanticEntityEvidence;
        setSemanticEvidenceByEntity((current) => ({ ...current, [entityId]: evidence }));
        return evidence;
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Semantic evidence failed');
        return null;
      } finally {
        setLoadingEvidenceId((current) => (current === entityId ? null : current));
      }
    },
    [repositoryFetch, semanticEvidenceByEntity],
  );

  const loadEvidenceNode = useCallback(
    async (nodeId: string) => {
      setIsLoadingDetail(true);
      try {
        const response = await repositoryFetch(
          `/graph/node/${encodeURIComponent(nodeId)}?include_rejected=${includeRejected}`,
        );
        if (!response.ok) throw new Error(await parseGraphError(response, 'Evidence node detail failed'));
        setNodeDetail((await response.json()) as InteractiveGraphNodeDetail);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Evidence node detail failed');
      } finally {
        setIsLoadingDetail(false);
      }
    },
    [includeRejected, repositoryFetch],
  );

  const handleNodeSelect = useCallback(
    async (node: InteractiveGraphNode) => {
      setSelection({ kind: 'node', node });
      setNodeDetail(null);
      setRelationEvidence(null);
      setSemanticEvidenceFocus(null);
      if (mode === 'semantic') {
        await Promise.all([loadSemanticEntity(node.id), loadSemanticEvidence(node.id)]);
        return;
      }
      await loadEvidenceNode(node.id);
      if (expandedNodeIds.includes(node.id)) return;
      try {
        const params = new URLSearchParams({
          node_id: node.id,
          depth: '1',
          level,
          include_rejected: String(includeRejected),
          limit: '300',
        });
        const response = await repositoryFetch(`/graph/focus?${params}`);
        if (!response.ok) throw new Error(await parseGraphError(response, 'Evidence focus failed'));
        const focusGraph = (await response.json()) as InteractiveGraphPayload;
        setGraph((current) => mergeGraphPayloads(current, focusGraph));
        setExpandedNodeIds((current) => [...current, node.id]);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Evidence focus failed');
      }
    },
    [
      expandedNodeIds,
      includeRejected,
      level,
      loadEvidenceNode,
      loadSemanticEntity,
      loadSemanticEvidence,
      mode,
      repositoryFetch,
    ],
  );

  const handleEdgeSelect = useCallback(
    async (edge: InteractiveGraphEdge) => {
      setSelection({ kind: 'edge', edge });
      setNodeDetail(null);
      setRelationEvidence(null);
      setSemanticEvidenceFocus(null);
      if (mode !== 'semantic' || !edge.semantic_relation) return;
      setIsLoadingDetail(true);
      try {
        const response = await repositoryFetch(
          `/graph/relation/${encodeURIComponent(edge.id)}/evidence?limit=20`,
        );
        if (!response.ok) throw new Error(await parseGraphError(response, 'Relation evidence failed'));
        setRelationEvidence((await response.json()) as SemanticRelationEvidence);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Relation evidence failed');
      } finally {
        setIsLoadingDetail(false);
      }
    },
    [mode, repositoryFetch],
  );

  const handleDocumentToggle = useCallback(
    async (document: InteractiveGraphNode) => {
      if (expandedDocumentId === document.id) {
        setExpandedDocumentId(null);
        return;
      }
      setExpandedDocumentId(document.id);
      setSelection({ kind: 'node', node: document });
      setNodeDetail(null);
      setRelationEvidence(null);
      setSemanticEvidenceFocus(null);
      await Promise.all([loadSemanticEntity(document.id), loadSemanticEvidence(document.id)]);
    },
    [expandedDocumentId, loadSemanticEntity, loadSemanticEvidence],
  );

  const handleSemanticLensChange = (nextLens: SemanticAtlasLens) => {
    setSemanticLens(nextLens);
    setExpandedDocumentId(null);
    clearSelection();
  };

  const handleModeChange = (nextMode: GraphExplorerMode) => {
    setMode(nextMode);
    setLevel(nextMode === 'semantic' ? 'overview' : 'documents');
    if (nextMode === 'semantic') setSemanticLens('documents');
    setFilters(nextMode === 'semantic' ? semanticFilters() : DEFAULT_GRAPH_FILTERS);
    setIncludeRejected(false);
    setExpandedDocumentId(null);
    clearSelection();
  };

  const handleBuild = async () => {
    if (mode === 'semantic') await onBuildSemanticGraph();
    else await onBuildEvidenceGraph();
    await loadGraph();
  };

  const handleReviewEvidenceEdge = async (
    edgeId: string,
    status: 'accepted' | 'rejected' | 'needs_review',
  ) => {
    await onReviewEvidenceEdge(edgeId, status);
    clearSelection();
    await loadGraph();
  };

  const reviewSemantic = async (
    kind: 'relations' | 'candidates',
    itemId: string,
    status: 'accepted' | 'needs_review' | 'rejected',
  ) => {
    setReviewingSemanticId(itemId);
    setError(null);
    try {
      const response = await repositoryFetch(`/graph/semantic/${kind}/${encodeURIComponent(itemId)}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ review_status: status }),
      });
      if (!response.ok) throw new Error(await parseGraphError(response, 'Semantic review failed'));
      if (selection?.kind === 'node') await loadSemanticEntity(selection.node.id);
      else clearSelection();
      await loadGraph();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Semantic review failed');
    } finally {
      setReviewingSemanticId(null);
    }
  };

  const handleIncludeRejectedChange = (value: boolean) => {
    setIncludeRejected(value);
    setFilters((current) => ({
      ...current,
      reviewStatuses: value
        ? Array.from(new Set([...current.reviewStatuses, 'rejected']))
        : current.reviewStatuses.filter((status) => status !== 'rejected'),
    }));
  };

  const handleTour = (tour: 'beginner' | 'structure' | 'concepts' | 'places_time') => {
    if (mode === 'semantic') {
      const nextLens: SemanticAtlasLens =
        tour === 'concepts' ? 'concepts' : tour === 'places_time' ? 'places' : 'documents';
      handleSemanticLensChange(nextLens);
      if (tour === 'beginner') {
        setSearchTerm('');
        setSubmittedQuery('');
      }
      return;
    }
    if (tour === 'beginner') {
      setLevel('documents');
      setFilters(DEFAULT_GRAPH_FILTERS);
      setSearchTerm('');
      setSubmittedQuery('');
      return;
    }
    if (tour === 'structure') {
      setLevel('documents');
      setFilters({
        ...DEFAULT_GRAPH_FILTERS,
        nodeTypes: ['material', 'segment', 'image', 'observation'],
        edgeTypes: ['contains', 'image_of', 'observation_of', 'mentions_concept', 'mentions_place', 'mentions_time'],
      });
      return;
    }
    if (tour === 'concepts') {
      setLevel('concepts');
      setFilters({
        ...DEFAULT_GRAPH_FILTERS,
        nodeTypes: ['material', 'concept', 'keyword'],
        edgeTypes: ['has_keyword', 'mentions_concept', 'semantically_related_to', 'image_of', 'observation_of'],
      });
      return;
    }
    setLevel('concepts');
    setFilters({
      ...DEFAULT_GRAPH_FILTERS,
      nodeTypes: ['material', 'place', 'time_reference'],
      edgeTypes: ['mentions_place', 'mentions_time'],
    });
  };

  const visibleGraph = useMemo(
    () =>
      mode === 'semantic'
        ? filterSemanticGraph(graph, filters, '')
        : filterInteractiveGraph(graph, filters, level, searchTerm),
    [filters, graph, level, mode, searchTerm],
  );

  const exportVisible = () => {
    downloadJsonFile(`${filenameToken(searchTerm || submittedQuery)}_visible_graph.json`, {
      mode,
      level,
      filters,
      nodes: visibleGraph.nodes,
      edges: visibleGraph.edges,
      hidden_summary: semanticPayload?.hidden_summary,
      evidence_note: graph?.evidence_note,
    });
  };

  const exportAll = () => {
    const payload = mode === 'semantic' ? semanticPayload : graph;
    if (!payload) return;
    downloadJsonFile(`${filenameToken(searchTerm || submittedQuery)}_${mode}_graph.json`, payload);
  };

  const modeNote =
    mode === 'semantic'
      ? 'Semantic Atlas is a fixed spatial map: documents, bridge concepts, resolved places, valid periods, and review queues stay in deterministic lanes. Relationship edges appear only on focus.'
      : 'Evidence Graph is an advanced source-traceability view. Amber dashed links are review candidates rather than confirmed claims.';

  return (
    <div className={isExpanded ? 'fixed inset-3 z-[90] overflow-auto rounded-xl bg-slate-50 p-3 shadow-2xl' : 'space-y-2'}>
      <GraphControls
        mode={mode}
        onModeChange={handleModeChange}
        level={level}
        onLevelChange={setLevel}
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        onSearchSubmit={() => setSubmittedQuery(searchTerm.trim())}
        filters={filters}
        onFiltersChange={setFilters}
        includeRejected={includeRejected}
        onIncludeRejectedChange={handleIncludeRejectedChange}
        onBuild={handleBuild}
        onRefresh={loadGraph}
        onTour={handleTour}
        onExportVisible={exportVisible}
        onExportAll={exportAll}
        isBuilding={isBuilding}
        isLoading={isLoading}
        disabled={!graph}
      />

      {error && (
        <div className="border border-rose-100 bg-rose-50 p-3 text-xs font-bold text-rose-700">{error}</div>
      )}

      <div
        title={modeNote}
        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5"
      >
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-slate-500">
          <span className="text-slate-700">{mode === 'semantic' ? 'Semantic Atlas' : 'Evidence Graph'}</span>
          {mode === 'evidence' && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-slate-500">
              Advanced / raw
            </span>
          )}
          <span className="text-slate-300">/</span>
          <span>
            {mode === 'semantic'
              ? `${semanticLens.charAt(0).toUpperCase()}${semanticLens.slice(1)} lens`
              : graphLevelLabel(level)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold text-slate-400">
            {mode === 'semantic'
              ? `${visibleGraph.nodes.filter((node) => node.node_type === 'material').length} documents / ${visibleGraph.edges.length} available relationships`
              : `${visibleGraph.nodes.length} nodes / ${visibleGraph.edges.length} links`}
          </span>
          <button
            type="button"
            onClick={() => {
              setLevel(mode === 'semantic' ? 'overview' : 'documents');
              if (mode === 'semantic') setSemanticLens('documents');
              setSearchTerm('');
              setSubmittedQuery('');
              clearSelection();
              setExpandedNodeIds([]);
              setExpandedDocumentId(null);
            }}
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[9px] font-black uppercase tracking-wider text-slate-500 hover:bg-slate-50"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={() => setIsExpanded((current) => !current)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[9px] font-black uppercase tracking-wider text-slate-500 hover:bg-slate-50"
          >
            {isExpanded ? 'Exit Full Screen' : 'Full Screen'}
          </button>
        </div>
      </div>

      <div className="grid gap-2 2xl:grid-cols-[minmax(0,1fr)_320px]">
        {mode === 'semantic' ? (
          <SemanticAtlasCanvas
            nodes={visibleGraph.nodes}
            edges={visibleGraph.edges}
            selected={selection}
            evidenceFocus={semanticEvidenceFocus}
            lens={semanticLens}
            searchTerm={searchTerm}
            expandedDocumentId={expandedDocumentId}
            detailsByEntity={semanticDetailsByEntity}
            evidenceByEntity={semanticEvidenceByEntity}
            hiddenSummary={semanticPayload?.hidden_summary}
            loadingDetailId={loadingSemanticEntityId}
            loadingEvidenceId={loadingEvidenceId}
            onLensChange={handleSemanticLensChange}
            onNodeSelect={handleNodeSelect}
            onEdgeSelect={handleEdgeSelect}
            onDocumentToggle={handleDocumentToggle}
            onEvidenceSelect={(document, item) => {
              setSelection({ kind: 'node', node: document });
              setSemanticEvidenceFocus({ document, item });
            }}
            onOpenMaterialView={onOpenMaterialView}
          />
        ) : (
          <GraphCanvas
            nodes={visibleGraph.nodes}
            edges={visibleGraph.edges}
            selected={selection}
            searchTerm={searchTerm}
            onNodeSelect={handleNodeSelect}
            onEdgeSelect={handleEdgeSelect}
            onClearSelection={clearSelection}
          />
        )}
        {mode === 'semantic' ? (
          <SemanticGraphDetailPanel
            selection={selection}
            detail={
              selection?.kind === 'node' ? semanticDetailsByEntity[selection.node.id] || null : null
            }
            evidenceFocus={semanticEvidenceFocus}
            entityEvidence={
              selection?.kind === 'node' ? semanticEvidenceByEntity[selection.node.id] || null : null
            }
            relationEvidence={relationEvidence}
            isLoading={
              isLoadingDetail
              || (selection?.kind === 'node' && loadingEvidenceId === selection.node.id)
            }
            reviewingId={reviewingSemanticId}
            onOpenEvidence={onOpenEvidence}
            onOpenMaterialView={onOpenMaterialView}
            expandedDocumentId={expandedDocumentId}
            onToggleDocument={handleDocumentToggle}
            onRelationSelect={(relation) => handleEdgeSelect(semanticRelationToInteractive(relation))}
            onReviewRelation={(relationId, status) => reviewSemantic('relations', relationId, status)}
            onReviewCandidate={(candidateId, status) => reviewSemantic('candidates', candidateId, status)}
            onClearFocus={() => {
              clearSelection();
              setExpandedDocumentId(null);
            }}
          />
        ) : (
          <GraphDetailPanel
            selection={selection}
            nodeDetail={nodeDetail}
            isLoadingDetail={isLoadingDetail}
            reviewingEdgeId={reviewingEdgeId}
            onOpenEvidence={onOpenEvidence}
            onReviewEdge={handleReviewEvidenceEdge}
            onClearFocus={() => {
              clearSelection();
              setExpandedNodeIds([]);
            }}
            explainNote={modeNote}
          />
        )}
      </div>

    </div>
  );
}
