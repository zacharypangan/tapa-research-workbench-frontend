export const EMPTY_FORM = {
  title: '',
  authors: '',
  year: '',
  source_type: 'other',
  collection: '',
  abstract_or_notes: '',
  source_url: '',
  language: '',
  region: '',
  uploaded_by: '',
  raw_reference: '',
  keywords: '',
  auto_keywords: '',
  status: 'needs_metadata',
};

export const EMPTY_LINK_FORM = {
  title: '',
  source_url: '',
  source_type: 'other',
};

export const EMPTY_OBSERVATION_FORM = {
  observation_type: 'term',
  observed_text: '',
  source_segment_id: '',
  source_image_id: '',
  source_page_ref: '',
  source_locator: '',
  context_quote: '',
  notes: '',
  observed_by: '',
};

export const STATUS_LABELS: Record<string, string> = {
  uploaded: 'Needs Triage',
  needs_metadata: 'Describe Source',
  ready_for_text_extraction: 'Ready to Extract',
  metadata_complete: 'Annotate Evidence',
  needs_review: 'Review Evidence',
};

export const EXTRACTION_STATUS_LABELS: Record<string, string> = {
  not_extracted: 'Not Extracted',
  extracting: 'Extracting',
  extracted: 'Extracted',
  no_text_found: 'No Text',
  extract_error: 'Error',
};

export const SOURCE_TYPE_LABELS: Record<string, string> = {
  anthropological_record: 'Anthropological Record',
  bibliography: 'Bibliography',
  dictionary: 'Dictionary',
  ethnography: 'Ethnography',
  other: 'Other',
  pdf: 'PDF',
  presentation: 'Presentation',
  publication: 'Publication',
  slide: 'Slide',
  workshop_material: 'Workshop Material',
};

export const OBSERVATION_TYPE_LABELS: Record<string, string> = {
  term: 'Term',
  motif: 'Motif',
  place: 'Place',
  material: 'Material',
  process: 'Process',
  other: 'Other',
};
