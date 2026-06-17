import type {
  GraphFilters,
  InteractiveGraphEdge,
  InteractiveGraphLevel,
  InteractiveGraphNode,
  InteractiveGraphPayload,
} from './graphTypes';
import { edgeSourceId, edgeTargetId } from './graphTypes';

const LEVEL_NODE_TYPES: Record<InteractiveGraphLevel, string[]> = {
  overview: ['corpus', 'material'],
  documents: ['corpus', 'material', 'segment', 'image', 'observation'],
  sections: ['material', 'segment', 'image', 'observation', 'concept', 'keyword', 'place', 'time_reference'],
  concepts: ['material', 'segment', 'image', 'observation', 'concept', 'keyword', 'place', 'time_reference', 'author'],
};

export const filterInteractiveGraph = (
  payload: InteractiveGraphPayload | null,
  filters: GraphFilters,
  level: InteractiveGraphLevel,
  searchTerm: string,
) => {
  if (!payload) {
    return { nodes: [] as InteractiveGraphNode[], edges: [] as InteractiveGraphEdge[] };
  }
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const allowedByLevel = new Set(LEVEL_NODE_TYPES[level]);
  const nodeTypeSet = new Set(filters.nodeTypes);
  const edgeTypeSet = new Set(filters.edgeTypes);
  const reviewSet = new Set(filters.reviewStatuses);
  const matchedNodeIds = new Set<string>();

  payload.nodes.forEach((node) => {
    const haystack = [
      node.label,
      node.node_type,
      node.summary,
      node.collection,
      node.source_type,
      node.year,
      node.language,
      node.region,
      JSON.stringify(node.properties || {}),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (!normalizedSearch || haystack.includes(normalizedSearch)) matchedNodeIds.add(node.id);
  });

  const levelNodeIds = new Set(
    payload.nodes
      .filter((node) => allowedByLevel.has(node.node_type) || matchedNodeIds.has(node.id))
      .filter((node) => nodeTypeSet.has(node.node_type))
      .map((node) => node.id),
  );
  const visibleNodeIds = new Set<string>();
  if (!normalizedSearch) {
    levelNodeIds.forEach((nodeId) => visibleNodeIds.add(nodeId));
  } else {
    matchedNodeIds.forEach((nodeId) => {
      if (levelNodeIds.has(nodeId)) visibleNodeIds.add(nodeId);
    });
    payload.edges.forEach((edge) => {
      const source = edgeSourceId(edge);
      const target = edgeTargetId(edge);
      const edgeHaystack = [
        edge.edge_type,
        edge.extraction_method,
        edge.review_status,
        edge.evidence_ref.material_title,
        edge.evidence_ref.snippet,
        edge.evidence_ref.page_ref,
        edge.evidence_ref.source_locator,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (matchedNodeIds.has(source) || matchedNodeIds.has(target) || edgeHaystack.includes(normalizedSearch)) {
        if (levelNodeIds.has(source)) visibleNodeIds.add(source);
        if (levelNodeIds.has(target)) visibleNodeIds.add(target);
      }
    });
  }

  const visibleEdges = payload.edges.filter((edge) => {
    const source = edgeSourceId(edge);
    const target = edgeTargetId(edge);
    if (!visibleNodeIds.has(source) || !visibleNodeIds.has(target)) return false;
    if (!edgeTypeSet.has(edge.edge_type)) return false;
    if (!reviewSet.has(edge.review_status)) return false;
    if (edge.confidence < filters.confidence) return false;
    if (!normalizedSearch) return true;
    const edgeHaystack = [
      edge.edge_type,
      edge.extraction_method,
      edge.review_status,
      edge.evidence_ref.material_title,
      edge.evidence_ref.snippet,
      edge.evidence_ref.page_ref,
      edge.evidence_ref.source_locator,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return matchedNodeIds.has(source) || matchedNodeIds.has(target) || edgeHaystack.includes(normalizedSearch);
  });

  const connectedNodeIds = new Set<string>();
  visibleEdges.forEach((edge) => {
    connectedNodeIds.add(edgeSourceId(edge));
    connectedNodeIds.add(edgeTargetId(edge));
  });

  const visibleNodes = payload.nodes.filter((node) => visibleNodeIds.has(node.id) && (connectedNodeIds.has(node.id) || node.node_type === 'corpus'));
  return { nodes: visibleNodes, edges: visibleEdges };
};

export const mergeGraphPayloads = (
  base: InteractiveGraphPayload | null,
  addition: InteractiveGraphPayload,
): InteractiveGraphPayload => {
  if (!base) return addition;
  const nodes = new Map(base.nodes.map((node) => [node.id, node]));
  const edges = new Map(base.edges.map((edge) => [edge.id, edge]));
  addition.nodes.forEach((node) => nodes.set(node.id, node));
  addition.edges.forEach((edge) => edges.set(edge.id, edge));
  return {
    ...addition,
    query: addition.query ?? base.query,
    material_id: addition.material_id ?? base.material_id,
    level: addition.level ?? base.level,
    nodes: Array.from(nodes.values()),
    edges: Array.from(edges.values()),
    clusters: addition.clusters.length > 0 ? addition.clusters : base.clusters,
    summary: {
      material_count: Array.from(nodes.values()).filter((node) => node.node_type === 'material').length,
      section_count: Array.from(nodes.values()).filter((node) => ['segment', 'image', 'observation'].includes(node.node_type)).length,
      concept_count: Array.from(nodes.values()).filter((node) =>
        ['concept', 'keyword', 'place', 'time_reference', 'author'].includes(node.node_type),
      ).length,
      edge_count: edges.size,
      review_needed_count: Array.from(edges.values()).filter((edge) => ['needs_review', 'unreviewed'].includes(edge.review_status)).length,
    },
  };
};
