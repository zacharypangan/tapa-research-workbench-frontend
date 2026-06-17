import type { GraphReviewStatus, KnowledgeGraphEdge, KnowledgeGraphEvidenceRef } from '../types';

export type InteractiveGraphLevel = 'overview' | 'documents' | 'sections' | 'concepts';

export interface InteractiveGraphNode {
  id: string;
  label: string;
  node_type: string;
  level: 'corpus' | 'material' | 'section' | 'concept';
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
  'corpus',
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
  'near_in_evidence',
];

export const DEFAULT_GRAPH_FILTERS: GraphFilters = {
  nodeTypes: GRAPH_NODE_TYPES,
  edgeTypes: GRAPH_EDGE_TYPES,
  reviewStatuses: ['accepted', 'needs_review', 'unreviewed'],
  confidence: 0,
};

export const nodeTypeColor = (nodeType: string) => {
  if (nodeType === 'material') return '#2563eb';
  if (nodeType === 'segment') return '#64748b';
  if (nodeType === 'concept' || nodeType === 'keyword') return '#059669';
  if (nodeType === 'place') return '#d97706';
  if (nodeType === 'time_reference') return '#7c3aed';
  if (nodeType === 'image') return '#be123c';
  if (nodeType === 'observation') return '#0f766e';
  if (nodeType === 'author') return '#0891b2';
  if (nodeType === 'corpus') return '#111827';
  return '#475569';
};

export const nodeRadius = (node: InteractiveGraphNode) => {
  if (node.node_type === 'corpus') return 10;
  if (node.node_type === 'material') return 7 + Math.min(7, node.degree * 0.35);
  if (node.level === 'section') return 5 + Math.min(4, node.degree * 0.2);
  return 4 + Math.min(4, node.degree * 0.18);
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
