import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import RepositoryWorkbench from './components/RepositoryWorkbench';
import TutorialModal from './components/TutorialModal';
import {
  WorkspaceTabs,
  type WorkspaceView,
} from './components/WorkspaceTabs';
import type {
  ResearchEvidenceNavigation,
} from './components/repository/types';
import './App.css';

const AtlasWorkspace = lazy(() =>
  import('./components/AtlasWorkspace').then((module) => ({
    default: module.AtlasWorkspace,
  })),
);

const DataGovernanceRegistry = lazy(() =>
  import('./components/DataGovernanceRegistry').then((module) => ({
    default: module.DataGovernanceRegistry,
  })),
);

const ProgressWorkspace = lazy(() =>
  import('./components/ProgressWorkspace').then((module) => ({
    default: module.ProgressWorkspace,
  })),
);

function App() {
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [activeTutorialTarget, setActiveTutorialTarget] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<WorkspaceView>('research');
  const [hasMountedAtlas, setHasMountedAtlas] = useState(false);
  const [hasMountedGovernance, setHasMountedGovernance] = useState(false);
  const [hasMountedProgress, setHasMountedProgress] = useState(false);
  const [evidenceNavigation, setEvidenceNavigation] =
    useState<ResearchEvidenceNavigation | null>(null);
  const hasHandledTutorialAutoStart = useRef(false);

  useEffect(() => {
    if (activeView !== 'research' || hasHandledTutorialAutoStart.current) return;
    hasHandledTutorialAutoStart.current = true;
    const disabled = localStorage.getItem('tapa-workbench:tutorial-autostart-disabled') === 'true';
    if (disabled) return;
    const timer = window.setTimeout(() => setIsTutorialOpen(true), 500);
    return () => window.clearTimeout(timer);
  }, [activeView]);

  const completeTutorial = useCallback(() => {
    localStorage.setItem('tapa-workbench:tutorial-completed', 'true');
    localStorage.setItem('tapa-workbench:tutorial-version', '2');
    setIsTutorialOpen(false);
  }, []);

  const handleTutorialAction = useCallback((target: string) => {
    window.dispatchEvent(new CustomEvent('tapa-workbench:tutorial-action', { detail: { target } }));
  }, []);

  const handleViewChange = useCallback((view: WorkspaceView) => {
    if (view === 'atlas') setHasMountedAtlas(true);
    if (view === 'governance') setHasMountedGovernance(true);
    if (view === 'progress') setHasMountedProgress(true);
    if (view !== 'research') {
      setIsTutorialOpen(false);
      setActiveTutorialTarget(null);
    }
    setActiveView(view);
  }, []);

  const openResearchEvidence = useCallback(
    (target: Omit<ResearchEvidenceNavigation, 'request_id'>) => {
      setEvidenceNavigation({
        ...target,
        request_id: Date.now(),
      });
      setActiveView('research');
      setIsTutorialOpen(false);
      setActiveTutorialTarget(null);
    },
    [],
  );

  const headerNavigation = (
    <WorkspaceTabs activeView={activeView} onViewChange={handleViewChange} />
  );

  return (
    <div className="standalone-workbench">
      <div hidden={activeView !== 'research'}>
        <RepositoryWorkbench
          onOpenTutorial={() => setIsTutorialOpen(true)}
          activeTutorialTarget={activeTutorialTarget}
          onTutorialAction={handleTutorialAction}
          headerNavigation={headerNavigation}
          evidenceNavigation={evidenceNavigation}
        />
      </div>

      {hasMountedAtlas && (
        <div hidden={activeView !== 'atlas'}>
          <Suspense
            fallback={
              <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-50 text-sm text-slate-500">
                Loading Semantic Atlas…
              </div>
            }
          >
            <AtlasWorkspace
              headerNavigation={headerNavigation}
              onOpenResearchEvidence={openResearchEvidence}
            />
          </Suspense>
        </div>
      )}

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

      {hasMountedProgress && (
        <div hidden={activeView !== 'progress'}>
          <Suspense
            fallback={
              <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-50 text-sm text-slate-500">
                Loading Progress Portal...
              </div>
            }
          >
            <ProgressWorkspace headerNavigation={headerNavigation} onOpenResearchEvidence={openResearchEvidence} />
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
