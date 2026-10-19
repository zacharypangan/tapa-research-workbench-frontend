import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { GraphEntity, GraphSource } from './types';
import { neighborhood, networkLinks, sourceClusterLayout } from './graphNetworkLayout';
import type { NetworkConnection, NetworkLink, NetworkPoint } from './graphNetworkLayout';

interface GraphNetworkProps {
  entities: GraphEntity[];
  sources: GraphSource[];
  connections: NetworkConnection[];
  selectedId?: string;
  selectedEntityIds: string[];
  excludedEntityIds: Set<string>;
  onSelect: (id: string) => void;
}
type Mode = 'whole' | 'neighborhood' | 'source';
interface Viewport { x: number; y: number; zoom: number }
type Pick = { kind: 'entity'; id: string } | { kind: 'source'; id: string } | { kind: 'link'; link: NetworkLink };
const MAX_NODES = 5000;
const MAX_LINKS = 12000;
const PALETTE = ['#2563eb', '#0f766e', '#9333ea', '#c2410c', '#be185d', '#4d7c0f', '#0369a1', '#6d28d9', '#a16207', '#475569'];
const label = (entity: GraphEntity) => entity.label_en || entity.label_original || entity.entity_id;
const humanize = (value: string) => value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ');
const short = (value: string, length = 38) => value.length > length ? `${value.slice(0, length - 1)}…` : value;
const isAlignment = (link: NetworkLink) => link.kind === 'inference' && (link.connections[0].statement.layer === 'concept_alignment' || link.connections[0].statement.predicate === 'aligns_reported_concept_with' || ['typed_label_match', 'source_definition_name_match'].includes(link.connections[0].statement.rule || ''));
const lineColor = (link: NetworkLink) => link.kind === 'context' ? '#a78bba' : isAlignment(link) ? '#2563eb' : link.kind === 'inference' ? '#c2410c' : link.kind === 'comparison' ? '#9333ea' : link.polarity === 'negative' ? '#be123c' : link.polarity === 'uncertain' ? '#a16207' : '#277362';

