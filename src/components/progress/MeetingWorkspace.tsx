import { useDeferredValue, useEffect, useMemo, useState, type FormEvent } from 'react';
import type {
  MeetingDetailPayload,
  MeetingMaterialLink,
  NarrativeArcDetail,
  ProgressApi,
  ProgressPresentation,
  ProgressSession,
  ResearchRecord,
  RecordProvenance,
  OpenResearchEvidence,
  TranscriptPage,
  TranscriptSegment,
} from './types';

type MeetingTab =
  | 'overview'
  | 'transcript'
  | 'records'
  | 'review'
  | 'framework'
  | 'narrative'
  | 'reports';

interface MeetingWorkspaceProps {
  detail: MeetingDetailPayload;
  api: ProgressApi;
  permissions: string[];
  onReload: () => Promise<void>;
  onOpenResearchEvidence?: OpenResearchEvidence;
}

const RECORD_TYPES = [
  'member_progress',
  'dataset',
  'spatial_issue',
  'temporal_issue',
  'uncertainty_issue',
  'method_claim',
  'technique',
  'decision',
  'open_question',
  'action_item',
  'repository_enrichment',
] as const;

const TABS: MeetingTab[] = [
  'overview',
  'transcript',
  'records',
  'review',
  'framework',
  'narrative',
  'reports',
];

const label = (value: string) => value.replaceAll('_', ' ');

