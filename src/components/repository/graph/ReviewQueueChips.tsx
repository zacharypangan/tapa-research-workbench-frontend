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
        left: lane.x + 10,
        top: lane.y + 42,
        width: lane.width - 20,
      }}
      className="absolute z-20 grid grid-cols-3 gap-1.5"
    >
      {queues.map((queue) => (
        <button
          key={queue.id}
          type="button"
          onClick={queue.action}
          className="rounded-lg border border-rose-200 bg-white px-2 py-1.5 text-left text-rose-800 shadow-sm hover:border-rose-300 hover:bg-rose-50"
        >
          <span className="block text-sm font-black">{queue.count}</span>
          <span className="mt-0.5 block truncate text-[8px] font-black uppercase tracking-wider text-rose-500">
            {queue.label}
          </span>
        </button>
      ))}
    </div>
  );
}
