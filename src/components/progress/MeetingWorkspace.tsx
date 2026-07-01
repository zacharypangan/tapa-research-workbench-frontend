import { useDeferredValue, useEffect, useState } from 'react';
import type {
  MeetingDetailPayload,
  ProgressApi,
  ResearchRecord,
  TranscriptPage,
  TranscriptSegment,
} from './types';

type MeetingTab = 'overview' | 'transcript' | 'records' | 'review' | 'framework' | 'reports';

interface MeetingWorkspaceProps {
  detail: MeetingDetailPayload;
  api: ProgressApi;
  permissions: string[];
  onReload: () => Promise<void>;
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

const statusStyle = (status: string) => {
  if (status === 'accepted') return 'bg-emerald-100 text-emerald-800';
  if (status === 'rejected') return 'bg-rose-100 text-rose-800';
  if (status === 'needs_review' || status === 'candidate') return 'bg-amber-100 text-amber-900';
  return 'bg-slate-100 text-slate-700';
};

function RecordCard({
  record,
  canReview,
  onReview,
}: {
  record: ResearchRecord;
  canReview: boolean;
  onReview: (recordId: string, decision: 'accepted' | 'rejected' | 'needs_review') => void;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-teal-700">{label(record.record_type)}</span>
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${statusStyle(record.status)}`}>
          {label(record.status)}
        </span>
      </div>
      <h3 className="mt-3 font-serif text-xl font-semibold text-slate-900">
        {record.title_original || record.title_en || record.title_ja || 'Untitled research record'}
      </h3>
      {record.title_original && (record.title_en || record.title_ja) && (
        <p className="mt-1 text-sm text-slate-500">{record.title_en || record.title_ja}</p>
      )}
      {(record.summary_en || record.summary_ja) && (
        <p className="mt-3 text-sm leading-6 text-slate-600">{record.summary_en || record.summary_ja}</p>
      )}
      {record.original_evidence && (
        <blockquote className="mt-4 border-l-2 border-teal-600 pl-4 text-sm leading-6 text-slate-700">
          {record.original_evidence}
        </blockquote>
      )}
      <div className="mt-4 flex items-center justify-between gap-3 text-xs text-slate-500">
        <span>{record.evidence.length} evidence link{record.evidence.length === 1 ? '' : 's'}</span>
        {canReview && ['candidate', 'needs_review'].includes(record.status) && (
          <div className="flex gap-2">
            <button className="rounded-full bg-emerald-700 px-3 py-1.5 font-bold text-white" onClick={() => onReview(record.id, 'accepted')}>Accept</button>
            <button className="rounded-full bg-rose-50 px-3 py-1.5 font-bold text-rose-700" onClick={() => onReview(record.id, 'rejected')}>Reject</button>
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

  const submit = async (event: React.FormEvent) => {
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
      setError(saveError instanceof Error ? saveError.message : 'Could not create the record.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <form onSubmit={submit} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-[#fffdf7] p-7 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-700">Create from evidence</p>
            <h2 className="mt-1 font-serif text-3xl font-semibold">Research record candidate</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full px-3 py-1 text-sm text-slate-500 hover:bg-slate-100">Close</button>
        </div>
        <blockquote className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-slate-700">
          <span className="mb-2 block text-xs font-bold text-amber-900">{segment.speaker_text || 'Unidentified speaker'} · {formatTime(segment.start_seconds)}</span>
          {segment.original_text}
        </blockquote>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-bold text-slate-700">Record type
            <select value={recordType} onChange={(event) => setRecordType(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-normal">
              {RECORD_TYPES.map((type) => <option key={type} value={type}>{label(type)}</option>)}
            </select>
          </label>
          <label className="text-sm font-bold text-slate-700">English title
            <input value={titleEn} onChange={(event) => setTitleEn(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-normal" />
          </label>
          <label className="text-sm font-bold text-slate-700">Japanese title
            <input value={titleJa} onChange={(event) => setTitleJa(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-normal" />
          </label>
          <label className="text-sm font-bold text-slate-700 sm:col-span-2">English summary
            <textarea value={summaryEn} onChange={(event) => setSummaryEn(event.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-normal" />
          </label>
        </div>
        {error && <p className="mt-4 text-sm font-semibold text-rose-700">{error}</p>}
        <button disabled={isSaving} className="mt-6 rounded-full bg-teal-800 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">
          {isSaving ? 'Creating candidate...' : 'Create evidence-linked candidate'}
        </button>
      </form>
    </div>
  );
}

export function MeetingWorkspace({ detail, api, permissions, onReload }: MeetingWorkspaceProps) {
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
    if (tab !== 'transcript') return;
    let active = true;
    const params = new URLSearchParams({ limit: '100', offset: String(transcriptOffset) });
    if (deferredQuery.trim()) params.set('q', deferredQuery.trim());
    api<TranscriptPage>(`/meetings/${detail.meeting.id}/transcript?${params}`)
      .then((payload) => { if (active) setTranscript(payload); })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : 'Could not load transcript.'); });
    return () => { active = false; };
  }, [api, deferredQuery, detail.meeting.id, tab, transcriptOffset]);

  const review = async (recordId: string, decision: 'accepted' | 'rejected' | 'needs_review') => {
    setError('');
    try {
      await api(`/records/${recordId}/review`, { method: 'POST', body: JSON.stringify({ decision }) });
      await onReload();
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : 'Could not review record.');
    }
  };

  const draftWithAi = async (segment: TranscriptSegment) => {
    setAiSourceId(segment.id);
    setError('');
    try {
      await api('/ai/extract', {
        method: 'POST',
        body: JSON.stringify({ source_kind: 'transcript_segment', source_ids: [segment.id] }),
      });
      await onReload();
    } catch (draftError) {
      setError(draftError instanceof Error ? draftError.message : 'AI candidate extraction failed.');
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
      setError(downloadError instanceof Error ? downloadError.message : 'Could not generate report.');
    }
  };

  const records = tab === 'review'
    ? detail.records.filter((record) => ['candidate', 'needs_review'].includes(record.status))
    : tab === 'framework'
      ? detail.records.filter((record) => ['spatial_issue', 'temporal_issue', 'uncertainty_issue', 'method_claim', 'technique'].includes(record.record_type))
      : detail.records;

  return (
    <div>
      <section className="border-b border-slate-200 bg-white px-6 py-6">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-700">{detail.meeting.meeting_date} · {label(detail.meeting.meeting_type)}</p>
        <h2 className="mt-2 font-serif text-4xl font-semibold tracking-tight text-slate-950">{detail.meeting.title_original}</h2>
        {detail.meeting.title_en && <p className="mt-1 text-slate-500">{detail.meeting.title_en}</p>}
        <nav className="mt-6 flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1" aria-label="Meeting sections">
          {(['overview', 'transcript', 'records', 'review', 'framework', 'reports'] as MeetingTab[]).map((item) => (
            <button key={item} onClick={() => setTab(item)} className={`whitespace-nowrap rounded-lg px-4 py-2 text-xs font-black uppercase tracking-wider ${tab === item ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
              {label(item)}{item === 'review' ? ` (${detail.records.filter((record) => ['candidate', 'needs_review'].includes(record.status)).length})` : ''}
            </button>
          ))}
        </nav>
      </section>

