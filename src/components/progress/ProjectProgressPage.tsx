import { useMemo, useState } from 'react';
import type {
  NarrativeArcDetail,
  NarrativeArcLink,
  ProjectProgressDashboard,
  ProgressTimelineEntry,
} from './types';

interface ProjectProgressPageProps {
  dashboard: ProjectProgressDashboard;
  onOpenMeeting: (meetingId: string) => void;
}

type ProgressLens = 'all' | 'meetings' | 'arcs' | 'records' | 'timeline' | 'treatment';

const label = (value: string) => value.replaceAll('_', ' ');

const truncate = (value: string | null | undefined, limit = 140) => {
  const text = value?.trim() ?? '';
  if (!text) return '';
  return text.length <= limit ? text : `${text.slice(0, limit - 1).trimEnd()}…`;
};

const matchesQuery = (query: string, values: Array<string | null | undefined>) => {
  if (!query) return true;
  const haystack = values
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(query);
};

const topCounts = (values: string[], limit: number) => {
  const counts = new Map<string, number>();
  values.forEach((value) => {
    const normalized = value.trim();
    if (!normalized) return;
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  });
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit);
};

const lensButtonClass = (active: boolean) =>
  [
    'rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.18em] transition',
    active
      ? 'border-amber-500 bg-amber-600 text-white shadow-sm'
      : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700',
  ].join(' ');

const domainClass = (tone: 'amber' | 'emerald' | 'violet' | 'sky', dimmed: boolean) =>
  [
    'rounded-[1.75rem] border p-5 backdrop-blur-sm transition',
    tone === 'amber' && 'border-amber-300/80 bg-white/75 shadow-[inset_0_0_0_1px_rgba(245,158,11,0.14)]',
    tone === 'emerald' && 'border-emerald-200 bg-emerald-50/70 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.1)]',
    tone === 'violet' && 'border-violet-200 bg-violet-50/80 shadow-[inset_0_0_0_1px_rgba(139,92,246,0.1)]',
    tone === 'sky' && 'border-sky-200 bg-sky-50/80 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.08)]',
    dimmed && 'opacity-50',
  ]
    .filter(Boolean)
    .join(' ');

