"use client";

import {
  ACTIVITY_KINDS,
  ANSWER_TOPICS,
  CONTACT_KINDS,
  describeApplicationDurations,
  INTERVIEW_ROUND_KINDS,
  OFFER_STATES,
  type ActivityKind,
  type AnswerTopic,
  type ApplicationStatus,
  type ApplicationStatusEvent,
  type ContactKind,
  type InterviewRoundKind,
  type OfferState,
  type OutcomeType,
} from "@nimanto/domain";
import {
  BookOpenText,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ClipboardList,
  Copy,
  Handshake,
  LineChart,
  Save,
  UsersRound,
  X,
} from "lucide-react";
import { type FormEvent, useEffect, useId, useMemo, useState } from "react";
import { api } from "../lib/api-client.js";
import type { ApplicationViewState } from "../lib/applications-workbench.js";
import {
  type CareerLedgerWorkbench,
  type CareerLedgerTab,
  emptyAnswerDraft,
  emptyOfferDraft,
  type OfferDraft,
} from "../lib/career-ledger-workbench.js";
import {
  careerLedgerInsightCounts,
  changedApplicationsForView,
  filtersFromSavedView,
} from "../lib/career-ledger.js";
import type { WorkbenchMutations } from "../lib/workbench-mutations.js";

type Application = {
  id: string;
  status: ApplicationStatus;
  createdAt?: string;
  updatedAt?: string;
  submittedAt?: string | null;
  followUpOn?: string | null;
  jobId: string;
  job?: { title: string; company: string };
  outcomes?: Array<{ type: OutcomeType; occurredAt: string }>;
  statusEvents?: ApplicationStatusEvent[];
};

type Evidence = { id: string; value: string; status: string };
type Job = { id: string; source: string; updatedAt: string };

export type AnswerRevision = {
  id: string;
  revision: number;
  topic: AnswerTopic | null;
  prompt: string | null;
  answerText: string;
  evidenceIds: string[];
  createdAt: string;
};

