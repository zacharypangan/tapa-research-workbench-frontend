import { formatEvidenceLabel, truncateText } from '../formatters';
import {
  EVIDENCE_ITEM_GAP,
  EVIDENCE_ITEM_HEIGHT,
  EVIDENCE_ITEM_LEFT,
  EVIDENCE_ITEM_TOP,
  EVIDENCE_ITEM_WIDTH,
  evidenceItemsForType,
} from './semanticAtlasLayout';
import type {
  InteractiveGraphNode,
  SemanticEntityDetail,
  SemanticEntityEvidence,
  SemanticEvidenceItem,
} from './graphTypes';

interface DocumentEvidenceClusterProps {
  document: InteractiveGraphNode;
  detail?: SemanticEntityDetail;
  evidence?: SemanticEntityEvidence;
  activeEvidenceType: string;
  visibleEntityIds: Set<string>;
  selectedEvidenceId: string | null;
  isLoading: boolean;
  onEvidenceTypeChange: (evidenceType: string) => void;
  onEvidenceSelect: (item: SemanticEvidenceItem) => void;
  onOpenMaterialView: (materialId: string, view: 'segments' | 'images' | 'observations') => void;
}

const GROUPS = [
  { id: 'segment', label: 'Sections' },
  { id: 'image', label: 'Images' },
  { id: 'observation', label: 'Observations' },
  { id: 'metadata', label: 'Metadata' },
] as const;

export function DocumentEvidenceCluster({
  document,
  detail,
  evidence,
  activeEvidenceType,
  visibleEntityIds,
  selectedEvidenceId,
  isLoading,
  onEvidenceTypeChange,
  onEvidenceSelect,
  onOpenMaterialView,
}: DocumentEvidenceClusterProps) {
  const items = evidence?.items || [];
  const activeItems = evidenceItemsForType(items, activeEvidenceType, visibleEntityIds);
  const materialId = document.material_id || (
    typeof document.properties.material_id === 'string' ? document.properties.material_id : null
  );
  const connectedConcepts = detail?.connected_entities.filter((entity) => entity.type === 'concept').length || 0;
  const connectedPlaces = detail?.connected_entities.filter((entity) => entity.type === 'place').length || 0;
  const connectedTimes = detail?.connected_entities.filter((entity) => entity.type === 'time_period').length || 0;

  return (
    <div className="relative h-[174px] border-t border-blue-300/20 bg-slate-950/80">
      <div className="absolute left-4 right-4 top-3 flex items-start justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {GROUPS.map((group) => {
            const count = items.filter((item) => item.evidence_type === group.id).length;
            const isActive = activeEvidenceType === group.id;
            return (
              <button
                key={group.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => onEvidenceTypeChange(group.id)}
                className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${
                  isActive
                    ? 'border-cyan-300 bg-cyan-300 text-slate-950'
                    : 'border-slate-600 bg-slate-900 text-slate-300 hover:border-cyan-400'
                }`}
              >
                {group.label} {count}
              </button>
            );
          })}
        </div>
        <div className="flex shrink-0 gap-1 text-[9px] font-black uppercase tracking-wider">
          <span className="rounded-full bg-emerald-400/15 px-2 py-1 text-emerald-200">
            Concepts {connectedConcepts}
          </span>
          <span className="rounded-full bg-amber-400/15 px-2 py-1 text-amber-200">
            Places {connectedPlaces}
          </span>
          <span className="rounded-full bg-violet-400/15 px-2 py-1 text-violet-200">
            Time {connectedTimes}
          </span>
        </div>
      </div>

      {isLoading && items.length === 0 && (
        <div className="absolute left-6 top-[94px] text-xs font-bold text-slate-400">
          Loading contained evidence…
        </div>
      )}

      {!isLoading && activeItems.length === 0 && (
        <div className="absolute left-6 top-[94px] text-xs font-bold text-slate-500">
          No {formatEvidenceLabel(activeEvidenceType)} evidence is available in this document.
        </div>
      )}

      {activeItems.map((item, index) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onEvidenceSelect(item)}
          style={{
            left: EVIDENCE_ITEM_LEFT + index * (EVIDENCE_ITEM_WIDTH + EVIDENCE_ITEM_GAP),
            top: EVIDENCE_ITEM_TOP - 94,
            width: EVIDENCE_ITEM_WIDTH,
            height: EVIDENCE_ITEM_HEIGHT,
          }}
          className={`absolute overflow-hidden rounded-xl border px-2.5 py-2 text-left ${
            selectedEvidenceId === item.id
              ? 'border-yellow-300 bg-yellow-300/15 ring-1 ring-yellow-300'
              : 'border-slate-600 bg-slate-900 hover:border-cyan-300 hover:bg-cyan-400/10'
          }`}
          title={item.evidence_ref.snippet || item.surface_text || formatEvidenceLabel(item.evidence_type)}
        >
          <span className="block truncate text-[9px] font-black uppercase tracking-wider text-cyan-200">
            {item.evidence_ref.page_ref || item.evidence_ref.source_locator || formatEvidenceLabel(item.evidence_type)}
          </span>
          <span className="mt-1 block text-[10px] font-bold leading-snug text-slate-200">
            {truncateText(item.surface_text || item.evidence_ref.snippet || 'Open evidence', 46)}
          </span>
        </button>
      ))}

      {materialId && (
        <div className="absolute bottom-2 right-3 flex gap-1">
          {([
            ['segments', 'Open sections'],
            ['images', 'Images'],
            ['observations', 'Observations'],
          ] as const).map(([view, label]) => (
            <button
              key={view}
              type="button"
              onClick={() => onOpenMaterialView(materialId, view)}
              className="text-[9px] font-black uppercase tracking-wider text-slate-500 hover:text-cyan-200"
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
