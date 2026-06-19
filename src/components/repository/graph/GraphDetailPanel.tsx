import { formatEvidenceLabel, truncateText } from '../formatters';
import type { GraphEvidenceOpener, GraphSelection, InteractiveGraphNodeDetail } from './graphTypes';
import { selectionEvidenceRef } from './graphTypes';
import type { GraphReviewStatus } from '../types';

interface GraphDetailPanelProps {
  selection: GraphSelection;
  nodeDetail: InteractiveGraphNodeDetail | null;
  isLoadingDetail: boolean;
  reviewingEdgeId: string | null;
  onOpenEvidence: GraphEvidenceOpener;
  onReviewEdge: (edgeId: string, status: 'accepted' | 'rejected' | 'needs_review') => Promise<void>;
  onClearFocus: () => void;
  explainNote: string;
}

const statusClass = (status: GraphReviewStatus) => {
  if (status === 'accepted') return 'bg-emerald-100 text-emerald-700';
  if (status === 'rejected') return 'bg-rose-100 text-rose-700';
  if (status === 'needs_review') return 'bg-amber-100 text-amber-800';
  return 'bg-slate-100 text-slate-600';
};

const edgePlainEnglish = (edgeType: string) => {
  const labels: Record<string, string> = {
    contains: 'contains or groups',
    authored_by: 'is authored by',
    has_keyword: 'has keyword',
    mentions_concept: 'mentions concept',
    mentions_place: 'mentions place',
    mentions_time: 'mentions time',
    observation_of: 'is a human observation of',
    image_of: 'is image evidence from',
    semantically_related_to: 'is semantically related',
    co_occurs_with: 'co-occurs in nearby evidence',
  };
  return labels[edgeType] || formatEvidenceLabel(edgeType);
};

const nodeMetric = (label: string, value: number | string | null | undefined) => (
  <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
    <div className="text-base font-black text-slate-800">{value ?? '0'}</div>
    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</div>
  </div>
);

