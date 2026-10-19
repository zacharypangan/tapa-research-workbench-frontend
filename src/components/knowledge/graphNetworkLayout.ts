import type { GraphEntity, GraphStatement } from './types';

export interface NetworkPoint { x: number; y: number }
export interface NetworkConnection {
  id: string;
  title: string;
  kind: 'relationship' | 'comparison' | 'inference';
  statement: GraphStatement;
  excluded: boolean;
}
export interface NetworkLink {
  id: string;
  from: string;
  to: string;
  kind: NetworkConnection['kind'] | 'context';
  polarity: string;
  excluded: boolean;
  connections: NetworkConnection[];
}
export interface SourceCluster extends NetworkPoint { sourceId: string; radius: number; count: number }

const name = (entity: GraphEntity) => entity.label_en || entity.label_original || entity.entity_id;

/** Aggregate only identical visual triples; original records and their IDs remain intact. */
export function networkLinks(connections: NetworkConnection[], ids: Set<string>, context: boolean): NetworkLink[] {
  const links = new Map<string, NetworkLink>();
  const add = (from: string, to: string, kind: NetworkLink['kind'], connection: NetworkConnection) => {
    if (!ids.has(from) || !ids.has(to)) return;
    const polarity = kind === 'context' ? 'context' : connection.statement.polarity;
    const key = JSON.stringify([from, to, kind, kind === 'context' ? '' : connection.statement.predicate, kind === 'context' ? '' : connection.statement.layer || '', polarity, connection.excluded]);
    const existing = links.get(key);
    if (existing) existing.connections.push(connection);
    else links.set(key, { id: key, from, to, kind, polarity, excluded: connection.excluded, connections: [connection] });
  };
  for (const connection of connections) {
    const statement = connection.statement;
    if (statement.object_id) add(statement.subject_id, statement.object_id, connection.kind, connection);
    if (context) {
      // Only exact entity IDs in declared context fields become context references.
      // Generic literal values and source membership never become semantic edges.
      for (const [key, value] of Object.entries(statement.scope || {})) {
        if (key.endsWith('_id') && typeof value === 'string' && value !== statement.subject_id && value !== statement.object_id) {
          add(statement.subject_id, value, 'context', connection);
        }
      }
    }
  }
  return [...links.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function neighborhood(roots: string[], links: NetworkLink[], hops: number): Set<string> {
  const adjacent = new Map<string, Set<string>>();
  for (const link of links) {
    if (!adjacent.has(link.from)) adjacent.set(link.from, new Set());
    if (!adjacent.has(link.to)) adjacent.set(link.to, new Set());
    adjacent.get(link.from)!.add(link.to);
    adjacent.get(link.to)!.add(link.from);
  }
  const result = new Set(roots);
  let frontier = roots;
  for (let hop = 0; hop < hops; hop++) {
    const next: string[] = [];
    for (const id of frontier) for (const neighbor of adjacent.get(id) || []) if (!result.has(neighbor)) {
      result.add(neighbor);
      next.push(neighbor);
    }
    frontier = next;
  }
  return result;
}

/** Stable, non-geographic packing of source-local concepts; no identity merging. */
export function sourceClusterLayout(entities: GraphEntity[], links: NetworkLink[], focusIds: string[] = []) {
  const groups = new Map<string, GraphEntity[]>();
  const degree = new Map<string, number>();
  for (const link of links) for (const id of [link.from, link.to]) degree.set(id, (degree.get(id) || 0) + 1);
  for (const entity of entities) {
    if (!groups.has(entity.source_id)) groups.set(entity.source_id, []);
    groups.get(entity.source_id)!.push(entity);
  }
  const orderedGroups = [...groups].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  const positions = new Map<string, NetworkPoint>();
  const clusters: SourceCluster[] = [];
  const cellSize = 2 * Math.max(78, 21 * Math.sqrt(orderedGroups[0]?.[1].length || 1) + 42) + 34;
  const cells = new Map<string, SourceCluster[]>();
  const cellKey = (x: number, y: number) => `${x},${y}`;
  const overlaps = (point: NetworkPoint, radius: number) => {
    const cellX = Math.floor(point.x / cellSize), cellY = Math.floor(point.y / cellSize);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      for (const other of cells.get(cellKey(cellX + dx, cellY + dy)) || []) {
        if (Math.hypot(point.x - other.x, point.y - other.y) < radius + other.radius + 32) return true;
      }
    }
    return false;
  };
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (const [sourceId, members] of orderedGroups) {
    const radius = Math.max(78, 21 * Math.sqrt(members.length) + 42);
    let center: NetworkPoint = { x: 0, y: 0 };
    if (clusters.length) {
      let bestDistance = Infinity;
      // Candidate centres touch one existing circle. Choose the compact free
      // location deterministically; sources with no web data leave no blank lane.
      const anchors = clusters.length > 36 ? [...clusters.slice(0, 8), ...clusters.slice(-28)] : clusters;
      for (const neighbor of anchors) for (let step = 0; step < 24; step++) {
        const angle = step * Math.PI / 12;
        const distance = neighbor.radius + radius + 34;
        const candidate = { x: neighbor.x + Math.cos(angle) * distance, y: neighbor.y + Math.sin(angle) * distance };
        const score = Math.hypot(candidate.x, candidate.y);
        if (score >= bestDistance || overlaps(candidate, radius)) continue;
        center = candidate;
        bestDistance = score;
      }
      if (!Number.isFinite(bestDistance)) center = { x: Math.max(...clusters.map(cluster => cluster.x + cluster.radius)) + radius + 34, y: 0 };
    }
    const cluster = { ...center, radius, sourceId, count: members.length };
    clusters.push(cluster);
    const key = cellKey(Math.floor(center.x / cellSize), Math.floor(center.y / cellSize));
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key)!.push(cluster);
    members.sort((a, b) => (degree.get(b.entity_id) || 0) - (degree.get(a.entity_id) || 0) || name(a).localeCompare(name(b)) || a.entity_id.localeCompare(b.entity_id));
    members.forEach((entity, index) => {
      const distance = 21 * Math.sqrt(index + .5);
      const angle = index * golden;
      positions.set(entity.entity_id, { x: center.x + Math.cos(angle) * distance, y: center.y + Math.sin(angle) * distance });
    });
  }
  if (focusIds.length) {
    const roots = new Set(focusIds.filter(id => positions.has(id)));
    const near = neighborhood([...roots], links, 1);
    const rings = [entities.filter(entity => roots.has(entity.entity_id)), entities.filter(entity => near.has(entity.entity_id) && !roots.has(entity.entity_id)), entities.filter(entity => !near.has(entity.entity_id))];
    let radius = 0;
    for (const [index, ring] of rings.entries()) {
      if (!ring.length) continue;
      radius = index === 0 && ring.length === 1 ? 0 : Math.max(radius + (index ? 115 : 40), ring.length * 7);
      ring.sort((a, b) => name(a).localeCompare(name(b)) || a.entity_id.localeCompare(b.entity_id)).forEach((entity, item) => {
        const angle = -Math.PI / 2 + 2 * Math.PI * item / ring.length;
        positions.set(entity.entity_id, { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
      });
    }
    // Source anchors are not shown in a neighborhood; source attribution stays
    // in the inspector and can be restored in the whole/source views.
    return { positions, clusters: [] as SourceCluster[] };
  }
  return { positions, clusters };
}
