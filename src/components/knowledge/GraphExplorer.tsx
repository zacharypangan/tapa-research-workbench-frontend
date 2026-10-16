import { useEffect, useId, useMemo, useState } from 'react';
import type { ResearchEvidenceNavigation } from '../repository/types';
import type { GraphData, GraphEntity, GraphEvidence, GraphSource, GraphStatement, ReviewDecision } from './types';
import './GraphExplorer.css';

interface GraphExplorerProps {
  graph: GraphData;
  decisions: ReviewDecision[];
  onReview: (candidateIds: string[], decision: 'accept' | 'reject', rationale: string) => Promise<void>;
  canReview: boolean;
  busy: boolean;
  onOpenResearchEvidence?: (target: Omit<ResearchEvidenceNavigation, 'request_id'>) => void;
}

type Kind = 'concept' | 'relationship' | 'comparison';
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
interface GraphPoint { x: number; y: number }
interface ConnectionGeometry { path: string; anchor: GraphPoint }

const MAX_NODES = 80;
const MAX_CONNECTIONS = 160;
const PAGE_SIZE = 35;
const CONTEXT_KEYS = ['place_id', 'time_id', 'scheme_id', 'production_case_id', 'case_id'];
const humanize = (value: string) => value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim();
const label = (entity?: GraphEntity) => entity?.label_en || entity?.label_original || 'Unknown concept';
const short = (value: string, length = 23) => value.length > length ? `${value.slice(0, length - 1)}…` : value;
const kindLabel: Record<Kind, string> = { concept: 'Concept', relationship: 'Reported relationship', comparison: 'Proposed comparison' };
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
    material_id: match[1], material_title: source?.title, view: 'segments',
    page_ref: (locator.pdf_page ?? locator.page ?? locator.page_number) === undefined ? null : String(locator.pdf_page ?? locator.page ?? locator.page_number),
    source_locator: locatorLabel(evidence), snippet: evidence.text,
  };
}

function connectionGeometry(start: GraphPoint, end: GraphPoint, anchor: GraphPoint): ConnectionGeometry {
  if (start.x === end.x && start.y === end.y) {
    const shift = (anchor.x - start.x) * 4 / 3;
    const top = start.y + (anchor.y - start.y) * 4 / 3;
    return { anchor, path: `M ${start.x + 54} ${start.y} C ${start.x + 90 + shift} ${top} ${start.x - 90 + shift} ${top} ${start.x - 54} ${start.y}` };
  }
  const initialControl = { x: 2 * anchor.x - (start.x + end.x) / 2, y: 2 * anchor.y - (start.y + end.y) / 2 };
  const boundary = (point: GraphPoint) => {
    const dx = initialControl.x - point.x;
    const dy = initialControl.y - point.y;
    const scale = Math.min(dx ? 54 / Math.abs(dx) : Infinity, dy ? 23 / Math.abs(dy) : Infinity);
    return Number.isFinite(scale) ? { x: point.x + dx * scale, y: point.y + dy * scale } : point;
  };
  const first = boundary(start);
  const last = boundary(end);
  // The quadratic curve passes exactly through its selectable midpoint.
  const control = { x: 2 * anchor.x - (first.x + last.x) / 2, y: 2 * anchor.y - (first.y + last.y) / 2 };
  return { anchor, path: `M ${first.x} ${first.y} Q ${control.x} ${control.y} ${last.x} ${last.y}` };
}

function findConnectionAnchor(base: GraphPoint, occupied: GraphPoint[], nodes: GraphPoint[], height: number): GraphPoint {
  // Reserve separate targets outside concept cards; crossing lines can still be
  // selected without relying on a curved SVG group's bounding-box centre.
  for (let ring = 0; ring < 65; ring++) for (let dx = -ring; dx <= ring; dx++) {
    const dy = ring - Math.abs(dx);
    for (const signedY of dy ? [-dy, dy] : [0]) {
      const point = { x: base.x + dx * 18, y: base.y + signedY * 18 };
      if (point.x < 16 || point.x > 984 || point.y < 45 || point.y > height - 15) continue;
      if (occupied.some(other => Math.hypot(point.x - other.x, point.y - other.y) < 22)) continue;
      if (nodes.some(node => Math.abs(point.x - node.x) < 62 && Math.abs(point.y - node.y) < 29)) continue;
      return point;
    }
  }
  return base;
}

