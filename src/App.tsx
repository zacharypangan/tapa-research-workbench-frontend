import { useCallback, useEffect, useState } from 'react';
import RepositoryWorkbench from './components/RepositoryWorkbench';
import TutorialModal from './components/TutorialModal';
import './App.css';

function App() {
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [activeTutorialTarget, setActiveTutorialTarget] = useState<string | null>(null);

  useEffect(() => {
    const disabled = localStorage.getItem('tapa-workbench:tutorial-autostart-disabled') === 'true';
    if (disabled) return;
    const timer = window.setTimeout(() => setIsTutorialOpen(true), 500);
    return () => window.clearTimeout(timer);
  }, []);

  const completeTutorial = useCallback(() => {
    localStorage.setItem('tapa-workbench:tutorial-completed', 'true');
    localStorage.setItem('tapa-workbench:tutorial-version', '2');
    setIsTutorialOpen(false);
  }, []);

  const handleTutorialAction = useCallback((target: string) => {
    window.dispatchEvent(new CustomEvent('tapa-workbench:tutorial-action', { detail: { target } }));
  }, []);

  return (
    <div className="standalone-workbench">
      <RepositoryWorkbench
        onOpenTutorial={() => setIsTutorialOpen(true)}
        activeTutorialTarget={activeTutorialTarget}
        onTutorialAction={handleTutorialAction}
      />

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
