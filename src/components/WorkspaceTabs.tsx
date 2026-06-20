export type WorkspaceView = 'research' | 'governance';

interface WorkspaceTabsProps {
  activeView: WorkspaceView;
  onViewChange: (view: WorkspaceView) => void;
}

const WORKSPACE_TABS = [
  { id: 'research', label: 'Research' },
  { id: 'governance', label: 'Data Governance' },
] as const;

export function WorkspaceTabs({
  activeView,
  onViewChange,
}: WorkspaceTabsProps) {
  return (
    <nav
      aria-label="Workspace sections"
      className="flex items-center rounded-lg border border-slate-200 bg-slate-100 p-1"
    >
      {WORKSPACE_TABS.map((tab) => {
        const isActive = activeView === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            aria-current={isActive ? 'page' : undefined}
            onClick={() => onViewChange(tab.id)}
            className={`h-8 rounded-md px-3 text-[10px] font-black uppercase tracking-wider transition-colors ${
              isActive
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:bg-white/70 hover:text-slate-800'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
