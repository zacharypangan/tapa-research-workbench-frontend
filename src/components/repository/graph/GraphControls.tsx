import type { GraphExplorerMode, GraphFilters, InteractiveGraphLevel } from './graphTypes';
import {
  GRAPH_EDGE_TYPES,
  GRAPH_NODE_TYPES,
  SEMANTIC_EDGE_TYPES,
  SEMANTIC_NODE_TYPES,
  graphLevelLabel,
} from './graphTypes';
import type { GraphReviewStatus } from '../types';

interface GraphControlsProps {
  mode: GraphExplorerMode;
  onModeChange: (mode: GraphExplorerMode) => void;
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
const WEAK_EDGE_TYPES = ['co_occurs_with', 'semantically_related_to'];

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
  mode,
  onModeChange,
}: GraphControlsProps) {
  const nodeTypes = mode === 'semantic' ? SEMANTIC_NODE_TYPES : GRAPH_NODE_TYPES;
  const edgeTypes = mode === 'semantic' ? SEMANTIC_EDGE_TYPES : GRAPH_EDGE_TYPES;
  const weakLinksEnabled = WEAK_EDGE_TYPES.every((edgeType) => filters.edgeTypes.includes(edgeType));
  const toggleFilterValue = (key: 'nodeTypes' | 'edgeTypes' | 'reviewStatuses', value: string) => {
    const current = filters[key] as string[];
    const next = current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
    onFiltersChange({ ...filters, [key]: next });
  };

  const toggleWeakLinks = () => {
    const nextEdgeTypes = weakLinksEnabled
      ? filters.edgeTypes.filter((edgeType) => !WEAK_EDGE_TYPES.includes(edgeType))
      : Array.from(new Set([...filters.edgeTypes, ...WEAK_EDGE_TYPES]));
    onFiltersChange({ ...filters, edgeTypes: nextEdgeTypes });
  };

  const selectedFilterClass = mode === 'semantic'
    ? 'bg-amber-700 text-white'
    : 'bg-slate-800 text-white';

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <div
          role="group"
          aria-label="Atlas view"
          className="flex shrink-0 rounded-lg border border-slate-200 bg-slate-50 p-0.5"
        >
          {([
            ['semantic', 'Semantic Atlas'],
            ['evidence', 'Evidence Graph'],
          ] as Array<[GraphExplorerMode, string]>).map(([item, label]) => (
            <button
              key={item}
              type="button"
              aria-pressed={mode === item}
              onClick={() => onModeChange(item)}
              className={`h-7 rounded-md px-2.5 text-[10px] font-black uppercase tracking-wider ${
                mode === item
                  ? item === 'semantic'
                    ? 'bg-amber-700 text-white shadow-sm'
                    : 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-500 hover:bg-white hover:text-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex min-w-[260px] flex-1 items-center gap-1.5">
          <input
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') onSearchSubmit();
            }}
            placeholder={mode === 'semantic' ? 'Focus documents, entities, or evidence' : 'Search the raw evidence graph'}
            aria-label={mode === 'semantic' ? 'Focus the Semantic Atlas' : 'Search the Evidence Graph'}
            className="h-8 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
          />
          <button
            type="button"
            onClick={onSearchSubmit}
            className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50"
          >
            Focus
          </button>
        </div>

        <button
          type="button"
          onClick={onBuild}
          disabled={isBuilding}
          className="h-8 rounded-lg bg-amber-700 px-3 text-[10px] font-black uppercase tracking-wider text-white hover:bg-amber-800 disabled:opacity-40"
        >
          {isBuilding ? 'Building' : 'Build'}
        </button>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50 disabled:opacity-40"
        >
          {isLoading ? 'Loading' : 'Reload'}
        </button>

        <details className="relative">
          <summary className="h-8 cursor-pointer list-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50">
            Export
          </summary>
          <div className="absolute right-0 z-50 mt-2 w-48 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-xl">
            <button
              type="button"
              onClick={onExportVisible}
              disabled={disabled}
              className="block w-full px-3 py-2 text-left text-[10px] font-black uppercase tracking-wider text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              {mode === 'semantic' ? 'Visible Atlas JSON' : 'Visible Graph JSON'}
            </button>
            <button
              type="button"
              onClick={onExportAll}
              disabled={disabled}
              className="block w-full px-3 py-2 text-left text-[10px] font-black uppercase tracking-wider text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              {mode === 'semantic' ? 'All Semantic JSON' : 'All Graph JSON'}
            </button>
          </div>
        </details>

        <details className="relative">
          <summary className="h-8 cursor-pointer list-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-600 hover:bg-white">
            More
          </summary>
          <div className="absolute right-0 z-50 mt-2 w-[min(760px,calc(100vw-3rem))] rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
            {mode === 'evidence' && (
              <div className="mb-3 border-b border-slate-100 pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                      Advanced / raw graph
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-400">
                      Choose a graph depth or a guided starting point.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={toggleWeakLinks}
                    className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${
                      weakLinksEnabled
                        ? 'bg-amber-700 text-white'
                        : 'border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                    }`}
                  >
                    {weakLinksEnabled ? 'Weak links on' : 'Show weak links'}
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(['overview', 'documents', 'sections', 'concepts'] as InteractiveGraphLevel[]).map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => onLevelChange(item)}
                      className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${
                        level === item
                          ? 'bg-slate-800 text-white'
                          : 'border border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      {graphLevelLabel(item)}
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[
                    ['beginner', "I'm New Here"],
                    ['structure', 'Document Structure'],
                    ['concepts', 'Concepts'],
                    ['places_time', 'Places & Time'],
                  ].map(([tour, label]) => (
                    <button
                      key={tour}
                      type="button"
                      onClick={() => onTour(tour as 'beginner' | 'structure' | 'concepts' | 'places_time')}
                      className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500 hover:bg-white"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid gap-3 lg:grid-cols-3">
              <div>
                <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Node types
                </div>
                <div className="flex flex-wrap gap-1">
                  {nodeTypes.map((nodeType) => (
                    <button
                      key={nodeType}
                      type="button"
                      onClick={() => toggleFilterValue('nodeTypes', nodeType)}
                      className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-wider ${
                        filters.nodeTypes.includes(nodeType)
                          ? selectedFilterClass
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      {nodeType.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Edge types
                </div>
                <div className="flex flex-wrap gap-1">
                  {edgeTypes.map((edgeType) => (
                    <button
                      key={edgeType}
                      type="button"
                      onClick={() => toggleFilterValue('edgeTypes', edgeType)}
                      className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-wider ${
                        filters.edgeTypes.includes(edgeType)
                          ? selectedFilterClass
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      {edgeType.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Review status
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {REVIEW_STATUSES.map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => toggleFilterValue('reviewStatuses', status)}
                        className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-wider ${
                          filters.reviewStatuses.includes(status)
                            ? selectedFilterClass
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        {status.replace(/_/g, ' ')}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="block">
                  <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Confidence {Math.round(filters.confidence * 100)}%
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={0.95}
                    step={0.05}
                    value={filters.confidence}
                    onChange={(event) => onFiltersChange({ ...filters, confidence: Number(event.target.value) })}
                    className="w-full accent-amber-700"
                  />
                </label>
                <label className="flex items-center gap-2 text-xs font-bold text-slate-500">
                  <input
                    type="checkbox"
                    checked={includeRejected}
                    onChange={(event) => onIncludeRejectedChange(event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 accent-amber-700"
                  />
                  Include rejected edges
                </label>
              </div>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}
