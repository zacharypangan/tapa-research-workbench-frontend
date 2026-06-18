import type { SemanticAtlasLens, SemanticGraphPayload } from './graphTypes';
import type { AtlasLaneLayout } from './semanticAtlasLayout';

interface ReviewQueueChipsProps {
  lane: AtlasLaneLayout;
  hiddenSummary?: SemanticGraphPayload['hidden_summary'];
  onLensChange: (lens: SemanticAtlasLens) => void;
}

export function ReviewQueueChips({
  lane,
  hiddenSummary,
  onLensChange,
}: ReviewQueueChipsProps) {
  const queues = [
    {
      id: 'places',
      label: 'Unresolved places',
      count: hiddenSummary?.unresolved_place_mentions || 0,
      action: () => onLensChange('places'),
    },
    {
      id: 'time',
      label: 'Date candidates',
      count: hiddenSummary?.invalid_or_candidate_time_mentions || 0,
      action: () => onLensChange('time'),
    },
    {
      id: 'relations',
      label: 'Weak relations',
      count: hiddenSummary?.hidden_candidate_relations || 0,
      action: () => onLensChange('concepts'),
    },
  ];

  return (
    <div
      style={{
        left: lane.x + 14,
        top: lane.y + 55,
        width: lane.width - 28,
      }}
      className="absolute z-20 grid grid-cols-3 gap-2"
    >
      {queues.map((queue) => (
        <button
          key={queue.id}
          type="button"
          onClick={queue.action}
          className="rounded-2xl border border-rose-300/30 bg-slate-950/75 px-3 py-2 text-left text-rose-100 hover:border-rose-300 hover:bg-rose-400/10"
        >
          <span className="block text-lg font-black">{queue.count}</span>
          <span className="mt-0.5 block text-[9px] font-black uppercase tracking-wider text-rose-200/70">
            {queue.label}
          </span>
        </button>
      ))}
    </div>
  );
}
