import type { SemanticAtlasLens } from './graphTypes';

interface SemanticLensPanelProps {
  lens: SemanticAtlasLens;
  counts: Partial<Record<SemanticAtlasLens, number>>;
  onLensChange: (lens: SemanticAtlasLens) => void;
}

const LENSES: Array<{
  id: SemanticAtlasLens;
  label: string;
}> = [
  { id: 'documents', label: 'All map' },
  { id: 'concepts', label: 'Concepts' },
  { id: 'places', label: 'Places' },
  { id: 'time', label: 'Time' },
];

export function SemanticLensPanel({ lens, counts, onLensChange }: SemanticLensPanelProps) {
  return (
    <nav aria-label="Semantic Atlas lenses" className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">
        Focus lens
      </span>
      {LENSES.map((item) => {
        const isActive = lens === item.id;
        return (
          <button
            key={item.id}
            type="button"
            aria-pressed={isActive}
            onClick={() => onLensChange(item.id)}
            className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition ${
              isActive
                ? 'border-cyan-300 bg-cyan-300 text-slate-950'
                : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-cyan-400 hover:text-cyan-200'
            }`}
          >
            {item.label}
            <span className={`ml-1.5 ${isActive ? 'text-slate-700' : 'text-slate-500'}`}>
              {counts[item.id] || 0}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
