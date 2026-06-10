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
  onClose: () => void;
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
