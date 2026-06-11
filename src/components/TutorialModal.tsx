import { useEffect, useMemo, useState } from 'react';

type TutorialStep = {
  title: string;
  body: string;
  target: string;
  checklist?: string[];
  trustNote?: string;
};

interface TutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  onTargetChange: (target: string | null) => void;
}

export default function TutorialModal({
  isOpen,
  onClose,
  onComplete,
  onTargetChange,
}: TutorialModalProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [disableAutoStart, setDisableAutoStart] = useState(
    () => localStorage.getItem('tapa-workbench:tutorial-autostart-disabled') === 'true',
  );

  const steps: TutorialStep[] = useMemo(
    () => [
      {
        title: 'Welcome to Research Workbench',
        target: 'workbench',
        body: 'Research Workbench is a shared evidence workspace for collecting source files, cleaning metadata, extracting text and images, marking observations, searching the corpus, and generating review reports.',
        checklist: ['Build a source library', 'Keep observations tied to evidence', 'Move from exact search to assisted review when local AI is ready'],
      },
      {
        title: 'Upload files first',
        target: 'upload',
        body: 'Start by uploading PDFs, text files, or images. Each upload creates or attaches evidence to a material record so the source can be extracted, searched, annotated, and included in reports.',
        checklist: ['Use Upload for files', 'Use Add Link later when the source is a URL', 'Select the material after upload to review details'],
      },
      {
        title: 'Complete the metadata',
        target: 'metadata',
        body: 'Use the metadata panel to clean up the record: title, authors, year, source type, status, language, region, keywords, raw reference, and collection notes. Save after each meaningful change.',
        checklist: ['Set status for your review queue', 'Add human-reviewed keywords', 'Keep collection notes descriptive'],
      },
      {
        title: 'Extract evidence',
        target: 'extraction',
        body: 'Run Extract after files or links are attached. Extraction creates text segments, discovered links, image evidence, OCR/captions, and run history. Use View Text / Links / Observations to inspect the result.',
      },
      {
        title: 'Open annotation workspace',
        target: 'content-button',
        body: 'Use Content to open the extracted source workspace for the selected material. This is where source text, images, links, observations, and extraction runs stay together.',
      },
      {
        title: 'Observe text evidence',
        target: 'text-observations',
        body: 'In the Text tab, select a word or phrase from a source segment, then use Mark Observation. The workbench carries over the quote, page reference, and source locator so the observation stays tied to evidence.',
        checklist: ['Capture what appears in the source', 'Choose term, motif, place, material, process, or other', 'Keep interpretation separate from observation notes'],
      },
      {
        title: 'Save the text observation',
        target: 'observation-save',
        body: 'After Mark Observation opens the form, review the carried-over quote, page reference, source locator, and observation type. Add notes if needed, then use Save Observation.',
        checklist: ['Confirm observed text', 'Choose the right capture type', 'Save the observation before moving on'],
      },
      {
        title: 'Observe image evidence',
        target: 'image-observations',
        body: 'The walkthrough opens the Images tab for you. Review extracted images, OCR text, and vision captions, then use Mark Image Observation for visible motifs, tools, materials, places, or process evidence.',
      },
      {
        title: 'Save the image observation',
        target: 'observation-save',
        body: 'After Mark Image Observation opens the form, review the image-linked evidence and notes, then save it. Image observations are kept separate from text observations but remain attached to the same material.',
        checklist: ['Check image source context', 'Add descriptive notes only', 'Save the observation'],
      },
      {
        title: 'Use exact corpus search',
        target: 'exact-search',
        body: 'Search Corpus performs exact text search across extracted source text. Use Search for quick review, and use Report beside it when you need a downloadable context report with matching passages.',
      },
      {
        title: 'Run assisted review',
        target: 'assisted-review',
        body: 'Find Related References discovers semantically similar passages and images. Organize References groups evidence into review-ready themes. Process References answers a specific query using cited source passages.',
        checklist: ['Relationship: how two terms or practices connect', 'Compare: how sources differ', 'Process: steps or production context', 'Evidence Gap: what is well supported or missing'],
        trustNote: 'Treat AI outputs as review aids. Check claims against the cited passages and images before using them in analysis or presentation materials.',
      },
    ],
    [],
  );

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
      if (event.key === 'ArrowLeft') setStepIndex((current) => Math.max(0, current - 1));
      if (event.key === 'ArrowRight') setStepIndex((current) => Math.min(steps.length - 1, current + 1));
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, steps.length]);

  useEffect(() => {
    if (!isOpen) return;
    const handleTutorialAction = (event: Event) => {
      const target = (event as CustomEvent<{ target?: string }>).detail?.target;
      if (!target || target !== steps[stepIndex]?.target) return;
      setStepIndex((current) => Math.min(steps.length - 1, current + 1));
    };
    window.addEventListener('tapa-workbench:tutorial-action', handleTutorialAction);
    return () => window.removeEventListener('tapa-workbench:tutorial-action', handleTutorialAction);
  }, [isOpen, stepIndex, steps]);

  useEffect(() => {
    if (!isOpen) {
      onTargetChange(null);
      return;
    }
    const target = steps[stepIndex]?.target ?? null;
    if (target === 'image-observations') {
      clickTutorialTarget('image-tab')();
    }
    if (target === 'exact-search') {
      clickTutorialTarget('close-annotation')();
    }
    onTargetChange(target);
  }, [isOpen, onTargetChange, stepIndex, steps]);

  useEffect(() => {
    localStorage.setItem('tapa-workbench:tutorial-autostart-disabled', disableAutoStart ? 'true' : 'false');
  }, [disableAutoStart]);

  const close = () => {
    onTargetChange(null);
    onClose();
  };

  const finish = () => {
    localStorage.setItem('tapa-workbench:tutorial-completed', 'true');
    localStorage.setItem('tapa-workbench:tutorial-version', '2');
    onTargetChange(null);
    onComplete();
  };

  function clickTutorialTarget(target: string) {
    return () => {
      const element = document.querySelector<HTMLElement>(`[data-tutorial-target="${target}"]`);
      element?.click();
    };
  }

  if (!isOpen) return null;

  const step = steps[stepIndex];
  const isLastStep = stepIndex === steps.length - 1;
  const countedSteps = steps.slice(1);
  const countedStepIndex = stepIndex - 1;
  const panelPositionClass = ['metadata', 'extraction', 'text-observations'].includes(step.target)
    ? 'left-4 top-20'
    : 'right-4 top-20';

  return (
    <>
      <section
        className={`pointer-events-auto fixed ${panelPositionClass} z-[95] w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900 shadow-2xl`}
        role="dialog"
        aria-modal="false"
        aria-labelledby="tutorial-title"
      >
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-blue-700">
                {stepIndex === 0
                  ? 'Workbench walkthrough'
                  : `Workbench walkthrough ${countedStepIndex + 1} of ${countedSteps.length}`}
              </div>
              <h2 id="tutorial-title" className="mt-1 text-base font-black leading-tight text-slate-900">
                {step.title}
              </h2>
            </div>
            <button
              type="button"
              onClick={close}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              title="Close walkthrough"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="mt-3 grid gap-1" style={{ gridTemplateColumns: `repeat(${countedSteps.length}, minmax(0, 1fr))` }}>
            {countedSteps.map((_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setStepIndex(index + 1)}
                className={`h-1.5 rounded-full transition ${index <= countedStepIndex ? 'bg-blue-600' : 'bg-slate-200'}`}
                title={`Go to step ${index + 1}`}
              />
            ))}
          </div>
        </div>

        <div className="max-h-[calc(100vh-15rem)] space-y-3 overflow-auto px-4 py-4">
          <p className="text-sm leading-relaxed text-slate-600">{step.body}</p>

          {step.checklist && (
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Look For</div>
              <div className="space-y-1.5">
                {step.checklist.map((item) => (
                  <div key={item} className="flex items-start gap-2 text-xs font-semibold leading-relaxed text-slate-700">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[9px] text-blue-700">✓</span>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          )}

          {step.trustNote && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
              {step.trustNote}
            </div>
          )}

        </div>

        <div className="space-y-3 border-t border-slate-200 bg-white/90 px-4 py-3">
          <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
            <input
              type="checkbox"
              checked={disableAutoStart}
              onChange={(event) => setDisableAutoStart(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Do not start with this again
          </label>
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={finish}
              className="text-xs font-black uppercase tracking-wider text-slate-400 hover:text-slate-700"
            >
              Finish
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
                disabled={stepIndex === 0}
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50 disabled:opacity-30"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => (isLastStep ? finish() : setStepIndex((current) => current + 1))}
                className="h-9 rounded-lg bg-slate-900 px-3 text-xs font-black uppercase tracking-wider text-white hover:bg-slate-800"
              >
                {isLastStep ? 'Finish' : 'Next'}
              </button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
