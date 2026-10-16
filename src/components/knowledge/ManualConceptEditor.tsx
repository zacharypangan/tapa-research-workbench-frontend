import { useState } from 'react';
import type { AnnotationBatch, OntologySpec } from './types';

interface Props {
  batches: AnnotationBatch[];
  ontology: OntologySpec;
  onSubmit: (batchId: string, response: { entities: Record<string, unknown>[]; assertions: Record<string, unknown>[] }) => Promise<void>;
  busy: boolean;
  sourceLabels?: Record<string, string>;
}

type Concept = {
  local_id: string; entity_type: string; label_original: string;
  scope: Record<string, string>; evidence: Array<{ unit_id: string; quote: string }>;
};
type Relationship = {
  local_id: string; subject: string; predicate: string; object: string;
  scope: Record<string, string>; polarity: string; epistemic_kind: string;
  evidence: Array<{ unit_id: string; quote: string }>; rationale: string;
};
type Draft = { entities: Concept[]; assertions: Relationship[]; nextConcept: number; nextRelationship: number };
type Rule = { subject_types?: string[]; object_types?: string[]; domain?: string[]; range?: string[]; requires_case_scope?: boolean; definition?: string };

const emptyDraft = (): Draft => ({ entities: [], assertions: [], nextConcept: 1, nextRelationship: 1 });
const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm disabled:opacity-50';
const buttonClass = 'rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-40';
const readable = (value: string) => value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').replace(/^./, (letter) => letter.toUpperCase());
const normal = (value: string) => value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}_]+/gu, ' ').trim();
const labelSupported = (label: string, quote: string) => {
  const name = normal(label), text = normal(quote);
  return !!name && (/[\u3400-\u9fff\u3040-\u30ff]/.test(name) ? text.includes(name) : ` ${text} `.includes(` ${name} `));
};
const typeAllowed = (rule: Rule, type: string, side: 'subject' | 'object') =>
  (side === 'subject' ? [rule.subject_types, rule.domain] : [rule.object_types, rule.range])
    .every((constraint) => !constraint?.length || constraint.includes(type));

function passageLabel(unit: AnnotationBatch['units'][number], index: number) {
  if (unit.locator && typeof unit.locator === 'object') {
    const locator = unit.locator as Record<string, unknown>;
    const page = locator.pdf_page ?? locator.page ?? locator.page_number;
    if (page !== undefined) return `Page ${String(page)} · Passage ${index + 1}`;
    const paragraph = locator.paragraph ?? locator.paragraph_number;
    if (paragraph !== undefined) return `Paragraph ${String(paragraph)} · Passage ${index + 1}`;
    if (locator.line_start !== undefined) return `Line ${String(locator.line_start)} · Passage ${index + 1}`;
  }
  return `Passage ${index + 1}`;
}

