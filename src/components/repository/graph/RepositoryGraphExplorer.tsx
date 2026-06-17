import { useCallback, useEffect, useMemo, useState } from 'react';
import { GraphCanvas } from './GraphCanvas';
import { GraphControls } from './GraphControls';
import { GraphDetailPanel } from './GraphDetailPanel';
import { filterInteractiveGraph, mergeGraphPayloads } from './graphLayout';
import type {
  GraphEvidenceOpener,
  GraphFilters,
  GraphSelection,
  InteractiveGraphEdge,
  InteractiveGraphLevel,
  InteractiveGraphNode,
  InteractiveGraphNodeDetail,
  InteractiveGraphPayload,
  RepositoryFetch,
} from './graphTypes';
import { DEFAULT_GRAPH_FILTERS, graphLevelLabel } from './graphTypes';

interface RepositoryGraphExplorerProps {
  repositoryFetch: RepositoryFetch;
  activeQuery: string;
  isBuilding: boolean;
  reviewingEdgeId: string | null;
  onBuildGraph: () => Promise<void>;
  onReviewEdge: (edgeId: string, status: 'accepted' | 'rejected' | 'needs_review') => Promise<void>;
  onOpenEvidence: GraphEvidenceOpener;
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
  onBuildGraph,
  onReviewEdge,
  onOpenEvidence,
}: RepositoryGraphExplorerProps) {
  const [graph, setGraph] = useState<InteractiveGraphPayload | null>(null);
  const [level, setLevel] = useState<InteractiveGraphLevel>('overview');
  const [searchTerm, setSearchTerm] = useState(activeQuery);
  const [submittedQuery, setSubmittedQuery] = useState(activeQuery);
  const [filters, setFilters] = useState<GraphFilters>(DEFAULT_GRAPH_FILTERS);
  const [includeRejected, setIncludeRejected] = useState(false);
  const [selection, setSelection] = useState<GraphSelection>(null);
  const [nodeDetail, setNodeDetail] = useState<InteractiveGraphNodeDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedNodeIds, setExpandedNodeIds] = useState<string[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    setSearchTerm(activeQuery);
    setSubmittedQuery(activeQuery);
  }, [activeQuery]);

  const loadInteractiveGraph = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        level,
        include_rejected: String(includeRejected),
        limit: '700',
      });
      const query = submittedQuery.trim();
      if (query.length >= 2) params.set('query', query);
      const response = await repositoryFetch(`/graph/interactive?${params}`);
      if (!response.ok) throw new Error(await parseGraphError(response, 'Interactive graph failed'));
      const data = (await response.json()) as InteractiveGraphPayload;
      setGraph(data);
      setSelection(null);
      setNodeDetail(null);
      setExpandedNodeIds([]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Interactive graph failed');
    } finally {
      setIsLoading(false);
    }
  }, [includeRejected, level, repositoryFetch, submittedQuery]);

  useEffect(() => {
    void loadInteractiveGraph();
  }, [loadInteractiveGraph]);

  const loadNodeDetail = useCallback(
    async (nodeId: string) => {
      setIsLoadingDetail(true);
      try {
        const params = new URLSearchParams({ include_rejected: String(includeRejected) });
        const response = await repositoryFetch(`/graph/node/${encodeURIComponent(nodeId)}?${params}`);
        if (!response.ok) throw new Error(await parseGraphError(response, 'Graph node detail failed'));
        setNodeDetail((await response.json()) as InteractiveGraphNodeDetail);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Graph node detail failed');
      } finally {
        setIsLoadingDetail(false);
      }
    },
    [includeRejected, repositoryFetch],
  );

  const expandNode = useCallback(
    async (node: InteractiveGraphNode) => {
      setSelection({ kind: 'node', node });
      setNodeDetail(null);
      await loadNodeDetail(node.id);
      if (expandedNodeIds.includes(node.id)) return;
      try {
        const nextDepth = node.node_type === 'corpus' ? 1 : 2;
        const params = new URLSearchParams({
          node_id: node.id,
          depth: String(nextDepth),
          level,
          include_rejected: String(includeRejected),
          limit: '350',
        });
        const response = await repositoryFetch(`/graph/focus?${params}`);
        if (!response.ok) throw new Error(await parseGraphError(response, 'Graph focus failed'));
        const focusGraph = (await response.json()) as InteractiveGraphPayload;
        setGraph((current) => mergeGraphPayloads(current, focusGraph));
        setExpandedNodeIds((current) => [...current, node.id]);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Graph focus failed');
      }
    },
    [expandedNodeIds, includeRejected, level, loadNodeDetail, repositoryFetch],
  );

  const handleEdgeSelect = (edge: InteractiveGraphEdge) => {
    setSelection({ kind: 'edge', edge });
    setNodeDetail(null);
  };

  const handleBuild = async () => {
    await onBuildGraph();
    await loadInteractiveGraph();
  };

  const handleReviewEdge = async (edgeId: string, status: 'accepted' | 'rejected' | 'needs_review') => {
    await onReviewEdge(edgeId, status);
    setSelection(null);
    setNodeDetail(null);
    await loadInteractiveGraph();
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
    if (tour === 'beginner') {
      setLevel('overview');
      setFilters(DEFAULT_GRAPH_FILTERS);
      setSearchTerm('');
      setSubmittedQuery('');
      return;
    }
    if (tour === 'structure') {
      setLevel('documents');
      setFilters({
        ...DEFAULT_GRAPH_FILTERS,
        nodeTypes: ['corpus', 'material', 'segment', 'image', 'observation'],
        edgeTypes: ['contains', 'image_of', 'observation_of'],
      });
      return;
    }
    if (tour === 'concepts') {
      setLevel('concepts');
      setFilters({
        ...DEFAULT_GRAPH_FILTERS,
        nodeTypes: ['material', 'segment', 'image', 'observation', 'concept', 'keyword'],
        edgeTypes: ['contains', 'has_keyword', 'mentions_concept', 'semantically_related_to', 'co_occurs_with', 'image_of', 'observation_of'],
      });
      return;
    }
    setLevel('concepts');
    setFilters({
      ...DEFAULT_GRAPH_FILTERS,
      nodeTypes: ['material', 'segment', 'image', 'observation', 'place', 'time_reference'],
      edgeTypes: ['contains', 'mentions_place', 'mentions_time'],
    });
  };

  const visibleGraph = useMemo(
    () => filterInteractiveGraph(graph, filters, level, searchTerm),
    [filters, graph, level, searchTerm],
  );

  const explainNote = useMemo(() => {
    if (level === 'overview') return 'Overview mode shows the repository and documents first. Open a document to reveal its evidence structure.';
    if (level === 'documents') return 'Document mode adds extracted sections, images, and observations so students can see how a source is structured.';
    if (level === 'sections') return 'Section mode connects chunks and evidence objects to the concepts, places, and times they mention.';
    return 'Concept mode emphasizes themes and entity mentions. Amber dashed links are candidates for review, not confirmed claims.';
  }, [level]);

  const exportVisible = () => {
    downloadJsonFile(`${filenameToken(searchTerm || submittedQuery)}_visible_graph.json`, {
      level,
      filters,
      nodes: visibleGraph.nodes,
      edges: visibleGraph.edges,
      evidence_note: graph?.evidence_note,
    });
  };

  const exportAll = () => {
    if (!graph) return;
    downloadJsonFile(`${filenameToken(searchTerm || submittedQuery)}_interactive_graph.json`, graph);
  };

  return (
    <div className={isExpanded ? 'fixed inset-4 z-[90] overflow-auto rounded-xl bg-slate-50 p-4 shadow-2xl' : 'space-y-3'}>
      <GraphControls
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
        onRefresh={loadInteractiveGraph}
        onTour={handleTour}
        onExportVisible={exportVisible}
        onExportAll={exportAll}
        isBuilding={isBuilding}
        isLoading={isLoading}
        disabled={!graph}
      />

      {error && (
        <div className="rounded-lg border border-rose-100 bg-rose-50 p-3 text-xs font-bold text-rose-700">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-white px-3 py-2">
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold text-slate-500">
          <span>Corpus</span>
          <span>/</span>
          <span>{graphLevelLabel(level)}</span>
          {expandedNodeIds.length > 0 && (
            <>
              <span>/</span>
              <span>{expandedNodeIds.length} expanded</span>
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold text-slate-400">
            {visibleGraph.nodes.length} nodes · {visibleGraph.edges.length} links
          </span>
          <button
            type="button"
            onClick={() => {
              setLevel('overview');
              setSearchTerm('');
              setSubmittedQuery('');
              setSelection(null);
              setNodeDetail(null);
            }}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500 hover:bg-slate-50"
          >
            Back to Overview
          </button>
          <button
            type="button"
            onClick={() => setIsExpanded((current) => !current)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500 hover:bg-slate-50"
          >
            {isExpanded ? 'Exit Full Screen' : 'Full Screen'}
          </button>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
        <GraphCanvas
          nodes={visibleGraph.nodes}
          edges={visibleGraph.edges}
          selected={selection}
          searchTerm={searchTerm}
          onNodeSelect={expandNode}
          onEdgeSelect={handleEdgeSelect}
          onClearSelection={() => {
            setSelection(null);
            setNodeDetail(null);
          }}
        />
        <GraphDetailPanel
          selection={selection}
          nodeDetail={nodeDetail}
          isLoadingDetail={isLoadingDetail}
          reviewingEdgeId={reviewingEdgeId}
          onOpenEvidence={onOpenEvidence}
          onReviewEdge={handleReviewEdge}
          onClearFocus={() => {
            setSelection(null);
            setNodeDetail(null);
            setExpandedNodeIds([]);
          }}
          explainNote={explainNote}
        />
      </div>

      {graph && (
        <div className="rounded-lg border border-slate-100 bg-white p-3 text-[11px] font-bold leading-relaxed text-slate-400">
          {graph.summary.material_count} documents · {graph.summary.section_count} evidence nodes · {graph.summary.concept_count} concept/entity nodes · {graph.summary.edge_count} links.
          {graph.summary.review_needed_count > 0 ? ` ${graph.summary.review_needed_count} links need review.` : ' No visible links need review.'}
        </div>
      )}
    </div>
  );
}
