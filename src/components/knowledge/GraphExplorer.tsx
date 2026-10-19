import { useEffect, useId, useMemo, useState } from 'react';
import type { ResearchEvidenceNavigation } from '../repository/types';
import type { GraphData, GraphEntity, GraphEvidence, GraphSource, GraphStatement, ReviewDecision } from './types';
import { GraphNetwork } from './GraphNetwork';
import type { NetworkConnection } from './graphNetworkLayout';
import './GraphExplorer.css';

interface GraphExplorerProps {
  graph: GraphData;
  decisions: ReviewDecision[];
  onReview: (candidateIds: string[], decision: 'accept' | 'reject', rationale: string) => Promise<void>;
  canReview: boolean;
  busy: boolean;
  onOpenResearchEvidence?: (target: Omit<ResearchEvidenceNavigation, 'request_id'>) => void;
}

type Kind = 'concept' | 'relationship' | 'comparison' | 'inference';
type Status = 'pending' | 'included' | 'excluded';
type Origin = 'primary' | 'web';
interface Candidate {
  id: string;
  kind: Kind;
  title: string;
  entity?: GraphEntity;
  statement?: GraphStatement;
  evidenceIds: string[];
  entityIds: string[];
  sourceIds: string[];
}
const PAGE_SIZE = 35;
const CONTEXT_KEYS = ['place_id', 'time_id', 'scheme_id', 'production_case_id', 'case_id'];
const humanize = (value: string) => value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim();
const label = (entity?: GraphEntity) => entity?.label_en || entity?.label_original || 'Unknown concept';
const kindLabel: Record<Kind, string> = { concept: 'Concept', relationship: 'Reported relationship', comparison: 'Proposed comparison', inference: 'Inferred connection' };
const statusLabel: Record<Status, string> = { pending: 'Pending', included: 'Included', excluded: 'Excluded' };

function origin(source?: GraphSource): Origin {
  return source?.origin === 'web' || /web|website|html/.test(source?.source_kind || '') ? 'web' : 'primary';
}