export type CareerOperationsSnapshot = {
  activities: Array<{
    id: string;
    applicationId: string;
    contactId: string | null;
    kind: ActivityKind;
    state: "planned" | "completed" | "cancelled";
    title: string;
    note: string;
    dueAt: string | null;
    occurredAt: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  contacts: Array<{
    id: string;
    name: string;
    organization: string;
    title: string;
    email: string;
    phone: string;
    kind: ContactKind;
    notes: string;
    applicationLinks: Array<{ applicationId: string; role: ContactKind }>;
    createdAt: string;
    updatedAt: string;
  }>;
  interviews: Array<{
    id: string;
    applicationId: string;
    kind: InterviewRoundKind;
    state: "scheduled" | "completed" | "cancelled";
    scheduledAt: string;
    format: string;
    location: string;
    participants: string[];
    prepNotes: string;
    outcomeNotes: string;
    createdAt: string;
    updatedAt: string;
  }>;
  answerBlocks: Array<{
    id: string;
    topic: AnswerTopic;
    prompt: string;
    currentRevision: number;
    latest: { answerText: string; evidenceIds: string[]; createdAt: string };
    revisions?: AnswerRevision[];
    createdAt: string;
    updatedAt: string;
  }>;
  savedViews: Array<{
    id: string;
    name: string;
    filters: Record<string, unknown>;
    lastReviewedAt: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  offers: Array<{
    id: string;
    applicationId: string;
    state: OfferState;
    currency: string;
    baseMinor: number;
    bonusMinor: number | null;
    equity: string;
    benefits: string;
    startOn: string | null;
    expiresOn: string | null;
    workMode: string;
    notes: string;
    createdAt: string;
    updatedAt: string;
  }>;
};

const tabs: Array<{ id: CareerLedgerTab; label: string; icon: typeof ClipboardList }> = [
  { id: "now", label: "Now", icon: CalendarDays },
  { id: "people", label: "People", icon: UsersRound },
  { id: "answers", label: "Answers", icon: BookOpenText },
  { id: "reviews", label: "Reviews", icon: ClipboardList },
  { id: "insights", label: "Insights", icon: LineChart },
  { id: "offers", label: "Offers", icon: Handshake },
];

function human(value: string): string {
  return value.replaceAll("_", " ").replace(/^\w/u, (letter) => letter.toLocaleUpperCase());
}

function applicationLabel(application: Application): string {
  return application.job
    ? `${application.job.title} · ${application.job.company}`
    : `Application ${application.id.slice(0, 8)}`;
}

function localDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function amountToMinor(value: string): number | null {
  if (!/^\d+(?:\.\d{1,2})?$/u.test(value.trim())) return null;
  const minor = Math.round(Number(value) * 100);
  return Number.isSafeInteger(minor) ? minor : null;
}

function formatMoney(minor: number | null, currency: string): string {
  if (minor === null) return "—";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(minor / 100);
  } catch {
    return `${currency} ${(minor / 100).toLocaleString()}`;
  }
}

function offerDraftFromRecord(
  offer: CareerOperationsSnapshot["offers"][number] | undefined,
  applicationId = offer?.applicationId ?? "",
): OfferDraft {
  if (!offer) return emptyOfferDraft(applicationId);
  return {
    applicationId: offer.applicationId,
    currency: offer.currency,
    base: String(offer.baseMinor / 100),
    bonus: offer.bonusMinor === null ? "" : String(offer.bonusMinor / 100),
    equity: offer.equity,
    benefits: offer.benefits,
    startOn: offer.startOn ?? "",
    expiresOn: offer.expiresOn ?? "",
    workMode: offer.workMode,
    notes: offer.notes,
  };
}

export function CareerLedger({
  applications,
  jobs,
  evidence,
  operations,
  busy,
  onAct,
  currentView,
  onApplyView,
  workbench,
}: {
  applications: Application[];
  jobs: Job[];
  evidence: Evidence[];
  operations: CareerOperationsSnapshot;
  busy: boolean;
  onAct: WorkbenchMutations;
  currentView: ApplicationViewState;
  onApplyView: (view: ApplicationViewState) => void;
  workbench: CareerLedgerWorkbench;
}) {
  const { state, dispatch } = workbench;
  const { tab } = state;
  const applicationIdsKey = applications.map((application) => application.id).join("\u0000");
  useEffect(() => {
    const applicationIds = applicationIdsKey.split("\u0000").filter(Boolean);
    const firstOffer = operations.offers.find((offer) => offer.applicationId === applicationIds[0]);
    dispatch({
      type: "applications_reconciled",
      applicationIds,
      initialOffer: firstOffer ? offerDraftFromRecord(firstOffer) : null,
    });
  }, [applicationIdsKey, dispatch, operations.offers]);

  return (
    <section className="career-ledger" aria-labelledby="career-ledger-title">
      <header className="career-ledger-heading">
        <div>
          <span>Candidate-owned operating record</span>
          <h2 id="career-ledger-title">Career ledger</h2>
          <p>
            Keep the work around each application beside its literal status. Every entry below is
            manual, private to this workspace, included in export, and removed with workspace data.
          </p>
        </div>
        <BriefcaseBusiness aria-hidden="true" />
      </header>
      <div className="career-ledger-tabs" role="tablist" aria-label="Career ledger sections">
        {tabs.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`career-tab-${item.id}`}
              aria-selected={tab === item.id}
              aria-controls={`career-panel-${item.id}`}
              tabIndex={tab === item.id ? 0 : -1}
              onClick={() => dispatch({ type: "tab_changed", tab: item.id })}
              onKeyDown={(event) => {
                const current = tabs.findIndex((entry) => entry.id === item.id);
                const requested =
                  event.key === "ArrowRight"
                    ? (current + 1) % tabs.length
                    : event.key === "ArrowLeft"
                      ? (current - 1 + tabs.length) % tabs.length
                      : event.key === "Home"
                        ? 0
                        : event.key === "End"
                          ? tabs.length - 1
                          : null;
                if (requested === null) return;
                event.preventDefault();
                const next = tabs[requested]!;
                dispatch({ type: "tab_changed", tab: next.id });
                requestAnimationFrame(() =>
                  document.getElementById(`career-tab-${next.id}`)?.focus(),
                );
              }}
            >
              <Icon size={15} aria-hidden="true" /> {item.label}
            </button>
          );
        })}
      </div>
      <div
        className="career-ledger-panel"
        role="tabpanel"
        id={`career-panel-${tab}`}
        aria-labelledby={`career-tab-${tab}`}
      >
        {tab === "now" && (
          <NowPanel
            applications={applications}
            operations={operations}
            busy={busy}
            onAct={onAct}
            workbench={workbench}
          />
        )}
        {tab === "people" && (
          <PeoplePanel
            applications={applications}
            contacts={operations.contacts}
            busy={busy}
            onAct={onAct}
            workbench={workbench}
          />
        )}
        {tab === "answers" && (
          <AnswersPanel
            evidence={evidence}
            answers={operations.answerBlocks}
            busy={busy}
            onAct={onAct}
            workbench={workbench}
          />
        )}
        {tab === "reviews" && (
          <ReviewsPanel
            applications={applications}
            jobs={jobs}
            views={operations.savedViews}
            operations={operations}
            currentView={currentView}
            onApplyView={onApplyView}
            busy={busy}
            onAct={onAct}
            workbench={workbench}
          />
        )}
        {tab === "insights" && (
          <InsightsPanel applications={applications} operations={operations} />
        )}
        {tab === "offers" && (
          <OffersPanel
            applications={applications}
            offers={operations.offers}
            busy={busy}
            onAct={onAct}
            workbench={workbench}
          />
        )}
      </div>
    </section>
  );
}

