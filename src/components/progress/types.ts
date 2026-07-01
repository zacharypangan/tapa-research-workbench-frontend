export interface ProgressStatus {
  available: boolean;
  role: string;
  permissions: string[];
}

export interface ProgressMeeting {
  id: string;
  title_original: string;
  title_en?: string | null;
  title_ja?: string | null;
  meeting_date: string;
  location?: string | null;
  meeting_type: string;
  summary_en?: string | null;
  summary_ja?: string | null;
}

export interface TranscriptSegment {
  id: string;
  meeting_id: string;
  speaker_text?: string | null;
  start_seconds?: number | null;
  end_seconds?: number | null;
  original_text: string;
  language: string;
  translation_en?: string | null;
  translation_ja?: string | null;
  summary_en?: string | null;
  summary_ja?: string | null;
  source_locator: string;
  repository_material_id?: string | null;
  repository_segment_id?: number | null;
  reviewed: boolean;
}

export interface EvidenceCitation {
  id: string;
  source_kind: string;
  transcript_segment_id?: string | null;
  repository_material_id?: string | null;
  repository_segment_id?: number | null;
  source_locator?: string | null;
  citation_text_original?: string | null;
}

export interface ResearchRecord {
  id: string;
  record_type: string;
  title_original?: string | null;
  title_en?: string | null;
  title_ja?: string | null;
  summary_en?: string | null;
  summary_ja?: string | null;
  original_evidence?: string | null;
  meeting_id?: string | null;
  status: string;
  confidence?: number | null;
  details: Record<string, unknown>;
  evidence: EvidenceCitation[];
  created_by: string;
}

export interface MeetingDetailPayload {
  meeting: ProgressMeeting;
  sessions: Array<Record<string, unknown>>;
  presentations: Array<Record<string, unknown>>;
  materials: Array<{
    id: string;
    repository_material_id: string;
    link_status: string;
    notes?: string | null;
    repository_title?: string | null;
    original_filename?: string | null;
    source_type?: string | null;
    repository_status?: string | null;
    parser_status?: string | null;
    parser_message?: string | null;
  }>;
  transcript_segments: TranscriptSegment[];
  transcript_count: number;
  records: ResearchRecord[];
}

export interface TranscriptPage {
  segments: TranscriptSegment[];
  total: number;
  limit: number;
  offset: number;
}

export interface ProgressSearchResult {
  source_kind: 'research_record' | 'transcript_segment';
  source_id: string;
  meeting_id?: string | null;
  title?: string | null;
  original_text?: string | null;
  translation_en?: string | null;
  translation_ja?: string | null;
  summary_en?: string | null;
  summary_ja?: string | null;
  source_locator?: string | null;
  matched_term: string;
  retrieval_basis: 'original' | 'translation' | 'concept_alias';
  score: number;
}

export type ProgressApi = <T>(path: string, init?: RequestInit) => Promise<T>;