function safeWebUrl(source?: GraphSource): string | null {
  const value = source?.source_url || source?.requested_url || source?.source_locator;
  if (!value) return null;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

function valueLabel(value: unknown, entities: Map<string, GraphEntity>): string {
  if (typeof value === 'string') return entities.has(value) ? label(entities.get(value)) : value;
  if (value === null) return 'Unspecified';
  if (Array.isArray(value)) return value.map(item => valueLabel(item, entities)).join(', ');
  if (typeof value === 'object') return Object.entries(value as Record<string, unknown>)
    .map(([key, item]) => `${humanize(key)}: ${valueLabel(item, entities)}`).join('; ');
  return String(value);
}

function locatorLabel(evidence: GraphEvidence): string {
  const locator = evidence.locator;
  if (typeof locator === 'string') return locator;
  const parts: string[] = [];
  const pageNumber = locator.pdf_page ?? locator.page ?? locator.page_number;
  if (pageNumber !== undefined) parts.push(`Page ${pageNumber}`);
  else if (locator.page_ref) parts.push(String(locator.page_ref).replace(/^page:/i, 'Page '));
  const pointer = locator.json_pointer ?? locator.pointer;
  if (pointer !== undefined) parts.push(`JSON field ${pointer || '(root)'}`);
  const paragraph = locator.paragraph ?? locator.paragraph_number;
  if (paragraph !== undefined) parts.push(`Paragraph ${paragraph}`);
  if (Array.isArray(locator.table_path)) for (const coordinates of locator.table_path) {
    if (coordinates && typeof coordinates === 'object') {
      const table = coordinates as Record<string, unknown>;
      const position = [table.table_index !== undefined ? `Table ${table.table_index}` : '',
        table.row !== undefined ? `row ${table.row}` : '', table.cell !== undefined ? `cell ${table.cell}` : ''].filter(Boolean);
      if (position.length) parts.push(position.join(', '));
    }
  }
  if (locator.table !== undefined) parts.push(`Table ${locator.table}`);
  if (locator.row !== undefined) parts.push(`Row ${locator.row}`);
  if (locator.cell !== undefined) parts.push(`Cell ${locator.cell}`);
  const selector = locator.css_selector ?? locator.selector;
  if (selector) parts.push(`Page element: ${selector}`);
  const block = locator.block ?? locator.block_number;
  if (block !== undefined) parts.push(`Source block ${block}`);
  if (locator.xpath) parts.push(`Document element: ${locator.xpath}`);
  if (!selector && block === undefined && locator.block_id) parts.push(`Source block ID: ${locator.block_id}`);
  if (locator.char_start !== undefined && locator.char_end !== undefined) parts.push(`Characters ${locator.char_start}–${locator.char_end}`);
  if (locator.line_start !== undefined) parts.push(`Line ${locator.line_start}${locator.line_end !== undefined ? `–${locator.line_end}` : ''}`);
  return parts.join(' · ') || humanize(String(locator.kind || 'Saved source passage'));
}

function evidenceTarget(source: GraphSource | undefined, evidence: GraphEvidence): Omit<ResearchEvidenceNavigation, 'request_id'> | null {
  const match = /^workbench:material\/([^/]+)\/file\/[^/]+$/.exec(source?.source_locator || '');
  if (!match) return null;
  const locator = typeof evidence.locator === 'object' ? evidence.locator : {};
  return {
    material_id: match[1], material_title: source?.title, view: 'source',
    page_ref: locator.page_ref ? String(locator.page_ref) : (locator.pdf_page ?? locator.page ?? locator.page_number) === undefined ? null : String(locator.pdf_page ?? locator.page ?? locator.page_number),
    source_locator: locator.source_locator ? String(locator.source_locator) : locatorLabel(evidence), snippet: evidence.text,
  };
}

export function GraphExplorer({ graph, decisions, onReview, canReview, busy, onOpenResearchEvidence }: GraphExplorerProps) {
  const controlId = useId().replace(/:/g, '');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Kind | 'all'>('all');
  const [sourceFilter, setSourceFilter] = useState<Origin | 'all'>('all');
  const [documentSourceFilter, setDocumentSourceFilter] = useState('all');
  const [showInferred, setShowInferred] = useState(true);
  const [statusFilter, setStatusFilter] = useState<Status | 'all'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [connectionPage, setConnectionPage] = useState(0);
  const [rationale, setRationale] = useState('');
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);

  const entities = useMemo(() => new Map(graph.entities.map(entity => [entity.entity_id, entity])), [graph.entities]);
  const sources = useMemo(() => new Map(graph.sources.map(source => [source.source_id, source])), [graph.sources]);
  const evidence = useMemo(() => new Map(graph.evidence.map(item => [item.evidence_id, item])), [graph.evidence]);
  const activeDecisions = useMemo(() => {
    const active = new Map<string, ReviewDecision>();
    for (const decision of [...(graph.read_only ? (graph.origin_decisions || []).filter(item => item.decision === 'reject') : []), ...(decisions.length ? decisions : graph.decisions || [])]) {
      const previous = active.get(decision.candidate_id);
      if (!previous || !decision.at || !previous.at || Date.parse(decision.at) >= Date.parse(previous.at)) active.set(decision.candidate_id, decision);
    }
    return active;
  }, [decisions, graph.decisions, graph.origin_decisions, graph.read_only]);
  const status = (id: string): Status => {
    const decision = activeDecisions.get(id)?.decision;
    return decision === 'accept' ? 'included' : decision === 'reject' ? 'excluded' : 'pending';
  };

  const candidates = useMemo(() => {
    const items: Candidate[] = graph.entities.map(entity => ({
      id: entity.entity_id, kind: 'concept', title: label(entity), entity,
      evidenceIds: entity.evidence_ids, entityIds: [entity.entity_id], sourceIds: [entity.source_id],
    }));
    for (const [kind, rows] of [['relationship', [...graph.assertions, ...(graph.supported_relationships || [])]], ['comparison', graph.alignments], ['inference', graph.inferences || []]] as const) {
      for (const statement of rows) {
        const id = statement.assertion_id || statement.alignment_id || statement.inference_id || statement.candidate_id;
        if (!id) continue;
        const contextIds = CONTEXT_KEYS.map(key => statement.scope?.[key]).filter((item): item is string => typeof item === 'string');
        const entityIds = [...new Set([statement.subject_id, ...(statement.object_id ? [statement.object_id] : []), ...(statement.via_entity_ids || []), ...contextIds])];
        const sourceIds = [...new Set([...(statement.source_id ? [statement.source_id] : []), ...entityIds.map(entityId => entities.get(entityId)?.source_id).filter((item): item is string => Boolean(item))])];
        const end = statement.object_id ? label(entities.get(statement.object_id)) : valueLabel(statement.value, entities);
        const relation = kind === 'comparison' ? 'may correspond to' : ({ possibly_same_concept: 'may refer to the same concept as', aligns_reported_concept_with: 'may correspond to', has_related_concept_context: 'has related name context with', shares_reported_connection: 'shares a reported connection with', shares_quoted_context: 'appears in quoted context with' } as Record<string, string>)[statement.predicate] || humanize(statement.predicate);
        const qualification = kind === 'relationship' && statement.polarity === 'negative' ? 'Negative claim: ' : kind === 'relationship' && statement.polarity === 'uncertain' ? 'Uncertain claim: ' : '';
        items.push({ id, kind, title: `${qualification}${label(entities.get(statement.subject_id))} → ${relation} → ${end}`, statement, evidenceIds: statement.evidence_ids, entityIds, sourceIds });
      }
    }
    return items;
  }, [graph.entities, graph.assertions, graph.supported_relationships, graph.alignments, graph.inferences, entities]);
  const candidateMap = useMemo(() => new Map(candidates.map(candidate => [candidate.id, candidate])), [candidates]);
  // Keep the detail panel useful on first load and when switching graphs.
  const hasActiveFilters = Boolean(query.trim()) || category !== 'all' || sourceFilter !== 'all' || documentSourceFilter !== 'all' || statusFilter !== 'all';
  const selected = candidateMap.get(selectedId || '') || (!hasActiveFilters ? candidates.find(candidate => candidate.kind === 'concept') : undefined);
  const insights = useMemo(() => {
    const connected = new Set<string>();
    const reportedConnected = new Set<string>();
    const inferredConnected = new Set<string>();
    const degree = new Map<string, number>();
    let documentWebLinks = 0;
    let reportedLinks = 0;
    let inferredLinks = 0;
    let comparisonLinks = 0;
    let contextReferences = 0;
    for (const candidate of candidates) {
      const statement = candidate.statement;
      if (!statement) continue;
      contextReferences += CONTEXT_KEYS.filter(key => typeof statement.scope?.[key] === 'string' && entities.has(String(statement.scope[key])) && statement.scope[key] !== statement.subject_id && statement.scope[key] !== statement.object_id).length;
      // A text description and an entity mentioned only in scope are not an
      // entity-to-entity relationship. Connectivity uses exact saved endpoints.
      const subject = entities.get(statement.subject_id);
      const object = entities.get(statement.object_id || '');
      if (!subject || !object) continue;
      for (const id of new Set([subject.entity_id, object.entity_id])) {
        connected.add(id);
        degree.set(id, (degree.get(id) || 0) + 1);
        if (candidate.kind === 'relationship') reportedConnected.add(id);
        if (candidate.kind === 'inference') inferredConnected.add(id);
      }
      if (candidate.kind === 'relationship') reportedLinks++;
      else if (candidate.kind === 'inference') inferredLinks++;
      else if (candidate.kind === 'comparison') comparisonLinks++;
      if (origin(sources.get(subject.source_id)) !== origin(sources.get(object.source_id))) documentWebLinks++;
    }
    const types = new Map<string, number>();
    for (const entity of graph.entities) types.set(entity.entity_type, (types.get(entity.entity_type) || 0) + 1);
    const reviewCounts = { pending: 0, included: 0, excluded: 0 };
    for (const candidate of candidates) {
      const decision = activeDecisions.get(candidate.id)?.decision;
      reviewCounts[decision === 'accept' ? 'included' : decision === 'reject' ? 'excluded' : 'pending']++;
    }
    return {
      connected: connected.size, reportedConnected: reportedConnected.size, inferredConnected: inferredConnected.size,
      reportedLinks, inferredLinks, comparisonLinks, contextReferences,
      isolated: graph.entities.filter(entity => !connected.has(entity.entity_id)),
      documentWebLinks,
      types: [...types].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
      mostConnected: [...degree].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5),
      reviewCounts,
    };
  }, [candidates, entities, sources, graph.entities, activeDecisions]);
  const relatedConnections = selected?.entity ? candidates.filter(candidate => candidate.statement && candidate.entityIds.includes(selected.id)) : [];
  const filtered = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return candidates.filter(candidate => {
      if (candidate.kind === 'inference' && !showInferred) return false;
      if (documentSourceFilter !== 'all' && !candidate.sourceIds.includes(documentSourceFilter)) return false;
      if (category !== 'all' && candidate.kind !== category) return false;
      if (sourceFilter !== 'all' && !candidate.sourceIds.some(id => origin(sources.get(id)) === sourceFilter)) return false;
      const decision = activeDecisions.get(candidate.id)?.decision;
      const itemStatus = decision === 'accept' ? 'included' : decision === 'reject' ? 'excluded' : 'pending';
      if (statusFilter !== 'all' && itemStatus !== statusFilter) return false;
      if (!search) return true;
      const searchable = [candidate.title, candidate.entity?.label_original, candidate.entity?.entity_type,
        candidate.statement?.predicate, ...candidate.sourceIds.map(id => sources.get(id)?.title),
        ...candidate.evidenceIds.map(id => evidence.get(id)?.text)].filter(Boolean).join(' ').toLocaleLowerCase();
      return searchable.includes(search);
    });
  }, [candidates, query, category, sourceFilter, documentSourceFilter, showInferred, statusFilter, sources, evidence, activeDecisions]);
  const selectionOutsideFilters = Boolean(selected && !filtered.some(candidate => candidate.id === selected.id));
  const connectionPages = Math.max(1, Math.ceil(relatedConnections.length / PAGE_SIZE));
  const currentConnectionPage = Math.min(connectionPage, connectionPages - 1);
  useEffect(() => { setPage(0); }, [query, category, sourceFilter, documentSourceFilter, showInferred, statusFilter]);
  useEffect(() => { setRationale(''); setReviewError(null); setConnectionPage(0); }, [selected?.id]);

  const networkEntities = useMemo(() => {
    const matchingIds = new Set(filtered.flatMap(candidate => candidate.entityIds));
    return graph.entities.filter(entity => matchingIds.has(entity.entity_id));
  }, [filtered, graph.entities]);
  const networkConnections = useMemo(() => filtered.filter((candidate): candidate is Candidate & { kind: NetworkConnection['kind']; statement: GraphStatement } => Boolean(candidate.statement) && candidate.kind !== 'concept').map(candidate => ({
    id: candidate.id, title: candidate.title, kind: candidate.kind, statement: candidate.statement,
    excluded: activeDecisions.get(candidate.id)?.decision === 'reject',
  })), [filtered, activeDecisions]);
  const excludedEntityIds = useMemo(() => new Set(graph.entities.filter(entity => activeDecisions.get(entity.entity_id)?.decision === 'reject').map(entity => entity.entity_id)), [graph.entities, activeDecisions]);
  const selectedEvidence = selected?.evidenceIds.map(id => evidence.get(id)).filter((item): item is GraphEvidence => Boolean(item)) || [];
  const parallelStatements = selected?.statement?.object_id ? candidates.filter(candidate => candidate.id !== selected.id && candidate.kind === selected.kind && candidate.statement?.subject_id === selected.statement!.subject_id && candidate.statement.object_id === selected.statement!.object_id && candidate.statement.predicate === selected.statement!.predicate && candidate.statement.polarity === selected.statement!.polarity) : [];
  const dependencies = selected?.statement ? selected.entityIds.map(id => entities.get(id)).filter((item): item is GraphEntity => Boolean(item)) : [];
  const excludedDependencies = dependencies.filter(entity => status(entity.entity_id) === 'excluded');
  const pendingDependencies = dependencies.filter(entity => status(entity.entity_id) === 'pending');
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const reviewBusy = busy || reviewing;

  async function review(decision: 'accept' | 'reject') {
    if (!selected || selected.statement?.derived_from_assertion_id || selected.kind === 'inference' || graph.read_only || !canReview || reviewBusy || !rationale.trim()) return;
    setReviewing(true);
    setReviewError(null);
    try {
      const ids = decision === 'accept' ? [...new Set([selected.id, ...pendingDependencies.map(entity => entity.entity_id)])] : [selected.id];
      await onReview(ids, decision, rationale.trim());
      setRationale('');
    } catch (error) { setReviewError(error instanceof Error ? error.message : 'The review could not be saved. Try again.'); }
    finally { setReviewing(false); }
  }

  return (
    <div className="research-graph-explorer">
      <div className="rge-introduction">
        <h3>Entities and connections</h3>
        <p>Select an entity or connection to inspect its details, linked concepts and supporting quotations in the side panel.</p>
        <div className="rge-metrics" aria-label="Graph totals">
          <span><strong>{graph.sources.length.toLocaleString()}</strong> sources</span>
          <span><strong>{graph.entities.length.toLocaleString()}</strong> concepts</span>
          <span><strong>{graph.assertions.length.toLocaleString()}</strong> reported statements</span>
          <span><strong>{graph.alignments.length.toLocaleString()}</strong> proposed comparisons</span>{(graph.supported_relationships || []).length > 0 && <span><strong>{graph.supported_relationships!.length.toLocaleString()}</strong> recovered source relationships</span>}
          <span><strong>{(graph.inferences || []).length.toLocaleString()}</strong> inferred connections</span>
          {graph.assertions.some(item => !item.object_id) && <span><strong>{graph.assertions.filter(item => !item.object_id).length.toLocaleString()}</strong> text descriptions</span>}
        </div>
      </div>
      {(graph.inferences || []).length > 0 && <p className="rge-inference-notice">Inferred connections are suggestions from labels, quoted context or reported paths. They do not establish identity, causation or historical transmission. {graph.inference_report?.truncated ? 'The suggestion limit was reached; this is a bounded set.' : ''}</p>}
      <div className="rge-filters">
        <label className="rge-search">Search concepts, sources or quotations<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="For example: barkcloth, material or place" /></label>
        {(graph.inferences || []).length > 0 && <label className="rge-inferred-toggle"><input type="checkbox" checked={showInferred} onChange={event => setShowInferred(event.target.checked)} />Show inferred connections</label>}
        <details className="rge-filter-options">
          <summary>Filters{category !== 'all' || sourceFilter !== 'all' || documentSourceFilter !== 'all' || statusFilter !== 'all' ? ' · active' : ''}</summary>
          <div className="rge-filter-controls">
        <label>Show<select value={category} onChange={event => setCategory(event.target.value as Kind | 'all')}><option value="all">All items</option><option value="concept">Concepts</option><option value="relationship">Reported relationships</option><option value="comparison">Proposed comparisons</option><option value="inference">Inferred connections</option></select></label>
        <label>Source<select value={sourceFilter} onChange={event => setSourceFilter(event.target.value as Origin | 'all')}><option value="all">All sources</option><option value="primary">Documents</option><option value="web">Web sources</option></select></label>
        <label>Document or web page<select value={documentSourceFilter} onChange={event => setDocumentSourceFilter(event.target.value)}><option value="all">All source records</option>{graph.sources.map(source => <option value={source.source_id} key={source.source_id}>{source.title || source.source_id}</option>)}</select></label>
        <label>Review<select value={statusFilter} onChange={event => setStatusFilter(event.target.value as Status | 'all')}><option value="all">All decisions</option><option value="pending">Pending</option><option value="included">Included</option><option value="excluded">Excluded</option></select></label>
          </div>
        </details>
      </div>
      <div className="rge-workspace">
      <section className="rge-overview" aria-label="Graph overview and insights">
      <div className="rge-network-panel">
      <div className="rge-network-heading">
        <h4>Connection overview</h4>
        <div className="rge-legend"><span className="rge-solid-line">Reported relationship</span><span className="rge-alignment-line">Concept alignment</span><span className="rge-dashed-line">Proposed comparison</span>{(graph.inferences || []).length > 0 && <span className="rge-inference-line">Inferred connection</span>}<span className="rge-negative-line">Negative claim</span><span className="rge-uncertain-line">Uncertain claim</span><span className="rge-source-line">Source association</span></div>
      </div>
      <GraphNetwork entities={networkEntities} sources={graph.sources} connections={networkConnections} selectedId={selected?.id} selectedEntityIds={!selectionOutsideFilters ? selected?.entityIds || [] : []} excludedEntityIds={excludedEntityIds} onSelect={setSelectedId} />
      </div>
      <section className="rge-insights" aria-labelledby={`${controlId}-insights`}>
        <h4 id={`${controlId}-insights`}>Graph insights</h4>
        <p className="rge-subtle">Counts cover this graph view before search and filters, including pending and excluded items. They describe recorded structure, not extraction completeness.</p>
        <dl className="rge-insight-totals">
          <div><dt>Concepts with reported links</dt><dd>{insights.reportedConnected.toLocaleString()}</dd></div>
          <div><dt>Concepts with inferred links</dt><dd>{insights.inferredConnected.toLocaleString()}</dd></div>
          <div><dt>Concepts with any concept link</dt><dd>{insights.connected.toLocaleString()}</dd></div>
          <div><dt>Concepts without connections</dt><dd>{insights.isolated.length.toLocaleString()}</dd></div>
          <div><dt>Document–web connections</dt><dd>{insights.documentWebLinks.toLocaleString()}</dd></div>
        </dl>
        <p className="rge-subtle">{insights.reportedLinks.toLocaleString()} reported relationship statements · {insights.comparisonLinks.toLocaleString()} proposed comparisons · {insights.inferredLinks.toLocaleString()} inferred statements · {insights.contextReferences.toLocaleString()} exact context references. Text descriptions and context references are counted separately from concept links.</p>
        <div className="rge-type-counts" aria-label="Entity types">{insights.types.map(([type, count]) => <span key={type}>{humanize(type)} <strong>{count.toLocaleString()}</strong></span>)}</div>
        <p className="rge-insight-review"><strong>Review:</strong> {insights.reviewCounts.pending.toLocaleString()} pending · {insights.reviewCounts.included.toLocaleString()} included · {insights.reviewCounts.excluded.toLocaleString()} excluded. Inclusion is a curation decision.</p>
        {insights.mostConnected.length > 0 && <div className="rge-insight-links"><strong>Most connected concepts</strong><div>{insights.mostConnected.map(([id, count]) => <button type="button" key={id} onClick={() => setSelectedId(id)}>{label(entities.get(id))} <span>{count}</span></button>)}</div></div>}
        {insights.isolated.length > 0 && <div className="rge-insight-links"><strong>Without recorded connections{insights.isolated.length > 5 ? ' · first 5' : ''}</strong><div>{insights.isolated.slice(0, 5).map(entity => <button type="button" key={entity.entity_id} onClick={() => setSelectedId(entity.entity_id)}>{label(entity)}</button>)}</div><p className="rge-subtle">Inspect their quotations before proposing a relationship. A shared label alone is not a link.</p></div>}
      </section>
        <details className="rge-candidate-list" aria-label="Searchable graph items" open>
          <summary>Browse entities and connections <span>({filtered.length.toLocaleString()} items)</span></summary>
          {filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE).map(candidate => {
            const blocked = candidate.statement && candidate.entityIds.some(id => status(id) === 'excluded');
            return <button key={candidate.id} type="button" className={`rge-candidate ${selected?.id === candidate.id ? 'rge-candidate-selected' : ''}`} onClick={() => setSelectedId(candidate.id)} aria-pressed={selected?.id === candidate.id}><span className="rge-candidate-kind">{candidate.statement?.derived_from_assertion_id ? 'Recovered source relationship' : kindLabel[candidate.kind]}<span className={`rge-status rge-status-${status(candidate.id)}`}>{statusLabel[status(candidate.id)]}</span></span><strong>{candidate.title}</strong><span className="rge-candidate-source">{candidate.sourceIds.map(id => sources.get(id)?.title || 'Source').join(' · ')}</span>{blocked && <span className="rge-blocked">Excluded from release: a required concept is excluded.</span>}</button>;
          })}
          {!filtered.length && <p className="rge-empty">No matching items. Try a broader search or another filter.</p>}
          {totalPages > 1 && <div className="rge-pagination"><button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</button><span>Page {currentPage + 1} of {totalPages}</span><button type="button" disabled={currentPage >= totalPages - 1} onClick={() => setPage(currentPage + 1)}>Next</button></div>}
        </details>
      </section>
        <aside className="rge-inspector" aria-label="Selected item and source evidence">
          <h4 className="rge-inspector-heading">Entity and connection details</h4>
          {!selected ? <div className="rge-empty-inspector"><h4>Start with a concept or connection</h4><p>Choose an item above or in the list to see its source quotations, context and review decisions.</p><p>Including an item approves its place in this graph. Specialist verification remains a separate research step.</p></div> : <>
            {selectionOutsideFilters && <p className="rge-subtle" role="status">This selected item is outside the current search or filters. Its details stay open; it is not added to the matching graph results.</p>}
            <div className="rge-inspector-top"><span>{selected.statement?.derived_from_assertion_id ? 'Recovered source relationship' : kindLabel[selected.kind]}</span><span className={`rge-status rge-status-${status(selected.id)}`}>{statusLabel[status(selected.id)]}</span></div>
            <h4>{selected.title}</h4>
            {selected.entity && <><p className="rge-subtle">{humanize(selected.entity.entity_type)} · {origin(sources.get(selected.entity.source_id)) === 'web' ? 'Web source account' : 'Document source account'}</p>{selected.entity.label_en && selected.entity.label_en !== selected.entity.label_original && <p className="rge-translation">English label: proposed translation awaiting review.<br />Original label: <span>{selected.entity.label_original}</span></p>}
              <dl className="rge-context"><dt>Source</dt><dd>{sources.get(selected.entity.source_id)?.title || selected.entity.source_id}</dd>{Object.entries(selected.entity.scope || {}).filter(([key]) => key !== 'seed_ids').map(([key, value]) => <div className="rge-context-pair" key={key}><dt>{humanize(key.replace(/_id$/, ''))}</dt><dd>{valueLabel(value, entities)}</dd></div>)}</dl>
              <div className="rge-related"><h5>Connections <span>({relatedConnections.length.toLocaleString()})</span></h5>{relatedConnections.length ? <><div className="rge-related-items">{relatedConnections.slice(currentConnectionPage * PAGE_SIZE, (currentConnectionPage + 1) * PAGE_SIZE).map(candidate => <button type="button" key={candidate.id} onClick={() => setSelectedId(candidate.id)}><span>{candidate.kind === 'inference' ? 'Inferred connection' : candidate.kind === 'comparison' ? 'Proposed comparison' : candidate.statement?.subject_id === selected.id ? 'Outgoing' : candidate.statement?.object_id === selected.id ? 'Incoming' : 'Context'}</span>{candidate.title}<span className={`rge-status rge-status-${status(candidate.id)}`}>{statusLabel[status(candidate.id)]}</span></button>)}</div>{connectionPages > 1 && <div className="rge-pagination"><button type="button" disabled={currentConnectionPage === 0} onClick={() => setConnectionPage(currentConnectionPage - 1)}>Previous</button><span>Page {currentConnectionPage + 1} of {connectionPages}</span><button type="button" disabled={currentConnectionPage >= connectionPages - 1} onClick={() => setConnectionPage(currentConnectionPage + 1)}>Next</button></div>}</> : <p className="rge-subtle">No recorded relationship or comparison refers to this concept in the current graph view.</p>}</div>
            </>}
            {selected.statement && <>
              <dl className="rge-context"><dt>Meaning</dt><dd>{selected.kind === 'inference' ? 'An unverified navigation proposal derived from the cited context or premises; not a source-reported fact.' : selected.kind === 'comparison' ? 'A possible correspondence between two source accounts; the concepts remain separate.' : humanize(selected.statement.epistemic_kind || 'source_report')}</dd><dt>Statement</dt><dd>{selected.kind === 'inference' ? 'Uncertain inferred connection' : selected.kind === 'comparison' ? 'Proposed comparison' : selected.statement.polarity === 'negative' ? 'Negative claim' : selected.statement.polarity === 'uncertain' ? 'Uncertain claim' : 'Affirmative claim'}</dd>{Object.entries(selected.statement.scope || {}).filter(([key]) => key !== 'seed_ids').map(([key, value]) => <div className="rge-context-pair" key={key}><dt>{humanize(key.replace(/_id$/, ''))}</dt><dd>{valueLabel(value, entities)}</dd></div>)}</dl>
              {selected.statement.derived_from_assertion_id && <div className="rge-recovered-notice"><strong>Recovered source relationship</strong><p>This endpoint was resolved from an existing source statement. It retains the original quotation and polarity and awaits review.</p><button type="button" onClick={() => setSelectedId(selected.statement!.derived_from_assertion_id!)}>Inspect original statement</button></div>}
              {selected.statement.rationale && <p className="rge-rationale">{selected.statement.rationale}</p>}
              {parallelStatements.length > 0 && <div className="rge-parallel-statements"><strong>Other statements on this link ({parallelStatements.length})</strong><p>The visual line groups matching endpoints, relation and polarity. Every statement retains its own evidence and review decision.</p>{parallelStatements.map((candidate, index) => <button type="button" key={candidate.id} onClick={() => setSelectedId(candidate.id)}>Statement {index + 1} · {candidate.evidenceIds.length} quotations · {statusLabel[status(candidate.id)]}</button>)}</div>}
              {selected.kind === 'inference' && <div className="rge-inference-premises"><strong>Why this connection was suggested</strong><p>{humanize(selected.statement.rule || 'Evidence context')}</p>{selected.statement.translation_involved && <p>A proposed translation contributes to this match and requires review.</p>}{(selected.statement.premise_ids || []).map(id => { const premise = candidateMap.get(id); return premise ? <button key={id} type="button" onClick={() => setSelectedId(id)}>{premise.title}</button> : <p key={id}>Recorded premise: {id}</p>; })}</div>}
              {dependencies.length > 0 && <div className="rge-dependencies"><strong>Required concepts</strong><div>{dependencies.map(entity => <button type="button" key={entity.entity_id} onClick={() => setSelectedId(entity.entity_id)}>{label(entity)} <span className={`rge-status rge-status-${status(entity.entity_id)}`}>{statusLabel[status(entity.entity_id)]}</span></button>)}</div></div>}
              {excludedDependencies.length > 0 && <p className="rge-blocked">This connection is excluded from releases while a required concept is excluded. Review that concept first.</p>}
            </>}
            <details className="rge-record-provenance"><summary>Original record and provenance</summary><pre>{JSON.stringify(selected.entity || selected.statement, null, 2)}</pre></details>
            <h5>Original source evidence <span>({selectedEvidence.length})</span></h5>
            <p className="rge-subtle">Quotations retain their original language and wording.</p>
            <div className="rge-evidence-list">{selectedEvidence.map(item => {
              const source = sources.get(item.source_id);
              const target = evidenceTarget(source, item);
              const url = safeWebUrl(source);
              return <article key={item.evidence_id} className="rge-evidence"><div className="rge-evidence-origin">{origin(source) === 'web' ? 'Web source' : 'Document'}</div><strong>{source?.title || 'Source'}</strong><p className="rge-evidence-locator">{locatorLabel(item)}</p><blockquote>{item.text}</blockquote>{onOpenResearchEvidence && target && <button type="button" onClick={() => onOpenResearchEvidence(target)}>Open source record</button>}{url && <a href={url} target="_blank" rel="noopener noreferrer">Open web source ↗</a>}<details><summary>Traceability details</summary><dl><dt>Source ID</dt><dd>{item.source_id}</dd><dt>Evidence ID</dt><dd>{item.evidence_id}</dd>{item.source_version_id && <><dt>Source version</dt><dd>{item.source_version_id}</dd></>}</dl><p>The quotation refers to the saved source version; a live page may have changed.</p></details></article>;
            })}</div>
            {!selectedEvidence.length && <p className="rge-blocked">Source quotations are unavailable for this item.</p>}
            <div className="rge-review-actions">
              <h5>Review for graph inclusion</h5><p>Inclusion records a curation decision, not scientific verification.</p>
              {activeDecisions.get(selected.id) && <p className="rge-last-review">Latest decision: {activeDecisions.get(selected.id)?.rationale}</p>}
              {canReview && !graph.read_only && !selected.statement?.derived_from_assertion_id && selected.kind !== 'inference' ? <><label htmlFor={`${controlId}-rationale`}>Reason for this decision<textarea id={`${controlId}-rationale`} value={rationale} onChange={event => setRationale(event.target.value)} placeholder="Explain why the evidence should be included or excluded." rows={3} maxLength={2000} disabled={reviewBusy} /></label>{pendingDependencies.length > 0 && <p className="rge-subtle">Including this connection also includes {pendingDependencies.length} required {pendingDependencies.length === 1 ? 'concept' : 'concepts'} listed above.</p>}<div className="rge-action-buttons"><button type="button" className="rge-include" disabled={reviewBusy || !rationale.trim() || excludedDependencies.length > 0 || !selectedEvidence.length} onClick={() => void review('accept')}>{reviewing ? 'Saving…' : 'Include in graph'}</button><button type="button" className="rge-exclude" disabled={reviewBusy || !rationale.trim()} onClick={() => void review('reject')}>Exclude</button></div></> : <p className="rge-subtle">{selected.statement?.derived_from_assertion_id ? 'Recovered endpoints require specialist review. Review the original source statement in its graph; this derived proposal does not inherit approval.' : graph.read_only ? 'This combined snapshot is read-only. Original source review decisions remain with their graphs; inferred connections require separate specialist review.' : graph.release_kind ? 'This published version is read-only. Start a new graph to make changes.' : 'A reviewer can record inclusion decisions. You can explore all quotations and connections.'}</p>}
              {reviewError && <p role="alert" className="rge-blocked">{reviewError}</p>}
            </div>
          </>}
        </aside>
      </div>
    </div>
  );
}
