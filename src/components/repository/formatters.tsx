import type { ExtractedPreview } from './types';

export function compactPayload(form: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(form).map(([key, value]) => [
      key,
      typeof value === 'string' && value.trim() === '' ? null : value,
    ]),
  );
}

export function guessSourceType(file: File) {
  const name = file.name.toLowerCase();
  if (file.type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (name.endsWith('.ppt') || name.endsWith('.pptx')) return 'presentation';
  if (name.endsWith('.bib') || name.endsWith('.ris')) return 'bibliography';
  return 'other';
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function getExtractionBadgeClass(status?: string) {
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

export function getObservationBadgeClass(type?: string) {
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

export function getObservationTypeHint(type: string) {
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

export function truncateText(value?: string | null, maxLength = 240) {
  if (!value) return '';
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trim()}...`;
}

export function formatLinkStatus(status?: string) {
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

export function getSegmentText(segment: ExtractedPreview['segments'][number]) {
  return cleanAnnotationText(segment.content_text || segment.text || 'No preview text returned for this segment.');
}

export function cleanAnnotationText(text: string) {
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

export function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function highlightSearchTermsHtml(text: string, terms: string[]) {
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
    .map((term) => escapeRegExp(escapeHtml(term)).replace(/\s+/g, '\\s+'));

  if (!patterns.length) {
    return escapedText;
  }

  const regex = new RegExp(`(${patterns.join('|')})`, 'gi');

  return escapedText.replace(
    regex,
    '<mark class="term-highlight">$1</mark>',
  );
}

export function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function formatEvidenceLabel(value?: string | null) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function relevanceBadgeClass(relevance?: 'high' | 'medium' | 'low') {
  if (relevance === 'high') {
    return 'bg-emerald-100 text-emerald-700';
  }
  if (relevance === 'medium') {
    return 'bg-sky-100 text-sky-700';
  }
  if (relevance === 'low') {
    return 'bg-slate-100 text-slate-500';
  }
  return 'bg-slate-100 text-slate-500';
}

export function printableEvidenceMeta(item: {
  sense?: string;
  research_relevance?: 'high' | 'medium' | 'low';
  evidence_type?: string;
  relevance_reason?: string;
}) {
  const badges = [
    item.research_relevance ? `<span class="badge relevance ${escapeHtml(item.research_relevance)}">${escapeHtml(item.research_relevance)}</span>` : '',
    item.sense ? `<span class="badge sense">${escapeHtml(formatEvidenceLabel(item.sense))}</span>` : '',
    item.evidence_type ? `<span class="badge type">${escapeHtml(formatEvidenceLabel(item.evidence_type))}</span>` : '',
  ].join('');

  return `
    ${badges ? `<div class="badges">${badges}</div>` : ''}
    ${item.relevance_reason ? `<p class="meta"><strong>Reason:</strong> ${escapeHtml(item.relevance_reason)}</p>` : ''}
  `;
}

export function printableWordlistRows(rows?: Array<Record<string, string | number | null>>) {
  if (!rows?.length) return '';

  const headers = ['language_name', 'concept', 'concept_group', 'form', 'source', 'latitude', 'longitude'];
  return `
    <table class="wordlist">
      <thead>
        <tr>${headers.map((header) => `<th>${escapeHtml(formatEvidenceLabel(header))}</th>`).join('')}</tr>
      </thead>
      <tbody>
        ${rows.map((row) => `
          <tr>
            ${headers.map((header) => `<td>${escapeHtml(row[header] ?? '')}</td>`).join('')}
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

export function buildHighlightRegex(terms: string[]) {
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

export function buildQueryTerms(query: string) {
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

export function highlightSearchTerms(text: string, terms: string[]) {
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

export function getRetrievalReason(text: string, terms: string[], score?: number) {
  const regex = buildHighlightRegex(terms);
  const cleanedText = cleanAnnotationText(text || '');
  const scoreText = typeof score === 'number' ? `${(score * 100).toFixed(1)} semantic score` : 'semantic score';

  if (!regex || !cleanedText) {
    return `Retrieved by embedding similarity (${scoreText}); no exact search token was available for comparison.`;
  }

  regex.lastIndex = 0;
  const hasLiteralTerm = regex.test(cleanedText);
  regex.lastIndex = 0;

  if (hasLiteralTerm) {
    return `Contains the search term or an expanded variant; also ranked by embedding similarity (${scoreText}).`;
  }

  return `Retrieved by embedding similarity (${scoreText}); the exact search token does not appear in this passage. Review as a possible conceptual neighbor, not a direct text match.`;
}

export async function parseErrorResponse(response: Response, fallback: string) {
  try {
    const data = await response.json();
    if (typeof data?.detail === 'string') return data.detail;
    if (typeof data?.message === 'string') return data.message;
  } catch {
    // Fall through to status text fallback.
  }
  return `${fallback} (${response.status})`;
}
