import type { GraphReviewStatus, KnowledgeGraphEdge, KnowledgeGraphEvidenceRef } from '../types';

export type InteractiveGraphLevel = 'overview' | 'documents' | 'sections' | 'concepts';
export type GraphExplorerMode = 'semantic' | 'evidence';
export type SemanticAtlasLens = 'documents' | 'concepts' | 'places' | 'time';
export type SemanticEvidenceGroup =
  | 'metadata'
  | 'segments'
  | 'images'
  | 'observations'
  | 'concepts'
  | 'places'
  | 'times'
  | 'candidates';

export type SemanticEntityType =
  | 'material'
  | 'collection'
  | 'source_type'
  | 'concept'
  | 'place'
  | 'time_period'
  | 'agent';

export interface SemanticGraphEntity {
  id: string;
  type: SemanticEntityType;
  label: string;
  normalized_label: string;
  canonical_key: string;
  importance_score: number;
  mention_count: number;
  document_count: number;
  collection_count: number;
  degree: number;
  accepted_relation_count: number;
  review_relation_count: number;
  evidence_count: number;
  is_generic: boolean;
  is_bridge_entity: boolean;
  properties: Record<string, unknown>;
}

export interface SemanticGraphRelation {
  id: string;
  source: string;
  target: string;
  predicate: string;
  relation_family: 'structural' | 'bibliographic' | 'semantic' | 'spatial' | 'temporal';
  evidence_count: number;
  document_count: number;
  confidence: number;
  status: Exclude<GraphReviewStatus, 'unreviewed'>;
  extraction_method: string;
  properties: Record<string, unknown>;
  evidence_preview: string;
  evidence_ref: KnowledgeGraphEvidenceRef;
  created_at: string;
  updated_at: string;
}

export interface SemanticGraphPayload {
  query?: string | null;
  view: 'overview' | 'documents' | 'concepts' | 'places_time';
  nodes: SemanticGraphEntity[];
  edges: SemanticGraphRelation[];
  summary: Record<string, number>;
  hidden_summary: {
    hidden_mentions: number;
    hidden_candidate_relations: number;
    hidden_cooccurrence_candidates: number;
    unresolved_place_mentions: number;
    invalid_or_candidate_time_mentions: number;
    generic_entities_hidden: number;
  };
  evidence_note?: string;
}

export interface SemanticGraphCandidate {
  id: string;
  source: string;
  target: string;
  source_entity?: { id: string; label: string; entity_type: string };
  target_entity?: { id: string; label: string; entity_type: string };
  predicate: string;
  candidate_method: string;
  evidence_count: number;
  document_count: number;
  confidence: number;
  review_status: Exclude<GraphReviewStatus, 'unreviewed'>;
  rationale?: string | null;
  properties: Record<string, unknown>;
}

export interface SemanticEntityDetail {
  entity: SemanticGraphEntity;
  relations: SemanticGraphRelation[];
  connected_entities: SemanticGraphEntity[];
  related_materials: Array<{
    entity_id: string;
    material_id?: string | null;
    title: string;
    shared_concept_count: number;
    evidence_count: number;
  }>;
  candidates: SemanticGraphCandidate[];
  evidence_note?: string;
}

export interface SemanticEvidenceItem {
  id: string;
  evidence_type: string;
  entity_id?: string;
  surface_text?: string;
  mention_method?: string;
  confidence?: number;
  review_status?: Exclude<GraphReviewStatus, 'unreviewed'>;
  evidence_ref: KnowledgeGraphEvidenceRef;
}

