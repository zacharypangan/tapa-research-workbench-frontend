import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import RepositoryWorkbench from './components/RepositoryWorkbench';
import TutorialModal from './components/TutorialModal';
import type { ResearchEvidenceNavigation } from './components/repository/types';
import './App.css';

const KnowledgeWorkspace = lazy(() => import('./components/KnowledgeWorkspace').then((module) => ({ default: module.KnowledgeWorkspace })));
type WorkspaceView = 'sources' | 'knowledge';

function App() {
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [activeTutorialTarget, setActiveTutorialTarget] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<WorkspaceView>(() => new URLSearchParams(window.location.search).get('view') === 'knowledge' ? 'knowledge' : 'sources');
  const [hasOpenedGraph, setHasOpenedGraph] = useState(activeView === 'knowledge');
  const [graphMaterial, setGraphMaterial] = useState<{ materialId?: string; requestId: number } | null>(null);
  const [evidenceNavigation, setEvidenceNavigation] = useState<ResearchEvidenceNavigation | null>(null);
  const tutorialTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const disabled = localStorage.getItem('tapa-workbench:tutorial-autostart-disabled') === 'true';
    if (disabled || new URLSearchParams(window.location.search).get('view') === 'knowledge') return;
    tutorialTimer.current = window.setTimeout(() => setIsTutorialOpen(true), 500);
    return () => window.clearTimeout(tutorialTimer.current);
  }, []);

  const changeView = useCallback((view: WorkspaceView) => {
    window.clearTimeout(tutorialTimer.current);
    const url = new URL(window.location.href);
    if (view === 'knowledge') url.searchParams.set('view', 'knowledge');
    else { url.searchParams.delete('view'); url.searchParams.delete('graph'); }
    window.history.replaceState(null, '', url);
    if (view === 'knowledge') setHasOpenedGraph(true);
    setIsTutorialOpen(false);
    setActiveTutorialTarget(null);
    setActiveView(view);
  }, []);

  const openKnowledgeGraph = useCallback((materialId?: string) => {
    const url = new URL(window.location.href);
    url.searchParams.delete('graph');
    window.history.replaceState(null, '', url);
    setGraphMaterial({ materialId, requestId: Date.now() });
    changeView('knowledge');
  }, [changeView]);

  const openResearchEvidence = useCallback((target: Omit<ResearchEvidenceNavigation, 'request_id'>) => {
    setEvidenceNavigation({ ...target, request_id: Date.now() });
    changeView('sources');
  }, [changeView]);

  const completeTutorial = useCallback(() => {
    localStorage.setItem('tapa-workbench:tutorial-completed', 'true');
    localStorage.setItem('tapa-workbench:tutorial-version', '2');
    setIsTutorialOpen(false);
  }, []);

  const handleTutorialAction = useCallback((target: string) => {
    window.dispatchEvent(new CustomEvent('tapa-workbench:tutorial-action', { detail: { target } }));
  }, []);

  const navigation = (
    <nav aria-label="Workbench views" className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
      {([['sources', 'Sources'], ['knowledge', 'Knowledge graph']] as const).map(([view, label]) => (
        <button key={view} type="button" aria-current={activeView === view ? 'page' : undefined} onClick={() => changeView(view)} className={`rounded-md px-3 py-2 text-xs font-semibold ${activeView === view ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:bg-white/70'}`}>{label}</button>
      ))}
    </nav>
  );

  return (
    <div className="standalone-workbench">
      <div hidden={activeView !== 'sources'}>
        <RepositoryWorkbench
          onOpenTutorial={() => setIsTutorialOpen(true)}
          activeTutorialTarget={activeTutorialTarget}
          onTutorialAction={handleTutorialAction}
          headerNavigation={navigation}
          evidenceNavigation={evidenceNavigation}
          onOpenKnowledgeGraph={openKnowledgeGraph}
        />
      </div>

      {hasOpenedGraph && <div hidden={activeView !== 'knowledge'}>
        <Suspense fallback={<div className="grid min-h-screen place-items-center text-sm text-slate-500">Loading knowledge graph…</div>}>
          <KnowledgeWorkspace key={graphMaterial?.requestId ?? 'saved-graph'} headerNavigation={navigation} initialMaterial={graphMaterial} active={activeView === 'knowledge'} onOpenResearchEvidence={openResearchEvidence} />
        </Suspense>
      </div>}

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
