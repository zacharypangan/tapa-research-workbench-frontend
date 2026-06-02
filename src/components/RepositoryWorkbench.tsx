import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { API_BASE_URL } from '../config';

interface RepositoryFile {
  id: string;
  material_id: string;
  original_filename: string;
  mime_type?: string | null;
  file_size: number;
  uploaded_at: string;
}

interface ExtractionRunSummary {
  status?: string;
  warnings?: string | null;
  error_message?: string | null;
  created_at?: string;
}

interface Material {
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

interface RepositoryWorkbenchProps {
  onClose: () => void;
}


interface ExtractedPreview {
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

interface Observation {
  id: string;
  material_id: string;
  source_segment_id?: number | null;
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

interface SearchResult {
  id: number;
  material_id: string;
  material_title: string;
  source_kind: string;
  source_locator: string;
  page_ref: string;
  snippet_text: string;
}

interface SearchReportResult {
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
}

interface SearchReport {
  query: string;
  query_terms: string[];
  context_window: number;
  total_matches: number;
  cooccurrence_count: number;
  results: SearchReportResult[];
}

interface AIStatus {
  provider_configured: boolean;
  embedding_model?: string;
  chat_model?: string;
  segment_count?: number;
  embedded_segment_count?: number;
  default_mode?: string;
  status_message?: string;
}

interface SemanticResult {
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
}

interface SemanticSearchResponse {
  query: string;
  provider_configured: boolean;
  embedding_model?: string;
  results: SemanticResult[];
  related_observations: Observation[];
  evidence_note?: string;
}

interface AskCorpusResponse {
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
  related_observations?: Observation[];
  evidence_note?: string;
}

interface AIEvidenceReport {
  query: string;
  provider_configured: boolean;
  themes: Array<{
    theme: string;
    material_id: string;
    material_title: string;
    citations: AskCorpusResponse['citations'];
    passages: Array<{
      segment_id: number;
      page_ref: string;
      score: number;
      content_text: string;
    }>;
  }>;
  related_observations: Observation[];
  evidence_note?: string;
}

const EMPTY_FORM = {
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

const EMPTY_LINK_FORM = {
  title: '',
  source_url: '',
  source_type: 'other',
};

const EMPTY_OBSERVATION_FORM = {
  observation_type: 'term',
  observed_text: '',
  source_segment_id: '',
  source_page_ref: '',
  source_locator: '',
  context_quote: '',
  notes: '',
  observed_by: '',
};

const STATUS_LABELS: Record<string, string> = {
  uploaded: 'Uploaded',
  needs_metadata: 'Needs Metadata',
  metadata_complete: 'Complete',
  needs_review: 'Needs Review',
  ready_for_text_extraction: 'Ready',
};

const EXTRACTION_STATUS_LABELS: Record<string, string> = {
  not_extracted: 'Not Extracted',
  extracting: 'Extracting',
  extracted: 'Extracted',
  no_text_found: 'No Text',
  extract_error: 'Error',
};

const SOURCE_TYPE_LABELS: Record<string, string> = {
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

const OBSERVATION_TYPE_LABELS: Record<string, string> = {
  term: 'Term',
  motif: 'Motif',
  place: 'Place',
  material: 'Material',
  process: 'Process',
  other: 'Other',
};

function compactPayload(form: typeof EMPTY_FORM) {
  return Object.fromEntries(
    Object.entries(form).map(([key, value]) => [
      key,
      typeof value === 'string' && value.trim() === '' ? null : value,
    ]),
  );
}

function guessSourceType(file: File) {
  const name = file.name.toLowerCase();
  if (file.type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (name.endsWith('.ppt') || name.endsWith('.pptx')) return 'presentation';
  if (name.endsWith('.bib') || name.endsWith('.ris')) return 'bibliography';
  return 'other';
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function getExtractionBadgeClass(status?: string) {
  switch (status) {
    case 'extracted':
      return 'bg-green-100 text-green-700';
    case 'extracting':
      return 'bg-blue-100 text-blue-700';
    case 'no_text_found':
      return 'bg-amber-100 text-amber-700';
    case 'extract_error':
      return 'bg-red-100 text-red-700';
    case 'not_extracted':
    default:
      return 'bg-slate-100 text-slate-600';
  }
}

function getObservationBadgeClass(type?: string) {
  switch (type) {
    case 'term':
      return 'bg-blue-50 text-blue-700';
    case 'motif':
      return 'bg-rose-50 text-rose-700';
    case 'place':
      return 'bg-emerald-50 text-emerald-700';
    case 'material':
      return 'bg-amber-50 text-amber-700';
    case 'process':
      return 'bg-violet-50 text-violet-700';
    default:
      return 'bg-slate-100 text-slate-600';
  }
}

function getObservationTypeHint(type: string) {
  switch (type) {
    case 'term':
      return 'Words, local names, lexical forms, or named expressions observed in the source.';
    case 'motif':
      return 'Visual forms, design elements, patterns, or repeated marks observed in the source.';
    case 'place':
      return 'Locations, regions, islands, villages, or spatial references observed in the source.';
    case 'material':
      return 'Plants, fibers, tools, pigments, substances, or physical inputs observed in the source.';
    case 'process':
      return 'Actions, production steps, preparation methods, or handling procedures observed in the source.';
    default:
      return 'Observed evidence that does not yet fit another capture type.';
  }
}

function truncateText(value?: string | null, maxLength = 240) {
  if (!value) return '';
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trim()}...`;
}

function formatLinkStatus(status?: string) {
  switch (status) {
    case 'ok':
      return 'Accessible';
    case 'access_restricted':
      return 'Access restricted';
    case 'fetch_error':
      return 'Fetch failed';
    default:
      return status || 'Unknown';
  }
}

function getSegmentText(segment: ExtractedPreview['segments'][number]) {
  return cleanAnnotationText(segment.content_text || segment.text || 'No preview text returned for this segment.');
}

function cleanAnnotationText(text: string) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const nonEmpty = lines.filter((line) => line.trim());
  if (nonEmpty.length < 6) return text.trim();

  const leadingNumbered = nonEmpty.filter((line) => /^\s*\d{1,4}\s+\S/.test(line) || /^\s*\d{1,4}\s*$/.test(line)).length;
  const trailingNumbered = nonEmpty.filter((line) => /\S\s+\d{1,4}\s*$/.test(line)).length;
  const hasDenseLeadingNumbers = leadingNumbered >= 5 && leadingNumbered / nonEmpty.length >= 0.25;
  const hasDenseTrailingNumbers = trailingNumbered >= 5 && trailingNumbered / nonEmpty.length >= 0.25;

  if (!hasDenseLeadingNumbers && !hasDenseTrailingNumbers) return text.trim();

  const cleanedLines = lines.flatMap((line) => {
    let cleaned = line;
    if (hasDenseLeadingNumbers) {
      if (/^\s*\d{1,4}\s*$/.test(cleaned)) return [];
      cleaned = cleaned.replace(/^\s*\d{1,4}\s+(?=\S)/, '');
    }
    if (hasDenseTrailingNumbers) {
      cleaned = cleaned.replace(/(?<=\S)\s+\d{1,4}\s*$/, '');
    }
    return [cleaned];
  });

  return cleanedLines
    .join('\n')
    .replace(/([A-Za-z])-\n([A-Za-z])/g, '$1$2')
    .replace(/(?<!\n)\n(?!\n)/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function highlightSearchTermsHtml(text: string, terms: string[]) {
  const escapedText = escapeHtml(text);

  const expandedTerms = terms.flatMap((term) => {
    const normalized = term.toLowerCase().trim();

    if (
      normalized === 'beat' ||
      normalized === 'beat verb' ||
      normalized === 'beat (verb)'
    ) {
      return ['beating', 'beaten', 'beats', 'beat'];
    }

    return [term];
  });

  const patterns = expandedTerms
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map((term) => escapeHtml(term).replace(/\s+/g, '\\s+'));

  if (!patterns.length) {
    return escapedText;
  }

  const regex = new RegExp(`(${patterns.join('|')})`, 'gi');

  return escapedText.replace(
    regex,
    '<mark class="term-highlight">$1</mark>',
  );
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildHighlightRegex(terms: string[]) {
  const expandedTerms = terms.flatMap((term) => {
    const normalized = term.toLowerCase().trim();

    if (normalized === 'beat' || normalized === 'beat verb' || normalized === 'beat (verb)') {
      return ['beat', 'beats', 'beating', 'beaten'];
    }

    return [term];
  });

  const patterns = expandedTerms
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map((term) => escapeRegExp(term).replace(/\s+/g, '\\s+'));

  if (!patterns.length) return null;

  return new RegExp(`(${patterns.join('|')})`, 'gi');
}

function buildQueryTerms(query: string) {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const commaTerms = trimmed
    .split(',')
    .map((term) => term.trim())
    .filter((term) => term.length > 1);

  if (commaTerms.length > 1) return commaTerms;

  const wordTerms = trimmed
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 2);

  return [trimmed, ...wordTerms];
}

function highlightSearchTerms(text: string, terms: string[]) {
  const regex = buildHighlightRegex(terms);

  if (!regex || !text) {
    return text;
  }

  const parts = text.split(regex);

  return parts.map((part, index) => {
    if (regex.test(part)) {
      regex.lastIndex = 0;
      return (
        <mark key={`${part}-${index}`} className="rounded bg-amber-200 px-0.5 text-slate-950">
          {part}
        </mark>
      );
    }

    regex.lastIndex = 0;
    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

async function parseErrorResponse(response: Response, fallback: string) {
  try {
    const data = await response.json();
    if (typeof data?.detail === 'string') return data.detail;
    if (typeof data?.message === 'string') return data.message;
  } catch {
    // Fall through to status text fallback.
  }
  return `${fallback} (${response.status})`;
}

export default function RepositoryWorkbench({ onClose }: RepositoryWorkbenchProps) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [sourceTypes, setSourceTypes] = useState<string[]>(Object.keys(SOURCE_TYPE_LABELS));
  const [statuses, setStatuses] = useState<string[]>(Object.keys(STATUS_LABELS));
  const [observationTypes, setObservationTypes] = useState<string[]>(Object.keys(OBSERVATION_TYPE_LABELS));
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isCreatingLink, setIsCreatingLink] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkForm, setLinkForm] = useState(EMPTY_LINK_FORM);
  const [repositoryApiAvailable, setRepositoryApiAvailable] = useState(true);
  const [extractedPreview, setExtractedPreview] = useState<ExtractedPreview | null>(null);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [observationForm, setObservationForm] = useState(EMPTY_OBSERVATION_FORM);
  const [editingObservationId, setEditingObservationId] = useState<string | null>(null);
  const [isSavingObservation, setIsSavingObservation] = useState(false);
  const [extractingMaterialId, setExtractingMaterialId] = useState<string | null>(null);
  const [isExtractedModalOpen, setIsExtractedModalOpen] = useState(false);
  const [extractedModalTab, setExtractedModalTab] = useState<'segments' | 'links' | 'observations' | 'runs'>('segments');
  const [fullTextQuery, setFullTextQuery] = useState('');
  const [isSearchingText, setIsSearchingText] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isGeneratingSearchReport, setIsGeneratingSearchReport] = useState(false);
  const [searchReport, setSearchReport] = useState<SearchReport | null>(null);
  const [showSearchReportModal, setShowSearchReportModal] = useState(false);
  const [aiStatus, setAiStatus] = useState<AIStatus | null>(null);
  const [semanticResults, setSemanticResults] = useState<SemanticSearchResponse | null>(null);
  const [askCorpusResult, setAskCorpusResult] = useState<AskCorpusResponse | null>(null);
  const [aiEvidenceReport, setAiEvidenceReport] = useState<AIEvidenceReport | null>(null);
  const [isRunningSemanticSearch, setIsRunningSemanticSearch] = useState(false);
  const [isAskingCorpus, setIsAskingCorpus] = useState(false);
  const [isGeneratingAiReport, setIsGeneratingAiReport] = useState(false);
  const [targetSegmentId, setTargetSegmentId] = useState<number | string | null>(null);
  const [isPreparingReportPrint] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const segmentListRef = useRef<HTMLDivElement | null>(null);

  const buildRepositoryUrls = useCallback((path: string) => {
    return [`${API_BASE_URL}/repository${path}`, `${API_BASE_URL}${path}`];
  }, []);

  const repositoryFetch = useCallback(
    async (path: string, init?: RequestInit) => {
      const urls = buildRepositoryUrls(path);
      let lastResponse: Response | null = null;
      for (const url of urls) {
        const response = await fetch(url, init);
        if (response.status !== 404) return response;
        lastResponse = response;
      }
      return lastResponse ?? fetch(urls[0], init);
    },
    [buildRepositoryUrls],
  );

  const selectedStatusCount = useMemo(() => {
    return materials.filter((material) => material.status === statusFilter).length;
  }, [materials, statusFilter]);

  const queueCounts = useMemo(() => {
    return statuses.reduce<Record<string, number>>((acc, status) => {
      acc[status] = materials.filter((material) => material.status === status).length;
      return acc;
    }, {});
  }, [materials, statuses]);

  const observationTypeCounts = useMemo(() => {
    return observations.reduce<Record<string, number>>((acc, observation) => {
      acc[observation.observation_type] = (acc[observation.observation_type] || 0) + 1;
      return acc;
    }, {});
  }, [observations]);

  const sourceLinkedObservationCount = useMemo(() => {
    return observations.filter(
      (observation) =>
        observation.source_segment_id ||
        observation.source_page_ref ||
        observation.source_locator,
    ).length;
  }, [observations]);

  const evidenceAssistantReady = Boolean(aiStatus?.provider_configured);
  const activeQueryTerms = useMemo(() => buildQueryTerms(fullTextQuery), [fullTextQuery]);

  const loadMaterials = useCallback(async () => {
    const params = new URLSearchParams();
    if (search.trim()) params.set('q', search.trim());
    if (statusFilter) params.set('status', statusFilter);
    const response = await repositoryFetch(`/materials?${params}`);
    if (!response.ok) {
      const message = await parseErrorResponse(response, 'Failed to load repository materials');
      throw new Error(message);
    }
    const data = await response.json();
    setMaterials(data.materials || []);
    if (!selectedId && data.materials?.[0]) {
      setSelectedId(data.materials[0].id);
    }
  }, [repositoryFetch, search, selectedId, statusFilter]);

  const loadSelectedMaterial = useCallback(async (id: string | null) => {
    if (!id) {
      setSelectedMaterial(null);
      return;
    }
    const response = await repositoryFetch(`/materials/${id}`);
    if (response.status === 404) {
      setSelectedId(null);
      setSelectedMaterial(null);
      setIsCreating(false);
      return;
    }
    if (!response.ok) {
      const message = await parseErrorResponse(response, 'Failed to load material');
      throw new Error(message);
    }
    const material = await response.json();
    setSelectedMaterial(material);
    setForm({
      title: material.title || '',
      authors: material.authors || '',
      year: material.year || '',
      source_type: material.source_type || 'other',
      collection: material.collection || '',
      abstract_or_notes: material.abstract_or_notes || '',
      source_url: material.source_url || '',
      language: material.language || '',
      region: material.region || '',
      uploaded_by: material.uploaded_by || '',
      raw_reference: material.raw_reference || '',
      keywords: material.keywords || '',
      auto_keywords: material.auto_keywords || '',
      status: material.status || 'needs_metadata',
    });
    setIsCreating(false);
  }, [repositoryFetch]);

  useEffect(() => {
    repositoryFetch('/source-types')
      .then((response) => (response.ok ? response.json() : { source_types: Object.keys(SOURCE_TYPE_LABELS) }))
      .then((data) => setSourceTypes(data.source_types || Object.keys(SOURCE_TYPE_LABELS)))
      .catch(() => {});
    repositoryFetch('/statuses')
      .then((response) => {
        if (response.status === 404) {
          setRepositoryApiAvailable(false);
          return { statuses: Object.keys(STATUS_LABELS) };
        }
        setRepositoryApiAvailable(response.ok);
        return response.ok ? response.json() : { statuses: Object.keys(STATUS_LABELS) };
      })
      .then((data) => setStatuses(data.statuses || Object.keys(STATUS_LABELS)))
      .catch(() => {});
    repositoryFetch('/observation-types')
      .then((response) => (response.ok ? response.json() : { observation_types: Object.keys(OBSERVATION_TYPE_LABELS) }))
      .then((data) => setObservationTypes(data.observation_types || Object.keys(OBSERVATION_TYPE_LABELS)))
      .catch(() => {});
    repositoryFetch('/ai/status')
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => setAiStatus(data))
      .catch(() => {});
  }, [repositoryFetch]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadMaterials().catch((err) => {
        setError(getErrorMessage(err, 'Failed to load repository'));
      });
    }, 200);
    return () => window.clearTimeout(timer);
  }, [loadMaterials]);

  useEffect(() => {
    loadSelectedMaterial(selectedId).catch((err) => {
      setError(getErrorMessage(err, 'Failed to load material'));
    });
  }, [loadSelectedMaterial, selectedId]);

  const startNewMaterial = () => {
    setSelectedId(null);
    setSelectedMaterial(null);
    setForm(EMPTY_FORM);
    setIsCreating(true);
  };

  const saveMaterial = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const payload = compactPayload(form);
      const response = await repositoryFetch(
        isCreating
          ? '/materials'
          : `/materials/${selectedMaterial?.id}`,
        {
          method: isCreating ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      if (!response.ok) {
        const message = await parseErrorResponse(response, 'Failed to save material');
        throw new Error(message);
      }
      const saved = await response.json();
      setSelectedId(saved.id);
      setIsCreating(false);
      await loadMaterials();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to save material'));
    } finally {
      setIsSaving(false);
    }
  };

  const uploadFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setIsUploading(true);
    setError(null);
    try {
      let firstCreatedId: string | null = null;
      for (const file of Array.from(files)) {
        const createResponse = await repositoryFetch('/materials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: file.name.replace(/\.[^.]+$/, ''),
            source_type: guessSourceType(file),
            status: 'needs_metadata',
          }),
        });
        if (!createResponse.ok) {
          const message = await parseErrorResponse(createResponse, `Failed to create record for ${file.name}`);
          throw new Error(message);
        }
        const material = await createResponse.json();
        firstCreatedId = firstCreatedId || material.id;

        const params = new URLSearchParams({
          filename: file.name,
          mime_type: file.type || 'application/octet-stream',
        });
        const fileResponse = await repositoryFetch(
          `/materials/${material.id}/files?${params}`,
          {
            method: 'POST',
            headers: { 'Content-Type': file.type || 'application/octet-stream' },
            body: file,
          },
        );
        if (!fileResponse.ok) {
          const message = await parseErrorResponse(fileResponse, `Failed to upload ${file.name}`);
          throw new Error(message);
        }
      }
      await loadMaterials();
      if (firstCreatedId) setSelectedId(firstCreatedId);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to upload files'));
    } finally {
      setIsUploading(false);
    }
  };

  const updateForm = (key: keyof typeof EMPTY_FORM, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const loadExtractedPreview = useCallback(async (materialId: string) => {
    const response = await repositoryFetch(`/materials/${materialId}/extracted`);
    if (!response.ok) return;
    const data = await response.json();
    setExtractedPreview(data);
  }, [repositoryFetch]);

  const loadObservations = useCallback(async (materialId: string) => {
    const response = await repositoryFetch(`/materials/${materialId}/observations`);
    if (!response.ok) return;
    const data = await response.json();
    setObservations(data.observations || []);
    if (data.observation_types) {
      setObservationTypes(data.observation_types);
    }
  }, [repositoryFetch]);

  const updateObservationForm = (key: keyof typeof EMPTY_OBSERVATION_FORM, value: string) => {
    setObservationForm((current) => ({ ...current, [key]: value }));
  };

  const openAnnotationWorkspace = (
    materialId: string,
    tab: 'segments' | 'links' | 'observations' | 'runs' = 'segments',
    segmentId?: number | string | null,
  ) => {
    setSelectedId(materialId);
    setExtractedModalTab(tab);
    setTargetSegmentId(segmentId ?? null);
    setIsExtractedModalOpen(true);
  };

  const resetObservationForm = () => {
    setObservationForm(EMPTY_OBSERVATION_FORM);
    setEditingObservationId(null);
  };

  const startObservationFromSegment = (segment: ExtractedPreview['segments'][number]) => {
    const segmentText = getSegmentText(segment);
    const selectedText = window.getSelection()?.toString().trim() || '';
    setObservationForm({
      ...EMPTY_OBSERVATION_FORM,
      observed_text: selectedText,
      source_segment_id: String(segment.id || ''),
      source_page_ref: segment.page_ref || '',
      source_locator: segment.source_locator || '',
      context_quote: segmentText,
    });
    setExtractedModalTab('observations');
  };

  const editObservation = (observation: Observation) => {
    setObservationForm({
      observation_type: observation.observation_type || 'term',
      observed_text: observation.observed_text || '',
      source_segment_id: observation.source_segment_id ? String(observation.source_segment_id) : '',
      source_page_ref: observation.source_page_ref || '',
      source_locator: observation.source_locator || '',
      context_quote: observation.context_quote || '',
      notes: observation.notes || '',
      observed_by: observation.observed_by || '',
    });
    setEditingObservationId(observation.id);
    setExtractedModalTab('observations');
  };

  const saveObservation = async () => {
    if (!selectedMaterial?.id) return;
    if (!observationForm.observed_text.trim()) {
      setError('Observed text is required.');
      return;
    }

    setIsSavingObservation(true);
    setError(null);

    try {
      const payload = {
        observation_type: observationForm.observation_type,
        observed_text: observationForm.observed_text.trim(),
        source_segment_id: observationForm.source_segment_id
          ? Number(observationForm.source_segment_id)
          : null,
        source_page_ref: observationForm.source_page_ref.trim() || null,
        source_locator: observationForm.source_locator.trim() || null,
        context_quote: observationForm.context_quote.trim() || null,
        notes: observationForm.notes.trim() || null,
        observed_by: observationForm.observed_by.trim() || null,
      };

      const response = await repositoryFetch(
        editingObservationId
          ? `/materials/${selectedMaterial.id}/observations/${editingObservationId}`
          : `/materials/${selectedMaterial.id}/observations`,
        {
          method: editingObservationId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        const message = await parseErrorResponse(response, 'Failed to save observation');
        throw new Error(message);
      }

      resetObservationForm();
      await loadObservations(selectedMaterial.id);
      await loadMaterials();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to save observation'));
    } finally {
      setIsSavingObservation(false);
    }
  };

  const deleteObservation = async (observationId: string) => {
    if (!selectedMaterial?.id) return;
    const confirmed = window.confirm('Delete this observation?');
    if (!confirmed) return;

    setError(null);

    try {
      const response = await repositoryFetch(
        `/materials/${selectedMaterial.id}/observations/${observationId}`,
        { method: 'DELETE' },
      );

      if (!response.ok) {
        const message = await parseErrorResponse(response, 'Failed to delete observation');
        throw new Error(message);
      }

      if (editingObservationId === observationId) {
        resetObservationForm();
      }
      await loadObservations(selectedMaterial.id);
      await loadMaterials();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to delete observation'));
    }
  };

  const extractMaterialText = useCallback(
    async (materialId: string, force = false) => {
      setError(null);
      setExtractingMaterialId(materialId);

      try {
        const response = await repositoryFetch(
          `/materials/${materialId}/extract?force=${force}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              include_links: true,
              max_link_depth: 1,
              max_link_pages: 20,
              max_segments: 1000,
            }),
          },
        );