export interface SemanticEntityEvidence {
  entity: SemanticGraphEntity;
  items: SemanticEvidenceItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface SemanticEvidenceFocus {
  document: InteractiveGraphNode;
  item: SemanticEvidenceItem;
}

export interface SemanticRelationEvidence {
  relation: SemanticGraphRelation;
  items: SemanticEvidenceItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface SemanticResolutionEvidence {
  material_id?: string;
  material_title?: string;
  segment_id?: number | string | null;
  image_id?: string | null;
  observation_id?: string | null;
  page_ref?: string | null;
  source_locator?: string | null;
  source?: string;
  snippet?: string;
}

export interface SemanticResolutionItem {
  id: string;
  mention_label: string;
  normalized_label: string;
  resolution_status: string;
  evidence_count: number;
  confidence?: number | null;
  notes?: string | null;
  evidence: SemanticResolutionEvidence[];
  time_type?: string;
  start_year?: number | null;
  end_year?: number | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface SemanticResolutionPayload {
  items: SemanticResolutionItem[];
  count: number;
  kind: 'place' | 'time';
}

export interface InteractiveGraphNode {
  id: string;
  label: string;
  node_type: string;
  level: 'material' | 'section' | 'concept';
  parent_id?: string | null;
  material_id?: string | null;
  segment_id?: number | string | null;
  image_id?: string | null;
  observation_id?: string | null;
  collection?: string | null;
  source_type?: string | null;
  year?: string | null;
  language?: string | null;
  region?: string | null;
  degree: number;
  confidence: number;
  review_status: GraphReviewStatus;
  properties: Record<string, unknown>;
  summary: string;
  semantic_entity?: SemanticGraphEntity;
  is_synthetic?: boolean;
  synthetic_kind?: 'cluster' | 'group' | 'summary';
  cluster_type?: string;
  node_count?: number;
  evidence_count?: number;
  document_count?: number;
  hidden_count?: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number;
  fy?: number;
}

export interface InteractiveGraphEdge extends KnowledgeGraphEdge {
  source: string | InteractiveGraphNode;
  target: string | InteractiveGraphNode;
  is_synthetic?: boolean;
  summary?: string;
  semantic_relation?: SemanticGraphRelation;
}

export interface InteractiveGraphCluster {
  id: string;
  label: string;
  cluster_type: string;
  node_ids: string[];
  summary: string;
}

export interface InteractiveGraphPayload {
  query?: string | null;
  material_id?: string | null;
  level?: InteractiveGraphLevel;
  include_rejected?: boolean;
  focus_node_id?: string;
  nodes: InteractiveGraphNode[];
  edges: InteractiveGraphEdge[];
  clusters: InteractiveGraphCluster[];
  summary: {
    material_count: number;
    section_count: number;
    concept_count: number;
    edge_count: number;
    review_needed_count: number;
  };
  evidence_note?: string;
}

export interface InteractiveGraphNodeDetail {
  node: InteractiveGraphNode;
  connected_nodes: Record<string, Array<Pick<InteractiveGraphNode, 'id' | 'label' | 'node_type' | 'level' | 'degree'>>>;
  edges: InteractiveGraphEdge[];
  evidence: InteractiveGraphEdge[];
  evidence_note?: string;
}

export interface GraphDiscoveryConcept {
  node_id: string;
  label: string;
  node_type: string;
  document_count: number;
  evidence_count: number;
  accepted_count: number;
  review_needed_count: number;
  documents: Array<{
    material_id: string;
    title: string;
    source_type?: string | null;
    year?: string | null;
    language?: string | null;
    region?: string | null;
    collection?: string | null;
  }>;
  snippets: string[];
}

export interface GraphDiscoveryDocument {
  material_id: string;
  title: string;
  source_type?: string | null;
  year?: string | null;
  language?: string | null;
  region?: string | null;
  collection?: string | null;
  status?: string | null;
  evidence_count: number;
  accepted_count: number;
  review_needed_count: number;
  sample_snippets: string[];
}

export interface GraphReviewQueueItem {
  edge: InteractiveGraphEdge;
  source_label: string;
  source_type: string;
  target_label: string;
  target_type: string;
  material?: GraphDiscoveryDocument | null;
  reason: string;
}

export interface GraphDiscoveryPayload {
  query?: string | null;
  material_id?: string | null;
  top_concepts: GraphDiscoveryConcept[];
  bridge_concepts: GraphDiscoveryConcept[];
  top_documents: GraphDiscoveryDocument[];
  related_documents: Array<{
    material: GraphDiscoveryDocument;
    shared_concept_count: number;
    shared_concepts: Array<{ node_id: string; label: string; node_type: string }>;
    relationship_strength: number;
    reason: string;
  }>;
  review_queue: GraphReviewQueueItem[];
  summary: {
    document_count: number;
    concept_count: number;
    bridge_concept_count: number;
    review_needed_count: number;
    edge_sample_count: number;
  };
  suggestions: string[];
  evidence_note?: string;
}

export type GraphSelection =
  | { kind: 'node'; node: InteractiveGraphNode }
  | { kind: 'edge'; edge: InteractiveGraphEdge }
  | null;

export interface GraphFilters {
  nodeTypes: string[];
  edgeTypes: string[];
  reviewStatuses: GraphReviewStatus[];
  confidence: number;
}

export type RepositoryFetch = (path: string, init?: RequestInit) => Promise<Response>;

export type GraphEvidenceOpener = (ref: KnowledgeGraphEvidenceRef) => void;

export const GRAPH_NODE_TYPES = [
  'cluster',
  'summary_group',
  'material',
  'segment',
  'image',
  'observation',
  'concept',
  'keyword',
  'place',
  'time_reference',
  'author',
];

export const GRAPH_EDGE_TYPES = [
  'contains',
  'authored_by',
  'has_keyword',
  'mentions_concept',
  'mentions_place',
  'mentions_time',
  'observation_of',
  'image_of',
  'semantically_related_to',
  'co_occurs_with',
];

export const SEMANTIC_NODE_TYPES: SemanticEntityType[] = [
  'material',
  'collection',
  'source_type',
  'concept',
  'place',
  'time_period',
  'agent',
];

export const SEMANTIC_EDGE_TYPES = [
  'belongs_to_collection',
  'has_source_type',
  'authored_by',
  'has_topic',
  'has_observation_topic',
  'related_to',
  'same_as',
  'broader_than',
  'narrower_than',
  'mentions_place',
  'mentions_time',
];

export const DEFAULT_GRAPH_FILTERS: GraphFilters = {
  nodeTypes: GRAPH_NODE_TYPES,
  edgeTypes: GRAPH_EDGE_TYPES.filter((edgeType) => edgeType !== 'co_occurs_with'),
  reviewStatuses: ['accepted', 'needs_review', 'unreviewed'],
  confidence: 0.65,
};

export const nodeTypeColor = (nodeType: string) => {
  if (nodeType === 'cluster') return '#9333ea';
  if (nodeType === 'summary_group') return '#0f766e';
  if (nodeType === 'material') return '#2563eb';
  if (nodeType === 'collection') return '#9333ea';
  if (nodeType === 'source_type') return '#475569';
  if (nodeType === 'segment') return '#64748b';
  if (nodeType === 'concept' || nodeType === 'keyword') return '#059669';
  if (nodeType === 'place') return '#d97706';
  if (nodeType === 'time_reference') return '#7c3aed';
  if (nodeType === 'time_period') return '#7c3aed';
  if (nodeType === 'image') return '#be123c';
  if (nodeType === 'observation') return '#0f766e';
  if (nodeType === 'author') return '#0891b2';
  if (nodeType === 'agent') return '#0891b2';
  return '#475569';
};

export const nodeRadius = (node: InteractiveGraphNode) => {
  if (node.node_type === 'cluster') return 9 + Math.min(8, (node.node_count || node.degree) * 0.28);
  if (node.node_type === 'summary_group') return 8 + Math.min(7, (node.node_count || node.degree) * 0.18);
  if (node.node_type === 'collection' || node.node_type === 'source_type') return 8 + Math.min(6, node.degree * 0.25);
  if (node.node_type === 'material') return 7 + Math.min(8, (node.evidence_count || node.degree) * 0.18);
  if (node.level === 'section') return 4 + Math.min(4, (node.evidence_count || node.degree) * 0.12);
  return 4 + Math.min(6, (node.document_count || node.evidence_count || node.degree) * 0.2);
};

export const resolveNodeId = (value: string | InteractiveGraphNode | undefined) => {
  if (!value) return '';
  return typeof value === 'string' ? value : value.id;
};

export const edgeSourceId = (edge: InteractiveGraphEdge) => resolveNodeId(edge.source);

export const edgeTargetId = (edge: InteractiveGraphEdge) => resolveNodeId(edge.target);

export const graphLevelLabel = (level: InteractiveGraphLevel) => {
  if (level === 'overview') return 'Overview';
  if (level === 'documents') return 'Documents';
  if (level === 'sections') return 'Sections';
  return 'Concepts';
};

export const selectionEvidenceRef = (selection: GraphSelection): KnowledgeGraphEvidenceRef | null => {
  if (!selection) return null;
  if (selection.kind === 'edge') return selection.edge.evidence_ref;
  const node = selection.node;
  if (!node.material_id) return null;
  return {
    material_id: node.material_id,
    segment_id: node.segment_id,
    image_id: node.image_id,
    observation_id: node.observation_id,
    page_ref: typeof node.properties.page_ref === 'string' ? node.properties.page_ref : null,
    source_locator: typeof node.properties.source_locator === 'string' ? node.properties.source_locator : null,
  };
};
