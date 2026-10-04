import type { AskCorpusResponse } from './types';

type Context = NonNullable<AskCorpusResponse['generation_context']>;

export function AIEvidenceInspection({ context, onOpenSource }: {
  context?: Context;
  onOpenSource: (passage: Context['passages'][number]) => void;
}) {
  return (
    <details className="mt-3 rounded-lg border border-slate-200 bg-white p-3 text-xs">
      <summary className="cursor-pointer font-semibold text-blue-700">Inspect AI evidence</summary>
      {context ? (
        <div className="mt-2 space-y-3">
          <p>These excerpts were supplied to the answer generator. Each passage was limited to {context.passage_character_limit} characters. Open the source to inspect its full context.</p>
          {!context.images_included && <p>Images, OCR attached to images, and AI image descriptions shown as related evidence were not supplied to this answer generator.</p>}
          {context.passages.map((passage) => (
            <div key={`${passage.citation_number}-${passage.segment_id}`} className="border-t border-slate-100 pt-2">
              <button type="button" onClick={() => onOpenSource(passage)} className="text-left font-semibold text-blue-700 underline hover:text-blue-900">
                [{passage.citation_number}] {passage.material_title} · {passage.page_ref}
              </button>
              <p className="mt-1 text-slate-500">{passage.source_locator}{passage.truncated ? ' · excerpt truncated for generation' : ''}</p>
              <blockquote className="mt-2 whitespace-pre-wrap border-l-2 border-slate-200 pl-3 leading-relaxed text-slate-700">{passage.excerpt}</blockquote>
            </div>
          ))}
          <details>
            <summary className="cursor-pointer text-slate-500">Processing details</summary>
            <p className="mt-1">Provider: {context.provider} · Model: {context.model}</p>
          </details>
        </div>
      ) : <p className="mt-2 text-slate-500">This response does not include generation-input details. Inspect the cited sources and check the backend version.</p>}
    </details>
  );
}