        if (!response.ok) {
          const message = await response.text();
          throw new Error(message || 'Text extraction failed.');
        }

        await loadMaterials();
        await loadExtractedPreview(materialId);

        const detailResponse = await repositoryFetch(`/materials/${materialId}`);
        if (detailResponse.ok) {
          const refreshedMaterial = await detailResponse.json();
          setSelectedMaterial(refreshedMaterial);
        }
      } catch (err) {
        setError(getErrorMessage(err, 'Text extraction failed.'));
      } finally {
        setExtractingMaterialId(null);
      }
    },
    [loadExtractedPreview, loadMaterials, repositoryFetch],
  );

  const generateKeywords = useCallback(async () => {
    if (!selectedMaterial?.id) return;

    setError(null);

    try {
      const response = await repositoryFetch(
        `/materials/${selectedMaterial.id}/auto-keywords?limit=12`,
        {
          method: 'POST',
        },
      );

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Keyword generation failed.');
      }

      const data = await response.json();
      const refreshedMaterial = data.material as Material;

      setSelectedMaterial(refreshedMaterial);

      setForm((previous) => ({
        ...previous,
        auto_keywords: refreshedMaterial.auto_keywords || '',
      }));

      await loadMaterials();
    } catch (err) {
      setError(getErrorMessage(err, 'Keyword generation failed.'));
    }
  }, [selectedMaterial?.id, repositoryFetch, loadMaterials]);

  const runFullTextSearch = async () => {
    const query = fullTextQuery.trim();
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearchingText(true);
    setError(null);
    try {
      const params = new URLSearchParams({ q: query, limit: '50' });
      const response = await repositoryFetch(`/search?${params}`);
      if (!response.ok) {
        const message = await parseErrorResponse(response, 'Full-text search failed');
        throw new Error(message);
      }
      const data = await response.json();
      setSearchResults(data.results || []);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Full-text search failed'));
    } finally {
      setIsSearchingText(false);
    }
  };

  const runSearchReport = async () => {
  const query = fullTextQuery.trim();

  if (query.length < 2) {
    setSearchReport(null);
    return;
  }

  setIsGeneratingSearchReport(true);
  setError(null);

  try {
    const response = await repositoryFetch('/search/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        context_window: 1,
        max_results: 200,
      }),
    });

    if (!response.ok) {
      const message = await parseErrorResponse(response, 'Search report generation failed');
      throw new Error(message);
    }

    const data = await response.json();
    setSearchReport(data);
    setShowSearchReportModal(true);
  } catch (err: unknown) {
    setError(getErrorMessage(err, 'Search report generation failed'));
  } finally {
    setIsGeneratingSearchReport(false);
  }
};

  const runSemanticSearch = async () => {
    const query = fullTextQuery.trim();
    if (query.length < 2) {
      setSemanticResults(null);
      return;
    }

    setIsRunningSemanticSearch(true);
    setError(null);

    try {
      const response = await repositoryFetch('/ai/semantic-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          limit: 12,
          include_observations: true,
        }),
      });

      if (!response.ok) {
        const message = await parseErrorResponse(response, 'Semantic search failed');
        throw new Error(message);
      }

      const data = await response.json();
      setSemanticResults(data);
      setAskCorpusResult(null);
      setAiEvidenceReport(null);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Semantic search failed'));
    } finally {
      setIsRunningSemanticSearch(false);
    }
  };

  const askCorpus = async () => {
    const question = fullTextQuery.trim();
    if (question.length < 2) {
      setAskCorpusResult(null);
      return;
    }

    setIsAskingCorpus(true);
    setError(null);

    try {
      const response = await repositoryFetch('/ai/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          max_results: 8,
        }),
      });

      if (!response.ok) {
        const message = await parseErrorResponse(response, 'Cited Answer failed');
        throw new Error(message);
      }

      const data = await response.json();
      setAskCorpusResult(data);
      setSemanticResults(null);
      setAiEvidenceReport(null);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Cited Answer failed'));
    } finally {
      setIsAskingCorpus(false);
    }
  };

  const generateAiEvidenceReport = async () => {
    const query = fullTextQuery.trim();
    if (query.length < 2) {
      setAiEvidenceReport(null);
      return;
    }

    setIsGeneratingAiReport(true);
    setError(null);

    try {
      const response = await repositoryFetch('/ai/evidence-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          limit: 16,
          include_observations: true,
        }),
      });

      if (!response.ok) {
        const message = await parseErrorResponse(response, 'AI evidence report failed');
        throw new Error(message);
      }

      const data = await response.json();
      setAiEvidenceReport(data);
      setSemanticResults(null);
      setAskCorpusResult(null);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'AI evidence report failed'));
    } finally {
      setIsGeneratingAiReport(false);
    }
  };

  useEffect(() => {
    if (!selectedMaterial?.id) {
      setExtractedPreview(null);
      setObservations([]);
      resetObservationForm();
      return;
    }
    loadExtractedPreview(selectedMaterial.id).catch(() => {});
    loadObservations(selectedMaterial.id).catch(() => {});
  }, [loadExtractedPreview, loadObservations, selectedMaterial?.id]);

  useEffect(() => {
    if (!isExtractedModalOpen || extractedModalTab !== 'segments' || !targetSegmentId || !extractedPreview) return;

    window.setTimeout(() => {
      const target = segmentListRef.current?.querySelector<HTMLElement>(
        `[data-segment-id="${String(targetSegmentId)}"]`,
      );
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target?.focus({ preventScroll: true });
    }, 80);
  }, [extractedPreview, extractedModalTab, isExtractedModalOpen, targetSegmentId]);

  const createLinkMaterial = async () => {
    const trimmedUrl = linkForm.source_url.trim();
    if (!trimmedUrl) {
      setError('Source URL is required for link material.');
      return;
    }
    setIsCreatingLink(true);
    setError(null);
    try {
      const response = await repositoryFetch('/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: linkForm.title.trim() || trimmedUrl,
          source_url: trimmedUrl,
          source_type: linkForm.source_type,
          status: 'needs_metadata',
        }),
      });
      if (!response.ok) {
        const message = await parseErrorResponse(response, 'Failed to add link material');
        throw new Error(message);
      }
      const material = await response.json();
      await loadMaterials();
      setSelectedId(material.id);
      setShowLinkModal(false);
      setLinkForm(EMPTY_LINK_FORM);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to add link material'));
    } finally {
      setIsCreatingLink(false);
    }
  };

  const downloadSearchReportPdf = () => {
    if (!searchReport) return;

    const resultSections = searchReport.results
      .map((result, index) => {
        return `
          <section class="result">
            <h2>${index + 1}. ${escapeHtml(result.material_title)}</h2>

            <p class="meta">
              ${escapeHtml(result.material_authors || 'Unknown author')}
              ${result.material_year ? ` · ${escapeHtml(result.material_year)}` : ''}
              · ${escapeHtml(result.page_ref)}
              · ${escapeHtml(result.source_locator)}
            </p>

            <div class="badges">
              ${(result.matched_terms || [])
                .map((term) => `<span class="badge matched">${escapeHtml(term)}</span>`)
                .join('')}
              ${
                result.all_terms_in_context
                  ? `<span class="badge all">all terms in context</span>`
                  : ''
              }
            </div>

            <p><strong>Matched terms:</strong> ${escapeHtml(result.matched_terms.join(', '))}</p>
            <p><strong>Terms in context:</strong> ${escapeHtml(result.terms_in_context.join(', '))}</p>
            <p><strong>All terms in context:</strong> ${result.all_terms_in_context ? 'Yes' : 'No'}</p>

            ${
              result.before
                ? `
                  <h3>Previous paragraph</h3>
                  <p class="context">${escapeHtml(result.before)}</p>
                `
                : ''
            }

            <h3>Matching paragraph</h3>
            <p class="match">${highlightSearchTermsHtml(result.match, searchReport.query_terms)}</p>

            ${
              result.after
                ? `
                  <h3>Next paragraph</h3>
                  <p class="context">$highlightSearchTermsHtml(result.after, searchReport.query_terms)</p>
                `
                : ''
            }
          </section>
        `;
      })
      .join('');

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Search Context Report</title>
          <style>
            @page {
              size: A4;
              margin: 18mm;
            }

            body {
              margin: 0;
              background: #ffffff;
              color: #0f172a;
              font-family: Arial, sans-serif;
              font-size: 11pt;
              line-height: 1.55;
            }

            h1 {
              margin: 0 0 16px;
              font-size: 22pt;
              letter-spacing: 0.03em;
            }

            h2 {
              margin: 22px 0 4px;
              font-size: 14pt;
              page-break-after: avoid;
            }

            h3 {
              margin: 14px 0 4px;
              color: #475569;
              font-size: 9.5pt;
              text-transform: uppercase;
              letter-spacing: 0.08em;
              page-break-after: avoid;
            }

            p {
              margin: 4px 0 8px;
            }

            .summary {
              border: 1px solid #cbd5e1;
              border-radius: 8px;
              padding: 12px;
              margin-bottom: 20px;
              page-break-inside: avoid;
            }

            .result {
              border-top: 1px solid #cbd5e1;
              padding-top: 16px;
              margin-top: 18px;
              page-break-inside: auto;
            }

            .meta {
              color: #64748b;
              font-size: 9.5pt;
            }

            .badges {
              display: flex;
              flex-wrap: wrap;
              gap: 6px;
              margin: 8px 0 10px;
            }

            .badge {
              display: inline-block;
              border-radius: 999px;
              padding: 3px 8px;
              font-size: 8.5pt;
              font-weight: 700;
              letter-spacing: 0.04em;
              text-transform: uppercase;
            }

            .badge.matched {
              background: #fef3c7;
              color: #92400e;
            }

            .badge.all {
              background: #dcfce7;
              color: #166534;
            }

            .context {
              color: #334155;
            }

            .match {
              border-left: 4px solid #f59e0b;
              background: #fffbeb;
              padding: 8px 12px;
            }

            .term-highlight {
              background: #fde68a !important;
              color: #0f172a !important;
              border: 1px solid #f59e0b;
              border-radius: 3px;
              padding: 0 2px;
              font-weight: 700;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            @media print {
              .term-highlight {
                background: #fde68a !important;
                color: #0f172a !important;
                border: 1px solid #f59e0b;
                font-weight: 700;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
            }

            .footer {
              margin-top: 24px;
              border-top: 1px solid #cbd5e1;
              padding-top: 10px;
              color: #64748b;
              font-size: 9pt;
            }
          </style>
        </head>

        <body>
          <h1>Search Context Report</h1>

          <div class="summary">
            <p><strong>Query:</strong> ${escapeHtml(searchReport.query)}</p>
            <p><strong>Terms:</strong> ${escapeHtml(searchReport.query_terms.join(', '))}</p>
            <p><strong>Context window:</strong> ${escapeHtml(searchReport.context_window)}</p>
            <p><strong>Total matches:</strong> ${escapeHtml(searchReport.total_matches)}</p>
            <p><strong>Co-occurrence windows:</strong> ${escapeHtml(searchReport.cooccurrence_count)}</p>
          </div>

          ${resultSections}

          <div class="footer">
            Generated from Research Workbench search context report.
          </div>

          <script>
            window.addEventListener('load', function () {
              window.focus();

              requestAnimationFrame(function () {
                setTimeout(function () {
                  window.print();
                }, 500);
              });
            });
          </script>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank', 'width=900,height=700');

    if (!printWindow) {
      setError('Popup was blocked. Please allow popups to download the PDF report.');
      return;
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const deleteSelectedMaterial = useCallback(async () => {
    if (!selectedMaterial?.id) return;

    const confirmed = window.confirm(
      `Delete "${selectedMaterial.title || 'this material'}"? This will also remove its attached files and extracted text.`,
    );

    if (!confirmed) return;

    setError(null);

    try {
      const response = await repositoryFetch(`/materials/${selectedMaterial.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Failed to delete material.');
      }

      setSelectedId(null);
      setSelectedMaterial(null);
      setExtractedPreview(null);
      setObservations([]);
      resetObservationForm();

      await loadMaterials();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to delete material.'));
    }
  }, [selectedMaterial, repositoryFetch, loadMaterials]);

  const fileDownloadUrl = (materialId: string, fileId: string) => {
    return `${API_BASE_URL}/repository/materials/${materialId}/files/${fileId}`;
  };

  return (
    <div className="fixed inset-0 z-[80] bg-slate-950/60 backdrop-blur-sm">
      <div className="h-full w-full bg-slate-50 text-slate-900 flex flex-col">
        <header className="h-16 shrink-0 border-b border-slate-200 bg-white px-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onClose}
              className="h-10 w-10 rounded-lg border border-slate-200 hover:bg-slate-100 flex items-center justify-center"
              title="Close repository"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h2 className="text-sm font-black uppercase tracking-[0.18em]">Research Workbench</h2>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="h-10 px-4 rounded-lg bg-blue-600 text-white text-xs font-black uppercase tracking-wider hover:bg-blue-700 flex items-center gap-2 cursor-pointer">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              {isUploading ? 'Uploading' : 'Upload'}
              <input
                type="file"
                multiple
                className="hidden"
                disabled={isUploading}
                onChange={(event) => uploadFiles(event.target.files)}
              />
            </label>
            <button
              onClick={() => setShowLinkModal(true)}
              className="h-10 px-4 rounded-lg border border-slate-200 bg-white text-xs font-black uppercase tracking-wider hover:bg-slate-100"
            >
              Add Link
            </button>
            <button
              onClick={startNewMaterial}
              className="h-10 px-4 rounded-lg border border-slate-200 bg-white text-xs font-black uppercase tracking-wider hover:bg-slate-100"
            >
              New Record
            </button>
          </div>
        </header>

        {error && (
          <div className="mx-5 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {!repositoryApiAvailable && (
          <div className="mx-5 mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Repository endpoints are not available on the current `VITE_API_BASE_URL`. Upload and Add Link require a backend with `/repository` routes.
          </div>
        )}

        <main className="min-h-0 flex-1 grid grid-cols-[280px_minmax(420px,1fr)_420px]">
          <aside className="min-h-0 border-r border-slate-200 bg-white p-4 overflow-auto">
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Search</label>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Title, author, filename, observation"
              className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
            />

            <div className="mt-6 flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Queue</span>
              {statusFilter && (
                <button
                  onClick={() => setStatusFilter('')}
                  className="text-[10px] font-black uppercase text-blue-600"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="mt-2 space-y-1">
              {statuses.map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`w-full min-h-10 rounded-lg px-3 text-left flex items-center justify-between text-xs font-bold transition-colors ${
                    statusFilter === status ? 'bg-blue-600 text-white' : 'hover:bg-slate-100 text-slate-600'
                  }`}
                >
                  <span>{STATUS_LABELS[status] || status}</span>
                  <span className={statusFilter === status ? 'text-blue-100' : 'text-slate-400'}>
                    {queueCounts[status] || 0}
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Collection Rule</div>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                Capture observed evidence with source context first. Leave meaning, relationship claims, and interpretation for later stages.
              </p>
            </div>
          </aside>

          <section className="min-h-0 overflow-auto p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Materials</h3>
                <p className="text-xs text-slate-400">
                  {statusFilter ? `${selectedStatusCount} in ${STATUS_LABELS[statusFilter]}` : `${materials.length} records shown`}
                </p>
              </div>
            </div>
            <div className="mb-3 rounded-xl border border-slate-200 bg-white p-3">
              <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                    Search Corpus
                  </h4>
                  <p className="mt-1 text-xs text-slate-400">
                    Start with exact text matches, then continue into related evidence or cited answers.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={fullTextQuery}
                  onChange={(event) => setFullTextQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') runFullTextSearch();
                  }}
                  placeholder="Search terms, e.g. paper mulberry, tapa cloth, tapa beater, beat"
                  className="repo-input"
                />
                <button
                  type="button"
                  onClick={runFullTextSearch}
                  disabled={isSearchingText}
                  className="h-10 rounded-lg bg-slate-900 px-4 text-xs font-black uppercase tracking-wider text-white disabled:opacity-40"
                >
                  {isSearchingText ? 'Searching' : 'Exact Search'}
                </button>

                <button
                  type="button"
                  onClick={runSearchReport}
                  disabled={isGeneratingSearchReport || fullTextQuery.trim().length < 2}
                  className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-xs font-black uppercase tracking-wider text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                  {isGeneratingSearchReport ? 'Generating' : 'Exact Report'}
                </button>
              </div>
              {searchResults.length > 0 && (
                <div className="mt-3 max-h-48 overflow-auto rounded-lg border border-slate-100">
                  {searchResults.map((result) => (
                    <button
                      key={`${result.id}-${result.material_id}`}
                      onClick={() => openAnnotationWorkspace(result.material_id, 'segments', result.id)}
                      className="block w-full border-b border-slate-100 px-3 py-2 text-left hover:bg-slate-50 last:border-b-0"
                    >
                      <div className="text-xs font-bold text-slate-700 truncate">{result.material_title}</div>
                      <div className="text-[11px] text-slate-500 truncate">{result.page_ref} · {result.source_locator}</div>
                      <div className="text-[11px] text-slate-600">
                        {highlightSearchTerms(result.snippet_text, activeQueryTerms)}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="mb-3 rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                    Continue With Assisted Review
                  </h4>
                  <p className="mt-1 text-xs text-slate-400">
                    Optional Ollama tools for the same query. Use related passages for discovery, or RAG answer when you need a cited synthesis.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={runSemanticSearch}
                    disabled={!evidenceAssistantReady || isRunningSemanticSearch || fullTextQuery.trim().length < 2}
                    className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-black uppercase tracking-wider text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                  >
                    {isRunningSemanticSearch ? 'Finding' : 'Find Related Passages'}
                  </button>
                  <button
                    type="button"
                    onClick={askCorpus}
                    disabled={!evidenceAssistantReady || isAskingCorpus || fullTextQuery.trim().length < 2}
                    className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-black uppercase tracking-wider text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                  >
                    {isAskingCorpus ? 'Reading' : 'Cited Answer (RAG)'}
                  </button>
                  <button
                    type="button"
                    onClick={generateAiEvidenceReport}
                    disabled={!evidenceAssistantReady || isGeneratingAiReport || fullTextQuery.trim().length < 2}
                    className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-black uppercase tracking-wider text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                  >
                    {isGeneratingAiReport ? 'Grouping' : 'Group Evidence'}
                  </button>
                </div>
              </div>

              {aiStatus && !aiStatus.provider_configured && (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {aiStatus.status_message || 'Semantic retrieval is inactive until Ollama is configured and running.'}
                </div>
              )}

              {semanticResults && (
                <div className="mt-3 space-y-3">
                  <div className="text-xs text-slate-500">
                    {semanticResults.evidence_note}
                  </div>
                  {semanticResults.results.length === 0 && (
                    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm text-slate-400">
                      No semantic evidence results returned.
                    </div>
                  )}
                  {semanticResults.results.slice(0, 5).map((result) => (
                    <button
                      key={`${result.segment_id}-${result.material_id}`}
                      type="button"
                      onClick={() => {
                        openAnnotationWorkspace(result.material_id, 'segments', result.segment_id);
                      }}
                      className="block w-full rounded-lg border border-slate-100 bg-slate-50 p-3 text-left hover:bg-blue-50"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0 truncate text-sm font-black text-slate-800">
                          {result.material_title}
                        </div>
                        <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                          {(result.score * 100).toFixed(1)} match
                        </div>
                      </div>
                      <div className="mt-1 text-[11px] text-slate-400">
                        {result.page_ref} · {result.source_locator}
                      </div>
                      <div className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-600">
                        {highlightSearchTerms(cleanAnnotationText(result.content_text), activeQueryTerms)}
                      </div>
                    </button>
                  ))}
                  {semanticResults.related_observations.length > 0 && (
                    <div className="rounded-lg border border-slate-100 bg-white p-3">
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Related Observations
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {semanticResults.related_observations.slice(0, 12).map((observation) => (
                          <span
                            key={observation.id}
                            className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-wider ${getObservationBadgeClass(observation.observation_type)}`}
                          >
                            {OBSERVATION_TYPE_LABELS[observation.observation_type] || observation.observation_type}: {observation.observed_text}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {askCorpusResult && (
                <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Cited Answer (RAG)
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    Retrieval-augmented answer from cited passages only. Use this for synthesis after checking the source hits.
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                    {askCorpusResult.answer}
                  </p>
                  {askCorpusResult.citations && askCorpusResult.citations.length > 0 && (
                    <div className="mt-3 border-t border-slate-200 pt-3">
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Citations
                      </div>
                      <div className="mt-2 space-y-2">
                        {askCorpusResult.citations.map((citation, index) => (
                          <button
                            key={`${citation.segment_id}-${index}`}
                            type="button"
                            onClick={() => {
                              openAnnotationWorkspace(citation.material_id, 'segments', citation.segment_id);
                            }}
                            className="block w-full rounded-lg bg-white px-3 py-2 text-left text-xs text-slate-600 hover:bg-blue-50"
                          >
                            [{index + 1}] {citation.material_title} · {citation.page_ref}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {aiEvidenceReport && (
                <div className="mt-3 space-y-3">
                  <div className="text-xs text-slate-500">
                    {aiEvidenceReport.evidence_note}
                  </div>
                  {aiEvidenceReport.themes.map((theme) => (
                    <div key={theme.material_id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                      <div className="text-sm font-black text-slate-800">{theme.material_title}</div>
                      <div className="mt-2 space-y-2">
                        {theme.passages.slice(0, 3).map((passage) => (
                          <button
                            key={passage.segment_id}
                            type="button"
                            onClick={() => openAnnotationWorkspace(theme.material_id, 'segments', passage.segment_id)}
                            className="block w-full rounded-lg bg-white p-3 text-left text-xs leading-relaxed text-slate-600 hover:bg-blue-50"
                          >
                            <div className="mb-1 font-bold text-slate-400">
                              {passage.page_ref} · {(passage.score * 100).toFixed(1)} match
                            </div>
                            {highlightSearchTerms(truncateText(cleanAnnotationText(passage.content_text), 320), activeQueryTerms)}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <table className="w-full table-fixed text-left">
                <thead className="bg-slate-100 text-[10px] uppercase tracking-widest text-slate-500">
                  <tr>
                    <th className="w-[30%] px-4 py-3">Title</th>
                    <th className="w-[15%] px-4 py-3">Source</th>
                    <th className="w-[12%] px-4 py-3">Status</th>
                    <th className="w-[14%] px-4 py-3">Extraction</th>
                    <th className="w-[12%] px-4 py-3">Observed</th>
                    <th className="w-[17%] px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {materials.map((material) => (
                    <tr
                      key={material.id}
                      onClick={() => setSelectedId(material.id)}
                      className={`cursor-pointer text-sm hover:bg-blue-50/60 ${
                        selectedId === material.id ? 'bg-blue-50' : 'bg-white'
                      }`}
                    >
                      <td className="px-4 py-4 align-top">
                        <div className="max-w-[28rem]">
                          <div className="truncate text-sm font-black text-slate-800">
                            {material.title || 'Untitled material'}
                          </div>
                          {material.raw_reference && (
                            <div className="mt-1 line-clamp-2 text-xs text-slate-500">
                              {material.raw_reference}
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-4 align-top">
                        <div className="truncate text-sm text-slate-600">
                          {material.authors || 'Unknown'}
                        </div>
                        <div className="mt-1 truncate text-xs text-slate-400">
                          {[
                            material.year || '-',
                            SOURCE_TYPE_LABELS[material.source_type] || material.source_type,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </div>
                      </td>

                      <td className="px-4 py-4 align-top">
                        <span className="inline-flex max-w-full rounded-md bg-slate-100 px-2 py-1 text-[10px] font-black uppercase tracking-tight text-slate-600">
                          {STATUS_LABELS[material.status] || material.status}
                        </span>
                      </td>

                      <td className="px-4 py-4 align-top">
                        <div className="flex flex-col items-start gap-1">
                          <span
                            className={`inline-flex max-w-full rounded-md px-2 py-1 text-[10px] font-black uppercase tracking-tight ${getExtractionBadgeClass(
                              material.extraction_status,
                            )}`}
                          >
                            {EXTRACTION_STATUS_LABELS[
                              material.extraction_status || 'not_extracted'
                            ] ||
                              material.extraction_status ||
                              'Not Extracted'}
                          </span>

                          <span className="text-xs text-slate-400">
                            {material.segment_count ?? 0} segments
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-4 align-top">
                        <div className="text-sm font-black text-slate-700 tabular-nums">
                          {material.observation_count ?? 0}
                        </div>
                        <div className="mt-1 truncate text-xs text-slate-400">
                          {Object.entries(material.observation_type_counts || {})
                            .slice(0, 2)
                            .map(([type, count]) => `${OBSERVATION_TYPE_LABELS[type] || type}: ${count}`)
                            .join(' · ') || 'None'}
                        </div>
                      </td>

                      <td className="px-4 py-4 align-top">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              openAnnotationWorkspace(material.id, 'segments');
                            }}
                            disabled={(material.segment_count ?? 0) === 0}
                            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Text
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              openAnnotationWorkspace(material.id, 'observations');
                            }}
                            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50"
                          >
                            Observe
                          </button>
                        </div>
                        <div className="mt-2 text-[11px] text-slate-400">
                          {material.file_count} files
                        </div>
                      </td>
                    </tr>
                  ))}

                  {materials.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-16 text-center text-sm text-slate-400">
                        No repository records match this view.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <aside className="min-h-0 border-l border-slate-200 bg-white overflow-auto">
            <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-5 py-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">
                    {isCreating ? 'New Metadata Record' : 'Metadata'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {selectedMaterial ? `Updated ${formatDate(selectedMaterial.updated_at)}` : 'Create or select a material'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {!isCreating && selectedMaterial && (
                    <>
                      <button
                        type="button"
                        onClick={deleteSelectedMaterial}
                        className="h-9 rounded-lg border border-red-200 bg-red-50 px-3 text-[10px] font-black uppercase tracking-wider text-red-700 hover:bg-red-100"
                      >
                        Delete
                      </button>

                      <button
                        type="button"
                        onClick={() => extractMaterialText(selectedMaterial.id, false)}
                        disabled={
                          extractingMaterialId === selectedMaterial.id ||
                          (selectedMaterial.segment_count ?? 0) > 0
                        }
                        className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-black uppercase tracking-wider text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                        title="Extract text from files and links for this material"
                      >
                        {extractingMaterialId === selectedMaterial.id ? 'Extracting' : 'Extract'}
                      </button>

                      <button
                        type="button"
                        onClick={() => extractMaterialText(selectedMaterial.id, true)}
                        disabled={extractingMaterialId === selectedMaterial.id}
                        className="h-9 rounded-lg border border-amber-200 bg-amber-50 px-3 text-[10px] font-black uppercase tracking-wider text-amber-700 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-40"
                        title="Clear existing extracted text and extract again"
                      >
                        Re-extract
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={saveMaterial}
                    disabled={isSaving || (!isCreating && !selectedMaterial)}
                    className="h-9 rounded-lg bg-slate-900 px-4 text-xs font-black uppercase tracking-wider text-white disabled:opacity-40"
                  >
                    {isSaving ? 'Saving' : 'Save'}
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-4 p-5">
              <Field label="Title">
                <input value={form.title} onChange={(event) => updateForm('title', event.target.value)} className="repo-input" />
              </Field>
              <Field label="Authors">
                <input value={form.authors} onChange={(event) => updateForm('authors', event.target.value)} className="repo-input" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Year">
                  <input value={form.year} onChange={(event) => updateForm('year', event.target.value)} className="repo-input" />
                </Field>
                <Field label="Source Type">
                  <select value={form.source_type} onChange={(event) => updateForm('source_type', event.target.value)} className="repo-input">
                    {sourceTypes.map((sourceType) => (
                      <option key={sourceType} value={sourceType}>
                        {SOURCE_TYPE_LABELS[sourceType] || sourceType}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Status">
                <select value={form.status} onChange={(event) => updateForm('status', event.target.value)} className="repo-input">
                  {statuses.map((status) => (
                    <option key={status} value={status}>
                      {STATUS_LABELS[status] || status}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Collection">
                  <input value={form.collection} onChange={(event) => updateForm('collection', event.target.value)} className="repo-input" />
                </Field>
                <Field label="Uploader">
                  <input value={form.uploaded_by} onChange={(event) => updateForm('uploaded_by', event.target.value)} className="repo-input" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Language">
                  <input value={form.language} onChange={(event) => updateForm('language', event.target.value)} className="repo-input" />
                </Field>
                <Field label="Region">
                  <input value={form.region} onChange={(event) => updateForm('region', event.target.value)} className="repo-input" />
                </Field>
              </div>
              <Field label="Source URL">
                <input value={form.source_url} onChange={(event) => updateForm('source_url', event.target.value)} className="repo-input" />
              </Field>
              <Field label="Raw Reference">
                <textarea
                  value={form.raw_reference}
                  onChange={(event) => updateForm('raw_reference', event.target.value)}
                  className="repo-textarea"
                  rows={4}
                />
              </Field>

              <Field label="Keywords">
                <input
                  value={form.keywords}
                  onChange={(event) => updateForm('keywords', event.target.value)}
                  placeholder="tapa, barkcloth, motif, Fiji"
                  className="repo-input"
                />
                <p className="mt-1 text-[10px] text-slate-400">
                  Human-edited keywords, separated by commas.
                </p>
              </Field>

              <Field label="Auto Keywords">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={generateKeywords}
                      disabled={!selectedMaterial || (selectedMaterial.segment_count ?? 0) === 0}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Generate
                    </button>

                    <button
                      type="button"
                      onClick={() => updateForm('keywords', form.auto_keywords)}
                      disabled={!form.auto_keywords}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Use
                    </button>
                  </div>

                  <textarea
                    value={form.auto_keywords}
                    onChange={(event) => updateForm('auto_keywords', event.target.value)}
                    placeholder="Generated after text extraction"
                    className="repo-textarea"
                    rows={3}
                  />

                  <p className="text-[10px] text-slate-400">
                    Non-LLM suggestions from extracted text. Review before copying into Keywords.
                  </p>
                </div>
              </Field>

              <Field label="Collection Notes">
                <textarea
                  value={form.abstract_or_notes}
                  onChange={(event) => updateForm('abstract_or_notes', event.target.value)}
                  className="repo-textarea"
                  rows={5}
                />
              </Field>

              {selectedMaterial && (
                <div className="rounded-xl border border-slate-200">
                  <div className="border-b border-slate-200 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Files
                  </div>
                  <div className="divide-y divide-slate-100">
                    {(selectedMaterial.files || []).map((file) => (
                      <a
                        key={file.id}
                        href={fileDownloadUrl(selectedMaterial.id, file.id)}
                        className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50"
                      >
                        <span className="min-w-0 truncate text-sm font-bold text-slate-700">{file.original_filename}</span>
                        <span className="shrink-0 text-xs text-slate-400">{formatBytes(file.file_size)}</span>
                      </a>
                    ))}
                    {(selectedMaterial.files || []).length === 0 && (
                      <div className="px-4 py-6 text-sm text-slate-400">No files attached.</div>
                    )}
                  </div>
                </div>
              )}

              {selectedMaterial && (
                <div className="rounded-xl border border-slate-200">
                  <div className="border-b border-slate-200 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Document Details
                  </div>

                  <div className="space-y-3 p-4">
                    <div className="grid grid-cols-4 gap-2 text-[11px]">
                      <div className="rounded-lg bg-slate-50 px-2 py-2">
                        <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">Segments</div>
                        <div className="text-sm font-black text-slate-700">{extractedPreview?.segments?.length ?? 0}</div>
                      </div>
                      <div className="rounded-lg bg-slate-50 px-2 py-2">
                        <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">Links</div>
                        <div className="text-sm font-black text-slate-700">{extractedPreview?.discovered_links?.length ?? 0}</div>
                      </div>
                      <div className="rounded-lg bg-slate-50 px-2 py-2">
                        <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">Runs</div>
                        <div className="text-sm font-black text-slate-700">{extractedPreview?.runs?.length ?? 0}</div>
                      </div>
                      <div className="rounded-lg bg-slate-50 px-2 py-2">
                        <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">Observed</div>
                        <div className="text-sm font-black text-slate-700">{observations.length}</div>
                      </div>
                    </div>

                    {observations.length > 0 && (
                      <div className="rounded-lg border border-slate-100 bg-white p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                              Observation Coverage
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              {sourceLinkedObservationCount} of {observations.length} linked to source context
                            </div>
                          </div>
                          <div className="flex flex-wrap justify-end gap-1">
                            {Object.entries(observationTypeCounts).map(([type, count]) => (
                              <span
                                key={type}
                                className={`rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-wider ${getObservationBadgeClass(type)}`}
                              >
                                {OBSERVATION_TYPE_LABELS[type] || type}: {count}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {selectedMaterial.latest_extraction_run?.error_message && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                        {selectedMaterial.latest_extraction_run.error_message}
                      </div>
                    )}

                    {(selectedMaterial.segment_count ?? 0) > 0 && (
                      <p className="text-xs text-slate-400">
                        This material already has extracted text. Use Re-extract in the header to refresh it.
                      </p>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        openAnnotationWorkspace(
                          selectedMaterial.id,
                          observations.length > 0 ? 'observations' : 'segments',
                        );
                      }}
                      disabled={!extractedPreview}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      View Text / Links / Observations
                    </button>
                  </div>
                </div>
              )}
            </div>
          </aside>
        </main>
      </div>
      {isExtractedModalOpen && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/50 p-4">
          <div className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-700">
                  Source Annotation Workspace
                </h3>
                <p className="text-xs text-slate-400">
                  {selectedMaterial?.title || 'Selected material'} · observations are evidence records, not interpretations
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsExtractedModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 hover:bg-slate-100"
                title="Close"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="border-b border-slate-200 px-5 pt-3">
              <div className="flex gap-2">
                {[
                  ['segments', `Text (${extractedPreview?.segments?.length ?? 0})`],
                  ['links', `Links (${extractedPreview?.discovered_links?.length ?? 0})`],
                  ['observations', `Observations (${observations.length})`],
                  ['runs', `Runs (${extractedPreview?.runs?.length ?? 0})`],
                ].map(([tab, label]) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setExtractedModalTab(tab as 'segments' | 'links' | 'observations' | 'runs')}
                    className={`rounded-t-lg px-4 py-2 text-[10px] font-black uppercase tracking-wider ${
                      extractedModalTab === tab
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-5">
              {!extractedPreview && (
                <p className="text-sm text-slate-400">No extracted document details loaded.</p>
              )}

              {extractedPreview && extractedModalTab === 'segments' && (
                <div ref={segmentListRef} className="space-y-3">
                  <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs leading-relaxed text-blue-800">
                    Select a word or phrase in a source segment, then click Mark Observation. The selected text, page reference, locator, and context are carried into the observation form.
                  </div>
                  {extractedPreview.segments.length === 0 && (
                    <p className="text-sm text-slate-400">No extracted text segments yet.</p>
                  )}
                  {extractedPreview.segments.map((segment, index) => {
                    const segmentText = getSegmentText(segment);
                    const isTargetSegment = String(segment.id) === String(targetSegmentId);
                    return (
                      <div
                        key={segment.id || index}
                        data-segment-id={String(segment.id)}
                        tabIndex={-1}
                        className={`rounded-lg border p-4 outline-none transition ${
                          isTargetSegment
                            ? 'border-blue-300 bg-blue-50 shadow-sm ring-2 ring-blue-100'
                            : 'border-slate-100 bg-white'
                        }`}
                      >
                        <div className="mb-2 flex items-center justify-between gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                          <span className="truncate">
                            {segment.page_ref || `Segment ${index + 1}`}
                            {isTargetSegment ? ' · cited result' : ''}
                          </span>
                          <span className="shrink-0">{segment.char_count ?? segmentText.length} chars</span>
                        </div>
                        <div className="mb-3 truncate text-[10px] text-slate-400">
                          {segment.source_kind || 'source'} · {segment.source_locator || 'unknown locator'}
                        </div>
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                          {highlightSearchTerms(segmentText, activeQueryTerms)}
                        </p>
                        <div className="mt-3 flex justify-end">
                          <button
                            type="button"
                            onClick={() => startObservationFromSegment(segment)}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50"
                          >
                            Mark Observation
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {extractedPreview && extractedModalTab === 'links' && (
                <div className="space-y-3">
                  {extractedPreview.discovered_links.length === 0 && (
                    <p className="text-sm text-slate-400">No discovered links.</p>
                  )}
                  {extractedPreview.discovered_links.map((link, index) => {
                    const linkUrl = link.discovered_url || link.source_url || '';
                    return (
                      <a
                        key={link.id || `${linkUrl}-${index}`}
                        href={linkUrl || undefined}
                        target="_blank"
                        rel="noreferrer"
                        className="block rounded-lg border border-slate-100 bg-white p-4 hover:bg-slate-50"
                      >
                        <div className="truncate text-sm font-bold text-slate-700">
                          {link.title || link.link_text || linkUrl || `Discovered link ${index + 1}`}
                        </div>
                        <div className="mt-1 truncate text-xs text-slate-400">{linkUrl || 'No URL available'}</div>
                        <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-slate-400">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5">depth: {link.depth ?? 0}</span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5">status: {formatLinkStatus(link.status)}</span>
                        </div>
                      </a>
                    );
                  })}
                </div>
              )}

              {extractedPreview && extractedModalTab === 'observations' && (
                <div className="grid gap-4 lg:grid-cols-[minmax(260px,360px)_1fr]">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      {editingObservationId ? 'Edit Observation' : 'New Observation'}
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-slate-500">
                      Record what appears in the source. Keep meanings, relationships, and interpretation for later analysis.
                    </p>

                    <div className="mt-4 space-y-3">
                      <div>
                        <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                          Capture Type
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {observationTypes.map((type) => (
                            <button
                              key={type}
                              type="button"
                              onClick={() => updateObservationForm('observation_type', type)}
                              className={`rounded-lg border px-3 py-2 text-left text-[10px] font-black uppercase tracking-wider ${
                                observationForm.observation_type === type
                                  ? `${getObservationBadgeClass(type)} border-current`
                                  : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                              }`}
                            >
                              {OBSERVATION_TYPE_LABELS[type] || type}
                            </button>
                          ))}
                        </div>
                        <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                          {getObservationTypeHint(observationForm.observation_type)}
                        </p>
                      </div>

                      <Field label="Observed Text">
                        <input
                          value={observationForm.observed_text}
                          onChange={(event) => updateObservationForm('observed_text', event.target.value)}
                          placeholder="Observed word, motif, place, material, or process"
                          className="repo-input"
                        />
                      </Field>

                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Page Ref">
                          <input
                            value={observationForm.source_page_ref}
                            onChange={(event) => updateObservationForm('source_page_ref', event.target.value)}
                            className="repo-input"
                          />
                        </Field>
                        <Field label="Observed By">
                          <input
                            value={observationForm.observed_by}
                            onChange={(event) => updateObservationForm('observed_by', event.target.value)}
                            className="repo-input"
                          />
                        </Field>
                      </div>

                      <Field label="Source Locator">
                        <input
                          value={observationForm.source_locator}
                          onChange={(event) => updateObservationForm('source_locator', event.target.value)}
                          className="repo-input"
                        />
                      </Field>

                      <Field label="Context Quote">
                        <textarea
                          value={observationForm.context_quote}
                          onChange={(event) => updateObservationForm('context_quote', event.target.value)}
                          className="repo-textarea"
                          rows={5}
                        />
                      </Field>

                      <Field label="Observation Notes">
                        <textarea
                          value={observationForm.notes}
                          onChange={(event) => updateObservationForm('notes', event.target.value)}
                          placeholder="Optional descriptive note only. Example: spelling variant, visible form, or source uncertainty."
                          className="repo-textarea"
                          rows={3}
                        />
                      </Field>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={saveObservation}
                          disabled={isSavingObservation || !observationForm.observed_text.trim()}
                          className="rounded-lg bg-slate-900 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-white disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {isSavingObservation ? 'Saving' : editingObservationId ? 'Update' : 'Save Observation'}
                        </button>
                        <button
                          type="button"
                          onClick={resetObservationForm}
                          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Captured Evidence
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {observations.length} observations · {sourceLinkedObservationCount} with source links
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {observationTypes.map((type) => (
                            <span
                              key={type}
                              className={`rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-wider ${getObservationBadgeClass(type)}`}
                            >
                              {OBSERVATION_TYPE_LABELS[type] || type}: {observationTypeCounts[type] || 0}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {observations.length === 0 && (
                      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-400">
                        No observations recorded for this material yet.
                      </div>
                    )}

                    {observations.map((observation) => (
                      <div key={observation.id} className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-blue-700">
                                {OBSERVATION_TYPE_LABELS[observation.observation_type] || observation.observation_type}
                              </span>
                              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                Observation
                              </span>
                            </div>
                            <div className="mt-2 text-sm font-black text-slate-800">
                              {observation.observed_text}
                            </div>
                            <div className="mt-1 text-xs text-slate-400">
                              {[observation.source_page_ref, observation.source_locator]
                                .filter(Boolean)
                                .join(' · ') || 'No source locator recorded'}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => editObservation(observation)}
                              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteObservation(observation.id)}
                              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-red-700 hover:bg-red-100"
                            >
                              Delete
                            </button>
                          </div>
                        </div>

                        {observation.context_quote && (
                          <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
                            {truncateText(observation.context_quote)}
                          </div>
                        )}

                        {observation.notes && (
                          <div className="mt-3 text-xs leading-relaxed text-slate-500">
                            {observation.notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {extractedPreview && extractedModalTab === 'runs' && (
                <div className="space-y-3">
                  {extractedPreview.runs.length === 0 && (
                    <p className="text-sm text-slate-400">No extraction runs yet.</p>
                  )}
                  {extractedPreview.runs.map((run) => (
                    <div key={run.id} className="rounded-lg border border-slate-100 bg-white p-4 text-sm text-slate-600">
                      <div className="font-bold text-slate-800">Status: {run.status}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {formatDate(run.created_at)} · {run.extracted_segment_count} segments · {run.discovered_link_count} links
                      </div>
                      {(run.error_message || run.warnings) && (
                        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                          {run.error_message || run.warnings}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isPreparingReportPrint && searchReport && (
        <div className="search-report-print">
          <h1>Search Context Report</h1>

          <div className="print-summary">
            <p><strong>Query:</strong> {searchReport.query}</p>
            <p><strong>Terms:</strong> {searchReport.query_terms.join(', ')}</p>
            <p><strong>Context window:</strong> {searchReport.context_window}</p>
            <p><strong>Total matches:</strong> {searchReport.total_matches}</p>
            <p><strong>Co-occurrence windows:</strong> {searchReport.cooccurrence_count}</p>
          </div>

          {searchReport.results.map((result, index) => (
            <section
              key={`${result.segment_id}-${result.paragraph_index}-${index}`}
              className="print-result"
            >
              <h2>
                {index + 1}. {result.material_title}
              </h2>

              <p className="print-meta">
                {result.material_authors || 'Unknown author'}
                {result.material_year ? ` · ${result.material_year}` : ''}
                {' · '}
                {result.page_ref}
                {' · '}
                {result.source_locator}
              </p>

              <p>
                <strong>Matched terms:</strong> {result.matched_terms.join(', ')}
              </p>

              <p>
                <strong>Terms in context:</strong> {result.terms_in_context.join(', ')}
              </p>

              <p>
                <strong>All terms in context:</strong>{' '}
                {result.all_terms_in_context ? 'Yes' : 'No'}
              </p>

              {result.before && (
                <>
                  <h3>Previous paragraph</h3>
                  <p>{result.before}</p>
                </>
              )}

              <h3>Matching paragraph</h3>
              <p className="print-match">{result.match}</p>

              {result.after && (
                <>
                  <h3>Next paragraph</h3>
                  <p>{result.after}</p>
                </>
              )}
            </section>
          ))}
        </div>
      )}

      {showSearchReportModal && searchReport && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/50 p-4">
          <div className="flex max-h-[90vh] w-full max-w-6xl flex-col rounded-xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-700">
                  Search Context Report
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Query: {searchReport.query}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {searchReport.total_matches} context matches · {searchReport.cooccurrence_count} co-occurrence windows
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={downloadSearchReportPdf}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-700 hover:bg-slate-50"
                >
                  Download PDF
                </button>

                <button
                  type="button"
                  onClick={() => setShowSearchReportModal(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 hover:bg-slate-100"
                  title="Close"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="border-b border-slate-100 px-5 py-3">
              <div className="flex flex-wrap gap-2">
                {searchReport.query_terms.map((term) => (
                  <span
                    key={term}
                    className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600"
                  >
                    {term}
                  </span>
                ))}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-5">
              {searchReport.results.length === 0 && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
                  No matches found in extracted text.
                </div>
              )}

              <div className="space-y-4">
                {searchReport.results.map((result, index) => (
                  <div
                    key={`${result.segment_id}-${result.paragraph_index}-${index}`}
                    className="rounded-xl border border-slate-200 bg-white p-4"
                  >
                    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedId(result.material_id);
                            setShowSearchReportModal(false);
                          }}
                          className="truncate text-left text-sm font-black text-slate-800 hover:text-blue-700"
                        >
                          {result.material_title}
                        </button>

                        <div className="mt-1 text-xs text-slate-400">
                          {result.material_authors || 'Unknown author'}
                          {result.material_year ? ` · ${result.material_year}` : ''}
                          {' · '}
                          {result.page_ref}
                          {' · '}
                          {result.source_locator}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {result.matched_terms.map((term) => (
                          <span
                            key={term}
                            className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-amber-700"
                          >
                            {term}
                          </span>
                        ))}

                        {result.all_terms_in_context && (
                          <span className="rounded-full bg-green-100 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-green-700">
                            all terms in context
                          </span>
                        )}
                      </div>
                    </div>

                    {result.before && (
                      <div className="mb-3 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-500">
                        <div className="mb-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                          Previous paragraph
                        </div>
                        {highlightSearchTerms(result.before, searchReport.query_terms)}
                      </div>
                    )}

                    <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-relaxed text-slate-800">
                      <div className="mb-1 text-[10px] font-black uppercase tracking-widest text-amber-700">
                        Matching paragraph
                      </div>
                      {highlightSearchTerms(result.match, searchReport.query_terms)}
                    </div>

                    {result.after && (
                      <div className="rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-500">
                        <div className="mb-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                          Next paragraph
                        </div>
                        {highlightSearchTerms(result.after, searchReport.query_terms)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {showLinkModal && (
        <div className="fixed inset-0 z-[90] bg-slate-950/50 flex items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-xl bg-white border border-slate-200 shadow-2xl">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-700">Add Link Material</h3>
              <button
                onClick={() => setShowLinkModal(false)}
                className="h-8 w-8 rounded-md border border-slate-200 hover:bg-slate-100 flex items-center justify-center"
                title="Close"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <Field label="Source URL">
                <input
                  value={linkForm.source_url}
                  onChange={(event) => setLinkForm((current) => ({ ...current, source_url: event.target.value }))}
                  className="repo-input"
                  placeholder="https://..."
                />
              </Field>
              <Field label="Title (Optional)">
                <input
                  value={linkForm.title}
                  onChange={(event) => setLinkForm((current) => ({ ...current, title: event.target.value }))}
                  className="repo-input"
                />
              </Field>
              <Field label="Source Type">
                <select
                  value={linkForm.source_type}
                  onChange={(event) => setLinkForm((current) => ({ ...current, source_type: event.target.value }))}
                  className="repo-input"
                >
                  {sourceTypes.map((sourceType) => (
                    <option key={sourceType} value={sourceType}>
                      {SOURCE_TYPE_LABELS[sourceType] || sourceType}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setShowLinkModal(false)}
                className="h-10 px-4 rounded-lg border border-slate-200 text-xs font-black uppercase tracking-wider hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={createLinkMaterial}
                disabled={isCreatingLink}
                className="h-10 px-4 rounded-lg bg-slate-900 text-white text-xs font-black uppercase tracking-wider disabled:opacity-40"
              >
                {isCreatingLink ? 'Adding' : 'Add Link'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</span>
      {children}
    </label>
  );
}
