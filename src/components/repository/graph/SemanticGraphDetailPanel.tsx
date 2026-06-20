import { formatEvidenceLabel, truncateText } from '../formatters';
import type {
  GraphEvidenceOpener,
  GraphSelection,
  SemanticEntityDetail,
  SemanticEntityEvidence,
  SemanticEvidenceFocus,
  SemanticGraphRelation,
  SemanticRelationEvidence,
} from './graphTypes';

interface SemanticGraphDetailPanelProps {
  selection: GraphSelection;
  detail: SemanticEntityDetail | null;
  evidenceFocus: SemanticEvidenceFocus | null;
  entityEvidence: SemanticEntityEvidence | null;
  relationEvidence: SemanticRelationEvidence | null;
  isLoading: boolean;
  reviewingId: string | null;
  onOpenEvidence: GraphEvidenceOpener;
  onOpenMaterialView: (materialId: string, view: 'segments' | 'images' | 'observations') => void;
  expandedDocumentId: string | null;
  onToggleDocument: (document: Extract<NonNullable<GraphSelection>, { kind: 'node' }>['node']) => void;
  onRelationSelect: (relation: SemanticGraphRelation) => void;
  onReviewRelation: (relationId: string, status: 'accepted' | 'needs_review' | 'rejected') => Promise<void>;
  onReviewCandidate: (candidateId: string, status: 'accepted' | 'needs_review' | 'rejected') => Promise<void>;
  onClearFocus: () => void;
}

const statusClass = (status: string) => {
  if (status === 'accepted') return 'bg-emerald-100 text-emerald-700';
  if (status === 'rejected') return 'bg-rose-100 text-rose-700';
  return 'bg-amber-100 text-amber-800';
};

const metric = (label: string, value: string | number) => (
  <div className="border border-slate-100 bg-slate-50 p-3">
    <div className="text-base font-black text-slate-800">{value}</div>
    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</div>
  </div>
);

