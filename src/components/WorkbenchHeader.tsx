import type { ReactNode } from 'react';

export function WorkbenchHeader({ navigation, actions }: { navigation?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="min-h-16 shrink-0 border-b border-slate-200 bg-white px-5 py-3 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="text-sm font-black uppercase tracking-[0.18em]">Research Workbench</h1>
        {navigation}
      </div>
      <div className="flex flex-wrap items-center gap-3">{actions}</div>
    </header>
  );
}
