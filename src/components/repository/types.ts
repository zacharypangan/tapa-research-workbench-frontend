export interface RepositoryFile {
  id: string;
  material_id: string;
  original_filename: string;
  mime_type?: string | null;
  file_size: number;
  uploaded_at: string;
}

export interface ExtractionRunSummary {
  status?: string;
  warnings?: string | null;
  error_message?: string | null;
  created_at?: string;
}

export interface Material {
  id: string;
  title: string;
  authors?: string | null;
  year?: string | null;
  source_type: string;
  collection?: string | null;
  abstract_or_notes?: string | null;
  source_url?: string | null;
  language?: string | null;
  region?: string | null;
  uploaded_by?: string | null;
  raw_reference?: string | null;
  keywords?: string | null;
  auto_keywords?: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  file_count: number;
  observation_count?: number;
  observation_type_counts?: Record<string, number>;
  files?: RepositoryFile[];
  extraction_status?: string;
  segment_count?: number;
  latest_extraction_run?: ExtractionRunSummary | null;
}

export interface RepositoryWorkbenchProps {
  onOpenTutorial?: () => void;
  activeTutorialTarget?: string | null;
  onTutorialAction?: (target: string) => void;
  initialFocus?: 'search';
  focusSignal?: number;
  onGraphMapLayerReady?: (layer: KnowledgeGraphMapLayer) => void;
}

export interface ExtractedPreview {
  segments: Array<{
    id: number | string;
    source_kind?: string;
    source_locator?: string;
    page_ref?: string;
    page_index?: number;
    content_text?: string;
    text?: string;
    char_count?: number;
    created_at?: string;
  }>;
  discovered_links: Array<{
    id?: number | string;
    source_url?: string;
    discovered_url?: string;
    link_text?: string | null;
    title?: string | null;
    depth?: number;
    status?: string;
    created_at?: string;
  }>;
  images?: ImageEvidence[];
  runs: Array<{
    id: string;
    include_links?: number;
    max_link_depth?: number;
    max_link_pages?: number;
    extracted_segment_count: number;
    discovered_link_count: number;
    status: string;
    error_message?: string | null;
    warnings?: string | null;
    created_at: string;
  }>;
}

