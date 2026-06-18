import type { ReactNode } from 'react';
import { shortDocumentTitle } from './atlasLayout';
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
  if (nodeType === 'concept') return 'border-emerald-300/70 bg-emerald-950/90 text-emerald-50';
  if (nodeType === 'place') return 'border-amber-300/70 bg-amber-950/90 text-amber-50';
  if (nodeType === 'time_period') return 'border-violet-300/70 bg-violet-950/90 text-violet-50';
  if (nodeType === 'agent') return 'border-cyan-300/70 bg-cyan-950/90 text-cyan-50';
  return 'border-slate-500 bg-slate-900 text-slate-50';
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
    ? 'ring-2 ring-cyan-300 shadow-[0_0_28px_rgba(34,211,238,0.3)]'
    : isSearchMatch
      ? 'ring-2 ring-yellow-300 shadow-[0_0_24px_rgba(253,224,71,0.24)]'
      : isFocused
        ? 'ring-1 ring-emerald-300/80 shadow-[0_0_20px_rgba(52,211,153,0.2)]'
        : '';

  if (node.node_type !== 'material') {
    return (
      <button
        type="button"
        style={style}
        aria-pressed={isSelected}
        onClick={onSelect}
        className={`absolute z-20 overflow-hidden rounded-full border px-3 text-left transition-all duration-200 ${entityTone(node.node_type)} ${emphasis} ${
          isDimmed ? 'opacity-25 saturate-50' : 'opacity-100'
        }`}
      >
        <span className="block truncate text-[11px] font-black leading-tight">{node.label}</span>
        <span className="mt-0.5 block truncate text-[9px] font-bold uppercase tracking-wider opacity-65">
          {node.document_count || 0} docs · {node.evidence_count || 0} evidence
        </span>
      </button>
    );
  }

  const metadata = [node.source_type, node.year, node.language].filter(Boolean).join(' · ');

  return (
    <article
      style={style}
      className={`absolute z-20 overflow-hidden rounded-2xl border border-blue-300/50 bg-slate-900/95 text-slate-50 transition-all duration-200 ${emphasis} ${
        isDimmed ? 'opacity-25 saturate-50' : 'opacity-100'
      } ${isExpanded ? 'z-30' : ''}`}
    >
      <button
        type="button"
        aria-pressed={isSelected}
        onClick={onSelect}
        className="flex h-[94px] w-full items-start gap-3 px-4 py-3 text-left hover:bg-blue-400/10"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[9px] font-black uppercase tracking-[0.18em] text-blue-300">
            Document
          </span>
          <span className="mt-1 block text-sm font-black leading-snug text-white" title={node.label}>
            {shortDocumentTitle(node.label, 7)}
          </span>
          <span className="mt-1.5 block truncate text-[10px] font-bold text-slate-400">
            {metadata || 'Repository source'}
          </span>
        </span>
        <span className="shrink-0 rounded-full bg-blue-400/15 px-2 py-1 text-[10px] font-black text-blue-200">
          {node.degree || node.evidence_count || 0}
        </span>
      </button>
      {onToggleExpand && (
        <button
          type="button"
          aria-expanded={isExpanded}
          onClick={onToggleExpand}
          className={`absolute right-3 z-10 rounded-full border border-blue-300/25 bg-slate-950/80 px-2 py-1 text-[8px] font-black uppercase tracking-wider text-blue-200 hover:border-cyan-300 hover:text-cyan-100 ${
            isExpanded ? 'top-[66px]' : 'bottom-2'
          }`}
        >
          {isExpanded ? 'Hide evidence' : 'Expand'}
        </button>
      )}
      {isExpanded && children}
    </article>
  );
}