export function GraphDetailPanel({
  selection,
  nodeDetail,
  isLoadingDetail,
  reviewingEdgeId,
  onOpenEvidence,
  onReviewEdge,
  onClearFocus,
  explainNote,
}: GraphDetailPanelProps) {
  if (!selection) {
    return (
      <aside className="min-h-[520px] rounded-xl border border-slate-200 bg-white p-4">
        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Start Anywhere</div>
        <h5 className="mt-2 text-lg font-black text-slate-800">Explore the repository as evidence.</h5>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          Search for a term, choose a tour, or click a document node. The detail panel will explain what each node or link means and where the evidence came from.
        </p>
        <div className="mt-4 rounded-lg bg-amber-50 p-3 text-xs font-bold leading-relaxed text-amber-800">
          {explainNote}
        </div>
      </aside>
    );
  }

  const sourceRef = selectionEvidenceRef(selection);

  if (selection.kind === 'edge') {
    const edge = selection.edge;
    return (
      <aside className="min-h-[520px] rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Relationship</div>
          <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-wider ${statusClass(edge.review_status)}`}>
            {formatEvidenceLabel(edge.review_status)}
          </span>
        </div>
        <h5 className="mt-2 text-lg font-black text-slate-800">{formatEvidenceLabel(edge.edge_type)}</h5>
        <div className="mt-2 flex flex-wrap gap-1">
          <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500">
            {(edge.confidence * 100).toFixed(0)} confidence
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500">
            {formatEvidenceLabel(edge.extraction_method)}
          </span>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-slate-500">
          This relationship means “{edgePlainEnglish(edge.edge_type)}.”{' '}
          {edge.edge_type === 'co_occurs_with' || edge.edge_type === 'semantically_related_to' || edge.review_status !== 'accepted'
            ? 'Treat it as a weak or suggested relationship until reviewed.'
            : 'This is direct accepted evidence or deterministic metadata.'}
        </p>
        <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs font-bold leading-relaxed text-slate-600">
          Why this link exists: {edge.summary || edge.evidence_ref.snippet || `It was created by ${formatEvidenceLabel(edge.extraction_method)} evidence extraction.`}
        </div>
        <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-3">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Evidence Source</div>
          <div className="mt-1 text-sm font-black text-slate-700">
            {edge.evidence_ref.material_title || edge.evidence_ref.source || 'Repository evidence'}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {[edge.evidence_ref.page_ref, edge.evidence_ref.source_locator].filter(Boolean).join(' · ')}
          </div>
          {edge.evidence_ref.snippet && (
            <p className="mt-2 text-xs leading-relaxed text-slate-600">{truncateText(edge.evidence_ref.snippet, 360)}</p>
          )}
          {edge.evidence_ref.material_id && (
            <button
              type="button"
              onClick={() => onOpenEvidence(edge.evidence_ref)}
              className="mt-3 rounded-lg bg-slate-900 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white hover:bg-slate-700"
            >
              Open Source
            </button>
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {(['accepted', 'needs_review', 'rejected'] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => onReviewEdge(edge.id, status)}
              disabled={reviewingEdgeId === edge.id}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              {formatEvidenceLabel(status)}
            </button>
          ))}
        </div>
      </aside>
    );
  }

  const node = selection.node;
  const sectionCount = typeof node.properties.section_count === 'number' ? node.properties.section_count : undefined;
  const imageCount = typeof node.properties.image_count === 'number' ? node.properties.image_count : undefined;
  const observationCount = typeof node.properties.observation_count === 'number' ? node.properties.observation_count : undefined;
  const nodeIds = Array.isArray(node.properties.node_ids) ? node.properties.node_ids : [];
  const isConceptLike = ['concept', 'keyword', 'place', 'time_reference', 'author'].includes(node.node_type);

  return (
    <aside className="min-h-[520px] rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Selected Node</div>
        <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-wider ${statusClass(node.review_status)}`}>
          {formatEvidenceLabel(node.review_status)}
        </span>
      </div>
      <h5 className="mt-2 text-lg font-black leading-tight text-slate-800">{node.label}</h5>
      <div className="mt-2 flex flex-wrap gap-1">
        <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500">
          {formatEvidenceLabel(node.node_type)}
        </span>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500">
          {node.degree} links
        </span>
        {node.year && (
          <span className="rounded-full bg-violet-100 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-violet-700">
            {node.year}
          </span>
        )}
      </div>
      <p className="mt-3 text-sm leading-relaxed text-slate-500">{node.summary}</p>
      {node.is_synthetic && (
        <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-xs font-bold leading-relaxed text-emerald-800">
          This is a summarized analysis node. It groups {node.node_count || nodeIds.length || 'multiple'} underlying evidence item(s) so the graph stays readable. Click it again to expand or collapse representative details.
        </div>
      )}
      {node.node_type === 'material' && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          {nodeMetric('Source Type', node.source_type || 'Source')}
          {nodeMetric('Year', node.year || 'Unknown')}
          {nodeMetric('Language', node.language || 'Unknown')}
          {nodeMetric('Region', node.region || 'Unknown')}
          {sectionCount !== undefined && nodeMetric('Sections', sectionCount)}
          {imageCount !== undefined && nodeMetric('Images', imageCount)}
          {observationCount !== undefined && nodeMetric('Observations', observationCount)}
        </div>
      )}
      {isConceptLike && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          {nodeMetric('Documents', node.document_count || 0)}
          {nodeMetric('Evidence Links', node.evidence_count || node.degree)}
        </div>
      )}
      {sourceRef?.material_id && (
        <button
          type="button"
          onClick={() => onOpenEvidence(sourceRef)}
          className="mt-3 rounded-lg bg-slate-900 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white hover:bg-slate-700"
        >
          Open Source
        </button>
      )}
      <button
        type="button"
        onClick={onClearFocus}
        className="ml-2 mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-500 hover:bg-slate-50"
      >
        Clear Focus
      </button>
      {node.node_type === 'material' && (
        <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs font-bold leading-relaxed text-blue-800">
          Drill-down starts with summary groups. Use the document group nodes for sections, images, observations, concepts, places, and time references before opening individual source snippets.
        </div>
      )}

      <div className="mt-5">
        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Connected Nodes</div>
        {isLoadingDetail && <div className="mt-2 text-xs text-slate-400">Loading detail...</div>}
        {!isLoadingDetail && nodeDetail && Object.entries(nodeDetail.connected_nodes).length === 0 && (
          <div className="mt-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-400">No direct neighbors in the current graph view.</div>
        )}
        <div className="mt-2 space-y-3">
          {nodeDetail &&
            Object.entries(nodeDetail.connected_nodes).map(([nodeType, connected]) => (
              <div key={nodeType}>
                <div className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  {formatEvidenceLabel(nodeType)}
                </div>
                <div className="space-y-1">
                  {connected.slice(0, 8).map((item) => (
                    <div key={item.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      <span className="font-bold text-slate-700">{item.label}</span>
                      <span className="ml-2 text-slate-400">{item.degree} links</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      </div>
    </aside>
  );
}