export default function ManualConceptEditor({ batches, ontology, onSubmit, busy, sourceLabels }: Props) {
  const [batchId, setBatchId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [quote, setQuote] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [conceptType, setConceptType] = useState('Concept');
  const [subjectId, setSubjectId] = useState('');
  const [predicate, setPredicate] = useState('');
  const [objectId, setObjectId] = useState('');
  const [caseId, setCaseId] = useState('');
  const [placeId, setPlaceId] = useState('');
  const [polarity, setPolarity] = useState('positive');
  const [rationale, setRationale] = useState('');
  const [error, setError] = useState('');
  const batch = batches.find((item) => item.batch_id === batchId) ?? batches[0];
  const unit = batch?.units.find((item) => item.unit_id === unitId) ?? batch?.units[0];
  const draft = batch ? drafts[batch.batch_id] ?? emptyDraft() : emptyDraft();
  const types = Object.keys(ontology.entity_types);
  const selectedType = types.includes(conceptType) ? conceptType : types[0] ?? '';
  const supportingQuote = quote ?? unit?.text ?? '';
  const quoteValid = !!unit && !!supportingQuote.trim() && unit.text.includes(supportingQuote);
  const passageConcepts = draft.entities.filter((item) => item.evidence.some((evidence) => evidence.unit_id === unit?.unit_id));
  const subject = passageConcepts.find((item) => item.local_id === subjectId);
  const predicates = Object.entries(ontology.predicates).filter(([, rule]) => subject && typeAllowed(rule, subject.entity_type, 'subject'));
  const rule: Rule | undefined = predicates.find(([key]) => key === predicate)?.[1];
  const objects = passageConcepts.filter((item) => rule && typeAllowed(rule, item.entity_type, 'object'));
  const cases = draft.entities.filter((item) => item.entity_type === 'ProductionCase');
  const places = draft.entities.filter((item) => ['Place', 'FindContext'].includes(item.entity_type));

  const resetEntry = () => {
    setQuote(null); setName(''); setSubjectId(''); setPredicate(''); setObjectId('');
    setCaseId(''); setPlaceId(''); setPolarity('positive'); setRationale(''); setError('');
  };
  const changeDraft = (update: (current: Draft) => Draft) => {
    if (batch) setDrafts((current) => ({ ...current, [batch.batch_id]: update(current[batch.batch_id] ?? emptyDraft()) }));
  };
  const addConcept = () => {
    if (!unit || !quoteValid || !selectedType || !labelSupported(name, supportingQuote)) {
      setError('Use an exact source quote and a concept name that appears in it. Keep the original wording.'); return;
    }
    changeDraft((current) => ({ ...current, nextConcept: current.nextConcept + 1, entities: [...current.entities, {
      local_id: `c${current.nextConcept}`, entity_type: selectedType, label_original: name.trim(), scope: {},
      evidence: [{ unit_id: unit.unit_id, quote: supportingQuote }],
    }] }));
    setName(''); setError('');
  };
  const addRelationship = () => {
    const object = objects.find((item) => item.local_id === objectId);
    if (!unit || !quoteValid || !subject || !rule || !object || !rationale.trim() || (rule.requires_case_scope && !cases.some((item) => item.local_id === caseId))) {
      setError('Choose two concepts from this passage, a relationship, its supporting quote, and a short explanation. Add a production account when required.'); return;
    }
    const scope: Record<string, string> = {};
    if (caseId) scope.case_id = caseId;
    if (placeId) scope.place_id = placeId;
    changeDraft((current) => ({ ...current, nextRelationship: current.nextRelationship + 1, assertions: [...current.assertions, {
      local_id: `r${current.nextRelationship}`, subject: subject.local_id, predicate, object: object.local_id,
      scope, polarity, epistemic_kind: 'source_report', rationale: rationale.trim(),
      evidence: [{ unit_id: unit.unit_id, quote: supportingQuote }],
    }] }));
    setSubjectId(''); setPredicate(''); setObjectId(''); setCaseId(''); setPlaceId(''); setRationale(''); setError('');
  };
  const removeConcept = (id: string) => {
    changeDraft((current) => ({ ...current,
      entities: current.entities.filter((item) => item.local_id !== id),
      assertions: current.assertions.filter((item) => item.subject !== id && item.object !== id && !Object.values(item.scope).includes(id)),
    }));
    if (subjectId === id) { setSubjectId(''); setPredicate(''); setObjectId(''); }
    if (objectId === id) setObjectId('');
    if (caseId === id) setCaseId('');
    if (placeId === id) setPlaceId('');
  };
  const submit = async (empty = false) => {
    if (!batch || busy) return;
    setError('');
    try {
      await onSubmit(batch.batch_id, { entities: empty ? [] : draft.entities.map((item) => ({ ...item })), assertions: empty ? [] : draft.assertions.map((item) => ({ ...item })) });
      changeDraft(() => emptyDraft()); resetEntry();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save this source section.'); }
  };

  if (!batch) return <p className="text-sm text-slate-500">There are no source sections waiting for manual entry.</p>;

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4" aria-label="Add concepts from source">
      <div>
        <h3 className="font-semibold text-slate-900">Add concepts from the source</h3>
        <p className="mt-1 text-sm text-slate-500">Read a passage, highlight its wording, and record concepts and relationships supported by it. Each saved entry keeps its source quote.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm font-medium">Source section
          <select className={inputClass} value={batch.batch_id} disabled={busy} onChange={(event) => { setBatchId(event.target.value); setUnitId(''); resetEntry(); }}>
            {batches.map((item, index) => <option key={item.batch_id} value={item.batch_id}>{sourceLabels?.[item.source_id] ?? `Source ${index + 1}`} · Section {index + 1}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium">Passage
          <select className={inputClass} value={unit?.unit_id ?? ''} disabled={busy} onChange={(event) => { setUnitId(event.target.value); resetEntry(); }}>
            {batch.units.map((item, index) => <option key={item.unit_id} value={item.unit_id}>{passageLabel(item, index)}</option>)}
          </select>
        </label>
      </div>
      <label className="block space-y-1 text-sm font-medium">Original source text
        <textarea className={`${inputClass} min-h-40 font-normal`} readOnly value={unit?.text ?? ''} onSelect={(event) => {
          const target = event.currentTarget;
          if (target.selectionEnd > target.selectionStart) setQuote(target.value.slice(target.selectionStart, target.selectionEnd));
        }} />
      </label>
      <label className="block space-y-1 text-sm font-medium">Supporting quote
        <textarea className={`${inputClass} min-h-20 font-normal`} disabled={busy} value={supportingQuote} onChange={(event) => setQuote(event.target.value)} />
        <span className={`block text-xs ${quoteValid ? 'text-slate-500' : 'text-red-600'}`}>Highlight text above or paste an exact quote. {quoteValid ? 'The quote matches this passage.' : 'The quote must match the source exactly.'}</span>
      </label>
      <div className="space-y-3 border-t border-slate-100 pt-4">
        <h4 className="text-sm font-semibold">1. Add a concept</h4>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm">Name in the original source<input className={inputClass} value={name} disabled={busy} onChange={(event) => setName(event.target.value)} placeholder="A name or phrase in the quote" /></label>
          <label className="space-y-1 text-sm">Type<select className={inputClass} value={selectedType} disabled={busy} onChange={(event) => setConceptType(event.target.value)}>{types.map((type) => <option key={type} value={type}>{readable(type)}</option>)}</select></label>
        </div>
        {typeof ontology.entity_types[selectedType] === 'string' && <p className="text-xs text-slate-500">{String(ontology.entity_types[selectedType])}</p>}
        <button type="button" className={buttonClass} disabled={busy || !name.trim() || !quoteValid} onClick={addConcept}>Add concept</button>
        {draft.entities.length > 0 && <ul className="space-y-1">{draft.entities.map((item) => <li key={item.local_id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm"><span>{item.label_original} <span className="text-slate-500">· {readable(item.entity_type)}</span></span><button type="button" disabled={busy} className="text-xs text-red-700 disabled:opacity-40" onClick={() => removeConcept(item.local_id)} aria-label={`Remove concept ${item.label_original}`}>Remove</button></li>)}</ul>}
      </div>
      {draft.entities.length > 0 && <div className="space-y-3 border-t border-slate-100 pt-4">
        <h4 className="text-sm font-semibold">2. Add a relationship, if the source states one</h4>
        <p className="text-xs text-slate-500">Choose concepts from this passage. The quote must support the relationship; sharing a topic is not enough.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="space-y-1 text-sm">From<select className={inputClass} disabled={busy} value={subjectId} onChange={(event) => { setSubjectId(event.target.value); setPredicate(''); setObjectId(''); }}><option value="">Choose a concept</option>{passageConcepts.map((item) => <option key={item.local_id} value={item.local_id}>{item.label_original}</option>)}</select></label>
          <label className="space-y-1 text-sm">Relationship<select className={inputClass} disabled={busy || !subject} value={predicate} onChange={(event) => { setPredicate(event.target.value); setObjectId(''); }}><option value="">Choose a relationship</option>{predicates.map(([key]) => <option key={key} value={key}>{readable(key)}</option>)}</select></label>
          <label className="space-y-1 text-sm">To<select className={inputClass} disabled={busy || !rule} value={objectId} onChange={(event) => setObjectId(event.target.value)}><option value="">Choose a concept</option>{objects.map((item) => <option key={item.local_id} value={item.local_id}>{item.label_original}</option>)}</select></label>
        </div>
        {rule?.definition && <p className="text-xs text-slate-500">{rule.definition}</p>}
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="space-y-1 text-sm">Source wording<select className={inputClass} value={polarity} disabled={busy} onChange={(event) => setPolarity(event.target.value)}><option value="positive">States the relationship</option><option value="negative">Denies the relationship</option><option value="uncertain">Expresses uncertainty</option></select></label>
          <label className="space-y-1 text-sm">Production account {rule?.requires_case_scope ? '(required)' : '(optional)'}<select className={inputClass} disabled={busy} value={caseId} onChange={(event) => setCaseId(event.target.value)}><option value="">Choose only if documented</option>{cases.map((item) => <option key={item.local_id} value={item.local_id}>{item.label_original}</option>)}</select></label>
          <label className="space-y-1 text-sm">Place or find context (optional)<select className={inputClass} disabled={busy} value={placeId} onChange={(event) => setPlaceId(event.target.value)}><option value="">Choose only if documented</option>{places.map((item) => <option key={item.local_id} value={item.local_id}>{item.label_original}</option>)}</select></label>
        </div>
        {rule?.requires_case_scope && cases.length === 0 && <p className="text-xs text-amber-700">First add the documented production account as a concept with type Production case.</p>}
        <label className="block space-y-1 text-sm">Why this quote supports the relationship<textarea className={inputClass} value={rationale} disabled={busy} onChange={(event) => setRationale(event.target.value)} placeholder="Describe the source wording that connects these concepts." /></label>
        <button type="button" className={buttonClass} disabled={busy || !subject || !rule || !objectId || !quoteValid || !rationale.trim()} onClick={addRelationship}>Add relationship</button>
        {draft.assertions.length > 0 && <ul className="space-y-1">{draft.assertions.map((item) => <li key={item.local_id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm"><span>{draft.entities.find((entity) => entity.local_id === item.subject)?.label_original} → {readable(item.predicate)} → {draft.entities.find((entity) => entity.local_id === item.object)?.label_original} <span className="text-slate-500">· {item.polarity === 'negative' ? 'Denied' : item.polarity === 'uncertain' ? 'Uncertain' : 'Stated'}</span></span><button type="button" disabled={busy} className="text-xs text-red-700 disabled:opacity-40" onClick={() => changeDraft((current) => ({ ...current, assertions: current.assertions.filter((link) => link.local_id !== item.local_id) }))} aria-label="Remove relationship">Remove</button></li>)}</ul>}
      </div>}
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
        <button type="button" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40" disabled={busy || draft.entities.length === 0} onClick={() => void submit()}>{busy ? 'Saving…' : 'Save this source section'}</button>
        <button type="button" className={buttonClass} disabled={busy || draft.entities.length > 0} onClick={() => void submit(true)}>No supported concepts in this section</button>
        <span className="text-xs text-slate-500">Entries still need evidence review before publication.</span>
      </div>
    </section>
  );
}
