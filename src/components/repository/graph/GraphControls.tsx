import type { GraphFilters, InteractiveGraphLevel } from './graphTypes';
import { GRAPH_EDGE_TYPES, GRAPH_NODE_TYPES, graphLevelLabel } from './graphTypes';
import type { GraphReviewStatus } from '../types';

interface GraphControlsProps {
  level: InteractiveGraphLevel;
  onLevelChange: (level: InteractiveGraphLevel) => void;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  onSearchSubmit: () => void;
  filters: GraphFilters;
  onFiltersChange: (filters: GraphFilters) => void;
  includeRejected: boolean;
  onIncludeRejectedChange: (value: boolean) => void;
  onBuild: () => void;
  onRefresh: () => void;
  onTour: (tour: 'beginner' | 'structure' | 'concepts' | 'places_time') => void;
  onExportVisible: () => void;
  onExportAll: () => void;
  isBuilding: boolean;
  isLoading: boolean;
  disabled: boolean;
}

const REVIEW_STATUSES: GraphReviewStatus[] = ['accepted', 'needs_review', 'unreviewed', 'rejected'];

export function GraphControls({
  level,
  onLevelChange,
  searchTerm,
  onSearchTermChange,
  onSearchSubmit,
  filters,
  onFiltersChange,
  includeRejected,
  onIncludeRejectedChange,
  onBuild,
  onRefresh,
  onTour,
  onExportVisible,
  onExportAll,
  isBuilding,
  isLoading,
  disabled,
}: GraphControlsProps) {
  const toggleFilterValue = (key: 'nodeTypes' | 'edgeTypes' | 'reviewStatuses', value: string) => {
    const current = filters[key] as string[];
    const next = current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
    onFiltersChange({ ...filters, [key]: next });
  };

  return (
    <div className="space-y-3 rounded-lg border border-slate-100 bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onBuild}
          disabled={isBuilding}
          className="h-9 rounded-lg bg-slate-900 px-3 text-[10px] font-black uppercase tracking-wider text-white hover:bg-slate-700 disabled:opacity-40"
        >
          {isBuilding ? 'Building' : 'Build / Refresh'}
        </button>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-black uppercase tracking-wider text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          {isLoading ? 'Loading' : 'Load'}
        </button>
        <div className="flex min-w-[240px] flex-1 items-center gap-2">
          <input
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') onSearchSubmit();
            }}
            placeholder="Search graph: tapa, beating, Fiji"
            className="repo-input h-9"
          />
          <button
            type="button"
            onClick={onSearchSubmit}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-black uppercase tracking-wider text-slate-700 hover:bg-slate-50"
          >
            Focus
          </button>
        </div>
        <details className="relative">
          <summary className="h-9 cursor-pointer list-none rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50">
            Export
          </summary>
          <div className="absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
            <button
              type="button"
              onClick={onExportVisible}
              disabled={disabled}
              className="block w-full px-3 py-2 text-left text-[10px] font-black uppercase tracking-wider text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              Visible Graph JSON
            </button>
            <button
              type="button"
              onClick={onExportAll}
              disabled={disabled}
              className="block w-full px-3 py-2 text-left text-[10px] font-black uppercase tracking-wider text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              All Graph JSON
            </button>
          </div>
        </details>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['overview', 'documents', 'sections', 'concepts'] as InteractiveGraphLevel[]).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onLevelChange(item)}
            className={`rounded-lg px-3 py-1 text-[10px] font-black uppercase tracking-wider ${
              level === item ? 'bg-blue-600 text-white' : 'border border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
            }`}
          >
            {graphLevelLabel(item)}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          ['beginner', "I'm New Here"],
          ['structure', 'Show Document Structure'],
          ['concepts', 'Show Concepts'],
          ['places_time', 'Show Places/Time'],
        ].map(([tour, label]) => (
          <button
            key={tour}
            type="button"
            onClick={() => onTour(tour as 'beginner' | 'structure' | 'concepts' | 'places_time')}
            className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500 hover:bg-white"
          >
            {label}
          </button>
        ))}
      </div>

      <details>
        <summary className="cursor-pointer list-none text-[10px] font-black uppercase tracking-widest text-slate-400">
          Filters
        </summary>
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          <div>
            <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Node Types</div>
            <div className="flex flex-wrap gap-1">
              {GRAPH_NODE_TYPES.map((nodeType) => (
                <button
                  key={nodeType}
                  type="button"
                  onClick={() => toggleFilterValue('nodeTypes', nodeType)}
                  className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-wider ${
                    filters.nodeTypes.includes(nodeType) ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {nodeType.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Edge Types</div>
            <div className="flex flex-wrap gap-1">
              {GRAPH_EDGE_TYPES.map((edgeType) => (
                <button
                  key={edgeType}
                  type="button"
                  onClick={() => toggleFilterValue('edgeTypes', edgeType)}
                  className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-wider ${
                    filters.edgeTypes.includes(edgeType) ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {edgeType.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Review</div>
              <div className="flex flex-wrap gap-1">
                {REVIEW_STATUSES.map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => toggleFilterValue('reviewStatuses', status)}
                    className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-wider ${
                      filters.reviewStatuses.includes(status) ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {status.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>
            <label className="block">
              <div className="mb-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                Confidence {Math.round(filters.confidence * 100)}%
              </div>
              <input
                type="range"
                min={0}
                max={0.95}
                step={0.05}
                value={filters.confidence}
                onChange={(event) => onFiltersChange({ ...filters, confidence: Number(event.target.value) })}
                className="w-full accent-slate-900"
              />
            </label>
            <label className="flex items-center gap-2 text-xs font-bold text-slate-500">
              <input
                type="checkbox"
                checked={includeRejected}
                onChange={(event) => onIncludeRejectedChange(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              Include rejected edges
            </label>
          </div>
        </div>
      </details>
    </div>
  );
}