export function GraphExplorer({ graph, decisions, onReview, canReview, busy, onOpenResearchEvidence }: GraphExplorerProps) {
  const controlId = useId().replace(/:/g, '');
  const arrowId = `${controlId}-arrow`;
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Kind | 'all'>('all');
  const [sourceFilter, setSourceFilter] = useState<Origin | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<Status | 'all'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rationale, setRationale] = useState('');
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);

  const entities = useMemo(() => new Map(graph.entities.map(entity => [entity.entity_id, entity])), [graph.entities]);
  const sources = useMemo(() => new Map(graph.sources.map(source => [source.source_id, source])), [graph.sources]);
  const evidence = useMemo(() => new Map(graph.evidence.map(item => [item.evidence_id, item])), [graph.evidence]);
  const activeDecisions = useMemo(() => {
    const active = new Map<string, ReviewDecision>();
    for (const decision of decisions.length ? decisions : graph.decisions || []) {
      const previous = active.get(decision.candidate_id);
      if (!previous || !decision.at || !previous.at || Date.parse(decision.at) >= Date.parse(previous.at)) active.set(decision.candidate_id, decision);
    }
    return active;
  }, [decisions, graph.decisions]);
  const status = (id: string): Status => {
    const decision = activeDecisions.get(id)?.decision;
    return decision === 'accept' ? 'included' : decision === 'reject' ? 'excluded' : 'pending';
  };

  const candidates = useMemo(() => {
    const items: Candidate[] = graph.entities.map(entity => ({
      id: entity.entity_id, kind: 'concept', title: label(entity), entity,
      evidenceIds: entity.evidence_ids, entityIds: [entity.entity_id], sourceIds: [entity.source_id],
    }));
    for (const [kind, rows] of [['relationship', graph.assertions], ['comparison', graph.alignments]] as const) {
      for (const statement of rows) {
        const id = statement.assertion_id || statement.alignment_id || statement.candidate_id;
        if (!id) continue;
        const contextIds = CONTEXT_KEYS.map(key => statement.scope?.[key]).filter((item): item is string => typeof item === 'string');
        const entityIds = [...new Set([statement.subject_id, ...(statement.object_id ? [statement.object_id] : []), ...contextIds])];
        const sourceIds = [...new Set([...(statement.source_id ? [statement.source_id] : []), ...entityIds.map(entityId => entities.get(entityId)?.source_id).filter((item): item is string => Boolean(item))])];
        const end = statement.object_id ? label(entities.get(statement.object_id)) : valueLabel(statement.value, entities);
        const relation = kind === 'comparison' ? 'may correspond to' : humanize(statement.predicate);
        const qualification = kind === 'relationship' && statement.polarity === 'negative' ? 'Negative claim: ' : kind === 'relationship' && statement.polarity === 'uncertain' ? 'Uncertain claim: ' : '';
        items.push({ id, kind, title: `${qualification}${label(entities.get(statement.subject_id))} → ${relation} → ${end}`, statement, evidenceIds: statement.evidence_ids, entityIds, sourceIds });
      }
    }
    return items;
  }, [graph.entities, graph.assertions, graph.alignments, entities]);
  const candidateMap = useMemo(() => new Map(candidates.map(candidate => [candidate.id, candidate])), [candidates]);
  const selected = selectedId ? candidateMap.get(selectedId) : undefined;
  const filtered = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return candidates.filter(candidate => {
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
  }, [candidates, query, category, sourceFilter, statusFilter, sources, evidence, activeDecisions]);
  useEffect(() => { setPage(0); }, [query, category, sourceFilter, statusFilter]);
  useEffect(() => { setRationale(''); setReviewError(null); }, [selectedId]);

  const network = useMemo(() => {
    const focusedIds = new Set(selected?.entityIds || []);
    const relatedIds = new Set(filtered.flatMap(candidate => candidate.entityIds));
    for (const id of focusedIds) relatedIds.add(id);
    const connections = filtered.filter(candidate => candidate.statement?.object_id);
    const degree = new Map<string, number>();
    for (const candidate of connections) for (const id of candidate.entityIds) degree.set(id, (degree.get(id) || 0) + 1);
    const pool = graph.entities.filter(entity => relatedIds.has(entity.entity_id)).sort((a, b) =>
      (degree.get(b.entity_id) || 0) - (degree.get(a.entity_id) || 0) || label(a).localeCompare(label(b)) || a.entity_id.localeCompare(b.entity_id));
    const initialNodes = pool.slice(0, MAX_NODES);
    const visibleIds = new Set(initialNodes.map(entity => entity.entity_id));
    const extraFocused = pool.filter(entity => focusedIds.has(entity.entity_id) && !visibleIds.has(entity.entity_id));
    // Keep the layout fixed when selecting already visible items. Only bring
    // off-screen selected concepts into the bounded overview when needed.
    const nodes = [...initialNodes.slice(0, MAX_NODES - extraFocused.length), ...extraFocused];
    const primary = nodes.filter(entity => origin(sources.get(entity.source_id)) === 'primary');
    const web = nodes.filter(entity => origin(sources.get(entity.source_id)) === 'web');
    const positions = new Map<string, GraphPoint>();
    for (const [lane, list] of [primary, web].entries()) list.forEach((entity, index) => positions.set(entity.entity_id, { x: 66 + lane * 506 + (index % 4) * 120, y: 76 + Math.floor(index / 4) * 66 }));
    const matchingEdges = connections.filter(candidate => positions.has(candidate.statement!.subject_id) && positions.has(candidate.statement!.object_id!));
    const edges = [...matchingEdges].sort((a, b) => Number(b.kind === 'comparison') - Number(a.kind === 'comparison') || a.id.localeCompare(b.id)).slice(0, MAX_CONNECTIONS);
    if (selected?.statement?.object_id && !edges.some(candidate => candidate.id === selected.id)) {
      const selectedEdge = matchingEdges.find(candidate => candidate.id === selected.id);
      if (selectedEdge) { if (edges.length === MAX_CONNECTIONS) edges.pop(); edges.push(selectedEdge); }
    }
    const height = Math.max(245, 125 + Math.ceil(Math.max(primary.length, web.length) / 4) * 66);
    const geometries = new Map<string, ConnectionGeometry>();
    const occupied: GraphPoint[] = [];
    const nodePoints = [...positions.values()];
    for (const candidate of [...edges].sort((a, b) => a.id.localeCompare(b.id))) {
      const start = positions.get(candidate.statement!.subject_id)!;
      const end = positions.get(candidate.statement!.object_id!)!;
      const base = { x: (start.x + end.x) / 2, y: start.y === end.y ? start.y - 32 : (start.y + end.y) / 2 };
      const anchor = findConnectionAnchor(base, occupied, nodePoints, height);
      occupied.push(anchor);
      geometries.set(candidate.id, connectionGeometry(start, end, anchor));
    }
    return { nodes, positions, edges, geometries, total: pool.length, totalConnections: matchingEdges.length, height };
  }, [filtered, selected, graph.entities, sources]);
  const selectedEvidence = selected?.evidenceIds.map(id => evidence.get(id)).filter((item): item is GraphEvidence => Boolean(item)) || [];
  const dependencies = selected?.statement ? selected.entityIds.map(id => entities.get(id)).filter((item): item is GraphEntity => Boolean(item)) : [];
  const excludedDependencies = dependencies.filter(entity => status(entity.entity_id) === 'excluded');
  const pendingDependencies = dependencies.filter(entity => status(entity.entity_id) === 'pending');
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const reviewBusy = busy || reviewing;

  async function review(decision: 'accept' | 'reject') {
    if (!selected || !canReview || reviewBusy || !rationale.trim()) return;
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
        <h3>Explore the evidence</h3>
        <p>Each concept belongs to its source. Reported relationships show what a source says; proposed comparisons connect related document and web concepts for review.</p>
        <div className="rge-metrics" aria-label="Graph totals">
          <span><strong>{graph.sources.length.toLocaleString()}</strong> sources</span>
          <span><strong>{graph.entities.length.toLocaleString()}</strong> concepts</span>
          <span><strong>{graph.assertions.length.toLocaleString()}</strong> reported relationships</span>
          <span><strong>{graph.alignments.length.toLocaleString()}</strong> proposed comparisons</span>
        </div>
      </div>
      <div className="rge-filters">
        <label className="rge-search">Search concepts, sources or quotations<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="For example: barkcloth, material or place" /></label>
        <label>Show<select value={category} onChange={event => setCategory(event.target.value as Kind | 'all')}><option value="all">All items</option><option value="concept">Concepts</option><option value="relationship">Reported relationships</option><option value="comparison">Proposed comparisons</option></select></label>
        <label>Source<select value={sourceFilter} onChange={event => setSourceFilter(event.target.value as Origin | 'all')}><option value="all">All sources</option><option value="primary">Documents</option><option value="web">Web sources</option></select></label>
        <label>Review<select value={statusFilter} onChange={event => setStatusFilter(event.target.value as Status | 'all')}><option value="all">All decisions</option><option value="pending">Pending</option><option value="included">Included</option><option value="excluded">Excluded</option></select></label>
      </div>
      <div className="rge-network-heading">
        <h4>Connection overview</h4>
        <div className="rge-legend"><span className="rge-primary-dot">Document concept</span><span className="rge-web-dot">Web concept</span><span className="rge-solid-line">Reported relationship</span><span className="rge-dashed-line">Proposed comparison</span></div>
      </div>
      {network.nodes.length ? (
        <div className="rge-network-scroll">
          <svg className="rge-network" viewBox={`0 0 1000 ${network.height}`} role="group" aria-label="Interactive graph overview. Choose a concept or connection to inspect its evidence.">
            <defs><marker id={arrowId} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto-start-reverse"><path d="M 0 0 L 7 3.5 L 0 7 z" fill="#64748b" /></marker></defs>
            <text x="20" y="28" className="rge-lane-label">DOCUMENTS</text><text x="526" y="28" className="rge-lane-label">WEB SOURCES</text>
            <line x1="500" y1="12" x2="500" y2={network.height - 10} stroke="#e2e8f0" />
            {network.edges.map(candidate => <g key={candidate.id} onClick={() => setSelectedId(candidate.id)} className={`rge-edge ${candidate.kind === 'comparison' ? 'rge-edge-comparison' : ''} ${status(candidate.id) === 'excluded' ? 'rge-edge-excluded' : ''} ${selectedId === candidate.id ? 'rge-edge-selected' : ''}`}><title>{candidate.title}</title><path d={network.geometries.get(candidate.id)!.path} className="rge-edge-hit" /><path d={network.geometries.get(candidate.id)!.path} className="rge-edge-visible" markerEnd={candidate.kind === 'relationship' ? `url(#${arrowId})` : undefined} /></g>)}
            {network.nodes.map(entity => {
              const point = network.positions.get(entity.entity_id)!;
              const selectedNode = selected?.entityIds.includes(entity.entity_id);
              return <g key={entity.entity_id} transform={`translate(${point.x},${point.y})`} role="button" tabIndex={0} aria-label={`${label(entity)}. ${humanize(entity.entity_type)}. ${sources.get(entity.source_id)?.title || 'Source'}. ${statusLabel[status(entity.entity_id)]}.`} onClick={() => setSelectedId(entity.entity_id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedId(entity.entity_id); } }} className={`rge-node rge-node-${origin(sources.get(entity.source_id))} ${selectedNode ? 'rge-node-selected' : ''} ${status(entity.entity_id) === 'excluded' ? 'rge-node-excluded' : ''}`}><title>{`${label(entity)} · ${sources.get(entity.source_id)?.title || 'Source'}`}</title><rect x="-53" y="-21" width="106" height="42" rx="8" /><text y="-2" textAnchor="middle">{short(label(entity), 18)}</text><text y="13" textAnchor="middle" className="rge-node-type">{short(humanize(entity.entity_type), 19)}</text></g>;
            })}
            {network.edges.map(candidate => {
              const anchor = network.geometries.get(candidate.id)!.anchor;
              return <circle key={candidate.id} cx={anchor.x} cy={anchor.y} r="7" role="button" tabIndex={0} aria-label={`${kindLabel[candidate.kind]}: ${candidate.title}`} onClick={() => setSelectedId(candidate.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedId(candidate.id); } }} className={`rge-connection-target ${candidate.kind === 'comparison' ? 'rge-connection-target-comparison' : ''} ${selectedId === candidate.id ? 'rge-connection-target-selected' : ''}`}><title>{`${kindLabel[candidate.kind]}: ${candidate.title}`}</title></circle>;
            })}
          </svg>
        </div>
      ) : <p className="rge-empty">No concepts match these filters.</p>}
      <p className="rge-caption">Showing {network.nodes.length.toLocaleString()} of {network.total.toLocaleString()} matching concepts and {network.edges.length.toLocaleString()} of {network.totalConnections.toLocaleString()} connections between them. {network.total > MAX_NODES || network.totalConnections > MAX_CONNECTIONS ? 'The overview prioritizes connected concepts and cross-source comparisons; the searchable list contains every matching item. ' : ''}Original source accounts remain separate. Select a concept or a small circle on a connection to read its evidence.</p>
      <div className="rge-review-grid">
        <section className="rge-candidate-list" aria-label="Searchable graph items">
          <h4>{filtered.length.toLocaleString()} matching items</h4>
          {filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE).map(candidate => {
            const blocked = candidate.statement && candidate.entityIds.some(id => status(id) === 'excluded');
            return <button key={candidate.id} type="button" className={`rge-candidate ${selectedId === candidate.id ? 'rge-candidate-selected' : ''}`} onClick={() => setSelectedId(candidate.id)} aria-pressed={selectedId === candidate.id}><span className="rge-candidate-kind">{kindLabel[candidate.kind]}<span className={`rge-status rge-status-${status(candidate.id)}`}>{statusLabel[status(candidate.id)]}</span></span><strong>{candidate.title}</strong><span className="rge-candidate-source">{candidate.sourceIds.map(id => sources.get(id)?.title || 'Source').join(' · ')}</span>{blocked && <span className="rge-blocked">Excluded from release: a required concept is excluded.</span>}</button>;
          })}
          {!filtered.length && <p className="rge-empty">No matching items. Try a broader search or another filter.</p>}
          {totalPages > 1 && <div className="rge-pagination"><button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</button><span>Page {currentPage + 1} of {totalPages}</span><button type="button" disabled={currentPage >= totalPages - 1} onClick={() => setPage(currentPage + 1)}>Next</button></div>}
        </section>
        <aside className="rge-inspector" aria-label="Selected item and source evidence">
          {!selected ? <div className="rge-empty-inspector"><h4>Start with a concept or connection</h4><p>Choose an item above or in the list to see its source quotations, context and review decisions.</p><p>Including an item approves its place in this graph. Specialist verification remains a separate research step.</p></div> : <>
            <div className="rge-inspector-top"><span>{kindLabel[selected.kind]}</span><span className={`rge-status rge-status-${status(selected.id)}`}>{statusLabel[status(selected.id)]}</span></div>
            <h4>{selected.title}</h4>
            {selected.entity && <><p className="rge-subtle">{humanize(selected.entity.entity_type)} · {origin(sources.get(selected.entity.source_id)) === 'web' ? 'Web source account' : 'Document source account'}</p>{selected.entity.label_en && selected.entity.label_en !== selected.entity.label_original && <p className="rge-translation">English label: proposed translation awaiting review.<br />Original label: <span>{selected.entity.label_original}</span></p>}</>}
            {selected.statement && <>
              <dl className="rge-context"><dt>Meaning</dt><dd>{selected.kind === 'comparison' ? 'A possible correspondence between two source accounts; the concepts remain separate.' : humanize(selected.statement.epistemic_kind || 'source_report')}</dd><dt>Statement</dt><dd>{selected.kind === 'comparison' ? 'Proposed comparison' : selected.statement.polarity === 'negative' ? 'Negative claim' : selected.statement.polarity === 'uncertain' ? 'Uncertain claim' : 'Affirmative claim'}</dd>{Object.entries(selected.statement.scope || {}).filter(([key]) => key !== 'seed_ids').map(([key, value]) => <div className="rge-context-pair" key={key}><dt>{humanize(key.replace(/_id$/, ''))}</dt><dd>{valueLabel(value, entities)}</dd></div>)}</dl>
              {selected.statement.rationale && <p className="rge-rationale">{selected.statement.rationale}</p>}
              {dependencies.length > 0 && <div className="rge-dependencies"><strong>Required concepts</strong><div>{dependencies.map(entity => <button type="button" key={entity.entity_id} onClick={() => setSelectedId(entity.entity_id)}>{label(entity)} <span className={`rge-status rge-status-${status(entity.entity_id)}`}>{statusLabel[status(entity.entity_id)]}</span></button>)}</div></div>}
              {excludedDependencies.length > 0 && <p className="rge-blocked">This connection is excluded from releases while a required concept is excluded. Review that concept first.</p>}
            </>}
            <h5>Original source evidence <span>({selectedEvidence.length})</span></h5>
            <p className="rge-subtle">Quotations retain their original language and wording.</p>
            <div className="rge-evidence-list">{selectedEvidence.map(item => {
              const source = sources.get(item.source_id);
              const target = evidenceTarget(source, item);
              const url = safeWebUrl(source);
              return <article key={item.evidence_id} className="rge-evidence"><div className="rge-evidence-origin">{origin(source) === 'web' ? 'Web source' : 'Document'}</div><strong>{source?.title || 'Source'}</strong><p className="rge-evidence-locator">{locatorLabel(item)}</p><blockquote>{item.text}</blockquote>{onOpenResearchEvidence && target && <button type="button" onClick={() => onOpenResearchEvidence(target)}>Open in library</button>}{url && <a href={url} target="_blank" rel="noopener noreferrer">Open web source ↗</a>}<details><summary>Traceability details</summary><dl><dt>Source ID</dt><dd>{item.source_id}</dd><dt>Evidence ID</dt><dd>{item.evidence_id}</dd>{item.source_version_id && <><dt>Source version</dt><dd>{item.source_version_id}</dd></>}</dl><p>The quotation refers to the saved source version; a live page may have changed.</p></details></article>;
            })}</div>
            {!selectedEvidence.length && <p className="rge-blocked">Source quotations are unavailable for this item.</p>}
            <div className="rge-review-actions">
              <h5>Review for graph inclusion</h5><p>Inclusion records a curation decision, not scientific verification.</p>
              {activeDecisions.get(selected.id) && <p className="rge-last-review">Latest decision: {activeDecisions.get(selected.id)?.rationale}</p>}
              {canReview ? <><label htmlFor={`${controlId}-rationale`}>Reason for this decision<textarea id={`${controlId}-rationale`} value={rationale} onChange={event => setRationale(event.target.value)} placeholder="Explain why the evidence should be included or excluded." rows={3} maxLength={2000} disabled={reviewBusy} /></label>{pendingDependencies.length > 0 && <p className="rge-subtle">Including this connection also includes {pendingDependencies.length} required {pendingDependencies.length === 1 ? 'concept' : 'concepts'} listed above.</p>}<div className="rge-action-buttons"><button type="button" className="rge-include" disabled={reviewBusy || !rationale.trim() || excludedDependencies.length > 0 || !selectedEvidence.length} onClick={() => void review('accept')}>{reviewing ? 'Saving…' : 'Include in graph'}</button><button type="button" className="rge-exclude" disabled={reviewBusy || !rationale.trim()} onClick={() => void review('reject')}>Exclude</button></div></> : <p className="rge-subtle">{graph.release_kind ? 'This published version is read-only. Start a new graph to make changes.' : 'A reviewer can record inclusion decisions. You can explore all quotations and connections.'}</p>}
              {reviewError && <p role="alert" className="rge-blocked">{reviewError}</p>}
            </div>
          </>}
        </aside>
      </div>
    </div>
  );
}