const formatTime = (seconds?: number | null) => {
  if (seconds == null) return '--:--';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = Math.floor(seconds % 60);
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${minutes}:${String(remainder).padStart(2, '0')}`;
};

const recordStatusClass = (status: string) => {
  if (status === 'accepted') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'rejected') return 'border-rose-200 bg-rose-50 text-rose-700';
  if (status === 'needs_review' || status === 'candidate') {
    return 'border-amber-200 bg-amber-50 text-amber-800';
  }
  return 'border-slate-200 bg-slate-50 text-slate-600';
};

const parserStatusClass = (status?: string | null) => {
  if (status === 'preserved_only') return 'border-amber-200 bg-amber-50 text-amber-800';
  if (status === 'pending') return 'border-blue-200 bg-blue-50 text-blue-700';
  return 'border-slate-200 bg-slate-50 text-slate-600';
};

const nonTranscriptMaterials = (materials: MeetingMaterialLink[]) =>
  materials.filter((item) => !item.is_transcript_source);

function RecordCard({
  record,
  api,
  canReview,
  onReview,
  onOpenResearchEvidence,
}: {
  record: ResearchRecord;
  api: ProgressApi;
  canReview: boolean;
  onReview: (recordId: string, decision: 'accepted' | 'rejected' | 'needs_review', notes: string) => Promise<boolean>;
  onOpenResearchEvidence?: OpenResearchEvidence;
}) {
  const [showEvidence, setShowEvidence] = useState(false);
  const [provenance, setProvenance] = useState<RecordProvenance | null>(null);
  const [provenanceError, setProvenanceError] = useState('');
  const [notes, setNotes] = useState(record.notes || '');
  const [isReviewing, setIsReviewing] = useState(false);
  const hasAiReference = typeof record.details?.ai_run_id === 'string';
  useEffect(() => {
    if (!showEvidence) return;
    let active = true;
    api<RecordProvenance>(`/records/${record.id}/provenance`)
      .then((payload) => {
        if (active) {
          setProvenance(payload);
          setProvenanceError('');
        }
      })
      .catch((error: unknown) => {
        if (active) setProvenanceError(error instanceof Error ? error.message : 'Could not load provenance.');
      });
    return () => { active = false; };
  }, [api, record.id, record.reviewed_at, showEvidence]);
  const submitReview = async (decision: 'accepted' | 'rejected' | 'needs_review') => {
    setIsReviewing(true);
    try {
      await onReview(record.id, decision, notes);
    } finally {
      setIsReviewing(false);
    }
  };
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-600">
          {label(record.record_type)}
        </span>
        <span
          className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-wider ${recordStatusClass(record.status)}`}
        >
          {label(record.status)}
        </span>
        <span className="text-xs text-slate-600">
          {hasAiReference ? (provenance?.ai_run ? 'AI-assisted record' : 'AI provenance attached') : 'No AI generation recorded'}
          {['candidate', 'needs_review'].includes(record.status) && ' · awaiting human review'}
        </span>
      </div>
      <h3 className="mt-3 text-lg font-semibold text-slate-900">
        {record.title_original || record.title_en || record.title_ja || 'Untitled research record'}
      </h3>
      {record.title_original && (record.title_en || record.title_ja) && (
        <p className="mt-1 text-sm text-slate-500">{record.title_en || record.title_ja}</p>
      )}
      {(record.summary_en || record.summary_ja) && (
        <p className="mt-3 text-sm leading-6 text-slate-700">
          {record.summary_en || record.summary_ja}
        </p>
      )}
      {record.summary_en && record.summary_ja && (
        <p lang="ja" className="mt-2 text-sm leading-6 text-slate-700">{record.summary_ja}</p>
      )}
      {record.original_evidence && (
        <blockquote className="mt-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-900">
          {record.original_evidence}
        </blockquote>
      )}
      {record.reviewed_by && (
        <p className="mt-3 text-xs text-slate-600">
          Reviewed by {record.reviewed_by}
          {record.reviewed_at && <> · <time dateTime={record.reviewed_at}>{new Date(record.reviewed_at).toLocaleString()}</time></>}
        </p>
      )}
      {record.notes && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          <p className="text-xs font-semibold">Record / review notes</p>
          <p className="mt-1 whitespace-pre-wrap">{record.notes}</p>
        </div>
      )}
      <details className="mt-4 rounded-lg border border-slate-200 p-3" onToggle={(event) => setShowEvidence(event.currentTarget.open)}>
        <summary className="cursor-pointer text-sm font-semibold text-blue-800">
          Inspect evidence and provenance · {record.evidence.length} source{record.evidence.length === 1 ? '' : 's'}
        </summary>
        {showEvidence && (
          <div className="mt-4 space-y-4">
            {record.evidence.length === 0 && <p className="text-sm text-amber-800">No supporting source is linked to this record.</p>}
            {record.evidence.map((evidence, index) => (
              <section key={evidence.id} aria-label={`Evidence ${index + 1}`} className="rounded-lg bg-slate-50 p-3 text-sm">
                <p className="font-semibold text-slate-700">Source {index + 1} · {label(evidence.source_kind)} · {label(evidence.relation || 'supports')}</p>
                <p className="mt-1 break-words text-xs text-slate-600">{evidence.source_locator || 'No precise source locator saved.'}</p>
                <p className="mt-3 text-xs font-semibold text-slate-600">Original evidence</p>
                {evidence.citation_text_original
                  ? <blockquote className="mt-1 whitespace-pre-wrap border-l-2 border-blue-300 pl-3 leading-6 text-slate-900">{evidence.citation_text_original}</blockquote>
                  : <p className="mt-1 text-slate-500">No quotation saved for this source.</p>}
                {evidence.citation_text_en && <div lang="en" className="mt-3"><p className="text-xs font-semibold text-slate-600">English translation</p><p className="mt-1 whitespace-pre-wrap leading-6">{evidence.citation_text_en}</p></div>}
                {evidence.citation_text_ja && <div lang="ja" className="mt-3"><p className="text-xs font-semibold text-slate-600">日本語訳 / Japanese translation</p><p className="mt-1 whitespace-pre-wrap leading-6">{evidence.citation_text_ja}</p></div>}
                {evidence.external_url && /^https?:\/\//i.test(evidence.external_url) && (
                  <a href={evidence.external_url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-blue-800 underline">Open cited source (new tab)</a>
                )}
                {evidence.repository_material_id && onOpenResearchEvidence && (
                  <button
                    type="button"
                    className="mt-3 block rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-800 hover:bg-blue-50"
                    aria-label={`Open source ${index + 1} in repository`}
                    onClick={() => onOpenResearchEvidence({
                      material_id: evidence.repository_material_id || undefined,
                      segment_id: evidence.repository_segment_id,
                      image_id: evidence.repository_image_id,
                      source_locator: evidence.source_locator,
                      snippet: evidence.citation_text_original || undefined,
                      source: 'progress',
                      view: evidence.repository_image_id ? 'images' : 'segments',
                    })}
                  >
                    Open source in repository
                  </button>
                )}
                {evidence.notes && <p className="mt-2 whitespace-pre-wrap text-slate-600">{evidence.notes}</p>}
                {evidence.source_hash && <details className="mt-2 text-xs text-slate-500"><summary className="cursor-pointer">Source fingerprint</summary><p className="mt-1 break-all font-mono">{evidence.source_hash}</p></details>}
              </section>
            ))}
            {provenanceError && <p role="status" className="text-sm text-amber-800">Provenance details are unavailable: {provenanceError}</p>}
            {!provenance && !provenanceError && <p role="status" className="text-sm text-slate-500">Loading provenance…</p>}
            {provenance?.ai_run && (
              <section className="border-t border-slate-200 pt-3 text-sm text-slate-700">
                <p className="font-semibold">AI generation</p>
                <p className="mt-1">{provenance.ai_run.provider} · {provenance.ai_run.model}</p>
                <p className="mt-1 text-xs">Prompt version {provenance.ai_run.prompt_version} · {provenance.ai_run.source_count} input source{provenance.ai_run.source_count === 1 ? '' : 's'}</p>
                <p className="mt-1 text-xs">Requested by {provenance.ai_run.requested_by} · <time dateTime={provenance.ai_run.created_at}>{new Date(provenance.ai_run.created_at).toLocaleString()}</time></p>
                {record.confidence != null && <p className="mt-2 text-xs text-slate-600">Recorded AI confidence score: {record.confidence.toFixed(2)}. This is not a calibrated probability that the interpretation is correct.</p>}
                <details className="mt-2 text-xs"><summary className="cursor-pointer">Generation identifiers</summary><p className="mt-1 break-all">Run: {provenance.ai_run.id}</p><p className="mt-1 break-all">Prompt fingerprint: {provenance.ai_run.prompt_hash}</p></details>
              </section>
            )}
            {provenance && hasAiReference && !provenance.ai_run && <p className="text-sm text-amber-800">The attached AI run could not be verified for this record.</p>}
            {provenance && provenance.review_history.length > 0 && (
              <section className="border-t border-slate-200 pt-3 text-sm text-slate-700">
                <p className="font-semibold">Recent review history</p>
                <ol className="mt-2 space-y-3">
                  {provenance.review_history.map((event) => (
                    <li key={event.id}>
                      <p className="text-xs">{event.actor_id} · <time dateTime={event.occurred_at}>{new Date(event.occurred_at).toLocaleString()}</time></p>
                      {typeof event.changes.status?.after === 'string' && <p className="mt-1">Decision: {label(event.changes.status.after)}</p>}
                      {typeof event.changes.notes?.after === 'string' && <p className="mt-1 whitespace-pre-wrap">{event.changes.notes.after}</p>}
                      {event.changes.notes?.after === null && <p className="mt-1 text-slate-500">Review notes cleared.</p>}
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </div>
        )}
      </details>
      <div className="mt-4 text-xs text-slate-500">
        {canReview && ['candidate', 'needs_review'].includes(record.status) && (
          <div>
            <label htmlFor={`review-notes-${record.id}`} className="block text-sm font-semibold text-slate-700">Review notes (optional)</label>
            <textarea id={`review-notes-${record.id}`} value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={10000} rows={3} disabled={isReviewing} placeholder="Explain a correction, uncertainty, or reason for the decision." className="mt-2 w-full rounded-lg border border-slate-300 p-3 text-sm text-slate-900 disabled:opacity-50" />
            <div className="mt-3 flex flex-wrap gap-2" aria-busy={isReviewing}>
              <button
                type="button"
                disabled={isReviewing || record.evidence.length === 0}
                className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                onClick={() => void submitReview('accepted')}
              >
                Accept
              </button>
              <button
                type="button"
                disabled={isReviewing}
                className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                onClick={() => void submitReview('rejected')}
              >
                Reject
              </button>
              <button type="button" disabled={isReviewing} onClick={() => void submitReview('needs_review')} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-amber-800 disabled:opacity-50">Needs more review</button>
            </div>
            {isReviewing && <p role="status" className="mt-2">Saving review…</p>}
          </div>
        )}
      </div>
    </article>
  );
}

function RecordComposer({
  segment,
  meetingId,
  api,
  onClose,
  onCreated,
}: {
  segment: TranscriptSegment;
  meetingId: string;
  api: ProgressApi;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [recordType, setRecordType] = useState('member_progress');
  const [titleEn, setTitleEn] = useState('');
  const [titleJa, setTitleJa] = useState('');
  const [summaryEn, setSummaryEn] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setError('');
    try {
      await api('/records', {
        method: 'POST',
        body: JSON.stringify({
          record_type: recordType,
          title_en: titleEn || null,
          title_ja: titleJa || null,
          summary_en: summaryEn || null,
          original_evidence: segment.original_text,
          original_language: segment.language,
          meeting_id: meetingId,
          status: 'candidate',
          evidence: [
            {
              source_kind: 'transcript_segment',
              transcript_segment_id: segment.id,
              source_locator: segment.source_locator,
              citation_text_original: segment.original_text,
              repository_material_id: segment.repository_material_id,
              repository_segment_id: segment.repository_segment_id,
            },
          ],
        }),
      });
      await onCreated();
      onClose();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : 'Could not create the record.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <form
        onSubmit={submit}
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-7 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
              Create From Evidence
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">
              Research Record Candidate
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-500 hover:bg-slate-50"
          >
            Close
          </button>
        </div>
        <blockquote className="mt-6 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
          <span className="mb-2 block text-[10px] font-black uppercase tracking-wider text-blue-700">
            {segment.speaker_text || 'Unidentified speaker'} · {formatTime(segment.start_seconds)}
          </span>
          {segment.original_text}
        </blockquote>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">
            Record type
            <select
              value={recordType}
              onChange={(event) => setRecordType(event.target.value)}
              className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500"
            >
              {RECORD_TYPES.map((type) => (
                <option key={type} value={type}>
                  {label(type)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            English title
            <input
              value={titleEn}
              onChange={(event) => setTitleEn(event.target.value)}
              className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Japanese title
            <input
              value={titleJa}
              onChange={(event) => setTitleJa(event.target.value)}
              className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
            English summary
            <textarea
              value={summaryEn}
              onChange={(event) => setSummaryEn(event.target.value)}
              rows={3}
              className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </label>
        </div>
        {error && <p className="mt-4 text-sm font-semibold text-rose-700">{error}</p>}
        <button
          disabled={isSaving}
          className="mt-6 h-10 rounded-lg border border-slate-200 bg-white px-5 text-xs font-black uppercase tracking-wider text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? 'Creating' : 'Create Candidate'}
        </button>
      </form>
    </div>
  );
}

function MaterialRow({ material }: { material: MeetingMaterialLink }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">{material.display_title}</p>
          <p className="mt-1 text-xs text-slate-500">
            {material.original_filename || material.source_type || material.repository_material_id}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span
            className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-wider ${parserStatusClass(material.parser_status)}`}
          >
            {material.parser_status === 'preserved_only'
              ? 'Preserved only'
              : material.link_status}
          </span>
          {material.is_transcript_source && (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-600">
              Transcript source
            </span>
          )}
        </div>
      </div>
      {material.parser_message && (
        <p className="mt-3 text-xs leading-5 text-slate-500">{material.parser_message}</p>
      )}
    </div>
  );
}

function NarrativeArcCard({
  detail,
  onDownload,
}: {
  detail: NarrativeArcDetail;
  onDownload: (path: string) => void;
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-600">
              Narrative arc
            </span>
            {detail.current_meeting_steps > 0 && (
              <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-blue-700">
                {detail.current_meeting_steps} step{detail.current_meeting_steps === 1 ? '' : 's'} in this meeting
              </span>
            )}
          </div>
          <h3 className="mt-3 text-lg font-semibold text-slate-900">
            {detail.arc.title_en}
          </h3>
          <p className="mt-1 text-sm text-slate-500">{detail.arc.title_ja}</p>
        </div>
        <button
          type="button"
          onClick={() => onDownload(`/reports/narrative-arcs/${detail.arc.id}`)}
          className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-xs font-black uppercase tracking-wider text-slate-700 hover:bg-slate-50"
        >
          Download arc
        </button>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
            English
          </p>
          <p className="mt-2">{detail.arc.description_en}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
            日本語
          </p>
          <p className="mt-2">{detail.arc.description_ja}</p>
        </div>
      </div>
      <div className="mt-5 space-y-3">
        {detail.links.map((link) => (
          <div
            key={link.id}
            className={`rounded-xl border p-4 ${
              link.is_current_meeting
                ? 'border-blue-200 bg-blue-50'
                : 'border-slate-200 bg-slate-50'
            }`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-600">
                {link.role_in_arc.replaceAll('_', ' ')}
              </span>
              {link.meeting_date && (
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  {link.meeting_date}
                </span>
              )}
              {link.source_record_type && (
                <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500">
                  {link.source_record_type.replaceAll('_', ' ')}
                </span>
              )}
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-900">{link.source_label}</p>
            {link.summary_en && <p className="mt-2 text-sm leading-6 text-slate-700">{link.summary_en}</p>}
            {link.summary_ja && <p className="mt-2 text-sm leading-6 text-slate-500">{link.summary_ja}</p>}
          </div>
        ))}
      </div>
    </article>
  );
}

function PresentationCard({
  presentation,
  materials,
}: {
  presentation: ProgressPresentation;
  materials: MeetingMaterialLink[];
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-600">
          Presentation
        </span>
        {presentation.generated && (
          <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-blue-700">
            Generated structure
          </span>
        )}
      </div>
      <h4 className="mt-3 text-base font-semibold text-slate-900">
        {presentation.title_original}
      </h4>
      {(presentation.title_en || presentation.title_ja) && (
        <p className="mt-1 text-sm text-slate-500">
          {presentation.title_en || presentation.title_ja}
        </p>
      )}
      <div className="mt-4 space-y-2">
        {materials.map((material) => (
          <MaterialRow key={material.id} material={material} />
        ))}
      </div>
    </article>
  );
}

function SessionCard({
  session,
  presentations,
  materialsByPresentation,
  unassignedMaterials,
  transcriptOnly,
}: {
  session: ProgressSession;
  presentations: ProgressPresentation[];
  materialsByPresentation: Map<string, MeetingMaterialLink[]>;
  unassignedMaterials: MeetingMaterialLink[];
  transcriptOnly: boolean;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-600">
              Session {session.order_index + 1}
            </span>
            {session.generated && (
              <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-blue-700">
                Generated structure
              </span>
            )}
          </div>
          <h3 className="mt-3 text-lg font-semibold text-slate-900">
            {session.title_original}
          </h3>
          {(session.title_en || session.title_ja) && (
            <p className="mt-1 text-sm text-slate-500">
              {session.title_en || session.title_ja}
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 text-right text-xs text-slate-500">
          <div>
            <p className="font-black uppercase tracking-wider text-slate-400">
              Presentations
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              {session.presentation_count}
            </p>
          </div>
          <div>
            <p className="font-black uppercase tracking-wider text-slate-400">
              Materials
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              {session.material_count}
            </p>
          </div>
        </div>
      </div>

      {presentations.length > 0 ? (
        <div className="mt-5 space-y-4">
          {presentations.map((presentation) => (
            <PresentationCard
              key={presentation.id}
              presentation={presentation}
              materials={materialsByPresentation.get(presentation.id) || []}
            />
          ))}
        </div>
      ) : transcriptOnly ? (
        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
          This meeting is transcript-only right now. The session shell exists so transcript evidence and future program structure can live in the same workbench.
        </div>
      ) : (
        <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm leading-6 text-slate-500">
          No presentations are assigned to this session yet.
        </div>
      )}

      {unassignedMaterials.length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
            Unassigned Materials
          </p>
          <div className="mt-3 space-y-2">
            {unassignedMaterials.map((material) => (
              <MaterialRow key={material.id} material={material} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export function MeetingWorkspace({
  detail,
  api,
  permissions,
  onReload,
  onOpenResearchEvidence,
}: MeetingWorkspaceProps) {
  const [tab, setTab] = useState<MeetingTab>('overview');
  const [transcriptQuery, setTranscriptQuery] = useState('');
  const deferredQuery = useDeferredValue(transcriptQuery);
  const [transcript, setTranscript] = useState<TranscriptPage>({
    segments: detail.transcript_segments,
    total: detail.transcript_count,
    limit: 100,
    offset: 0,
  });
  const [transcriptOffset, setTranscriptOffset] = useState(0);
  const [composerSegment, setComposerSegment] = useState<TranscriptSegment | null>(null);
  const [error, setError] = useState('');
  const [aiSourceId, setAiSourceId] = useState<string | null>(null);
  const canReview = permissions.includes('progress:review');

  useEffect(() => {
    setTranscript({
      segments: detail.transcript_segments,
      total: detail.transcript_count,
      limit: 100,
      offset: 0,
    });
    setTranscriptOffset(0);
  }, [detail]);

  useEffect(() => {
    if (tab !== 'transcript') return;
    let active = true;
    const params = new URLSearchParams({
      limit: '100',
      offset: String(transcriptOffset),
    });
    if (deferredQuery.trim()) params.set('q', deferredQuery.trim());
    api<TranscriptPage>(`/meetings/${detail.meeting.id}/transcript?${params}`)
      .then((payload) => {
        if (active) setTranscript(payload);
      })
      .catch((loadError) => {
        if (!active) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Could not load transcript.',
        );
      });
    return () => {
      active = false;
    };
  }, [api, deferredQuery, detail.meeting.id, tab, transcriptOffset]);

  const review = async (
    recordId: string,
    decision: 'accepted' | 'rejected' | 'needs_review',
    notes: string,
  ) => {
    setError('');
    try {
      await api(`/records/${recordId}/review`, {
        method: 'POST',
        body: JSON.stringify({ decision, notes }),
      });
      await onReload();
      return true;
    } catch (reviewError) {
      setError(
        reviewError instanceof Error ? reviewError.message : 'Could not review record.',
      );
      return false;
    }
  };

  const draftWithAi = async (segment: TranscriptSegment) => {
    setAiSourceId(segment.id);
    setError('');
    try {
      await api('/ai/extract', {
        method: 'POST',
        body: JSON.stringify({
          source_kind: 'transcript_segment',
          source_ids: [segment.id],
        }),
      });
      await onReload();
    } catch (draftError) {
      setError(
        draftError instanceof Error
          ? draftError.message
          : 'AI candidate extraction failed.',
      );
    } finally {
      setAiSourceId(null);
    }
  };

  const downloadReport = async (path: string) => {
    setError('');
    try {
      const report = await api<{ filename: string; media_type: string; content: string }>(path);
      const url = URL.createObjectURL(new Blob([report.content], { type: report.media_type }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = report.filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : 'Could not generate report.',
      );
    }
  };

  const records = tab === 'review'
    ? detail.records.filter((record) => ['candidate', 'needs_review'].includes(record.status))
    : tab === 'framework'
      ? detail.records.filter((record) =>
          [
            'spatial_issue',
            'temporal_issue',
            'uncertainty_issue',
            'method_claim',
            'technique',
          ].includes(record.record_type),
        )
      : detail.records;

  const presentationsBySession = useMemo(() => {
    const map = new Map<string, ProgressPresentation[]>();
    for (const presentation of detail.presentations) {
      const sessionId = presentation.session_id || '';
      const items = map.get(sessionId) || [];
      items.push(presentation);
      map.set(sessionId, items);
    }
    return map;
  }, [detail.presentations]);

  const materialsByPresentation = useMemo(() => {
    const map = new Map<string, MeetingMaterialLink[]>();
    for (const material of detail.materials) {
      if (!material.presentation_id) continue;
      const items = map.get(material.presentation_id) || [];
      items.push(material);
      map.set(material.presentation_id, items);
    }
    return map;
  }, [detail.materials]);

  const unassignedPresentationMaterials = useMemo(
    () =>
      nonTranscriptMaterials(detail.materials).filter(
        (material) => !material.presentation_id,
      ),
    [detail.materials],
  );

  const transcriptSourceMaterials = useMemo(
    () => detail.materials.filter((material) => material.is_transcript_source),
    [detail.materials],
  );

  const preservedOnlyCount = useMemo(
    () => detail.materials.filter((material) => material.parser_status === 'preserved_only').length,
    [detail.materials],
  );

  return (
    <div className="flex min-h-full flex-col bg-slate-50 text-slate-900">
      <section className="border-b border-slate-200 bg-white px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-600">
                {detail.meeting.meeting_date}
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-600">
                {label(detail.meeting.meeting_type)}
              </span>
              {detail.structure.transcript_only && (
                <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-blue-700">
                  Transcript only
                </span>
              )}
            </div>
            <h2 className="mt-3 text-2xl font-semibold text-slate-900">
              {detail.meeting.title_original}
            </h2>
            {detail.meeting.title_en && (
              <p className="mt-1 text-sm text-slate-500">{detail.meeting.title_en}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ['Sessions', detail.structure.session_count],
                ['Presentations', detail.structure.presentation_count],
                ['Materials', detail.structure.material_count],
                ['Transcript cues', detail.transcript_count],
            ].map(([title, value]) => (
              <div key={title} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  {title}
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
              </div>
            ))}
          </div>
        </div>

        <nav
          className="mt-5 flex gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-slate-100 p-1"
          aria-label="Meeting sections"
        >
          {TABS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTab(item)}
              className={`whitespace-nowrap rounded-md px-4 py-2 text-[10px] font-black uppercase tracking-wider transition-colors ${
                tab === item
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:bg-white/70 hover:text-slate-800'
              }`}
            >
              {label(item)}
              {item === 'review'
                ? ` (${detail.records.filter((record) => ['candidate', 'needs_review'].includes(record.status)).length})`
                : ''}
            </button>
          ))}
        </nav>
      </section>

      <div className="flex-1 p-6">
        {error && (
          <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            {error}
          </div>
        )}

        {tab === 'overview' && (
          <div className="space-y-6">
            <div className="grid gap-4 xl:grid-cols-4">
              {[
                ['Accepted records', detail.records.filter((record) => record.status === 'accepted').length],
                ['Review queue', detail.records.filter((record) => ['candidate', 'needs_review'].includes(record.status)).length],
                ['Generated presentations', detail.structure.generated_presentation_count],
                ['Preserved-only assets', preservedOnlyCount],
              ].map(([title, value]) => (
                <div key={title} className="rounded-xl border border-slate-200 bg-white p-5">
                  <p className="text-xs font-black uppercase tracking-wider text-slate-400">
                    {title}
                  </p>
                  <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
                </div>
              ))}
            </div>

            <section className="rounded-xl border border-slate-200 bg-white p-5">
              {(detail.meeting.summary_en || detail.meeting.summary_ja) && (
                <div className="mb-5 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      English summary
                    </p>
                    <p className="mt-2">{detail.meeting.summary_en || 'Not yet reviewed.'}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      日本語要約
                    </p>
                    <p className="mt-2">{detail.meeting.summary_ja || '未確認。'}</p>
                  </div>
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                    Meeting Program
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-slate-900">
                    Session and presentation structure
                  </h3>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                  {detail.structure.presentation_material_count} presentation materials,{' '}
                  {detail.structure.transcript_material_count} transcript sources
                </div>
              </div>
              <div className="mt-5 space-y-4">
                {detail.sessions.map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    presentations={presentationsBySession.get(session.id) || []}
                    materialsByPresentation={materialsByPresentation}
                    unassignedMaterials={session.order_index === 0 ? unassignedPresentationMaterials : []}
                    transcriptOnly={detail.structure.transcript_only}
                  />
                ))}
                {detail.sessions.length === 0 && (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                    No session structure exists for this meeting yet.
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                    Narrative development
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-slate-900">
                    How this meeting advances the program arcs
                  </h3>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                  {detail.structure.related_arc_count} related arc{detail.structure.related_arc_count === 1 ? '' : 's'}
                </div>
              </div>
              <div className="mt-4 space-y-4">
                {detail.related_arcs.length > 0 ? (
                  detail.related_arcs.map((arcDetail) => (
                    <NarrativeArcCard
                      key={arcDetail.arc.id}
                      detail={arcDetail}
                      onDownload={downloadReport}
                    />
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                    No narrative arcs are linked to this meeting yet.
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                Transcript Sources
              </p>
              <h3 className="mt-2 text-xl font-semibold text-slate-900">
                Materials from minutes and caption files
              </h3>
              <div className="mt-4 space-y-2">
                {transcriptSourceMaterials.length > 0 ? (
                  transcriptSourceMaterials.map((material) => (
                    <MaterialRow key={material.id} material={material} />
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                    No transcript source files are linked to this meeting.
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {tab === 'transcript' && (
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            {detail.structure.transcript_only && (
              <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
                This meeting currently has transcript evidence but no presentation-file structure. You can still create evidence-linked records directly from transcript cues below.
              </div>
            )}
            <div className="flex flex-wrap items-end justify-between gap-4">
              <label className="w-full max-w-xl text-xs font-black uppercase tracking-wider text-slate-500">
                Find in transcript
                <input
                  value={transcriptQuery}
                  onChange={(event) => {
                    setTranscriptQuery(event.target.value);
                    setTranscriptOffset(0);
                  }}
                  placeholder="Original text, translation, or speaker"
                  className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500"
                />
              </label>
              <p className="text-sm text-slate-500">
                {transcript.total.toLocaleString()} matching cues
              </p>
            </div>
            <div className="mt-5 space-y-3">
              {transcript.segments.map((segment) => (
                <article
                  key={segment.id}
                  className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[88px_1fr_auto]"
                >
                  <div className="font-mono text-xs font-bold text-slate-600">
                    {formatTime(segment.start_seconds)}
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      {segment.speaker_text || 'Unidentified speaker'} · {segment.language}
                    </p>
                    <p className="mt-2 text-sm leading-7 text-slate-900">
                      {segment.original_text}
                    </p>
                    {(segment.translation_en || segment.translation_ja) && (
                      <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-900">
                        {segment.translation_en || segment.translation_ja}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 self-start">
                    <button
                      type="button"
                      onClick={() => setComposerSegment(segment)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-700 hover:bg-slate-50"
                    >
                      Create record
                    </button>
                    <button
                      type="button"
                      disabled={aiSourceId === segment.id}
                      onClick={() => void draftWithAi(segment)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {aiSourceId === segment.id ? 'Drafting' : 'AI draft'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
            <div className="mt-5 flex justify-between">
              <button
                type="button"
                disabled={transcriptOffset === 0}
                onClick={() => setTranscriptOffset(Math.max(0, transcriptOffset - 100))}
                className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-xs font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={transcriptOffset + 100 >= transcript.total}
                onClick={() => setTranscriptOffset(transcriptOffset + 100)}
                className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-xs font-black uppercase tracking-wider text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next 100
              </button>
            </div>
          </section>
        )}

        {['records', 'review', 'framework'].includes(tab) && (
          <section className="grid gap-4 xl:grid-cols-2">
            {records.map((record) => (
              <RecordCard
                key={record.id}
                record={record}
                api={api}
                canReview={canReview}
                onReview={review}
                onOpenResearchEvidence={onOpenResearchEvidence}
              />
            ))}
            {records.length === 0 && (
              <p className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
                No records in this view yet.
              </p>
            )}
          </section>
        )}

        {tab === 'narrative' && (
          <section className="space-y-4">
            {detail.related_arcs.length > 0 ? (
              detail.related_arcs.map((arcDetail) => (
                <NarrativeArcCard
                  key={arcDetail.arc.id}
                  detail={arcDetail}
                  onDownload={downloadReport}
                />
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
                No narrative arcs are linked to this meeting yet.
              </div>
            )}
          </section>
        )}

        {tab === 'reports' && (
          <section className="grid gap-4 md:grid-cols-2">
            {[
              ['Meeting report', 'Bilingual meeting summary with typed records and exact evidence.', `/reports/meeting/${detail.meeting.id}`],
              ['Decision log', 'Project decisions, status, and supporting evidence.', '/reports/decisions'],
              ['Space/time framework', 'Spatial, temporal, uncertainty, and method records.', '/reports/framework'],
              ['Repository enrichment queue', 'CSV queue of reviewed repository enrichment opportunities.', '/reports/repository-enrichment'],
              ...detail.related_arcs.map((arcDetail) => [
                `Narrative arc: ${arcDetail.arc.title_en}`,
                'Chronological narrative export with linked records and evidence.',
                `/reports/narrative-arcs/${arcDetail.arc.id}`,
              ] as const),
            ].map(([title, description, path]) => (
              <article key={title} className="rounded-xl border border-slate-200 bg-white p-6">
                <h3 className="text-xl font-semibold text-slate-900">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
                <button
                  type="button"
                  onClick={() => void downloadReport(path)}
                  className="mt-5 h-10 rounded-lg border border-slate-200 bg-white px-4 text-xs font-black uppercase tracking-wider text-slate-700 hover:bg-slate-50"
                >
                  Generate download
                </button>
              </article>
            ))}
          </section>
        )}
      </div>

      {composerSegment && (
        <RecordComposer
          segment={composerSegment}
          meetingId={detail.meeting.id}
          api={api}
          onClose={() => setComposerSegment(null)}
          onCreated={onReload}
        />
      )}
    </div>
  );
}
