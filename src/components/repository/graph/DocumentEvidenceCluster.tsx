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
    <div className="relative h-[148px] border-t border-slate-100 bg-slate-50">
      <div className="absolute left-3 right-3 top-2 flex items-start justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {GROUPS.map((group) => {
            const count = items.filter((item) => item.evidence_type === group.id).length;
            const isActive = activeEvidenceType === group.id;
            return (
              <button
                key={group.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => onEvidenceTypeChange(group.id)}
                className={`rounded-full border px-2 py-0.5 text-[8px] font-black uppercase tracking-wider ${
                  isActive
                    ? 'border-amber-700 bg-amber-700 text-white'
                    : 'border-slate-200 bg-white text-slate-500 hover:border-amber-300 hover:text-amber-800'
                }`}
              >
                {group.label} {count}
              </button>
            );
          })}
        </div>
        <div className="flex shrink-0 gap-2 pt-0.5 text-[8px] font-black uppercase tracking-wider text-slate-400">
          <span className="text-emerald-700">C {connectedConcepts}</span>
          <span className="text-amber-700">P {connectedPlaces}</span>
          <span className="text-violet-700">T {connectedTimes}</span>
        </div>
      </div>

      {isLoading && items.length === 0 && (
        <div className="absolute left-4 top-[72px] text-xs font-bold text-slate-400">
          Loading contained evidence…
        </div>
      )}

      {!isLoading && activeItems.length === 0 && (
        <div className="absolute left-4 top-[72px] text-xs font-bold text-slate-500">
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
            top: EVIDENCE_ITEM_TOP - 76,
            width: EVIDENCE_ITEM_WIDTH,
            height: EVIDENCE_ITEM_HEIGHT,
          }}
          className={`absolute overflow-hidden rounded-lg border px-2 py-1.5 text-left shadow-sm ${
            selectedEvidenceId === item.id
              ? 'border-yellow-400 bg-yellow-50 ring-1 ring-yellow-400'
              : 'border-slate-200 bg-white hover:border-amber-300 hover:bg-amber-50'
          }`}
          title={item.evidence_ref.snippet || item.surface_text || formatEvidenceLabel(item.evidence_type)}
        >
          <span className="block truncate text-[8px] font-black uppercase tracking-wider text-amber-700">
            {item.evidence_ref.page_ref || item.evidence_ref.source_locator || formatEvidenceLabel(item.evidence_type)}
          </span>
          <span className="mt-0.5 block text-[9px] font-bold leading-snug text-slate-600">
            {truncateText(item.surface_text || item.evidence_ref.snippet || 'Open evidence', 46)}
          </span>
        </button>
      ))}

      {materialId && (
        <div className="absolute bottom-1.5 right-3 flex gap-2">
          {([
            ['segments', 'Open sections'],
            ['images', 'Images'],
            ['observations', 'Observations'],
          ] as const).map(([view, label]) => (
            <button
              key={view}
              type="button"
              onClick={() => onOpenMaterialView(materialId, view)}
              className="text-[8px] font-black uppercase tracking-wider text-slate-400 hover:text-amber-800"
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