      <div className="p-6">
        {error && <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div>}

        {tab === 'overview' && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ['Materials', detail.materials.length],
                ['Transcript cues', detail.transcript_count],
                ['Research records', detail.records.length],
                ['Accepted', detail.records.filter((record) => record.status === 'accepted').length],
              ].map(([title, value]) => (
                <div key={title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{title}</p>
                  <p className="mt-2 font-serif text-4xl font-semibold text-slate-950">{value}</p>
                </div>
              ))}
            </div>
            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <h3 className="font-serif text-2xl font-semibold">Repository materials</h3>
              <div className="mt-4 grid gap-2 lg:grid-cols-2">
                {detail.materials.map((material) => (
                  <div key={material.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-800">{material.repository_title || material.original_filename || material.repository_material_id}</p>
                      <p className="mt-0.5 truncate text-xs text-slate-500">{material.original_filename || material.source_type}</p>
                    </div>
                    <span className={`ml-3 shrink-0 rounded-full px-2 py-1 text-[10px] font-bold uppercase ${material.parser_status === 'preserved_only' ? 'bg-amber-100 text-amber-900' : 'bg-teal-100 text-teal-800'}`}>
                      {material.parser_status === 'preserved_only' ? 'preserved only' : material.link_status}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {tab === 'transcript' && (
          <section>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <label className="w-full max-w-xl text-xs font-black uppercase tracking-wider text-slate-500">Find in transcript
                <input value={transcriptQuery} onChange={(event) => { setTranscriptQuery(event.target.value); setTranscriptOffset(0); }} placeholder="Original text, translation, or speaker" className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-normal normal-case tracking-normal" />
              </label>
              <p className="text-sm text-slate-500">{transcript.total.toLocaleString()} matching cues</p>
            </div>
            <div className="mt-5 space-y-3">
              {transcript.segments.map((segment) => (
                <article key={segment.id} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-[88px_1fr_auto]">
                  <div className="font-mono text-xs font-bold text-teal-700">{formatTime(segment.start_seconds)}</div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-slate-500">{segment.speaker_text || 'Unidentified speaker'} · {segment.language}</p>
                    <p className="mt-2 text-[15px] leading-7 text-slate-900">{segment.original_text}</p>
                    {(segment.translation_en || segment.translation_ja) && <p className="mt-2 border-l-2 border-amber-400 pl-3 text-sm leading-6 text-slate-600">{segment.translation_en || segment.translation_ja}</p>}
                  </div>
                  <div className="flex flex-col gap-2 self-start">
                    <button onClick={() => setComposerSegment(segment)} className="rounded-full border border-teal-700 px-3 py-1.5 text-xs font-bold text-teal-800 hover:bg-teal-50">Create record</button>
                    <button disabled={aiSourceId === segment.id} onClick={() => void draftWithAi(segment)} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 disabled:opacity-50">{aiSourceId === segment.id ? 'Drafting...' : 'AI draft'}</button>
                  </div>
                </article>
              ))}
            </div>
            <div className="mt-5 flex justify-between">
              <button disabled={transcriptOffset === 0} onClick={() => setTranscriptOffset(Math.max(0, transcriptOffset - 100))} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-bold disabled:opacity-40">Previous</button>
              <button disabled={transcriptOffset + 100 >= transcript.total} onClick={() => setTranscriptOffset(transcriptOffset + 100)} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">Next 100</button>
            </div>
          </section>
        )}

        {['records', 'review', 'framework'].includes(tab) && (
          <section className="grid gap-4 xl:grid-cols-2">
            {records.map((record) => <RecordCard key={record.id} record={record} canReview={canReview} onReview={review} />)}
            {records.length === 0 && <p className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-500">No records in this view yet.</p>}
          </section>
        )}

        {tab === 'reports' && (
          <section className="grid gap-4 md:grid-cols-2">
            {[
              ['Meeting report', 'Bilingual meeting summary with typed records and exact evidence.', `/reports/meeting/${detail.meeting.id}`],
              ['Decision log', 'Project decisions, status, and supporting evidence.', '/reports/decisions'],
              ['Space/time framework', 'Spatial, temporal, uncertainty, and method records.', '/reports/framework'],
              ['Repository enrichment queue', 'CSV queue of reviewed repository enrichment opportunities.', '/reports/repository-enrichment'],
            ].map(([title, description, path]) => (
              <article key={title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="font-serif text-2xl font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
                <button onClick={() => void downloadReport(path)} className="mt-5 rounded-full bg-teal-800 px-4 py-2 text-xs font-black uppercase tracking-wider text-white">Generate download</button>
              </article>
            ))}
          </section>
        )}
      </div>

      {composerSegment && (
        <RecordComposer segment={composerSegment} meetingId={detail.meeting.id} api={api} onClose={() => setComposerSegment(null)} onCreated={onReload} />
      )}
    </div>
  );
}
