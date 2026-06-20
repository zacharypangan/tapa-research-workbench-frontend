import type { ReactNode } from 'react';
import type { AtlasNodePosition } from './semanticAtlasLayout';

interface SemanticAtlasNodeProps {
  position: AtlasNodePosition;
  isSelected: boolean;
  isFocused: boolean;
  isDimmed: boolean;
  isExpanded: boolean;
  isSearchMatch: boolean;
  onSelect: () => void;
  onToggleExpand?: () => void;
  children?: ReactNode;
}

const entityTone = (nodeType: string) => {
  if (nodeType === 'concept') return 'border-emerald-200 bg-emerald-50 text-emerald-900';
  if (nodeType === 'place') return 'border-amber-200 bg-amber-50 text-amber-900';
  if (nodeType === 'time_period') return 'border-violet-200 bg-violet-50 text-violet-900';
  if (nodeType === 'agent') return 'border-sky-200 bg-sky-50 text-sky-900';
  return 'border-slate-200 bg-white text-slate-800';
};

export function SemanticAtlasNode({
  position,
  isSelected,
  isFocused,
  isDimmed,
  isExpanded,
  isSearchMatch,
  onSelect,
  onToggleExpand,
  children,
}: SemanticAtlasNodeProps) {
  const { node } = position;
  const style = {
    left: position.x,
    top: position.y,
    width: position.width,
    height: position.height,
  };
  const emphasis = isSelected
    ? 'ring-2 ring-amber-600 shadow-md'
    : isSearchMatch
      ? 'ring-2 ring-yellow-400 shadow-sm'
      : isFocused
        ? 'ring-1 ring-emerald-500 shadow-sm'
        : '';

  if (node.node_type !== 'material') {
    return (
      <button
        type="button"
        style={style}
        aria-pressed={isSelected}
        onClick={onSelect}
        className={`absolute z-20 overflow-hidden rounded-full border px-2.5 text-left shadow-sm transition-all duration-200 ${entityTone(node.node_type)} ${emphasis} ${
          isDimmed ? 'opacity-30 saturate-50' : 'opacity-100'
        }`}
      >
        <span className="block truncate text-[10px] font-black leading-tight">{node.label}</span>
        <span className="mt-0.5 block truncate text-[8px] font-bold uppercase tracking-wider opacity-55">
          {node.document_count || 0} docs · {node.evidence_count || 0} evidence
        </span>
      </button>
    );
  }

  const metadata = [node.source_type, node.year, node.language].filter(Boolean).join(' · ');

  return (
    <article
      style={style}
      className={`absolute z-20 overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-800 shadow-sm transition-all duration-200 ${emphasis} ${
        isDimmed ? 'opacity-30 saturate-50' : 'opacity-100'
      } ${isExpanded ? 'z-30' : ''}`}
    >
      <button
        type="button"
        aria-pressed={isSelected}
        onClick={onSelect}
        className="block h-[76px] w-full px-3 py-2 text-left hover:bg-amber-50"
      >
        <span className="block min-w-0 pr-10">
          <span
            className="block overflow-hidden text-xs font-black leading-[1.25] text-slate-800"
            style={{
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: 2,
            }}
            title={node.label}
          >
            {node.label}
          </span>
          <span className="mt-1 block truncate pr-8 text-[9px] font-bold text-slate-400">
            {metadata || 'Repository source'}
          </span>
        </span>
      </button>
      <span className="pointer-events-none absolute right-2 top-2 rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-black text-slate-500">
        {node.degree || node.evidence_count || 0}
      </span>
      {onToggleExpand && (
        <button
          type="button"
          aria-expanded={isExpanded}
          onClick={onToggleExpand}
          className={`absolute right-2 z-10 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-amber-700 shadow-sm hover:border-amber-300 hover:bg-amber-50 ${
            isExpanded ? 'top-[52px]' : 'bottom-2'
          }`}
        >
          {isExpanded ? 'Hide evidence' : 'Expand'}
        </button>
      )}
      {isExpanded && children}
    </article>
  );
}
