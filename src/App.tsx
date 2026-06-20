import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import RepositoryWorkbench from './components/RepositoryWorkbench';
import TutorialModal from './components/TutorialModal';
import {
  WorkspaceTabs,
  type WorkspaceView,
} from './components/WorkspaceTabs';
import { API_BASE_URL } from './config';
import './App.css';

const DataGovernanceRegistry = lazy(() =>
  import('./components/DataGovernanceRegistry').then((module) => ({
    default: module.DataGovernanceRegistry,
  })),
);

function App() {
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [activeTutorialTarget, setActiveTutorialTarget] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<WorkspaceView>('research');
  const [isGovernanceAvailable, setIsGovernanceAvailable] = useState(false);
  const [hasMountedGovernance, setHasMountedGovernance] = useState(false);

  useEffect(() => {
    const disabled = localStorage.getItem('tapa-workbench:tutorial-autostart-disabled') === 'true';
    if (disabled) return;
    const timer = window.setTimeout(() => setIsTutorialOpen(true), 500);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    fetch(`${API_BASE_URL}/governance/status`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : { available: false }))
      .then((payload: { available?: boolean }) => {
        setIsGovernanceAvailable(payload.available === true);
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setIsGovernanceAvailable(false);
        }
      });

    return () => controller.abort();
  }, []);

  const completeTutorial = useCallback(() => {
    localStorage.setItem('tapa-workbench:tutorial-completed', 'true');
    localStorage.setItem('tapa-workbench:tutorial-version', '2');
    setIsTutorialOpen(false);
  }, []);

  const handleTutorialAction = useCallback((target: string) => {
    window.dispatchEvent(new CustomEvent('tapa-workbench:tutorial-action', { detail: { target } }));
  }, []);

  const handleViewChange = useCallback(
    (view: WorkspaceView) => {
      if (view === 'governance') {
        if (!isGovernanceAvailable) return;
        setHasMountedGovernance(true);
        setIsTutorialOpen(false);
        setActiveTutorialTarget(null);
      }
      setActiveView(view);
    },
    [isGovernanceAvailable],
  );

  const headerNavigation = isGovernanceAvailable ? (
    <WorkspaceTabs activeView={activeView} onViewChange={handleViewChange} />
  ) : null;

  return (
    <div className="standalone-workbench">
      <div hidden={activeView !== 'research'}>
        <RepositoryWorkbench
          onOpenTutorial={() => setIsTutorialOpen(true)}
          activeTutorialTarget={activeTutorialTarget}
          onTutorialAction={handleTutorialAction}
          headerNavigation={headerNavigation}
        />
      </div>

      {hasMountedGovernance && (
        <div hidden={activeView !== 'governance'}>
          <Suspense
            fallback={
              <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-50 text-sm text-slate-500">
                Loading Data Governance…
              </div>
            }
          >
            <DataGovernanceRegistry headerNavigation={headerNavigation} />
          </Suspense>
        </div>
      )}

      <TutorialModal
        isOpen={isTutorialOpen}
        onClose={() => setIsTutorialOpen(false)}
        onComplete={completeTutorial}
        onTargetChange={setActiveTutorialTarget}
      />
    </div>
  );
}

export default App;
