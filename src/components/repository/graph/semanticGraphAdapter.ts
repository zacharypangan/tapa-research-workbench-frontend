import type {
  GraphFilters,
  InteractiveGraphEdge,
  InteractiveGraphLevel,
  InteractiveGraphNode,
  InteractiveGraphPayload,
  SemanticGraphEntity,
  SemanticGraphPayload,
  SemanticGraphRelation,
  SemanticAtlasLens,
} from './graphTypes';
import { SEMANTIC_EDGE_TYPES, SEMANTIC_NODE_TYPES } from './graphTypes';

const semanticLevel = (type: SemanticGraphEntity['type']): InteractiveGraphNode['level'] => {
  if (type === 'material') return 'material';
  return 'concept';
};

const semanticSummary = (entity: SemanticGraphEntity) => {
  if (entity.type === 'material') {
    return typeof entity.properties.summary === 'string'
      ? entity.properties.summary
      : `${entity.evidence_count} evidence mentions support this document in the Semantic Atlas.`;
  }
  const coverage = entity.document_count === 1 ? '1 document' : `${entity.document_count} documents`;
  return `${entity.label} is supported by ${entity.evidence_count} evidence mention${entity.evidence_count === 1 ? '' : 's'} across ${coverage}.`;
};

export const semanticNodeToInteractive = (entity: SemanticGraphEntity): InteractiveGraphNode => ({
  id: entity.id,
  label: entity.label,
  node_type: entity.type,
  level: semanticLevel(entity.type),
  material_id: typeof entity.properties.material_id === 'string' ? entity.properties.material_id : null,
  collection: typeof entity.properties.collection === 'string' ? entity.properties.collection : null,
  source_type: typeof entity.properties.source_type === 'string' ? entity.properties.source_type : null,
  year: typeof entity.properties.year === 'string' ? entity.properties.year : null,
  language: typeof entity.properties.language === 'string' ? entity.properties.language : null,
  region: typeof entity.properties.region === 'string' ? entity.properties.region : null,
  degree: entity.degree,
  confidence: entity.importance_score,
  review_status: entity.review_relation_count > 0 ? 'needs_review' : 'accepted',
  properties: {
    ...entity.properties,
    importance_score: entity.importance_score,
    mention_count: entity.mention_count,
    document_count: entity.document_count,
    collection_count: entity.collection_count,
    is_generic: entity.is_generic,
    is_bridge_entity: entity.is_bridge_entity,
  },
  summary: semanticSummary(entity),
  evidence_count: entity.evidence_count,
  document_count: entity.document_count,
  semantic_entity: entity,
});

export const semanticRelationToInteractive = (relation: SemanticGraphRelation): InteractiveGraphEdge => ({
  id: relation.id,
  source_node_id: relation.source,
  target_node_id: relation.target,
  source: relation.source,
  target: relation.target,
  edge_type: relation.predicate,
  weight: Math.max(0.7, Math.min(4, Math.log1p(relation.evidence_count))),
  confidence: relation.confidence,
  evidence_ref: relation.evidence_ref || {},
  extraction_method: relation.extraction_method,
  review_status: relation.status,
  created_at: relation.created_at,
  summary: relation.evidence_preview,
  semantic_relation: relation,
});

export const adaptSemanticGraph = (payload: SemanticGraphPayload): InteractiveGraphPayload => {
  const nodes = payload.nodes.map(semanticNodeToInteractive);
  const edges = payload.edges.map(semanticRelationToInteractive);
  return {
    query: payload.query,
    level: 'overview',
    nodes,
    edges,
    clusters: [],
    summary: {
      material_count: payload.summary.material_count || 0,
      section_count: 0,
      concept_count:
        (payload.summary.concept_count || 0)
        + (payload.summary.place_count || 0)
        + (payload.summary.time_period_count || 0)
        + (payload.summary.agent_count || 0),
      edge_count: edges.length,
      review_needed_count: edges.filter((edge) => edge.review_status === 'needs_review').length,
    },
    evidence_note: payload.evidence_note,
  };
};

export const semanticFilters = (confidence = 0.55): GraphFilters => ({
  nodeTypes: [...SEMANTIC_NODE_TYPES],
  edgeTypes: [...SEMANTIC_EDGE_TYPES],
  reviewStatuses: ['accepted', 'needs_review'],
  confidence,
});

export const semanticViewForLevel = (
  level: InteractiveGraphLevel,
): SemanticGraphPayload['view'] => {
  if (level === 'documents') return 'documents';
  if (level === 'concepts') return 'concepts';
  if (level === 'sections') return 'places_time';
  return 'overview';
};

export const semanticLevelForLens = (lens: SemanticAtlasLens): InteractiveGraphLevel => {
  if (lens === 'concepts') return 'concepts';
  if (lens === 'places' || lens === 'time') return 'sections';
  return 'documents';
};

export const filterSemanticGraph = (
  payload: InteractiveGraphPayload | null,
  filters: GraphFilters,
  searchTerm: string,
) => {
  if (!payload) return { nodes: [] as InteractiveGraphNode[], edges: [] as InteractiveGraphEdge[] };
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const nodeTypes = new Set(filters.nodeTypes);
  const edgeTypes = new Set(filters.edgeTypes);
  const reviewStatuses = new Set(filters.reviewStatuses);
  const matchingIds = new Set(
    payload.nodes
      .filter((node) => {
        if (!normalizedSearch) return true;
        return [
          node.label,
          node.summary,
          node.node_type,
          JSON.stringify(node.properties),
        ]
          .join(' ')
          .toLowerCase()
          .includes(normalizedSearch);
      })
      .map((node) => node.id),
  );
  const visibleEdges = payload.edges.filter((edge) => {
    if (!edgeTypes.has(edge.edge_type) || !reviewStatuses.has(edge.review_status)) return false;
    if (edge.review_status !== 'accepted' && edge.confidence < filters.confidence) return false;
    const source = typeof edge.source === 'string' ? edge.source : edge.source.id;
    const target = typeof edge.target === 'string' ? edge.target : edge.target.id;
    if (!normalizedSearch) return true;
    return matchingIds.has(source) || matchingIds.has(target);
  });
  const connectedIds = new Set<string>();
  visibleEdges.forEach((edge) => {
    connectedIds.add(typeof edge.source === 'string' ? edge.source : edge.source.id);
    connectedIds.add(typeof edge.target === 'string' ? edge.target : edge.target.id);
  });
  const visibleNodes = payload.nodes.filter(
    (node) =>
      nodeTypes.has(node.node_type)
      && (
        normalizedSearch
          ? matchingIds.has(node.id) || connectedIds.has(node.id)
          : connectedIds.has(node.id) || node.node_type === 'material'
      ),
  );
  return { nodes: visibleNodes, edges: visibleEdges };
};
