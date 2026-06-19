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
    <nav aria-label="Semantic Atlas lenses" className="flex flex-wrap items-center gap-1">
      <span className="mr-1 text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">
        Lens
      </span>
      {LENSES.map((item) => {
        const isActive = lens === item.id;
        const count = counts[item.id] || 0;
        const isEmpty = item.id !== 'documents' && count === 0;
        return (
          <button
            key={item.id}
            type="button"
            aria-pressed={isActive}
            disabled={isEmpty}
            onClick={() => onLensChange(item.id)}
            className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wider transition ${
              isActive
                ? 'border-amber-700 bg-amber-700 text-white'
                : 'border-slate-200 bg-white text-slate-500 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-800 disabled:cursor-not-allowed disabled:opacity-35'
            }`}
          >
            {item.label}
            <span className={`ml-1.5 ${isActive ? 'text-amber-100' : 'text-slate-400'}`}>
              {count}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
