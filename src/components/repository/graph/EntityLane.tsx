import type { AtlasLaneLayout } from './semanticAtlasLayout';

interface EntityLaneProps {
  lane: AtlasLaneLayout;
  count: number;
  isActive: boolean;
}

const accentClass: Record<AtlasLaneLayout['accent'], string> = {
  blue: 'border-blue-400/30 bg-blue-950/20 text-blue-200',
  emerald: 'border-emerald-400/30 bg-emerald-950/20 text-emerald-200',
  amber: 'border-amber-400/30 bg-amber-950/20 text-amber-200',
  violet: 'border-violet-400/30 bg-violet-950/20 text-violet-200',
  cyan: 'border-cyan-400/30 bg-cyan-950/20 text-cyan-200',
  rose: 'border-rose-400/30 bg-rose-950/20 text-rose-200',
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
      className={`absolute z-0 rounded-3xl border backdrop-blur-sm ${accentClass[lane.accent]} ${
        isActive ? 'ring-1 ring-current/60' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3 px-4 pt-3">
        <div>
          <h5 className="text-[11px] font-black uppercase tracking-[0.2em]">{lane.label}</h5>
          <p className="mt-1 text-[9px] font-bold uppercase tracking-wider opacity-55">{lane.description}</p>
        </div>
        <span className="rounded-full border border-current/20 bg-slate-950/50 px-2 py-1 text-[10px] font-black">
          {count}
        </span>
      </div>
    </section>
  );
}