export interface Observation {
  id: string;
  material_id: string;
  source_segment_id?: number | null;
  source_image_id?: string | null;
  observation_type: string;
  observed_text: string;
  source_page_ref?: string | null;
  source_locator?: string | null;
  context_quote?: string | null;
  notes?: string | null;
  observed_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SearchResult {
  id: number;
  material_id: string;
  material_title: string;
  source_kind: string;
  source_locator: string;
  page_ref: string;
  snippet_text: string;
}

export interface SearchReportResult {
  segment_id: number | string;
  material_id: string;
  material_title: string;
  material_authors?: string | null;
  material_year?: string | null;
  source_kind: string;
  source_locator: string;
  page_ref: string;
  page_index: number;
  paragraph_index: number;
  matched_terms: string[];
  terms_in_context: string[];
  all_terms_in_context: boolean;
  before: string;
  match: string;
  after: string;
  context_text: string;
  sense?: string;
  research_relevance?: 'high' | 'medium' | 'low';
  relevance_reason?: string;
  evidence_type?: string;
  domain_relevance_score?: number;
  wordlist_rows?: Array<Record<string, string | number | null>>;
}

export interface SearchReport {
  query: string;
  query_terms: string[];
  context_window: number;
  total_matches: number;
  cooccurrence_count: number;
  results: SearchReportResult[];
}

export interface AIStatus {
  provider_configured: boolean;
  chat_configured?: boolean;
  embedding_configured?: boolean;
  embedding_model?: string;
  chat_model?: string;
  segment_count?: number;
  embedded_segment_count?: number;
  image_evidence_count?: number;
  embedded_image_count?: number;
  default_mode?: string;
  status_message?: string;
}

export interface SemanticResult {
  evidence_type?: string;
  segment_id: number;
  material_id: string;
  material_title: string;
  material_authors?: string | null;
  material_year?: string | null;
  source_kind: string;
  source_locator: string;
  page_ref: string;
  page_index: number;
  content_text: string;
  score: number;
  semantic_score?: number;
  retrieval_basis?: string;
  sense?: string;
  research_relevance?: 'high' | 'medium' | 'low';
  relevance_reason?: string;
  domain_relevance_score?: number;
  wordlist_rows?: Array<Record<string, string | number | null>>;
}

export interface ImageEvidence {
  evidence_type: 'document_image' | 'page_snapshot' | 'slide_image' | string;
  image_id: string;
  material_id: string;
  file_id?: string | null;
  material_title?: string;
  material_authors?: string | null;
  material_year?: string | null;
  source_kind: string;
  source_locator: string;
  page_ref: string;
  page_index: number;
  image_url: string;
  mime_type?: string | null;
  width?: number;
  height?: number;
  extraction_method?: string;
  ocr_text?: string | null;
  visual_caption?: string | null;
  semantic_score?: number;
  score?: number;
  matched_terms?: string[];
  contains_exact_term?: boolean;
  retrieval_basis?: string;
  evidence_level?: string;
  sense?: string;
  research_relevance?: 'high' | 'medium' | 'low';
  relevance_reason?: string;
  domain_relevance_score?: number;
  wordlist_rows?: Array<Record<string, string | number | null>>;
}

export interface SemanticSearchResponse {
  query: string;
  provider_configured: boolean;
  embedding_model?: string;
  results: SemanticResult[];
  image_results?: ImageEvidence[];
  related_observations: Observation[];
  evidence_note?: string;
}

export interface AskCorpusResponse {
  question: string;
  provider_configured: boolean;
  answer: string;
  citations?: Array<{
    material_id: string;
    material_title: string;
    material_authors?: string | null;
    material_year?: string | null;
    segment_id: number;
    page_ref: string;
    source_locator: string;
  }>;
  retrieved_passages?: SemanticResult[];
  image_results?: ImageEvidence[];
  related_observations?: Observation[];
  evidence_note?: string;
}

export interface AIEvidenceReport {
  query: string;
  provider_configured: boolean;
  themes: Array<{
    theme: string;
    material_id: string;
    material_title: string;
    citations: AskCorpusResponse['citations'];
    dominant_senses?: string[];
    high_relevance_count?: number;
    medium_relevance_count?: number;
    low_relevance_count?: number;
    passages: Array<{
      segment_id: number;
      page_ref: string;
      score: number;
      content_text: string;
      sense?: string;
      research_relevance?: 'high' | 'medium' | 'low';
      relevance_reason?: string;
      evidence_type?: string;
      domain_relevance_score?: number;
      wordlist_rows?: Array<Record<string, string | number | null>>;
    }>;
    image_passages?: ImageEvidence[];
  }>;
  image_results?: ImageEvidence[];
  related_observations: Observation[];
  evidence_note?: string;
}

export type GraphReviewStatus = 'accepted' | 'rejected' | 'needs_review' | 'unreviewed';

export interface KnowledgeGraphNode {
  id: string;
  node_type: string;
  label: string;
  normalized_label: string;
  properties: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeGraphEvidenceRef {
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

export interface KnowledgeGraphEdge {
  id: string;
  source_node_id: string;
  target_node_id: string;
  edge_type: string;
  weight: number;
  confidence: number;
  evidence_ref: KnowledgeGraphEvidenceRef;
  extraction_method: string;
  review_status: GraphReviewStatus;
  created_at: string;
}

export interface KnowledgeGraphNetwork {
  query?: string | null;
  material_id?: string | null;
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  summary: {
    seed_count: number;
    node_count: number;
    edge_count: number;
  };
  evidence_note?: string;
}

export interface KnowledgeGraphTimelineItem {
  time_label: string;
  sort_year?: number | null;
  source_node_id: string;
  source_label: string;
  source_type: string;
  edge: KnowledgeGraphEdge;
}

export interface KnowledgeGraphTimeline {
  query?: string | null;
  material_id?: string | null;
  items: KnowledgeGraphTimelineItem[];
  unresolved: KnowledgeGraphTimelineItem[];
  evidence_note?: string;
}

export interface KnowledgeGraphMapFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  properties: {
    place_label: string;
    source_label: string;
    source_type: string;
    edge_id: string;
    review_status: GraphReviewStatus;
    confidence: number;
    evidence_ref: KnowledgeGraphEvidenceRef;
  };
}

export interface KnowledgeGraphMapLayer {
  id: string;
  name: string;
  dataset: string;
  type: 'geojson';
  source: 'repository_knowledge_graph';
  visible: boolean;
  opacity: number;
  color: [number, number, number];
  coords: {
    lat: string;
    lon: string;
  };
  data: Array<Record<string, unknown>>;
  filteredData: Array<Record<string, unknown>>;
  geoData: {
    type: 'FeatureCollection';
    features: KnowledgeGraphMapFeature[];
  };
  isSpatial: boolean;
  pointSize: number;
  displayField: string;
  tooltipFields: string[];
  staged_at: string;
}

export interface KnowledgeGraphMapItem {
  place_label: string;
  source_node_id: string;
  source_label: string;
  source_type: string;
  edge: KnowledgeGraphEdge;
}

export interface KnowledgeGraphMap {
  query?: string | null;
  material_id?: string | null;
  geojson: {
    type: 'FeatureCollection';
    features: KnowledgeGraphMapFeature[];
  };
  unresolved: KnowledgeGraphMapItem[];
  evidence_note?: string;
}

export interface KnowledgeGraphBuildResult {
  build_id: string;
  scope: string;
  material_id?: string | null;
  status: string;
  material_count: number;
  node_count: number;
  edge_count: number;
}