export function GraphNetwork({ entities, sources, connections, selectedId, selectedEntityIds, excludedEntityIds, onSelect }: GraphNetworkProps) {
  const instructionId = useId();
  const canvas = useRef<HTMLCanvasElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const view = useRef<Viewport>({ x: 0, y: 0, zoom: 1 });
  const drag = useRef<{ pointerId: number; x: number; y: number; view: Viewport; moved: boolean } | null>(null);
  const [size, setSize] = useState({ width: 800, height: 540, dpr: 1 });
  const [mode, setMode] = useState<Mode>('whole');
  const [hops, setHops] = useState(1);
  const [sourceId, setSourceId] = useState('');
  const [entityType, setEntityType] = useState('');
  const [showSources, setShowSources] = useState(true);
  const [showContext, setShowContext] = useState(false);
  const [showLabels, setShowLabels] = useState(false);
  const [hover, setHover] = useState<{ label: string; x: number; y: number } | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const keyboardId = useRef<string | null>(null);
  const frame = useRef<number | null>(null);
  const redraw = useRef<() => void>(() => {});
  const sourceMap = useMemo(() => new Map(sources.map(source => [source.source_id, source])), [sources]);
  const entityMap = useMemo(() => new Map(entities.map(entity => [entity.entity_id, entity])), [entities]);
  const types = useMemo(() => [...new Set(entities.map(entity => entity.entity_type))].sort(), [entities]);
  const colors = useMemo(() => new Map(types.map((type, index) => [type, PALETTE[index % PALETTE.length]])), [types]);
  const selectedKey = selectedEntityIds.join('\u0000');
  const roots = useMemo(() => selectedKey.split('\u0000').filter(id => entityMap.has(id)), [selectedKey, entityMap]);
  const layoutRootKey = mode === 'neighborhood' || entities.length > MAX_NODES ? selectedKey : '';
  const layoutRoots = useMemo(() => layoutRootKey.split('\u0000').filter(id => entityMap.has(id)), [layoutRootKey, entityMap]);
  const allLinks = useMemo(() => networkLinks(connections, new Set(entityMap.keys()), showContext), [connections, entityMap, showContext]);
  const effectiveSource = sourceMap.has(sourceId) ? sourceId : entities[0]?.source_id || '';
  const network = useMemo(() => {
    const near = mode === 'neighborhood' ? neighborhood(layoutRoots, allLinks, hops) : null;
    const matching = entities.filter(entity => (!entityType || entity.entity_type === entityType) && (mode !== 'source' || entity.source_id === effectiveSource) && (!near || near.has(entity.entity_id)));
    const ranked = matching.length > MAX_NODES ? [...matching].sort((a, b) => Number(layoutRoots.includes(b.entity_id)) - Number(layoutRoots.includes(a.entity_id)) || a.entity_id.localeCompare(b.entity_id)) : matching;
    const nodes = ranked.slice(0, MAX_NODES);
    const ids = new Set(nodes.map(entity => entity.entity_id));
    const matchingLinks = allLinks.filter(link => ids.has(link.from) && ids.has(link.to));
    const priority = { relationship: 0, comparison: 1, inference: 2, context: 3 };
    const links = [...matchingLinks].sort((a, b) => priority[a.kind] - priority[b.kind] || a.id.localeCompare(b.id)).slice(0, MAX_LINKS);
    const layout = sourceClusterLayout(nodes, links, mode === 'neighborhood' ? layoutRoots : []);
    return { nodes, links, ...layout, totalNodes: matching.length, totalLinks: matchingLinks.length, statementCount: links.filter(link => link.kind !== 'context').reduce((sum, link) => sum + link.connections.length, 0) };
  }, [entities, entityType, mode, effectiveSource, allLinks, hops, layoutRoots]);
  const sourceMembers = useMemo(() => {
    const members = new Map<string, GraphEntity[]>();
    for (const entity of network.nodes) {
      if (!members.has(entity.source_id)) members.set(entity.source_id, []);
      members.get(entity.source_id)!.push(entity);
    }
    return members;
  }, [network.nodes]);

  const paint = useCallback(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    const { x, y, zoom } = view.current;
    ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
    ctx.clearRect(0, 0, size.width, size.height);
    ctx.fillStyle = '#fbfcfa';
    ctx.fillRect(0, 0, size.width, size.height);
    const selected = new Set(roots);
    const nearby = neighborhood(roots, network.links, 1);
    const point = (id: string) => {
      const position = network.positions.get(id)!;
      return { x: position.x * zoom + x, y: position.y * zoom + y };
    };
    const drawLabel = (text: string, at: NetworkPoint, color: string, bold = false) => {
      ctx.font = `${bold ? '600 ' : ''}11px system-ui, sans-serif`;
      while (text.length > 2 && ctx.measureText(text).width > size.width - 20) text = `${text.slice(0, -2)}…`;
      const width = ctx.measureText(text).width;
      const left = Math.max(width / 2 + 5, Math.min(size.width - width / 2 - 5, at.x));
      ctx.fillStyle = '#fbfcfaeb';
      ctx.fillRect(left - width / 2 - 3, at.y - 1, width + 6, 15);
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(text, left, at.y);
    };
    if (showSources) for (const cluster of network.clusters) {
      const center = { x: cluster.x * zoom + x, y: cluster.y * zoom + y };
      ctx.strokeStyle = '#d8e2dc';
      ctx.fillStyle = '#f2f6f240';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 6]);
      ctx.beginPath(); ctx.arc(center.x, center.y, cluster.radius * zoom, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    for (const link of network.links) {
      const a = point(link.from), b = point(link.to);
      const active = link.connections.some(connection => connection.id === selectedId);
      const related = selected.has(link.from) || selected.has(link.to);
      ctx.globalAlpha = link.excluded ? .16 : active ? 1 : mode === 'whole' ? (related ? .75 : link.kind === 'relationship' ? .28 : .17) : .65;
      ctx.strokeStyle = lineColor(link);
      ctx.lineWidth = active ? 2.8 : related ? 1.6 : 1;
      ctx.setLineDash(isAlignment(link) ? [6, 4] : link.kind === 'inference' ? [2, 5] : link.kind === 'comparison' ? [7, 4] : link.kind === 'context' ? [3, 5] : []);
      ctx.beginPath();
      if (link.from === link.to) ctx.arc(a.x + 9, a.y - 9, 12, .2, Math.PI * 1.9);
      else { ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
      ctx.stroke();
      if (link.kind === 'relationship' && mode !== 'whole' && link.from !== link.to) {
        const distance = Math.hypot(b.x - a.x, b.y - a.y);
        if (distance > 22) {
          const ux = (b.x - a.x) / distance, uy = (b.y - a.y) / distance;
          const tx = b.x - ux * 8, ty = b.y - uy * 8;
          ctx.setLineDash([]); ctx.fillStyle = lineColor(link);
          ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx - ux * 7 - uy * 3, ty - uy * 7 + ux * 3); ctx.lineTo(tx - ux * 7 + uy * 3, ty - uy * 7 - ux * 3); ctx.closePath(); ctx.fill();
        }
      }
    }
    ctx.globalAlpha = 1; ctx.setLineDash([]);
    if (showSources) for (const cluster of network.clusters) {
      const center = { x: cluster.x * zoom + x, y: cluster.y * zoom + y };
      const source = sourceMap.get(cluster.sourceId);
      const members = sourceMembers.get(cluster.sourceId) || [];
      ctx.globalAlpha = .13; ctx.strokeStyle = '#a98b62'; ctx.setLineDash([3, 4]);
      for (const entity of members) { const p = point(entity.entity_id); ctx.beginPath(); ctx.moveTo(center.x, center.y); ctx.lineTo(p.x, p.y); ctx.stroke(); }
      ctx.globalAlpha = 1; ctx.setLineDash([]); ctx.fillStyle = '#7c8a80'; ctx.fillRect(center.x - 4, center.y - 4, 8, 8);
      if (center.x > 0 && center.x < size.width && center.y > 0 && center.y < size.height && (network.clusters.length <= 8 || zoom > .75 || cluster.sourceId === effectiveSource && mode === 'source')) drawLabel(short(source?.title || cluster.sourceId, mode === 'source' ? 60 : 37), { x: center.x, y: center.y - cluster.radius * zoom + 7 }, '#52685c', true);
    }
    for (const entity of network.nodes) {
      const p = point(entity.entity_id);
      if (p.x < -100 || p.y < -25 || p.x > size.width + 100 || p.y > size.height + 25) continue;
      const active = selected.has(entity.entity_id);
      const radius = active ? 6 : mode === 'whole' && network.nodes.length > 150 ? 3.3 : 4.5;
      ctx.globalAlpha = excludedEntityIds.has(entity.entity_id) ? .3 : 1;
      ctx.fillStyle = colors.get(entity.entity_type) || PALETTE[0];
      ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, Math.PI * 2); ctx.fill();
      if (active) { ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(p.x, p.y, radius + 3, 0, Math.PI * 2); ctx.stroke(); }
      if (active || network.nodes.length <= 20 || showLabels && (network.nodes.length <= 100 || zoom > 1) || mode === 'neighborhood' && nearby.has(entity.entity_id) && network.nodes.length <= 60 || zoom > 2.2) drawLabel(short(label(entity)), { x: p.x, y: p.y + radius + 5 }, '#253d35', active);
    }
    if (mode !== 'whole' && network.links.length <= 12) for (const link of network.links) {
      if (link.kind === 'context') continue;
      const a = point(link.from), b = point(link.to);
      drawLabel(short(humanize(link.connections[0].statement.predicate), 32), { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, lineColor(link));
    }
    ctx.globalAlpha = 1;
  }, [size, network, roots, selectedId, showSources, sourceMap, sourceMembers, effectiveSource, mode, excludedEntityIds, colors, showLabels]);
  const requestPaint = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => { frame.current = null; paint(); });
  }, [paint]);
  useEffect(() => {
    redraw.current = requestPaint;
    requestPaint();
    return () => { if (frame.current !== null) { cancelAnimationFrame(frame.current); frame.current = null; } };
  }, [requestPaint]);
  const fit = useCallback(() => {
    const points = [...network.positions.values(), ...(showSources ? network.clusters.flatMap(cluster => [{ x: cluster.x - cluster.radius, y: cluster.y - cluster.radius }, { x: cluster.x + cluster.radius, y: cluster.y + cluster.radius }]) : [])];
    if (!points.length) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const point of points) { minX = Math.min(minX, point.x); minY = Math.min(minY, point.y); maxX = Math.max(maxX, point.x); maxY = Math.max(maxY, point.y); }
    const zoom = Math.max(.015, Math.min(2, (size.width - 90) / Math.max(120, maxX - minX), (size.height - 100) / Math.max(120, maxY - minY)));
    view.current = { zoom, x: size.width / 2 - (minX + maxX) / 2 * zoom, y: size.height / 2 - (minY + maxY) / 2 * zoom };
    redraw.current();
  }, [network, showSources, size.width, size.height]);
  // Refit only when the layout or container changes, not while dragging.
  useEffect(() => { fit(); return () => { if (frame.current !== null) cancelAnimationFrame(frame.current); }; }, [fit]);
  useEffect(() => {
    const element = surface.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setSize({ width: Math.max(200, entry.contentRect.width), height: Math.max(300, entry.contentRect.height), dpr: Math.min(window.devicePixelRatio || 1, 2) }));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const zoomAt = useCallback((factor: number, at?: NetworkPoint) => {
    const center = at || { x: size.width / 2, y: size.height / 2 };
    const current = view.current;
    const zoom = Math.min(12, Math.max(.015, current.zoom * factor));
    const ratio = zoom / current.zoom;
    view.current = { zoom, x: center.x - (center.x - current.x) * ratio, y: center.y - (center.y - current.y) * ratio };
    requestPaint();
  }, [size.width, size.height, requestPaint]);
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => { event.preventDefault(); const rect = element.getBoundingClientRect(); zoomAt(Math.exp(-event.deltaY * .0014), { x: event.clientX - rect.left, y: event.clientY - rect.top }); };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, [zoomAt]);

  function hit(at: NetworkPoint): Pick | null {
    const { x, y, zoom } = view.current;
    let best = 11;
    let found: Pick | null = null;
    for (const entity of network.nodes) {
      const position = network.positions.get(entity.entity_id)!;
      const distance = Math.hypot(position.x * zoom + x - at.x, position.y * zoom + y - at.y);
      if (distance < best) { best = distance; found = { kind: 'entity', id: entity.entity_id }; }
    }
    if (found) return found;
    if (showSources) for (const cluster of network.clusters) if (Math.hypot(cluster.x * zoom + x - at.x, cluster.y * zoom + y - at.y) < 10) return { kind: 'source', id: cluster.sourceId };
    best = 5;
    for (const link of network.links) {
      const first = network.positions.get(link.from)!, last = network.positions.get(link.to)!;
      const a = { x: first.x * zoom + x, y: first.y * zoom + y }, b = { x: last.x * zoom + x, y: last.y * zoom + y };
      const dx = b.x - a.x, dy = b.y - a.y;
      const fraction = Math.max(0, Math.min(1, ((at.x - a.x) * dx + (at.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
      const distance = link.from === link.to ? Math.abs(Math.hypot(at.x - a.x - 9, at.y - a.y + 9) - 12) : Math.hypot(at.x - a.x - fraction * dx, at.y - a.y - fraction * dy);
      if (distance < best) { best = distance; found = { kind: 'link', link }; }
    }
    return found;
  }
  function choose(pick: Pick) {
    if (pick.kind === 'source') {
      setSourceId(pick.id); setMode('source');
      const first = entities.find(entity => entity.source_id === pick.id);
      if (first) onSelect(first.entity_id);
      setAnnouncement(`Source view: ${sourceMap.get(pick.id)?.title || pick.id}`);
    }
    else if (pick.kind === 'entity') { onSelect(pick.id); keyboardId.current = pick.id; setAnnouncement(`Selected ${label(entityMap.get(pick.id)!)}. Details are in the side panel.`); }
    else { onSelect(pick.link.connections[0].id); setAnnouncement(`${pick.link.connections.length} statement${pick.link.connections.length === 1 ? '' : 's'} on this link. The first is open in the details; all are in the searchable list.`); }
    setHover(null);
  }
  function saveImage() {
    const image = canvas.current;
    if (!image) return;
    image.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob), anchor = document.createElement('a');
      anchor.href = url; anchor.download = 'research-network.png'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }
  const selectedSource = sourceMap.get(effectiveSource);
  const excludedCount = network.nodes.filter(entity => excludedEntityIds.has(entity.entity_id)).length;
  return <div className="rge-interactive-network">
    <div className="rge-network-toolbar" aria-label="Network view controls">
      <div className="rge-network-modes"><button type="button" aria-pressed={mode === 'whole'} onClick={() => setMode('whole')}>Whole network</button><button type="button" aria-pressed={mode === 'neighborhood'} disabled={!roots.length} onClick={() => setMode('neighborhood')}>Selected neighborhood</button><button type="button" aria-pressed={mode === 'source'} disabled={!entities.length} onClick={() => choose({ kind: 'source', id: effectiveSource })}>One source</button></div>
      {mode === 'neighborhood' && <label>Depth<select value={hops} onChange={event => setHops(Number(event.target.value))}><option value="1">1 connection</option><option value="2">2 connections</option></select></label>}
      {mode === 'source' && <label>Source<select value={effectiveSource} onChange={event => choose({ kind: 'source', id: event.target.value })}>{sources.filter(source => entities.some(entity => entity.source_id === source.source_id)).map(source => <option key={source.source_id} value={source.source_id}>{source.title || source.source_id}</option>)}</select></label>}
      <details className="rge-network-options"><summary>View options</summary><div><label>Concept type<select value={entityType} onChange={event => setEntityType(event.target.value)}><option value="">All types</option>{types.map(type => <option key={type} value={type}>{humanize(type)}</option>)}</select></label><label><input type="checkbox" checked={showSources} onChange={event => setShowSources(event.target.checked)} />Source context</label><label><input type="checkbox" checked={showContext} onChange={event => setShowContext(event.target.checked)} />Exact context references</label><label><input type="checkbox" checked={showLabels} onChange={event => setShowLabels(event.target.checked)} />More labels when zoomed</label></div></details>
    </div>
    <div ref={surface} className="rge-network-surface">
      <canvas ref={canvas} width={Math.round(size.width * size.dpr)} height={Math.round(size.height * size.dpr)} tabIndex={0} role="group" aria-label="Interactive research network. Arrow keys select concepts, Enter inspects, plus and minus zoom, F fits and Escape returns to the whole network." aria-describedby={instructionId}
        onPointerDown={event => { if (event.button !== 0) return; event.currentTarget.focus(); drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, view: { ...view.current }, moved: false }; event.currentTarget.setPointerCapture(event.pointerId); }}
        onPointerMove={event => {
          if (drag.current) { const state = drag.current; if (Math.hypot(event.clientX - state.x, event.clientY - state.y) > 4) state.moved = true; if (state.moved) { view.current = { ...state.view, x: state.view.x + event.clientX - state.x, y: state.view.y + event.clientY - state.y }; requestPaint(); setHover(null); } return; }
          const rect = event.currentTarget.getBoundingClientRect(), point = { x: event.clientX - rect.left, y: event.clientY - rect.top }, pick = hit(point);
          const text = pick?.kind === 'entity' ? `${label(entityMap.get(pick.id)!)} · ${humanize(entityMap.get(pick.id)!.entity_type)}` : pick?.kind === 'source' ? `Source: ${sourceMap.get(pick.id)?.title || pick.id}` : pick?.kind === 'link' ? `${pick.link.connections[0].title}${pick.link.connections.length > 1 ? ` (${pick.link.connections.length} statements)` : ''}` : '';
          event.currentTarget.style.cursor = pick ? 'pointer' : 'grab'; setHover(text ? { label: text, x: Math.max(8, Math.min(size.width - 250, point.x + 12)), y: Math.max(8, point.y - 42) } : null);
        }}
        onPointerUp={event => { const state = drag.current; drag.current = null; if (!state || state.pointerId !== event.pointerId) return; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); if (!state.moved) { const rect = event.currentTarget.getBoundingClientRect(), pick = hit({ x: event.clientX - rect.left, y: event.clientY - rect.top }); if (pick) choose(pick); } }}
        onPointerCancel={() => { drag.current = null; }} onPointerLeave={() => setHover(null)}
        onDoubleClick={event => { const rect = event.currentTarget.getBoundingClientRect(), pick = hit({ x: event.clientX - rect.left, y: event.clientY - rect.top }); if (pick?.kind === 'entity') { choose(pick); setMode('neighborhood'); } }}
        onKeyDown={event => {
          if (event.key === '+' || event.key === '=') { event.preventDefault(); zoomAt(1.4); }
          else if (event.key === '-') { event.preventDefault(); zoomAt(1 / 1.4); }
          else if (event.key.toLowerCase() === 'f') { event.preventDefault(); fit(); }
          else if (event.key === 'Escape') { setMode('whole'); setHover(null); }
          else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key) && network.nodes.length) {
            event.preventDefault();
            const current = network.nodes.findIndex(entity => entity.entity_id === (keyboardId.current || roots[0]));
            const step = ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1;
            const entity = network.nodes[(current + step + network.nodes.length) % network.nodes.length];
            keyboardId.current = entity.entity_id; choose({ kind: 'entity', id: entity.entity_id });
          } else if ((event.key === 'Enter' || event.key === ' ') && (keyboardId.current || roots[0])) { event.preventDefault(); choose({ kind: 'entity', id: keyboardId.current || roots[0] }); }
        }} />
      {!network.nodes.length && <p className="rge-network-empty">No concepts match this view. Choose Whole network or broaden the filters.</p>}
      {hover && <div className="rge-network-tooltip" style={{ left: hover.x, top: hover.y }}>{hover.label}</div>}
      <div className="rge-network-tools"><button type="button" aria-label="Zoom in" onClick={() => zoomAt(1.4)}>+</button><button type="button" aria-label="Zoom out" onClick={() => zoomAt(1 / 1.4)}>−</button><button type="button" onClick={fit}>Fit view</button><button type="button" onClick={saveImage}>Save PNG</button></div>
    </div>
    <p className="rge-network-count" aria-live="polite">{network.nodes.length.toLocaleString()} of {network.totalNodes.toLocaleString()} matching concepts · {network.links.filter(link => link.kind !== 'context').length.toLocaleString()} visual links ({network.statementCount.toLocaleString()} statements){showContext ? ` · ${network.links.filter(link => link.kind === 'context').length.toLocaleString()} context references` : ''}{excludedCount ? ` · ${excludedCount} excluded concepts shown faintly` : ''}. {network.totalNodes > MAX_NODES || network.totalLinks > MAX_LINKS ? 'This canvas is bounded to 5,000 concepts and 12,000 links; search and export retain all matching records.' : ''}</p>
    <div className="rge-network-type-legend">{types.map(type => <span key={type}><i style={{ background: colors.get(type) }} />{humanize(type)}</span>)}</div>
    {mode === 'source' && selectedSource && <details className="rge-network-source"><summary>Source provenance: {selectedSource.title || selectedSource.source_id}</summary><dl><dt>Source ID</dt><dd>{selectedSource.source_id}</dd><dt>Saved locator</dt><dd>{selectedSource.source_locator || 'Not supplied'}</dd>{selectedSource.source_version_id && <><dt>Source version</dt><dd>{selectedSource.source_version_id}</dd></>}{selectedSource.snapshot_sha256 && <><dt>Snapshot SHA-256</dt><dd>{selectedSource.snapshot_sha256}</dd></>}</dl></details>}
    <p className="rge-caption" id={instructionId}>Click a concept or link to inspect its evidence. Double-click a concept, or choose Selected neighborhood, to follow 1 or 2 connections. Scroll to zoom; drag to pan. Dashed source associations and optional context references describe attribution, not production or causation. Position is not geographic. Source accounts and original IDs remain separate; descriptions stay in the list and inspector.</p>
    <span className="rge-screen-reader" role="status">{announcement}</span>
  </div>;
}