function NowPanel({
  applications,
  operations,
  busy,
  onAct,
  workbench,
}: {
  applications: Application[];
  operations: CareerOperationsSnapshot;
  busy: boolean;
  onAct: WorkbenchMutations;
  workbench: CareerLedgerWorkbench;
}) {
  const { state, dispatch } = workbench;
  const { activity, interview, interviewOutcomes } = state;
  const setActivity = (draft: typeof activity) => dispatch({ type: "activity_changed", draft });
  const setInterview = (draft: typeof interview) => dispatch({ type: "interview_changed", draft });

  const submitActivity = (event: FormEvent) => {
    event.preventDefault();
    const submitted = { ...activity };
    void onAct.run({
      request: () =>
        api("/v1/application-activities", {
          method: "POST",
          body: JSON.stringify({
            ...submitted,
            dueAt: submitted.dueAt ? new Date(submitted.dueAt).toISOString() : null,
          }),
        }),
      success: "Activity recorded in the candidate-owned ledger.",
      transient: true,
      commit: () => dispatch({ type: "activity_committed", submitted }),
    });
  };
  const submitInterview = (event: FormEvent) => {
    event.preventDefault();
    if (!interview.scheduledAt) return;
    const submitted = { ...interview };
    void onAct.run({
      request: () =>
        api("/v1/interview-rounds", {
          method: "POST",
          body: JSON.stringify({
            ...submitted,
            scheduledAt: new Date(submitted.scheduledAt).toISOString(),
            participants: submitted.participants
              .split(",")
              .map((value) => value.trim())
              .filter(Boolean),
          }),
        }),
      success: "Interview round added to the application record.",
      transient: true,
      commit: () => dispatch({ type: "interview_committed", submitted }),
    });
  };

  if (applications.length === 0) {
    return (
      <p className="career-ledger-empty">Track an application before adding work or rounds.</p>
    );
  }
  return (
    <div className="career-ledger-columns">
      <div className="career-ledger-stack">
        <div className="ledger-section-heading">
          <span>Typed work</span>
          <h3>Plan the next concrete action</h3>
        </div>
        <form className="career-ledger-form" onSubmit={submitActivity}>
          <label>
            Application
            <select
              value={activity.applicationId}
              onChange={(event) => setActivity({ ...activity, applicationId: event.target.value })}
            >
              {applications.map((application) => (
                <option key={application.id} value={application.id}>
                  {applicationLabel(application)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Activity type
            <select
              value={activity.kind}
              onChange={(event) =>
                setActivity({ ...activity, kind: event.target.value as ActivityKind })
              }
            >
              {ACTIVITY_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {human(kind)}
                </option>
              ))}
            </select>
          </label>
          <label className="ledger-span">
            Action
            <input
              required
              maxLength={180}
              value={activity.title}
              onChange={(event) => setActivity({ ...activity, title: event.target.value })}
              placeholder="Send thank-you note"
            />
          </label>
          <label>
            Due at
            <input
              type="datetime-local"
              value={activity.dueAt}
              onChange={(event) => setActivity({ ...activity, dueAt: event.target.value })}
            />
          </label>
          <label className="ledger-span">
            Private note
            <textarea
              maxLength={2_000}
              value={activity.note}
              onChange={(event) => setActivity({ ...activity, note: event.target.value })}
            />
          </label>
          <button className="button mini primary" disabled={busy || !activity.title.trim()}>
            Add activity
          </button>
        </form>
        <ul className="ledger-records">
          {operations.activities.map((item) => (
            <li key={item.id}>
              <div>
                <span>
                  {human(item.kind)} · {human(item.state)}
                </span>
                <strong>{item.title}</strong>
                <small>
                  {applicationLabel(
                    applications.find((application) => application.id === item.applicationId)!,
                  )}
                </small>
                {item.dueAt && <time dateTime={item.dueAt}>Due {localDateTime(item.dueAt)}</time>}
                {item.note && <p>{item.note}</p>}
              </div>
              {item.state === "planned" && (
                <div className="ledger-row-actions">
                  <button
                    className="button mini quiet"
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void onAct.run({
                        request: () =>
                          api(`/v1/application-activities/${item.id}/state`, {
                            method: "PUT",
                            body: JSON.stringify({ state: "completed" }),
                          }),
                        success: "Activity marked complete.",
                        transient: true,
                      })
                    }
                  >
                    <Check size={14} /> Complete
                  </button>
                  <button
                    className="button mini quiet"
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void onAct.run({
                        request: () =>
                          api(`/v1/application-activities/${item.id}/state`, {
                            method: "PUT",
                            body: JSON.stringify({ state: "cancelled" }),
                          }),
                        success: "Activity marked cancelled.",
                        transient: true,
                      })
                    }
                  >
                    <X size={14} /> Cancel
                  </button>
                </div>
              )}
            </li>
          ))}
          {operations.activities.length === 0 && (
            <li className="ledger-empty-row">No activities recorded yet.</li>
          )}
        </ul>
      </div>

      <div className="career-ledger-stack">
        <div className="ledger-section-heading">
          <span>Interview rounds</span>
          <h3>Keep preparation beside the appointment</h3>
        </div>
        <form className="career-ledger-form" onSubmit={submitInterview}>
          <label>
            Application
            <select
              value={interview.applicationId}
              onChange={(event) =>
                setInterview({ ...interview, applicationId: event.target.value })
              }
            >
              {applications.map((application) => (
                <option key={application.id} value={application.id}>
                  {applicationLabel(application)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Round
            <select
              value={interview.kind}
              onChange={(event) =>
                setInterview({ ...interview, kind: event.target.value as InterviewRoundKind })
              }
            >
              {INTERVIEW_ROUND_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {human(kind)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Scheduled at
            <input
              required
              type="datetime-local"
              value={interview.scheduledAt}
              onChange={(event) => setInterview({ ...interview, scheduledAt: event.target.value })}
            />
          </label>
          <label>
            Format
            <input
              maxLength={120}
              value={interview.format}
              onChange={(event) => setInterview({ ...interview, format: event.target.value })}
              placeholder="Video, phone, onsite"
            />
          </label>
          <label>
            Location or link note
            <input
              maxLength={320}
              value={interview.location}
              onChange={(event) => setInterview({ ...interview, location: event.target.value })}
              placeholder="Video link stored elsewhere, phone, or office"
            />
          </label>
          <label className="ledger-span">
            Participants, comma-separated
            <input
              value={interview.participants}
              onChange={(event) => setInterview({ ...interview, participants: event.target.value })}
            />
          </label>
          <label className="ledger-span">
            Preparation notes
            <textarea
              maxLength={4_000}
              value={interview.prepNotes}
              onChange={(event) => setInterview({ ...interview, prepNotes: event.target.value })}
            />
          </label>
          <button className="button mini primary" disabled={busy || !interview.scheduledAt}>
            Add round
          </button>
        </form>
        <ul className="ledger-records">
          {operations.interviews.map((round) => (
            <li key={round.id}>
              <div>
                <span>
                  {human(round.kind)} · {human(round.state)}
                </span>
                <strong>
                  {applicationLabel(
                    applications.find((application) => application.id === round.applicationId)!,
                  )}
                </strong>
                <time dateTime={round.scheduledAt}>{localDateTime(round.scheduledAt)}</time>
                {(round.format || round.location || round.participants.length > 0) && (
                  <small>
                    {[round.format, round.location, ...round.participants]
                      .filter(Boolean)
                      .join(" · ")}
                  </small>
                )}
                {round.prepNotes && <p>{round.prepNotes}</p>}
                {round.outcomeNotes && <p>{round.outcomeNotes}</p>}
              </div>
              {round.state === "scheduled" && (
                <div className="ledger-completion-note">
                  <label>
                    Outcome notes for {human(round.kind)}
                    <textarea
                      maxLength={4_000}
                      value={interviewOutcomes[round.id] ?? ""}
                      onChange={(event) =>
                        dispatch({
                          type: "interview_outcome_changed",
                          interviewId: round.id,
                          notes: event.target.value,
                        })
                      }
                    />
                  </label>
                  <button
                    className="button mini quiet"
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void onAct.run({
                        request: () =>
                          api(`/v1/interview-rounds/${round.id}/state`, {
                            method: "PUT",
                            body: JSON.stringify({
                              state: "completed",
                              outcomeNotes: interviewOutcomes[round.id] ?? "",
                            }),
                          }),
                        success: "Interview round marked complete.",
                        transient: true,
                        commit: () =>
                          dispatch({
                            type: "interview_outcome_committed",
                            interviewId: round.id,
                            submitted: interviewOutcomes[round.id] ?? "",
                          }),
                      })
                    }
                  >
                    <Check size={14} /> Complete
                  </button>
                  <button
                    className="button mini quiet"
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void onAct.run({
                        request: () =>
                          api(`/v1/interview-rounds/${round.id}/state`, {
                            method: "PUT",
                            body: JSON.stringify({ state: "cancelled" }),
                          }),
                        success: "Interview round marked cancelled.",
                        transient: true,
                      })
                    }
                  >
                    <X size={14} /> Cancel round
                  </button>
                </div>
              )}
            </li>
          ))}
          {operations.interviews.length === 0 && (
            <li className="ledger-empty-row">No interview rounds recorded yet.</li>
          )}
        </ul>
      </div>
    </div>
  );
}

function PeoplePanel({
  applications,
  contacts,
  busy,
  onAct,
  workbench,
}: {
  applications: Application[];
  contacts: CareerOperationsSnapshot["contacts"];
  busy: boolean;
  onAct: WorkbenchMutations;
  workbench: CareerLedgerWorkbench;
}) {
  const { state, dispatch } = workbench;
  const draft = state.contact;
  const setDraft = (next: typeof draft) => dispatch({ type: "contact_changed", draft: next });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const submitted = { ...draft };
    void onAct.run({
      request: () => api("/v1/contacts", { method: "POST", body: JSON.stringify(submitted) }),
      success: "Contact added to the manual relationship ledger.",
      transient: true,
      commit: () => dispatch({ type: "contact_committed", submitted }),
    });
  };
  return (
    <div className="career-ledger-columns">
      <div className="career-ledger-stack">
        <div className="ledger-section-heading">
          <span>Manual only</span>
          <h3>Add a person you choose to remember</h3>
        </div>
        <form className="career-ledger-form" onSubmit={submit}>
          <label>
            Name
            <input
              required
              maxLength={180}
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            />
          </label>
          <label>
            Relationship
            <select
              value={draft.kind}
              onChange={(event) => setDraft({ ...draft, kind: event.target.value as ContactKind })}
            >
              {CONTACT_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {human(kind)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Organization
            <input
              maxLength={180}
              value={draft.organization}
              onChange={(event) => setDraft({ ...draft, organization: event.target.value })}
            />
          </label>
          <label>
            Title
            <input
              maxLength={180}
              value={draft.title}
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
            />
          </label>
          <label>
            Email
            <input
              type="email"
              maxLength={320}
              value={draft.email}
              onChange={(event) => setDraft({ ...draft, email: event.target.value })}
            />
          </label>
          <label>
            Phone
            <input
              maxLength={80}
              value={draft.phone}
              onChange={(event) => setDraft({ ...draft, phone: event.target.value })}
            />
          </label>
          <label className="ledger-span">
            Application
            <select
              value={draft.applicationId}
              onChange={(event) => setDraft({ ...draft, applicationId: event.target.value })}
            >
              <option value="">No application link</option>
              {applications.map((application) => (
                <option key={application.id} value={application.id}>
                  {applicationLabel(application)}
                </option>
              ))}
            </select>
          </label>
          <label className="ledger-span">
            Private context
            <textarea
              maxLength={2_000}
              value={draft.notes}
              onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
            />
          </label>
          <button className="button mini primary" disabled={busy || !draft.name.trim()}>
            Add person
          </button>
        </form>
        <p className="boundary-note">
          No scraping, social-network import, messaging, or automatic enrichment. This is a
          candidate-entered address book.
        </p>
      </div>
      <ul className="ledger-records ledger-records-tall">
        {contacts.map((contact) => (
          <li key={contact.id}>
            <div>
              <span>{human(contact.kind)}</span>
              <strong>{contact.name}</strong>
              {(contact.title || contact.organization) && (
                <small>{[contact.title, contact.organization].filter(Boolean).join(" · ")}</small>
              )}
              {contact.email && <a href={`mailto:${contact.email}`}>{contact.email}</a>}
              {contact.phone && <small>{contact.phone}</small>}
              {contact.applicationLinks.map((link) => (
                <small key={`${link.applicationId}-${link.role}`}>
                  {human(link.role)} for{" "}
                  {applicationLabel(
                    applications.find((application) => application.id === link.applicationId)!,
                  )}
                </small>
              ))}
              {contact.notes && <p>{contact.notes}</p>}
            </div>
          </li>
        ))}
        {contacts.length === 0 && <li className="ledger-empty-row">No people recorded yet.</li>}
      </ul>
    </div>
  );
}

export function AnswerRevisionHistory({
  revisions,
  onCopyEvidence,
}: {
  revisions: AnswerRevision[];
  onCopyEvidence: (evidenceId: string, revision: number) => void;
}) {
  return (
    <ol>
      {revisions.map((revision) => {
        const topicKnown = revision.topic !== null && revision.topic !== undefined;
        const promptKnown = revision.prompt !== null && revision.prompt !== undefined;
        return (
          <li key={revision.id}>
            <div className="answer-revision-heading">
              <strong>Revision {revision.revision}</strong>
              <time dateTime={revision.createdAt}>{localDateTime(revision.createdAt)}</time>
            </div>
            <div className="answer-revision-context">
              <p>
                <strong>Topic:</strong>{" "}
                {revision.topic !== null && revision.topic !== undefined
                  ? human(revision.topic)
                  : "Unknown — not retained"}
              </p>
              <p>
                <strong>Prompt:</strong> {promptKnown ? revision.prompt : "Unknown — not retained"}
              </p>
              {(!topicKnown || !promptKnown) && (
                <p className="boundary-note">
                  Legacy provenance limit: this revision did not retain all of its own context.
                  Nimanto does not inherit context from the current Answer Block.
                </p>
              )}
            </div>
            <p>{revision.answerText}</p>
            <div className="answer-revision-evidence">
              <strong>Evidence IDs in saved order</strong>
              {revision.evidenceIds.length > 0 ? (
                <ol aria-label={`Evidence order for answer revision ${revision.revision}`}>
                  {revision.evidenceIds.map((evidenceId) => (
                    <li key={evidenceId}>
                      <code>{evidenceId}</code>
                      <button
                        className="button mini quiet"
                        type="button"
                        aria-label={`Copy evidence ID ${evidenceId}`}
                        onClick={() => onCopyEvidence(evidenceId, revision.revision)}
                      >
                        <Copy size={13} /> Copy ID
                      </button>
                    </li>
                  ))}
                </ol>
              ) : (
                <small>No evidence IDs were retained for this revision.</small>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function AnswerHistoryDetails({
  answer,
  onCopyEvidence,
}: {
  answer: CareerOperationsSnapshot["answerBlocks"][number];
  onCopyEvidence: (evidenceId: string, revision: number) => void;
}) {
  const [history, setHistory] = useState<{
    revision: number;
    state: "loading" | "loaded" | "failed";
    revisions: AnswerRevision[];
  } | null>(null);
  const currentHistory = history?.revision === answer.currentRevision ? history : null;
  const loadHistory = () => {
    if (currentHistory?.state === "loading" || currentHistory?.state === "loaded") return;
    setHistory({ revision: answer.currentRevision, state: "loading", revisions: [] });
    void api<CareerOperationsSnapshot["answerBlocks"][number]>(
      `/v1/answer-blocks/${answer.id}/revisions`,
    )
      .then((record) =>
        setHistory({
          revision: record.currentRevision,
          state: "loaded",
          revisions: record.revisions ?? [],
        }),
      )
      .catch(() =>
        setHistory({ revision: answer.currentRevision, state: "failed", revisions: [] }),
      );
  };

  return (
    <details
      className="answer-history"
      onToggle={(event) => {
        if (event.currentTarget.open) loadHistory();
      }}
    >
      <summary>
        {answer.currentRevision} retained revision{answer.currentRevision === 1 ? "" : "s"}
      </summary>
      {currentHistory?.state === "loading" && <p role="status">Loading revision history…</p>}
      {currentHistory?.state === "failed" && (
        <div>
          <p role="alert">Revision history could not be loaded. The saved answer is unchanged.</p>
          <button className="button mini quiet" type="button" onClick={loadHistory}>
            Try again
          </button>
        </div>
      )}
      {currentHistory?.state === "loaded" && (
        <AnswerRevisionHistory
          revisions={currentHistory.revisions}
          onCopyEvidence={onCopyEvidence}
        />
      )}
    </details>
  );
}

function AnswersPanel({
  evidence,
  answers,
  busy,
  onAct,
  workbench,
}: {
  evidence: Evidence[];
  answers: CareerOperationsSnapshot["answerBlocks"];
  busy: boolean;
  onAct: WorkbenchMutations;
  workbench: CareerLedgerWorkbench;
}) {
  const { state, dispatch } = workbench;
  const draft = state.answer;
  const setDraft = (next: typeof draft) => dispatch({ type: "answer_changed", draft: next });
  const [copyStatus, setCopyStatus] = useState("");
  const confirmedEvidence = evidence.filter((claim) => claim.status === "confirmed");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const submitted = structuredClone(draft);
    void onAct.run({
      request: () =>
        api(submitted.id ? `/v1/answer-blocks/${submitted.id}` : "/v1/answer-blocks", {
          method: submitted.id ? "PUT" : "POST",
          body: JSON.stringify(submitted),
        }),
      success: submitted.id
        ? "A new immutable answer revision was saved."
        : "Reusable answer saved.",
      transient: true,
      commit: () => dispatch({ type: "answer_committed", submitted }),
    });
  };
  return (
    <div className="career-ledger-columns">
      <div className="career-ledger-stack">
        <div className="ledger-section-heading">
          <span>Candidate-authored</span>
          <h3>{draft.id ? "Revise this answer" : "Save an answer worth reusing"}</h3>
        </div>
        <form className="career-ledger-form" onSubmit={submit}>
          <label>
            Topic
            <select
              value={draft.topic}
              onChange={(event) => setDraft({ ...draft, topic: event.target.value as AnswerTopic })}
            >
              {ANSWER_TOPICS.map((topic) => (
                <option key={topic} value={topic}>
                  {human(topic)}
                </option>
              ))}
            </select>
          </label>
          <label className="ledger-span">
            Prompt
            <input
              required
              maxLength={500}
              value={draft.prompt}
              onChange={(event) => setDraft({ ...draft, prompt: event.target.value })}
              placeholder="Why are you interested in this role?"
            />
          </label>
          <label className="ledger-span">
            Your answer
            <textarea
              required
              maxLength={8_000}
              value={draft.answerText}
              onChange={(event) => setDraft({ ...draft, answerText: event.target.value })}
            />
          </label>
          {confirmedEvidence.length > 0 && (
            <fieldset className="ledger-evidence-picker ledger-span">
              <legend>Supporting evidence (optional)</legend>
              {confirmedEvidence.map((claim) => (
                <label key={claim.id}>
                  <input
                    type="checkbox"
                    checked={draft.evidenceIds.includes(claim.id)}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        evidenceIds: event.target.checked
                          ? [...draft.evidenceIds, claim.id]
                          : draft.evidenceIds.filter((id) => id !== claim.id),
                      })
                    }
                  />
                  <span>{claim.value}</span>
                </label>
              ))}
            </fieldset>
          )}
          <div className="button-group">
            <button
              className="button mini primary"
              disabled={busy || !draft.prompt.trim() || !draft.answerText.trim()}
            >
              <Save size={14} /> {draft.id ? "Save revision" : "Save answer"}
            </button>
            {draft.id && (
              <button
                className="button mini quiet"
                type="button"
                onClick={() => setDraft(emptyAnswerDraft())}
              >
                Cancel revision
              </button>
            )}
          </div>
        </form>
      </div>
      <p className="sr-only" aria-live="polite">
        {copyStatus}
      </p>
      <ul className="ledger-records ledger-records-tall">
        {answers.map((answer) => (
          <li key={answer.id}>
            <div>
              <span>
                {human(answer.topic)} · revision {answer.currentRevision}
              </span>
              <strong>{answer.prompt}</strong>
              <p>{answer.latest.answerText}</p>
              <small>
                {answer.latest.evidenceIds.length} linked evidence record
                {answer.latest.evidenceIds.length === 1 ? "" : "s"}
              </small>
            </div>
            <div className="ledger-row-actions">
              <button
                className="button mini quiet"
                type="button"
                onClick={() =>
                  void navigator.clipboard
                    .writeText(answer.latest.answerText)
                    .then(() => setCopyStatus(`Copied answer for ${answer.prompt}.`))
                    .catch(() => setCopyStatus("Copy failed. Select the answer text and copy it."))
                }
              >
                <Copy size={14} /> Copy
              </button>
              <button
                className="button mini quiet"
                type="button"
                onClick={() =>
                  setDraft({
                    id: answer.id,
                    topic: answer.topic,
                    prompt: answer.prompt,
                    answerText: answer.latest.answerText,
                    evidenceIds: [...answer.latest.evidenceIds],
                  })
                }
              >
                Revise
              </button>
              <AnswerHistoryDetails
                answer={answer}
                onCopyEvidence={(evidenceId, revision) =>
                  void navigator.clipboard
                    .writeText(evidenceId)
                    .then(() => setCopyStatus(`Copied evidence ID from revision ${revision}.`))
                    .catch(() =>
                      setCopyStatus("Copy failed. Select the full evidence ID and copy it."),
                    )
                }
              />
            </div>
          </li>
        ))}
        {answers.length === 0 && (
          <li className="ledger-empty-row">No reusable answers saved yet.</li>
        )}
      </ul>
    </div>
  );
}

function ReviewsPanel({
  applications,
  jobs,
  views,
  operations,
  currentView,
  onApplyView,
  busy,
  onAct,
  workbench,
}: {
  applications: Application[];
  jobs: Job[];
  views: CareerOperationsSnapshot["savedViews"];
  operations: CareerOperationsSnapshot;
  currentView: ApplicationViewState;
  onApplyView: (view: ApplicationViewState) => void;
  busy: boolean;
  onAct: WorkbenchMutations;
  workbench: CareerLedgerWorkbench;
}) {
  const { state, dispatch } = workbench;
  const name = state.reviewName;
  const save = (event: FormEvent) => {
    event.preventDefault();
    const submitted = name;
    void onAct.run({
      request: () =>
        api("/v1/application-views", {
          method: "POST",
          body: JSON.stringify({ name: submitted, filters: currentView }),
        }),
      success: "Current application filters saved as a review view.",
      transient: true,
      commit: () => dispatch({ type: "review_name_committed", submitted }),
    });
  };
  return (
    <div className="career-ledger-columns">
      <div className="career-ledger-stack">
        <div className="ledger-section-heading">
          <span>Explicit review watermark</span>
          <h3>Return to a question, not a blank filter form</h3>
        </div>
        <form className="saved-view-form" onSubmit={save}>
          <label>
            View name
            <input
              required
              maxLength={120}
              value={name}
              onChange={(event) =>
                dispatch({ type: "review_name_changed", name: event.target.value })
              }
              placeholder="Submitted roles awaiting a reply"
            />
          </label>
          <button className="button mini primary" disabled={busy || !name.trim()}>
            <Save size={14} /> Save current view
          </button>
        </form>
        <p className="boundary-note">
          “Changed” means a matching candidate-visible Application, current Role, or
          application-owned ledger record has a newer stored timestamp than your explicit review
          watermark. No push notification or employer-event inference is made.
        </p>
      </div>
      <ul className="ledger-records ledger-records-tall">
        {views.map((view) => {
          const changedIds = changedApplicationsForView({
            applications,
            jobs,
            filters: view.filters,
            lastReviewedAt: view.lastReviewedAt,
            careerOperations: operations,
          });
          const changedApplications = changedIds.flatMap((id) => {
            const application = applications.find((candidate) => candidate.id === id);
            return application ? [application] : [];
          });
          return (
            <li key={view.id}>
              <div>
                <span>
                  {view.lastReviewedAt
                    ? `Reviewed ${localDateTime(view.lastReviewedAt)}`
                    : "Never marked reviewed"}
                </span>
                <strong>{view.name}</strong>
                <small>
                  {changedIds.length} matching record{changedIds.length === 1 ? "" : "s"} new or
                  changed since review
                </small>
                {changedApplications.length > 0 && (
                  <ul
                    className="ledger-change-list"
                    aria-label={`Changed applications for ${view.name}`}
                  >
                    {changedApplications.map((application) => (
                      <li key={application.id}>{applicationLabel(application)}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="ledger-row-actions">
                <button
                  className="button mini quiet"
                  type="button"
                  onClick={() =>
                    onApplyView({ ...currentView, ...filtersFromSavedView(view.filters) })
                  }
                >
                  Open view
                </button>
                <button
                  className="button mini quiet"
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void onAct.run({
                      request: () =>
                        api(`/v1/application-views/${view.id}/review`, { method: "POST" }),
                      success: "Saved view marked reviewed at the current time.",
                      transient: true,
                    })
                  }
                >
                  <Check size={14} /> Mark reviewed
                </button>
              </div>
            </li>
          );
        })}
        {views.length === 0 && <li className="ledger-empty-row">No saved review views yet.</li>}
      </ul>
    </div>
  );
}

function InsightsPanel({
  applications,
  operations,
}: {
  applications: Application[];
  operations: CareerOperationsSnapshot;
}) {
  const durations = useMemo(
    () =>
      describeApplicationDurations(
        applications.map((application) => ({
          id: application.id,
          status: application.status,
          createdAt: application.createdAt ?? application.updatedAt ?? new Date(0).toISOString(),
          ...(application.submittedAt !== undefined
            ? { submittedAt: application.submittedAt }
            : {}),
          ...(application.outcomes ? { outcomes: application.outcomes } : {}),
          ...(application.statusEvents ? { statusEvents: application.statusEvents } : {}),
        })),
      ),
    [applications],
  );
  const { plannedActivities, completedActivities, nonCancelledInterviews, completedInterviews } =
    careerLedgerInsightCounts(operations);
  return (
    <div className="career-insights">
      <div className="ledger-section-heading">
        <span>Descriptive only</span>
        <h3>Read your recorded process without forecasting it</h3>
      </div>
      <div className="career-insight-grid">
        {durations.map((observation) => (
          <article key={observation.id}>
            <span>
              {observation.sampleSize
                ? `${observation.sampleSize} observed interval${observation.sampleSize === 1 ? "" : "s"}`
                : "No complete interval"}
            </span>
            <strong>
              {observation.medianDays === null ? "—" : `${observation.medianDays} days`}
            </strong>
            <p>{observation.label}</p>
          </article>
        ))}
        <article>
          <span>Typed activities</span>
          <strong>{plannedActivities}</strong>
          <p>Planned now · {completedActivities} completed</p>
        </article>
        <article>
          <span>Recorded interview rounds</span>
          <strong>{nonCancelledInterviews}</strong>
          <p>Non-cancelled · {completedInterviews} completed</p>
        </article>
        <article>
          <span>Offer records</span>
          <strong>{operations.offers.length}</strong>
          <p>Candidate-entered comparisons</p>
        </article>
      </div>
      <p className="boundary-note">
        Medians use only complete recorded intervals and always show sample size. Counts and elapsed
        time are not conversion rates, benchmarks, causal evidence, or hiring probabilities.
      </p>
    </div>
  );
}

function OffersPanel({
  applications,
  offers,
  busy,
  onAct,
  workbench,
}: {
  applications: Application[];
  offers: CareerOperationsSnapshot["offers"];
  busy: boolean;
  onAct: WorkbenchMutations;
  workbench: CareerLedgerWorkbench;
}) {
  const { state, dispatch } = workbench;
  const draft = state.offer;
  const setDraft = (next: OfferDraft) => dispatch({ type: "offer_changed", draft: next });
  const baseHelpId = useId();
  const bonusHelpId = useId();
  const baseMinor = amountToMinor(draft.base);
  const bonusMinor = draft.bonus ? amountToMinor(draft.bonus) : null;
  const baseInvalid = draft.base.trim().length > 0 && baseMinor === null;
  const bonusInvalid = draft.bonus.trim().length > 0 && bonusMinor === null;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (baseMinor === null || (draft.bonus && bonusMinor === null)) return;
    const submitted = { ...draft };
    void onAct.run({
      request: () =>
        api(`/v1/applications/${submitted.applicationId}/offer`, {
          method: "PUT",
          body: JSON.stringify({ ...submitted, baseMinor, bonusMinor }),
        }),
      success: offers.some((offer) => offer.applicationId === submitted.applicationId)
        ? "Candidate-entered offer updated."
        : "Candidate-entered offer added.",
      transient: true,
    });
  };
  if (applications.length === 0)
    return <p className="career-ledger-empty">Track an application before recording an offer.</p>;
  return (
    <div className="career-ledger-stack">
      <div className="ledger-section-heading">
        <span>Candidate-entered terms</span>
        <h3>Compare literal offer details</h3>
      </div>
      <form className="career-ledger-form offer-form" onSubmit={submit}>
        <label className="ledger-span">
          Application
          <select
            value={draft.applicationId}
            onChange={(event) => {
              const applicationId = event.target.value;
              setDraft(
                offerDraftFromRecord(
                  offers.find((offer) => offer.applicationId === applicationId),
                  applicationId,
                ),
              );
            }}
          >
            {applications.map((application) => (
              <option key={application.id} value={application.id}>
                {applicationLabel(application)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Currency
          <input
            required
            pattern="[A-Za-z]{3}"
            maxLength={3}
            value={draft.currency}
            onChange={(event) =>
              setDraft({ ...draft, currency: event.target.value.toLocaleUpperCase() })
            }
          />
        </label>
        <label>
          Annual base
          <input
            required
            inputMode="decimal"
            aria-invalid={baseInvalid}
            aria-describedby={baseHelpId}
            value={draft.base}
            onChange={(event) => setDraft({ ...draft, base: event.target.value })}
            placeholder="145000 or 145000.00"
          />
          <small id={baseHelpId} className={baseInvalid ? "field-note field-error" : "field-note"}>
            {baseInvalid
              ? "Enter digits with up to two decimal places; do not use commas or currency symbols."
              : "Digits with up to two decimal places; no commas or currency symbols."}
          </small>
        </label>
        <label>
          Annual bonus
          <input
            inputMode="decimal"
            aria-invalid={bonusInvalid}
            aria-describedby={bonusHelpId}
            value={draft.bonus}
            onChange={(event) => setDraft({ ...draft, bonus: event.target.value })}
          />
          <small
            id={bonusHelpId}
            className={bonusInvalid ? "field-note field-error" : "field-note"}
          >
            {bonusInvalid
              ? "Enter digits with up to two decimal places; do not use commas or currency symbols."
              : "Optional; use digits with up to two decimal places."}
          </small>
        </label>
        <label>
          Work mode
          <input
            maxLength={80}
            value={draft.workMode}
            onChange={(event) => setDraft({ ...draft, workMode: event.target.value })}
          />
        </label>
        <label>
          Start date
          <input
            type="date"
            value={draft.startOn}
            onChange={(event) => setDraft({ ...draft, startOn: event.target.value })}
          />
        </label>
        <label>
          Decision date
          <input
            type="date"
            value={draft.expiresOn}
            onChange={(event) => setDraft({ ...draft, expiresOn: event.target.value })}
          />
        </label>
        <label className="ledger-span">
          Equity terms
          <textarea
            maxLength={1_000}
            value={draft.equity}
            onChange={(event) => setDraft({ ...draft, equity: event.target.value })}
          />
        </label>
        <label className="ledger-span">
          Benefits
          <textarea
            maxLength={4_000}
            value={draft.benefits}
            onChange={(event) => setDraft({ ...draft, benefits: event.target.value })}
          />
        </label>
        <label className="ledger-span">
          Private notes
          <textarea
            maxLength={4_000}
            value={draft.notes}
            onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
          />
        </label>
        <button
          className="button mini primary"
          disabled={busy || baseMinor === null || bonusInvalid}
        >
          Save offer
        </button>
      </form>
      <div className="offer-comparison-scroll">
        <table className="offer-comparison">
          <thead>
            <tr>
              <th>Application</th>
              <th>Base</th>
              <th>Bonus</th>
              <th>Equity & benefits</th>
              <th>Dates</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {offers.map((offer) => (
              <tr key={offer.id}>
                <th scope="row">
                  {applicationLabel(
                    applications.find((application) => application.id === offer.applicationId)!,
                  )}
                </th>
                <td>{formatMoney(offer.baseMinor, offer.currency)}</td>
                <td>{formatMoney(offer.bonusMinor, offer.currency)}</td>
                <td>{[offer.equity, offer.benefits].filter(Boolean).join(" · ") || "—"}</td>
                <td>
                  {[
                    offer.startOn ? `Start ${offer.startOn}` : "",
                    offer.expiresOn ? `Decide ${offer.expiresOn}` : "",
                  ]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </td>
                <td>
                  <select
                    aria-label={`Offer status for ${applicationLabel(applications.find((application) => application.id === offer.applicationId)!)}`}
                    value={offer.state}
                    disabled={busy}
                    onChange={(event) =>
                      void onAct.run({
                        request: () =>
                          api(`/v1/offers/${offer.id}/state`, {
                            method: "PUT",
                            body: JSON.stringify({ state: event.target.value }),
                          }),
                        success: "Offer status updated.",
                        transient: true,
                      })
                    }
                  >
                    {OFFER_STATES.map((state) => (
                      <option key={state} value={state}>
                        {human(state)}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
            {offers.length === 0 && (
              <tr>
                <td colSpan={6}>No offers recorded yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="boundary-note">
        Nimanto stores and compares only the terms you enter. It does not value equity or provide
        legal, tax, immigration, negotiation, or financial advice.
      </p>
    </div>
  );
}
