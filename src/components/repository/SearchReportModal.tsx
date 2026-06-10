import {
  formatEvidenceLabel,
  highlightSearchTerms,
  relevanceBadgeClass,
} from './formatters';
import type { SearchReport } from './types';

interface SearchReportModalProps {
  searchReport: SearchReport;
  onClose: () => void;
  onDownloadPdf: () => void;
  onDownloadCsv: () => void;
  onSelectMaterial: (materialId: string) => void;
}

const WORDLIST_HEADERS = ['language_name', 'concept', 'concept_group', 'form', 'source', 'latitude', 'longitude'];

export function SearchReportModal({
  searchReport,
  onClose,
  onDownloadPdf,
  onDownloadCsv,
  onSelectMaterial,
}: SearchReportModalProps) {
  return (
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
            <details className="relative">
              <summary className="cursor-pointer list-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-700 hover:bg-slate-50">
                Download
              </summary>
              <div className="absolute right-0 z-10 mt-2 w-36 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                <button
                  type="button"
                  onClick={onDownloadPdf}
                  className="block w-full px-3 py-2 text-left text-[10px] font-black uppercase tracking-wider text-slate-700 hover:bg-slate-50"
                >
                  PDF File
                </button>
                <button
                  type="button"
                  onClick={onDownloadCsv}
                  className="block w-full px-3 py-2 text-left text-[10px] font-black uppercase tracking-wider text-slate-700 hover:bg-slate-50"
                >
                  CSV File
                </button>
              </div>
            </details>

            <button
              type="button"
              onClick={onClose}
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
                      onClick={() => onSelectMaterial(result.material_id)}
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
                    {result.research_relevance && (
                      <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-wider ${relevanceBadgeClass(result.research_relevance)}`}>
                        {result.research_relevance}
                      </span>
                    )}

                    {result.sense && (
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500">
                        {formatEvidenceLabel(result.sense)}
                      </span>
                    )}

                    {result.evidence_type && (
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500">
                        {formatEvidenceLabel(result.evidence_type)}
                      </span>
                    )}

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

                {result.relevance_reason && (
                  <div className="mb-3 text-xs font-semibold text-slate-500">
                    {result.relevance_reason}
                  </div>
                )}

                {!!result.wordlist_rows?.length && (
                  <div className="mb-3 overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full min-w-[720px] text-left text-[11px]">
                      <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                        <tr>
                          {WORDLIST_HEADERS.map((header) => (
                            <th key={header} className="px-2 py-2 font-black">
                              {formatEvidenceLabel(header)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {result.wordlist_rows.map((row, rowIndex) => (
                          <tr key={rowIndex} className="bg-white text-slate-600">
                            {WORDLIST_HEADERS.map((header) => (
                              <td key={header} className="px-2 py-2 align-top">
                                {row[header] ?? ''}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

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
  );
}
