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

export interface ProgressStructureSummary {
  session_count: number;
  presentation_count: number;
  material_count: number;
  presentation_material_count: number;
  transcript_material_count: number;
  has_presentations: boolean;
  transcript_only: boolean;
  generated_session_count: number;
  generated_presentation_count: number;
  related_arc_count: number;
}

export interface ProgressSession {
  id: string;
  meeting_id: string;
  title_original: string;
  title_en?: string | null;
  title_ja?: string | null;
  session_type: string;
  start_time?: string | null;
  end_time?: string | null;
  order_index: number;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  generated: boolean;
  presentation_count: number;
  material_count: number;
}

export interface ProgressPresentation {
  id: string;
  meeting_id: string;
  session_id?: string | null;
  presenter_member_id?: string | null;
  title_original: string;
  title_en?: string | null;
  title_ja?: string | null;
  language_primary: string;
  start_time?: string | null;
  end_time?: string | null;
  order_index: number;
  summary_en?: string | null;
  summary_ja?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  generated: boolean;
  material_count: number;
}

export interface MeetingMaterialLink {
  id: string;
  repository_material_id: string;
  presentation_id?: string | null;
  link_status: string;
  notes?: string | null;
  repository_title?: string | null;
  original_filename?: string | null;
  source_type?: string | null;
  repository_status?: string | null;
  parser_status?: string | null;
  parser_message?: string | null;
  raw_reference?: string | null;
  display_title: string;
  group_key: string;
  is_transcript_source: boolean;
  presentation_title?: string | null;
  generated_presentation: boolean;
}

export interface NarrativeArc {
  id: string;
  title_en: string;
  title_ja: string;
  description_en: string;
  description_ja: string;
  status: string;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface NarrativeArcLink {
  id: string;
  source_kind: string;
  source_id: string;
  role_in_arc: string;
  summary_en?: string | null;
  summary_ja?: string | null;
  confidence?: number | null;
  order_index: number;
  notes?: string | null;
  meeting_id?: string | null;
  meeting_date?: string | null;
  source_label: string;
  source_status?: string | null;
  source_record_type?: string | null;
  is_current_meeting: boolean;
}

export interface NarrativeArcDetail {
  arc: NarrativeArc;
  links: NarrativeArcLink[];
  link_count: number;
  current_meeting_steps: number;
}

export interface NarrativeTreatmentCard {
  title: string;
  description: string;
}

export interface ProgressTimelineEntry {
  meeting: ProgressMeeting;
  session_count: number;
  presentation_count: number;
  material_count: number;
  transcript_count: number;
  record_count: number;
  accepted_record_count: number;
  narrative_arc_step_count: number;
  featured_record_titles: string[];
  arc_titles: string[];
}

export interface ProjectProgressSummary {
  meeting_count: number;
  session_count: number;
  presentation_count: number;
  material_count: number;
  record_count: number;
  accepted_record_count: number;
  narrative_arc_count: number;
  transcript_segment_count: number;
}

export interface ProjectProgressDashboard {
  summary: ProjectProgressSummary;
  narrative_treatment: NarrativeTreatmentCard[];
  timeline: ProgressTimelineEntry[];
  arcs: NarrativeArcDetail[];
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
  structure: ProgressStructureSummary;
  sessions: ProgressSession[];
  presentations: ProgressPresentation[];
  materials: MeetingMaterialLink[];
  transcript_segments: TranscriptSegment[];
  transcript_count: number;
  records: ResearchRecord[];
  related_arcs: NarrativeArcDetail[];
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