export function SemanticGraphDetailPanel({
  selection,
  detail,
  evidenceFocus,
  entityEvidence,
  relationEvidence,
  isLoading,
  reviewingId,
  onOpenEvidence,
  onOpenMaterialView,
  expandedDocumentId,
  onToggleDocument,
  onRelationSelect,
  onReviewRelation,
  onReviewCandidate,
  onClearFocus,
}: SemanticGraphDetailPanelProps) {
  if (evidenceFocus) {
    const { document, item } = evidenceFocus;
    return (
      <aside className="min-h-[520px] rounded-xl border border-yellow-200 bg-white p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[10px] font-black uppercase tracking-widest text-yellow-700">
            Contained Evidence
          </div>
          <span className={`px-2 py-1 text-[10px] font-black uppercase tracking-wider ${statusClass(item.review_status || 'accepted')}`}>
            {formatEvidenceLabel(item.review_status || 'accepted')}
          </span>
        </div>
        <h5 className="mt-2 text-lg font-black leading-tight text-slate-800">
          {item.surface_text || item.evidence_ref.page_ref || formatEvidenceLabel(item.evidence_type)}
        </h5>
        <p className="mt-1 text-xs font-bold text-slate-400">{document.label}</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {metric('Type', formatEvidenceLabel(item.evidence_type))}
          {metric('Confidence', `${Math.round((item.confidence || 0) * 100)}%`)}
        </div>
        <div className="mt-4 border border-slate-100 bg-slate-50 p-3">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Source locator
          </div>
          <div className="mt-1 text-xs font-bold text-slate-600">
            {[item.evidence_ref.page_ref, item.evidence_ref.source_locator].filter(Boolean).join(' / ')
              || 'Repository evidence'}
          </div>
          {item.evidence_ref.snippet && (
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              {truncateText(item.evidence_ref.snippet, 520)}
            </p>
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onOpenEvidence(item.evidence_ref)}
            className="bg-slate-900 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white hover:bg-slate-700"
          >
            Open Source
          </button>
          <button
            type="button"
            onClick={() => onToggleDocument(document)}
            className="border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50"
          >
            {expandedDocumentId === document.id ? 'Hide Evidence' : 'Expand Document'}
          </button>
          <button
            type="button"
            onClick={onClearFocus}
            className="border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-500 hover:bg-slate-50"
          >
            Clear Focus
          </button>
        </div>
      </aside>
    );
  }

  if (!selection) {
    return (
      <aside className="min-h-[520px] rounded-xl border border-slate-200 bg-white p-4">
        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Start Anywhere</div>
        <h5 className="mt-2 text-lg font-black text-slate-800">Follow a meaningful connection.</h5>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          This is a fixed semantic map. Choose a document, bridge concept, resolved place, or valid time period to reveal its relationship paths. Expand a document to inspect contained evidence.
        </p>
      </aside>
    );
  }

  if (selection.kind === 'edge') {
    const relation = selection.edge.semantic_relation;
    if (!relation) return null;
    return (
      <aside className="min-h-[520px] rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Semantic Relation</div>
          <span className={`px-2 py-1 text-[10px] font-black uppercase tracking-wider ${statusClass(relation.status)}`}>
            {formatEvidenceLabel(relation.status)}
          </span>
        </div>
        <h5 className="mt-2 text-lg font-black text-slate-800">{formatEvidenceLabel(relation.predicate)}</h5>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">{relation.evidence_preview}</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {metric('Evidence', relation.evidence_count)}
          {metric('Documents', relation.document_count)}
          {metric('Confidence', `${Math.round(relation.confidence * 100)}%`)}
          {metric('Method', formatEvidenceLabel(relation.extraction_method))}
        </div>

        <div className="mt-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Source Evidence</div>
        {isLoading && <div className="mt-2 text-xs text-slate-400">Loading evidence...</div>}
        <div className="mt-2 space-y-2">
          {(relationEvidence?.items || []).slice(0, 8).map((item) => (
            <div key={item.id} className="border border-slate-100 bg-slate-50 p-3">
              <div className="text-xs font-black text-slate-700">
                {item.evidence_ref.material_title || formatEvidenceLabel(item.evidence_type)}
              </div>
              <div className="mt-1 text-[11px] text-slate-400">
                {[item.evidence_ref.page_ref, item.evidence_ref.source_locator].filter(Boolean).join(' / ')}
              </div>
              {item.evidence_ref.snippet && (
                <p className="mt-2 text-xs leading-relaxed text-slate-600">
                  {truncateText(item.evidence_ref.snippet, 280)}
                </p>
              )}
              {item.evidence_ref.material_id && (
                <button
                  type="button"
                  onClick={() => onOpenEvidence(item.evidence_ref)}
                  className="mt-2 bg-slate-900 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white hover:bg-slate-700"
                >
                  Open Source
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {(['accepted', 'needs_review', 'rejected'] as const).map((status) => (
            <button
              key={status}
              type="button"
              disabled={reviewingId === relation.id}
              onClick={() => onReviewRelation(relation.id, status)}
              className="border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              {formatEvidenceLabel(status)}
            </button>
          ))}
        </div>
      </aside>
    );
  }

  const entity = detail?.entity || selection.node.semantic_entity;
  if (!entity) return null;
  const materialId = typeof entity.properties.material_id === 'string' ? entity.properties.material_id : null;

  return (
    <aside className="min-h-[520px] rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Semantic Entity</div>
        {entity.is_bridge_entity && (
          <span className="bg-emerald-100 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-700">
            Bridge Entity
          </span>
        )}
      </div>
      <h5 className="mt-2 text-lg font-black leading-tight text-slate-800">{entity.label}</h5>
      <div className="mt-2 flex flex-wrap gap-1">
        <span className="bg-slate-100 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500">
          {formatEvidenceLabel(entity.type)}
        </span>
        {entity.is_generic && (
          <span className="bg-amber-100 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-amber-800">
            Generic, shown by request
          </span>
        )}
      </div>
      <p className="mt-3 text-sm leading-relaxed text-slate-500">{selection.node.summary}</p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {metric('Documents', entity.document_count)}
        {metric('Evidence', entity.evidence_count)}
        {metric('Collections', entity.collection_count)}
        {metric('Importance', `${Math.round(entity.importance_score * 100)}%`)}
      </div>

      {materialId && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onToggleDocument(selection.node)}
            className="bg-slate-900 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white hover:bg-slate-700"
          >
            {expandedDocumentId === selection.node.id ? 'Hide Evidence' : 'Expand Evidence'}
          </button>
          <button
            type="button"
            onClick={() => onOpenMaterialView(materialId, 'segments')}
            className="border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50"
          >
            Open Source
          </button>
          <button
            type="button"
            onClick={() => onOpenMaterialView(materialId, 'images')}
            className="border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50"
          >
            Show Images
          </button>
          <button
            type="button"
            onClick={() => onOpenMaterialView(materialId, 'observations')}
            className="border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50"
          >
            Show Observations
          </button>
        </div>
      )}

      {detail?.relations && detail.relations.length > 0 && (
        <div className="mt-5">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Semantic Relationships
          </div>
          <div className="mt-2 space-y-2">
            {detail.relations.slice(0, 10).map((relation) => {
              const connectedId = relation.source === entity.id ? relation.target : relation.source;
              const connected = detail.connected_entities.find((item) => item.id === connectedId);
              return (
                <button
                  key={relation.id}
                  type="button"
                  onClick={() => onRelationSelect(relation)}
                  className="block w-full border border-slate-100 bg-slate-50 p-3 text-left hover:border-blue-200 hover:bg-blue-50"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black text-slate-700">
                      {formatEvidenceLabel(relation.predicate)}
                    </span>
                    <span className={`px-2 py-1 text-[9px] font-black uppercase tracking-wider ${statusClass(relation.status)}`}>
                      {formatEvidenceLabel(relation.status)}
                    </span>
                  </span>
                  <span className="mt-1 block text-xs text-slate-500">
                    {connected?.label || 'Connected entity'} · {relation.evidence_count} evidence item
                    {relation.evidence_count === 1 ? '' : 's'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-5">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Traceable Source Evidence
          </div>
          {entityEvidence && <span className="text-xs font-black text-slate-400">{entityEvidence.total}</span>}
        </div>
        {isLoading && !entityEvidence && <div className="mt-2 text-xs text-slate-400">Loading source evidence...</div>}
        <div className="mt-2 space-y-2">
          {(entityEvidence?.items || []).slice(0, 6).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onOpenEvidence(item.evidence_ref)}
              className="block w-full border border-slate-100 bg-slate-50 p-3 text-left hover:border-blue-200 hover:bg-blue-50"
            >
              <span className="block text-xs font-black text-slate-700">
                {item.evidence_ref.material_title || formatEvidenceLabel(item.evidence_type)}
              </span>
              <span className="mt-1 block text-[11px] text-slate-400">
                {[item.evidence_ref.page_ref, item.evidence_ref.source_locator].filter(Boolean).join(' / ')
                  || formatEvidenceLabel(item.evidence_type)}
              </span>
              {item.evidence_ref.snippet && (
                <span className="mt-2 block text-xs leading-relaxed text-slate-600">
                  {truncateText(item.evidence_ref.snippet, 240)}
                </span>
              )}
            </button>
          ))}
        </div>
        {!isLoading && entityEvidence && entityEvidence.items.length === 0 && (
          <div className="mt-2 border border-slate-100 bg-slate-50 p-3 text-xs text-slate-400">
            No source mentions are attached to this semantic entity yet.
          </div>
        )}
      </div>

      {detail?.related_materials && detail.related_materials.length > 0 && (
        <div className="mt-5">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Related Documents</div>
          <div className="mt-2 space-y-1">
            {detail.related_materials.slice(0, 8).map((material) => (
              <button
                key={material.entity_id}
                type="button"
                disabled={!material.material_id}
                onClick={() => material.material_id && onOpenMaterialView(material.material_id, 'segments')}
                className="block w-full border border-slate-100 bg-slate-50 px-3 py-2 text-left text-xs text-slate-600 hover:bg-blue-50 disabled:cursor-default"
              >
                <span className="font-bold text-slate-700">{material.title}</span>
                <span className="ml-2 text-slate-400">
                  {material.shared_concept_count} shared / {material.evidence_count} evidence
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {detail?.connected_entities && detail.connected_entities.length > 0 && (
        <div className="mt-5">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Connected Entities</div>
          <div className="mt-2 space-y-1">
            {detail.connected_entities.slice(0, 10).map((connected) => (
              <div key={connected.id} className="border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <span className="font-bold text-slate-700">{connected.label}</span>
                <span className="ml-2 text-slate-400">{formatEvidenceLabel(connected.type)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {detail?.candidates && detail.candidates.length > 0 && (
        <div className="mt-5">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Candidate Relations</div>
          <p className="mt-1 text-xs text-slate-400">These suggestions are not rendered as Semantic Atlas edges until accepted.</p>
          <div className="mt-2 space-y-2">
            {detail.candidates.slice(0, 6).map((candidate) => (
              <div key={candidate.id} className="border border-amber-100 bg-amber-50 p-3">
                <div className="text-xs font-black text-amber-900">
                  {candidate.source_entity?.label} {'->'} {candidate.target_entity?.label}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-amber-800">{candidate.rationale}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {(['accepted', 'needs_review', 'rejected'] as const).map((status) => (
                    <button
                      key={status}
                      type="button"
                      disabled={reviewingId === candidate.id}
                      onClick={() => onReviewCandidate(candidate.id, status)}
                      className="border border-amber-200 bg-white px-2 py-1 text-[10px] font-black uppercase tracking-wider text-amber-800 hover:bg-amber-100 disabled:opacity-40"
                    >
                      {formatEvidenceLabel(status)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onClearFocus}
        className="mt-4 border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-500 hover:bg-slate-50"
      >
        Clear Focus
      </button>
    </aside>
  );
}
