import type { AtlasLaneLayout } from './semanticAtlasLayout';

interface EntityLaneProps {
  lane: AtlasLaneLayout;
  count: number;
  isActive: boolean;
}

const accentClass: Record<AtlasLaneLayout['accent'], string> = {
  blue: 'border-amber-200 bg-amber-50/45 text-amber-900',
  emerald: 'border-emerald-200 bg-emerald-50/55 text-emerald-900',
  amber: 'border-orange-200 bg-orange-50/55 text-orange-900',
  violet: 'border-violet-200 bg-violet-50/55 text-violet-900',
  cyan: 'border-sky-200 bg-sky-50/55 text-sky-900',
  rose: 'border-rose-200 bg-rose-50/55 text-rose-900',
};

export function EntityLane({ lane, count, isActive }: EntityLaneProps) {
  return (
    <section
      style={{
        left: lane.x,
        top: lane.y,
        width: lane.width,
        height: lane.height,
      }}
      aria-label={`${lane.label} lane`}
      className={`absolute z-0 rounded-2xl border ${accentClass[lane.accent]} ${
        isActive ? 'ring-1 ring-current/40' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2 px-3 pt-2.5">
        <div className="min-w-0">
          <h5 className="text-[10px] font-black uppercase tracking-[0.16em]">{lane.label}</h5>
          <p className="mt-0.5 truncate text-[8px] font-bold uppercase tracking-wider opacity-50">{lane.description}</p>
        </div>
        <span className="rounded-full border border-current/15 bg-white/70 px-1.5 py-0.5 text-[9px] font-black">
          {count}
        </span>
      </div>
    </section>
  );
}
