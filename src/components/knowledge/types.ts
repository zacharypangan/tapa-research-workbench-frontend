export interface ResearchRun {
  run_id: string;
  title?: string;
  status: string;
  stage: string;
  created_at: string;
  updated_at: string;
  research_topic?: string;
  max_pages?: number;
  augmentation_enabled?: boolean;
  document_count?: number;
  documents?: Array<{ source_id: string; title: string; locator: string }>;
  artifacts: string[];
  job_id?: string;
  job_status?: string;
  detail?: string;
  error_type?: string;
  missing_batch_ids?: string[];
  rejected_batch_ids?: string[];
  entity_count?: number;
  assertion_count?: number;
  alignment_count?: number;
  rejection_count?: number;
  release_path?: string;
  release_summary?: { counts: Record<string, number>; release_kind: string };
}

export interface RunList { items: ResearchRun[]; total: number; limit: number; offset: number }

export interface Capabilities {
  can_write: boolean;
  can_review: boolean;
  extraction: {
    configured: boolean;
    processing_version?: string;
    default_mode: string;
    modes: Array<{ id: string; label: string; available: boolean }>;
  };
  supported_formats: string[];
  limits: { max_documents: number; max_pages: number };
  statuses: Record<string, string>;
  collection?: { available: boolean; engine: string; label: string; detail: string; discovery_methods?: string[] };
  ontology_templates?: Array<{ id: string; label: string }>;
}

export interface GraphSource {
  source_id: string;
  title: string;
  origin?: string;
  source_kind?: string;
  source_locator?: string;
  source_url?: string;
  requested_url?: string;
  seed_ids?: string[];
  acquisition_method?: string;
  snapshot_sha256?: string;
  source_version_id?: string;
}

export interface GraphEntity {
  entity_id: string;
  entity_type: string;
  label_original: string;
  label_en?: string;
  source_id: string;
  evidence_ids: string[];
  scope?: Record<string, unknown>;
  review_status?: string;
  candidate_version?: string;
}

export interface GraphEvidence {
  evidence_id: string;
  source_id: string;
  text: string;
  locator: Record<string, unknown> | string;
  character_locator?: Record<string, unknown>;
  unit_id?: string;
  source_version_id?: string;
}

export interface GraphStatement {
  assertion_id?: string;
  alignment_id?: string;
  candidate_id?: string;
  subject_id: string;
  predicate: string;
  object_id?: string;
  value?: unknown;
  source_id?: string;
  evidence_ids: string[];
  scope: Record<string, unknown>;
  polarity: string;
  epistemic_kind?: string;
  rationale?: string;
  basis?: string;
  review_status?: string;
  scientific_status?: string;
  candidate_version?: string;
}

export interface ReviewDecision {
  candidate_id: string;
  decision: 'accept' | 'reject';
  rationale: string;
  actor_id?: string;
  at?: string;
  candidate_version?: string;
}

export interface GraphData {
  partial_extraction?: boolean;
  pending_batch_count?: number;
  entities: GraphEntity[];
  evidence: GraphEvidence[];
  sources: GraphSource[];
  assertions: GraphStatement[];
  alignments: GraphStatement[];
  decisions?: ReviewDecision[];
  release_kind?: string;
}

export interface ResearchSeed {
  seed_id: string;
  entity_id: string;
  source_id: string;
  label: string;
  entity_type: string;
  question: string;
  queries: string[];
}

export interface AnnotationBatch {
  batch_id: string;
  source_id: string;
  units: Array<{ unit_id: string; text: string; locator: unknown }>;
}

export type ResearchApi = <T>(path: string, init?: RequestInit) => Promise<T>;

export interface OntologySpec {
  version: string;
  entity_types: Record<string, unknown>;
  predicates: Record<string, {
    definition?: string;
    subject_types?: string[];
    object_types?: string[];
    domain?: string[];
    range?: string[];
    requires_object?: boolean;
    requires_case_scope?: boolean;
  }>;
}