function MeetingProgressCard({
  entry,
  onOpenMeeting,
}: {
  entry: ProgressTimelineEntry;
  onOpenMeeting: (meetingId: string) => void;
}) {
  return (
    <article className="rounded-[1.5rem] border-2 border-emerald-300 bg-white/90 p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">
              {entry.meeting.meeting_date}
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">
              {label(entry.meeting.meeting_type)}
            </span>
            {entry.presentation_count === 0 && (
              <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-blue-700">
                Transcript only
              </span>
            )}
          </div>
          <h3 className="mt-3 text-2xl font-bold leading-tight text-slate-900">
            {entry.meeting.title_original}
          </h3>
          {entry.meeting.title_en && (
            <p className="mt-1 text-sm text-slate-500">{entry.meeting.title_en}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => onOpenMeeting(entry.meeting.id)}
          className="rounded-full border border-amber-300 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-amber-700 hover:bg-amber-50"
        >
          Open
        </button>
      </div>

      {(entry.meeting.summary_en || entry.meeting.summary_ja) && (
        <p className="mt-4 text-sm leading-6 text-slate-700">
          {truncate(entry.meeting.summary_en || entry.meeting.summary_ja, 180)}
        </p>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {[
          ['Sessions', entry.session_count],
          ['Presentations', entry.presentation_count],
          ['Materials', entry.material_count],
          ['Transcript cues', entry.transcript_count],
          ['Records', entry.record_count],
          ['Arc steps', entry.narrative_arc_step_count],
        ].map(([title, value]) => (
          <div key={title} className="rounded-2xl border border-slate-200 bg-slate-50/90 px-3 py-3">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
              {title}
            </p>
            <p className="mt-1 text-lg font-bold text-slate-900">{value}</p>
          </div>
        ))}
      </div>

      {(entry.featured_record_titles.length > 0 || entry.arc_titles.length > 0) && (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-[1.25rem] border border-amber-200 bg-amber-50/70 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">
              Record signals
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {entry.featured_record_titles.length > 0 ? (
                entry.featured_record_titles.slice(0, 6).map((title, index) => (
                  <span
                    key={`${title}-${index}`}
                    className="rounded-full border border-amber-200 bg-white px-3 py-1 text-xs font-medium text-amber-900"
                  >
                    {truncate(title, 42)}
                  </span>
                ))
              ) : (
                <span className="text-sm text-slate-500">No seeded records yet.</span>
              )}
            </div>
          </div>

          <div className="rounded-[1.25rem] border border-emerald-200 bg-emerald-50/70 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
              Narrative paths
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {entry.arc_titles.length > 0 ? (
                entry.arc_titles.slice(0, 6).map((title, index) => (
                  <span
                    key={`${title}-${index}`}
                    className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-medium text-emerald-900"
                  >
                    {truncate(title, 42)}
                  </span>
                ))
              ) : (
                <span className="text-sm text-slate-500">No arc links yet.</span>
              )}
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

function ArcStep({
  link,
  onOpenMeeting,
}: {
  link: NarrativeArcLink;
  onOpenMeeting: (meetingId: string) => void;
}) {
  return (
    <div className="rounded-[1.25rem] border border-slate-200 bg-white/85 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {link.meeting_date && (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">
                {link.meeting_date}
              </span>
            )}
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">
              {label(link.role_in_arc)}
            </span>
            {link.source_record_type && (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                {label(link.source_record_type)}
              </span>
            )}
          </div>
          <h4 className="mt-3 text-base font-semibold text-slate-900">
            {link.source_label}
          </h4>
        </div>
        {link.meeting_id && (
          <button
            type="button"
            onClick={() => onOpenMeeting(link.meeting_id!)}
            className="rounded-full border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-700 hover:bg-slate-100"
          >
            Open meeting
          </button>
        )}
      </div>
      {(link.summary_en || link.summary_ja) && (
        <p className="mt-3 text-sm leading-6 text-slate-700">
          {truncate(link.summary_en || link.summary_ja, 180)}
        </p>
      )}
    </div>
  );
}

function NarrativeArcPanel({
  detail,
  onOpenMeeting,
}: {
  detail: NarrativeArcDetail;
  onOpenMeeting: (meetingId: string) => void;
}) {
  return (
    <article className="rounded-[1.75rem] border border-emerald-200 bg-white/90 p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">
              {label(detail.arc.status)}
            </span>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
              {detail.link_count} steps
            </span>
          </div>
          <h3 className="mt-3 text-2xl font-bold text-slate-900">{detail.arc.title_en}</h3>
          <p className="mt-1 text-sm text-slate-500">{detail.arc.title_ja}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <div className="rounded-[1.25rem] border border-emerald-200 bg-emerald-50/70 p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
            Arc treatment
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-700">
            {detail.arc.description_en}
          </p>
          <p className="mt-4 text-sm leading-6 text-slate-500">
            {detail.arc.description_ja}
          </p>
        </div>

        <div className="space-y-3">
          {detail.links.map((link) => (
            <ArcStep key={link.id} link={link} onOpenMeeting={onOpenMeeting} />
          ))}
        </div>
      </div>
    </article>
  );
}

export function ProjectProgressPage({
  dashboard,
  onOpenMeeting,
}: ProjectProgressPageProps) {
  const [focusQuery, setFocusQuery] = useState('');
  const [activeLens, setActiveLens] = useState<ProgressLens>('all');

  const normalizedQuery = focusQuery.trim().toLowerCase();

  const filteredTimeline = useMemo(
    () =>
      dashboard.timeline.filter((entry) =>
        matchesQuery(normalizedQuery, [
          entry.meeting.title_original,
          entry.meeting.title_en,
          entry.meeting.title_ja,
          entry.meeting.summary_en,
          entry.meeting.summary_ja,
          entry.meeting.meeting_date,
          entry.featured_record_titles.join(' '),
          entry.arc_titles.join(' '),
        ]),
      ),
    [dashboard.timeline, normalizedQuery],
  );

  const filteredArcs = useMemo(
    () =>
      dashboard.arcs.filter((detail) =>
        matchesQuery(normalizedQuery, [
          detail.arc.title_en,
          detail.arc.title_ja,
          detail.arc.description_en,
          detail.arc.description_ja,
          detail.links.map((link) => `${link.source_label} ${link.summary_en ?? ''}`).join(' '),
        ]),
      ),
    [dashboard.arcs, normalizedQuery],
  );

  const filteredTreatment = useMemo(
    () =>
      dashboard.narrative_treatment.filter((item) =>
        matchesQuery(normalizedQuery, [item.title, item.description]),
      ),
    [dashboard.narrative_treatment, normalizedQuery],
  );

  const earliestEntry = filteredTimeline[0] || null;
  const latestEntry = filteredTimeline[filteredTimeline.length - 1] || null;

  const totalArcSteps = filteredArcs.reduce((sum, detail) => sum + detail.link_count, 0);

  const topRecordSignals = useMemo(
    () =>
      topCounts(
        filteredTimeline.flatMap((entry) => entry.featured_record_titles),
        8,
      ),
    [filteredTimeline],
  );

  const topPaths = useMemo(
    () =>
      topCounts(
        [
          ...filteredTimeline.flatMap((entry) => entry.arc_titles),
          ...filteredArcs.map((detail) => detail.arc.title_en),
        ],
        5,
      ),
    [filteredArcs, filteredTimeline],
  );

  const timelineMarkers = filteredTimeline.slice(-5);

  const lenses: Array<{ id: ProgressLens; label: string; count: number }> = [
    {
      id: 'all',
      label: 'All map',
      count:
        filteredTimeline.length + filteredArcs.length + topRecordSignals.length + filteredTreatment.length,
    },
    { id: 'meetings', label: 'Meetings', count: filteredTimeline.length },
    { id: 'arcs', label: 'Arcs', count: filteredArcs.length },
    { id: 'records', label: 'Records', count: topRecordSignals.length },
    { id: 'timeline', label: 'Time', count: timelineMarkers.length },
    { id: 'treatment', label: 'Governance', count: filteredTreatment.length },
  ];

  const isDimmed = (lens: ProgressLens) => activeLens !== 'all' && activeLens !== lens;

  return (
    <div className="flex min-h-full flex-col bg-[#f7f3eb] text-slate-900">
      <section className="border-b border-[#dbe3ee] bg-[#fcf8f0] px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-5xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">
                Research command center
              </span>
              {earliestEntry && latestEntry && (
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">
                  {earliestEntry.meeting.meeting_date} to {latestEntry.meeting.meeting_date}
                </span>
              )}
            </div>
            <h2 className="mt-3 text-4xl font-black tracking-tight text-slate-900">
              Spatiotemporal progress atlas
            </h2>
            <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600">
              Follow the project as a visual map instead of a report stack. Meetings, narrative arcs,
              record signals, and governance treatment stay linked so the research story remains easy
              to scan and easy to open in detail.
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-[1.75rem] border border-[#dbe3ee] bg-white/80 p-4 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
                Focus meetings, arcs, or evidence
              </p>
              <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                <input
                  value={focusQuery}
                  onChange={(event) => setFocusQuery(event.target.value)}
                  placeholder="Focus meetings, narrative arcs, record signals, or evidence"
                  className="h-14 min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none focus:border-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setFocusQuery('')}
                  className="h-14 rounded-2xl border border-slate-200 bg-white px-5 text-xs font-black uppercase tracking-[0.18em] text-slate-600 hover:bg-slate-50"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="flex-1 space-y-6 p-6">
        <section className="rounded-[2rem] border border-[#dbe3ee] bg-[#fcf8f0] p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="text-2xl font-black tracking-tight text-slate-900">Atlas overview</h3>
              <p className="mt-2 text-sm text-slate-500">
                A visual map of meetings, themes, narrative paths, and project governance.
              </p>
            </div>
            <div className="flex items-center gap-4 text-[11px] font-black uppercase tracking-[0.18em]">
              <span className="inline-flex items-center gap-2 text-emerald-700">
                <span className="h-0.5 w-6 rounded-full bg-emerald-500" />
                Accepted
              </span>
              <span className="inline-flex items-center gap-2 text-amber-700">
                <span className="h-0.5 w-6 border-t-2 border-dashed border-amber-500" />
                Review
              </span>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ['Meetings', filteredTimeline.length],
              ['Presentations', filteredTimeline.reduce((sum, entry) => sum + entry.presentation_count, 0)],
              ['Accepted records', filteredTimeline.reduce((sum, entry) => sum + entry.accepted_record_count, 0)],
              ['Narrative arcs', filteredArcs.length],
              ['Sessions', filteredTimeline.reduce((sum, entry) => sum + entry.session_count, 0)],
              ['Materials', filteredTimeline.reduce((sum, entry) => sum + entry.material_count, 0)],
              ['Record signals', topRecordSignals.length],
              ['Arc steps', totalArcSteps],
            ].map(([title, value]) => (
              <div key={title} className="rounded-[1.4rem] border border-slate-200 bg-white px-4 py-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                  {title}
                </p>
                <p className="mt-2 text-4xl font-black tracking-tight text-slate-900">{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
              Lens
            </span>
            {lenses.map((lens) => (
              <button
                key={lens.id}
                type="button"
                onClick={() => setActiveLens(lens.id)}
                className={lensButtonClass(activeLens === lens.id)}
              >
                {lens.label} {lens.count}
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
              Visible paths
            </span>
            {topPaths.length > 0 ? (
              topPaths.map(([path, count]) => (
                <span
                  key={path}
                  className="rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-black text-amber-800"
                >
                  {truncate(path, 42)} · {count}
                </span>
              ))
            ) : (
              <span className="text-sm text-slate-500">No narrative paths match the current focus.</span>
            )}
          </div>
        </section>

        <section className="rounded-[2rem] border border-[#dbe3ee] bg-[linear-gradient(to_right,rgba(196,208,224,0.18)_1px,transparent_1px),linear-gradient(to_bottom,rgba(196,208,224,0.18)_1px,transparent_1px)] bg-[size:34px_34px] bg-[#fcf8f0] p-5 shadow-sm">
          <div className="grid gap-5 xl:grid-cols-[1.25fr_0.95fr]">
            <article className={domainClass('amber', isDimmed('meetings'))}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-amber-700">
                    Meetings
                  </p>
                  <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-900">
                    Source sessions
                  </h3>
                  <p className="mt-2 text-sm text-slate-500">
                    Scannable project events with direct access to meeting detail.
                  </p>
                </div>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-black text-slate-500">
                  {filteredTimeline.length}
                </span>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {filteredTimeline.slice(0, 6).map((entry) => (
                  <article
                    key={entry.meeting.id}
                    className="rounded-[1.5rem] border-2 border-emerald-300 bg-white p-5 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="text-xl font-bold leading-tight text-slate-900">
                          {entry.meeting.title_original}
                        </h4>
                        <p className="mt-1 text-sm font-semibold text-slate-500">
                          {entry.meeting.meeting_date}
                        </p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-black text-slate-500">
                        {entry.material_count}
                      </span>
                    </div>
                    <p className="mt-4 text-sm leading-6 text-slate-700">
                      {truncate(entry.meeting.summary_en || entry.meeting.summary_ja, 110) ||
                        'No summary has been added yet.'}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                        Segments {entry.transcript_count}
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                        Review {entry.record_count}
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                        Arcs {entry.narrative_arc_step_count}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenMeeting(entry.meeting.id)}
                      className="mt-5 inline-flex rounded-full border border-amber-300 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-amber-700 hover:bg-amber-50"
                    >
                      Open
                    </button>
                  </article>
                ))}
              </div>
            </article>

            <div className="space-y-5">
              <article className={domainClass('emerald', isDimmed('arcs'))}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.22em] text-emerald-700">
                      Narrative paths
                    </p>
                    <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-900">
                      Arc development
                    </h3>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-black text-slate-500">
                    {filteredArcs.length}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  {filteredArcs.slice(0, 6).map((detail) => (
                    <div
                      key={detail.arc.id}
                      className="rounded-full border-2 border-emerald-300 bg-white px-4 py-3 text-sm font-semibold text-emerald-900"
                    >
                      {truncate(detail.arc.title_en, 36)} · {detail.link_count} steps
                    </div>
                  ))}
                </div>
              </article>

              <article className={domainClass('amber', isDimmed('records'))}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.22em] text-amber-700">
                      Record signals
                    </p>
                    <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-900">
                      Evidence themes
                    </h3>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-black text-slate-500">
                    {topRecordSignals.length}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  {topRecordSignals.map(([title, count]) => (
                    <div
                      key={title}
                      className="rounded-full border border-amber-200 bg-white px-4 py-3 text-sm font-semibold text-amber-900"
                    >
                      {truncate(title, 34)} · {count}
                    </div>
                  ))}
                </div>
              </article>

              <article className={domainClass('violet', isDimmed('timeline'))}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.22em] text-violet-700">
                      Timeline
                    </p>
                    <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-900">
                      Time markers
                    </h3>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-black text-slate-500">
                    {timelineMarkers.length}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  {timelineMarkers.map((entry) => (
                    <button
                      key={entry.meeting.id}
                      type="button"
                      onClick={() => onOpenMeeting(entry.meeting.id)}
                      className="rounded-full border-2 border-violet-200 bg-white px-4 py-3 text-sm font-black text-violet-700 hover:bg-violet-50"
                    >
                      {entry.meeting.meeting_date.slice(0, 4)} · {entry.transcript_count}
                    </button>
                  ))}
                </div>
              </article>

              <article className={domainClass('sky', isDimmed('treatment'))}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.22em] text-sky-700">
                      Governance treatment
                    </p>
                    <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-900">
                      How arcs are governed
                    </h3>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-black text-slate-500">
                    {filteredTreatment.length}
                  </span>
                </div>
                <div className="mt-4 space-y-3">
                  {filteredTreatment.map((item) => (
                    <article
                      key={item.title}
                      className="rounded-[1.25rem] border border-sky-200 bg-white/90 p-4"
                    >
                      <h4 className="text-sm font-bold text-slate-900">{item.title}</h4>
                      <p className="mt-2 text-sm leading-6 text-slate-700">
                        {truncate(item.description, 180)}
                      </p>
                    </article>
                  ))}
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
              Meeting map
            </p>
            <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-900">
              Discrete progress across the archive
            </h3>
          </div>
          <div className="space-y-4">
            {filteredTimeline.map((entry) => (
              <MeetingProgressCard
                key={entry.meeting.id}
                entry={entry}
                onOpenMeeting={onOpenMeeting}
              />
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
              Arc development
            </p>
            <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-900">
              Narrative development across meetings
            </h3>
          </div>
          <div className="space-y-4">
            {filteredArcs.map((detail) => (
              <NarrativeArcPanel
                key={detail.arc.id}
                detail={detail}
                onOpenMeeting={onOpenMeeting}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
