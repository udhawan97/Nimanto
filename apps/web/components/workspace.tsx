"use client";

import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Check,
  CircleAlert,
  Database,
  Download,
  FileCheck2,
  FileOutput,
  FolderSearch2,
  LogOut,
  MailCheck,
  Menu,
  Play,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
  UserRoundCheck,
  X,
} from "lucide-react";
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Brand } from "./brand.js";

const API = process.env.NEXT_PUBLIC_NIMANTO_API_ORIGIN ?? "http://127.0.0.1:4310";

type Section = "overview" | "evidence" | "jobs" | "applications" | "packets" | "actions" | "data";
type Evidence = {
  id: string;
  kind: string;
  value: string;
  status: string;
  confidence: string;
  sourceName: string;
  locator: string;
};
type Job = {
  id: string;
  source: string;
  title: string;
  company: string;
  description: string;
  location: string;
  requirements: string[];
  url: string;
  sourceMeta: {
    compensation?: { minimum?: number | null; maximum?: number | null; currency?: string } | null;
    benefits?: string[];
    interviewEvidence?: { text?: string; sourceLocator?: string; observedAt?: string } | null;
  };
};
type Match = {
  id: string;
  jobId: string;
  result: {
    band: string;
    coverage: string;
    blockers: Array<{ code: string; sourceText: string }>;
    requirements: Array<{
      requirement: string;
      state: string;
      evidenceIds: string[];
      reason: string;
    }>;
  };
  job: Job;
};
type Outcome = { id: string; type: string; note: string; occurredAt: string };
type Application = {
  id: string;
  jobId: string;
  status: string;
  job?: { title: string; company: string };
  outcomes?: Outcome[];
};
type Packet = {
  id: string;
  applicationId: string;
  status: string;
  approvedAt: string | null;
  artifactManifest: { artifacts?: Array<{ format: string; filename: string; sha256: string }> };
};
type Action = {
  id: string;
  packetId: string;
  provider: string;
  state: string;
  target: { to?: string };
  payload: { subject?: string; body?: string };
  result?: { providerReference?: string };
};
type Signal = {
  id: string;
  company: string;
  label: string;
  sourceType: string;
  sourceLocator: string;
  sourcePeriod: string;
  confidence: string;
  limitations: string;
};
type Dashboard = {
  identity: { displayName: string; email: string };
  profile: { authorizationWording: string } | null;
  evidence: Evidence[];
  jobs: Job[];
  matches: Match[];
  h1bSignals: Signal[];
  applications: Application[];
  packets: Packet[];
  externalActions: Action[];
  receipts: unknown[];
  personalFunnel: {
    sampleSize: number;
    replies: number;
    screens: number;
    interviews: number;
    offers: number;
    scope: string;
  };
  runtime: { externalActionsEnabled: boolean };
};
type ActionRunner = (
  work: () => Promise<unknown>,
  success: string,
  onSuccess?: (result: unknown) => void,
) => Promise<void>;
type EvidenceImportPreview = {
  filename: string;
  mimeType: string;
  contentBase64: string;
  claimCount: number;
  warnings: string[];
  preview: {
    acceptedFiles: string[];
    ignoredFiles: string[];
    acceptedFields: Array<{ file: string; fields: string[] }>;
  } | null;
  previewHash: string;
};

class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    credentials: "include",
    headers: { ...(init?.body ? { "content-type": "application/json" } : {}), ...init?.headers },
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as {
      error?: { code?: string; message?: string };
    };
    throw new ApiError(
      payload.error?.code ?? `HTTP_${response.status}`,
      payload.error?.message ?? "Nimanto could not complete that request.",
    );
  }
  return response.json() as Promise<T>;
}

function human(value: string): string {
  return value.replaceAll("_", " ").replace(/^\w/, (letter) => letter.toUpperCase());
}

function fileBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("FILE_READ_FAILED"));
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.readAsDataURL(file);
  });
}

const navigation: Array<{ id: Section; label: string; icon: typeof Activity }> = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "evidence", label: "Evidence vault", icon: FolderSearch2 },
  { id: "jobs", label: "Role discovery", icon: BriefcaseBusiness },
  { id: "applications", label: "Applications", icon: UserRoundCheck },
  { id: "packets", label: "Review packets", icon: FileOutput },
  { id: "actions", label: "Approved actions", icon: Send },
  { id: "data", label: "Data controls", icon: Database },
];

export function Workspace() {
  const [section, setSection] = useState<Section>("overview");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [bootstrapSecret, setBootstrapSecret] = useState("");
  const [inviteToken, setInviteToken] = useState("");
  const menuButton = useRef<HTMLButtonElement>(null);
  const closeNavigationButton = useRef<HTMLButtonElement>(null);
  const firstNavigationButton = useRef<HTMLButtonElement>(null);
  const refreshButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const invitation = fragment.get("invite") ?? "";
    const value = fragment.get("bootstrap") ?? "";
    if (invitation) {
      setInviteToken(invitation);
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
      return;
    }
    if (value) {
      window.sessionStorage.setItem("nimanto_bootstrap", value);
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
      setBootstrapSecret(value);
    } else {
      setBootstrapSecret(window.sessionStorage.getItem("nimanto_bootstrap") ?? "");
    }
  }, []);

  const clearBootstrapSecret = useCallback(() => {
    window.sessionStorage.removeItem("nimanto_bootstrap");
    setBootstrapSecret("");
    setInviteToken("");
  }, []);

  const closeMobileNavigation = useCallback(() => {
    setMobileNav(false);
    window.requestAnimationFrame(() => menuButton.current?.focus());
  }, []);

  useEffect(() => {
    if (!mobileNav) return;
    closeNavigationButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMobileNavigation();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeMobileNavigation, mobileNav]);

  const refresh = useCallback(async () => {
    try {
      const status = await api<{ authenticated: boolean }>("/v1/auth/status");
      if (!status.authenticated) {
        setAuthRequired(true);
        setDashboard(null);
        return;
      }
      const value = await api<Dashboard>("/v1/dashboard");
      setDashboard(value);
      setAuthRequired(false);
    } catch (error) {
      if (error instanceof ApiError && error.code === "AUTHENTICATION_REQUIRED")
        setAuthRequired(true);
      else
        setNotice({
          kind: "error",
          text: error instanceof Error ? error.message : "The local service is unavailable.",
        });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const act: ActionRunner = async (work, success, onSuccess) => {
    setBusy(true);
    setNotice(null);
    try {
      const result = await work();
      onSuccess?.(result);
      await refresh();
      setNotice({ kind: "ok", text: success });
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "Nimanto could not complete that request.",
      });
    } finally {
      setBusy(false);
    }
  };

  if (authRequired || (!dashboard && !notice)) {
    return (
      <WorkspaceStart
        unavailable={!authRequired}
        onStart={(identity) =>
          act(
            () =>
              inviteToken
                ? api("/v1/auth/invitations/accept", {
                    method: "POST",
                    body: JSON.stringify({ ...identity, token: inviteToken }),
                  })
                : api("/v1/auth/local", {
                    method: "POST",
                    body: JSON.stringify(identity),
                    headers: { "x-nimanto-bootstrap-secret": bootstrapSecret },
                  }),
            "Your private beta workspace is ready.",
            clearBootstrapSecret,
          )
        }
        onDemo={() =>
          act(
            () =>
              api("/v1/auth/demo", {
                method: "POST",
                body: "{}",
                headers: { "x-nimanto-bootstrap-secret": bootstrapSecret },
              }),
            "The synthetic Priya Shah workspace is ready.",
            clearBootstrapSecret,
          )
        }
        bootstrapSecret={bootstrapSecret}
        inviteMode={Boolean(inviteToken)}
        onBootstrapSecret={setBootstrapSecret}
        busy={busy}
        notice={notice}
      />
    );
  }
  if (!dashboard)
    return (
      <WorkspaceStart
        unavailable
        onStart={() => void refresh()}
        onDemo={() => void refresh()}
        busy={busy}
        notice={notice}
        bootstrapSecret={bootstrapSecret}
        inviteMode={false}
        onBootstrapSecret={setBootstrapSecret}
      />
    );

  const selected = navigation.find((item) => item.id === section)!;
  return (
    <div className="workspace-shell">
      <aside
        id="workspace-navigation"
        className={mobileNav ? "workspace-sidebar is-open" : "workspace-sidebar"}
      >
        <div className="workspace-brand">
          <a href="../">
            <Brand />
          </a>
          <button
            ref={closeNavigationButton}
            className="icon-button mobile-close"
            type="button"
            onClick={closeMobileNavigation}
            onKeyDown={(event) => {
              if (event.key === "Tab" && !event.shiftKey) {
                event.preventDefault();
                firstNavigationButton.current?.focus();
              }
            }}
            aria-label="Close navigation"
          >
            <X />
          </button>
        </div>
        <p className="workspace-label">
          Private workbench
          <span className="workspace-cultural">
            <span lang="ja">証拠・判断・承認</span>
            <i aria-hidden="true" />
            <span lang="hi">प्रमाण · निर्णय · स्वीकृति</span>
          </span>
        </p>
        <nav aria-label="Workbench">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                ref={item.id === "overview" ? firstNavigationButton : undefined}
                type="button"
                className={
                  section === item.id ? "workspace-nav-item is-active" : "workspace-nav-item"
                }
                aria-current={section === item.id ? "page" : undefined}
                onClick={() => {
                  setSection(item.id);
                  closeMobileNavigation();
                }}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="sidebar-foot">
          <div className="local-indicator">
            <span /> Local service connected
          </div>
          <button
            type="button"
            className="workspace-nav-item"
            onClick={() => {
              void act(
                () => api("/v1/session", { method: "DELETE" }),
                "Signed out.",
                () => {
                  clearBootstrapSecret();
                  setDashboard(null);
                  setAuthRequired(true);
                },
              );
            }}
          >
            <LogOut size={18} /> Sign out
          </button>
        </div>
      </aside>
      {mobileNav && (
        <button
          className="nav-scrim"
          type="button"
          aria-label="Close navigation"
          onClick={closeMobileNavigation}
        />
      )}

      <main id="main" className="workspace-main">
        <header className="workspace-header">
          <button
            ref={menuButton}
            className="icon-button menu-button"
            type="button"
            onClick={() => setMobileNav(true)}
            onKeyDown={(event) => {
              if (event.key === "Tab" && !event.shiftKey && !mobileNav && !busy) {
                event.preventDefault();
                refreshButton.current?.focus();
              }
            }}
            aria-label="Open navigation"
            aria-controls="workspace-navigation"
            aria-expanded={mobileNav}
          >
            <Menu />
          </button>
          <div>
            <p>{selected.label}</p>
            <span>{dashboard.identity.email}</span>
          </div>
          <button
            ref={refreshButton}
            className="button mini quiet"
            type="button"
            disabled={busy}
            onClick={() => void refresh()}
          >
            <RefreshCw size={15} /> Refresh
          </button>
        </header>
        {notice && (
          <div className={`notice ${notice.kind}`} role="status" aria-live="polite">
            {notice.kind === "ok" ? <Check size={17} /> : <CircleAlert size={17} />}
            <span>{notice.text}</span>
            <button
              className="icon-button"
              type="button"
              onClick={() => setNotice(null)}
              aria-label="Dismiss message"
            >
              <X size={15} />
            </button>
          </div>
        )}
        <div className="workspace-content">
          {section === "overview" && (
            <Overview dashboard={dashboard} onGo={setSection} onAct={act} busy={busy} />
          )}
          {section === "evidence" && (
            <EvidenceVault dashboard={dashboard} onAct={act} busy={busy} />
          )}
          {section === "jobs" && <Jobs dashboard={dashboard} onAct={act} busy={busy} />}
          {section === "applications" && (
            <Applications dashboard={dashboard} onAct={act} busy={busy} onGo={setSection} />
          )}
          {section === "packets" && <Packets dashboard={dashboard} onAct={act} busy={busy} />}
          {section === "actions" && <Actions dashboard={dashboard} onAct={act} busy={busy} />}
          {section === "data" && <DataControls dashboard={dashboard} onAct={act} busy={busy} />}
        </div>
      </main>
    </div>
  );
}

function WorkspaceStart({
  unavailable,
  onStart,
  busy,
  notice,
  bootstrapSecret,
  inviteMode,
  onBootstrapSecret,
  onDemo,
}: {
  unavailable: boolean;
  onStart: (identity: { displayName: string; email: string }) => void;
  onDemo: () => void;
  busy: boolean;
  notice: { kind: "ok" | "error"; text: string } | null;
  bootstrapSecret: string;
  inviteMode: boolean;
  onBootstrapSecret: (value: string) => void;
}) {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onStart({
      displayName: String(data.get("displayName") ?? ""),
      email: String(data.get("email") ?? ""),
    });
  };
  return (
    <main id="main" className="workspace-start">
      <a className="back-link" href="../">
        <ArrowLeft size={16} /> Back to Nimanto
      </a>
      <form className="start-panel" onSubmit={submit}>
        <Brand />
        <div
          className="cultural-line compact"
          aria-label="From evidence to action; from evidence to progress"
        >
          <span lang="ja">証拠から、行動へ。</span>
          <i aria-hidden="true" />
          <span lang="hi">प्रमाण से, प्रगति तक।</span>
        </div>
        <p className="eyebrow">
          <span /> {inviteMode ? "Private invitation" : "Local-first beta"}
        </p>
        <h1>{unavailable ? "Connect the local service." : "Your evidence stays with you."}</h1>
        <p>
          {unavailable ? (
            <>
              Start the Nimanto backend at <code>127.0.0.1:4310</code>, then try again.
            </>
          ) : inviteMode ? (
            "Accept this single-use invitation to create an empty, tenant-isolated candidate workspace."
          ) : (
            "Open the synthetic starter workspace, inspect every source link, and replace examples with your own confirmed evidence."
          )}
        </p>
        {!unavailable && !inviteMode && !bootstrapSecret && (
          <label className="launch-secret-field">
            Private launch key
            <input
              type="password"
              autoComplete="off"
              value={bootstrapSecret}
              onChange={(event) => onBootstrapSecret(event.target.value)}
              placeholder="Paste the key shown by the local launcher"
            />
            <small>The launcher normally supplies this key automatically.</small>
          </label>
        )}
        {!unavailable && (
          <div className="field-grid identity-fields">
            <label>
              Your name
              <input name="displayName" required maxLength={120} autoComplete="name" />
            </label>
            <label>
              Your email
              <input name="email" type="email" required maxLength={254} autoComplete="email" />
            </label>
          </div>
        )}
        <button
          className="button primary"
          type={unavailable ? "button" : "submit"}
          onClick={unavailable ? () => onStart({ displayName: "", email: "" }) : undefined}
          disabled={busy || (!unavailable && !inviteMode && !bootstrapSecret)}
        >
          {unavailable ? <RefreshCw size={17} /> : <Play size={17} />}
          {busy ? "Connecting…" : unavailable ? "Try again" : "Start private workspace"}
        </button>
        {!unavailable && !inviteMode && (
          <button
            className="button quiet"
            type="button"
            onClick={onDemo}
            disabled={busy || !bootstrapSecret}
          >
            Use clearly labeled synthetic demo
          </button>
        )}
        {notice && (
          <div
            className={`notice ${notice.kind}`}
            role={notice.kind === "error" ? "alert" : "status"}
          >
            {notice.kind === "ok" ? <Check size={17} /> : <CircleAlert size={17} />}
            {notice.text}
          </div>
        )}
        <small>Synthetic starter data is labeled and can be deleted at any time.</small>
      </form>
    </main>
  );
}

function PageIntro({
  eyebrow,
  title,
  copy,
  action,
}: {
  eyebrow: string;
  title: string;
  copy: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-intro">
      <div>
        <p className="eyebrow">
          <span /> {eyebrow}
        </p>
        <h1>{title}</h1>
        <p>{copy}</p>
      </div>
      {action}
    </div>
  );
}

function Metric({
  value,
  label,
  detail,
}: {
  value: string | number;
  label: string;
  detail: string;
}) {
  return (
    <div className="metric">
      <strong>{value}</strong>
      <span>{label}</span>
      <small>{detail}</small>
    </div>
  );
}

function Overview({
  dashboard,
  onGo,
  onAct,
  busy,
}: {
  dashboard: Dashboard;
  onGo: (section: Section) => void;
  onAct: ActionRunner;
  busy: boolean;
}) {
  const pending = dashboard.evidence.filter((item) => item.status === "pending").length;
  const blockers = dashboard.matches.reduce(
    (count, match) => count + match.result.blockers.length,
    0,
  );
  const latestMatches = dashboard.matches.slice(0, 3);
  return (
    <>
      <PageIntro
        eyebrow="Today’s record"
        title={`Good to see you, ${dashboard.identity.displayName.split(" ")[0]}.`}
        copy="One calm view of what is confirmed, what needs review, and what is ready for your decision."
        action={
          <button className="button primary" type="button" onClick={() => onGo("jobs")}>
            <Plus size={17} /> Add a role
          </button>
        }
      />
      <div className="metric-row">
        <Metric
          value={dashboard.evidence.filter((item) => item.status === "confirmed").length}
          label="Confirmed evidence"
          detail={`${pending} awaiting review`}
        />
        <Metric
          value={dashboard.matches.length}
          label="Explained matches"
          detail={`${blockers} visible blocker${blockers === 1 ? "" : "s"}`}
        />
        <Metric
          value={dashboard.applications.length}
          label="Tracked applications"
          detail={`${dashboard.packets.filter((item) => item.status === "approved").length} approved packets`}
        />
        <Metric
          value={dashboard.receipts.length}
          label="Execution receipts"
          detail="Local audit trail"
        />
      </div>
      <div className="workspace-columns">
        <section className="work-panel">
          <div className="panel-heading">
            <div>
              <span>Role evidence</span>
              <h2>Recent explanations</h2>
            </div>
            <button type="button" className="text-button" onClick={() => onGo("jobs")}>
              All roles <ArrowRight size={15} />
            </button>
          </div>
          {latestMatches.length ? (
            latestMatches.map((match) => (
              <div className="match-row" key={match.id}>
                <div className="company-initial">{match.job.company.charAt(0)}</div>
                <div>
                  <strong>{match.job.title}</strong>
                  <span>{match.job.company}</span>
                </div>
                <span className={`state ${match.result.blockers.length ? "warning" : "supported"}`}>
                  {human(match.result.band)}
                </span>
              </div>
            ))
          ) : (
            <Empty
              icon={Sparkles}
              title="No explanations yet"
              copy="Run a match from Role discovery to see every supported and missing requirement."
            />
          )}
        </section>
        <section className="work-panel">
          <div className="panel-heading">
            <div>
              <span>Next decisions</span>
              <h2>Review queue</h2>
            </div>
          </div>
          {pending > 0 ? (
            <button className="queue-row" type="button" onClick={() => onGo("evidence")}>
              <CircleAlert />
              <span>
                <strong>
                  {pending} imported claim{pending === 1 ? "" : "s"}
                </strong>
                <small>Confirm or reject before matching</small>
              </span>
              <ArrowRight />
            </button>
          ) : (
            <div className="queue-row is-complete">
              <ShieldCheck />
              <span>
                <strong>Evidence queue is clear</strong>
                <small>All imported claims have a decision</small>
              </span>
              <Check />
            </div>
          )}
          {dashboard.externalActions
            .filter((item) => item.state === "pending_approval")
            .map((item) => (
              <button
                key={item.id}
                className="queue-row"
                type="button"
                onClick={() => onGo("actions")}
              >
                <MailCheck />
                <span>
                  <strong>Action needs approval</strong>
                  <small>
                    {item.provider} · {item.target.to}
                  </small>
                </span>
                <ArrowRight />
              </button>
            ))}
        </section>
      </div>
      {dashboard.jobs.length > 0 && dashboard.matches.length === 0 && (
        <div className="focus-strip">
          <div>
            <SlidersHorizontal />
            <span>
              <strong>Your starter roles are ready.</strong>
              <small>
                Run both deterministic explanations—no model is used; only confirmed career evidence
                is scored.
              </small>
            </span>
          </div>
          <button
            className="button inverted"
            type="button"
            disabled={busy}
            onClick={() =>
              onAct(async () => {
                for (const job of dashboard.jobs)
                  await api(`/v1/jobs/${job.id}/match`, { method: "POST" });
              }, "Role explanations are ready.")
            }
          >
            Run starter matches
          </button>
        </div>
      )}
    </>
  );
}

function Empty({
  icon: Icon,
  title,
  copy,
}: {
  icon: typeof Activity;
  title: string;
  copy: string;
}) {
  return (
    <div className="empty">
      <Icon />
      <strong>{title}</strong>
      <p>{copy}</p>
    </div>
  );
}

function EvidenceVault({
  dashboard,
  onAct,
  busy,
}: {
  dashboard: Dashboard;
  onAct: ActionRunner;
  busy: boolean;
}) {
  const [kind, setKind] = useState("skill");
  const [value, setValue] = useState("");
  const [authorization, setAuthorization] = useState(dashboard.profile?.authorizationWording ?? "");
  const [importPreview, setImportPreview] = useState<EvidenceImportPreview | null>(null);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void onAct(
      () => api("/v1/evidence", { method: "POST", body: JSON.stringify({ kind, value }) }),
      "Claim added to the review queue.",
    ).then(() => setValue(""));
  };
  return (
    <>
      <PageIntro
        eyebrow="Evidence vault"
        title="Confirm the record before using it."
        copy="Every imported claim starts pending. Source names and locators stay beside the claim throughout matching and packet generation."
      />
      <div className="workspace-columns wide-left">
        <section className="work-panel">
          <div className="panel-heading">
            <div>
              <span>All claims</span>
              <h2>{dashboard.evidence.length} evidence items</h2>
            </div>
            <label className="button mini quiet file-button">
              <Upload size={15} /> Import file
              <input
                type="file"
                accept=".txt,.md,.json,.docx,.pdf,.zip"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  void onAct(
                    async () => {
                      const contentBase64 = await fileBase64(file);
                      const preview = await api<
                        Omit<EvidenceImportPreview, "filename" | "mimeType" | "contentBase64">
                      >("/v1/evidence/preview", {
                        method: "POST",
                        body: JSON.stringify({
                          filename: file.name,
                          mimeType: file.type,
                          contentBase64,
                        }),
                      });
                      return {
                        filename: file.name,
                        mimeType: file.type,
                        contentBase64,
                        ...preview,
                      } satisfies EvidenceImportPreview;
                    },
                    `${file.name} is ready for your import decision.`,
                    (result) => setImportPreview(result as EvidenceImportPreview),
                  );
                  event.target.value = "";
                }}
              />
            </label>
          </div>
          {importPreview && (
            <section className="import-preview" aria-labelledby="import-preview-title">
              <div>
                <span>Import preview · nothing stored yet</span>
                <h3 id="import-preview-title">Review {importPreview.filename}</h3>
                <p>
                  {importPreview.claimCount} pending claim
                  {importPreview.claimCount === 1 ? "" : "s"} will enter your private review queue.
                </p>
              </div>
              {importPreview.preview && (
                <div className="import-preview-grid">
                  <div>
                    <strong>Accepted files and fields</strong>
                    <ul>
                      {importPreview.preview.acceptedFields.map((entry) => (
                        <li key={entry.file}>
                          <code>{entry.file}</code>
                          <small>{entry.fields.join(" · ") || "No approved fields found"}</small>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <strong>Ignored files</strong>
                    {importPreview.preview.ignoredFiles.length ? (
                      <ul>
                        {importPreview.preview.ignoredFiles.map((file) => (
                          <li key={file}>
                            <code>{file}</code>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <small>None</small>
                    )}
                  </div>
                </div>
              )}
              {importPreview.warnings.map((warning) => (
                <p className="field-note" key={warning}>
                  {warning}
                </p>
              ))}
              <div className="form-actions">
                <button
                  className="button primary"
                  type="button"
                  disabled={busy || importPreview.claimCount === 0}
                  onClick={() =>
                    onAct(
                      () =>
                        api("/v1/evidence/import", {
                          method: "POST",
                          body: JSON.stringify({
                            filename: importPreview.filename,
                            mimeType: importPreview.mimeType,
                            contentBase64: importPreview.contentBase64,
                            confirmedPreviewHash: importPreview.previewHash,
                          }),
                        }),
                      `${importPreview.filename} was imported as pending evidence.`,
                      () => setImportPreview(null),
                    )
                  }
                >
                  <Check size={16} /> Confirm import
                </button>
                <button
                  className="button quiet"
                  type="button"
                  disabled={busy}
                  onClick={() => setImportPreview(null)}
                >
                  Cancel
                </button>
              </div>
            </section>
          )}
          <div className="evidence-list">
            {dashboard.evidence.map((claim) => (
              <article key={claim.id} className="evidence-item">
                <div className="evidence-kind">{human(claim.kind)}</div>
                <div>
                  <strong>{claim.value}</strong>
                  <small>
                    {claim.sourceName} · {claim.locator}
                  </small>
                </div>
                <div className="evidence-controls">
                  <span
                    className={`state ${claim.status === "confirmed" ? "supported" : claim.status === "pending" ? "warning" : "muted"}`}
                  >
                    {human(claim.status)}
                  </span>
                  {claim.status === "pending" && (
                    <>
                      <button
                        className="icon-button positive"
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          onAct(
                            () => api(`/v1/evidence/${claim.id}/confirm`, { method: "POST" }),
                            "Claim confirmed.",
                          )
                        }
                        aria-label={`Confirm ${claim.value}`}
                      >
                        <Check size={16} />
                      </button>
                      <button
                        className="icon-button"
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          onAct(
                            () => api(`/v1/evidence/${claim.id}/reject`, { method: "POST" }),
                            "Claim rejected.",
                          )
                        }
                        aria-label={`Reject ${claim.value}`}
                      >
                        <X size={16} />
                      </button>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
        <div className="stacked-panels">
          <form className="work-panel form-panel" onSubmit={submit}>
            <div className="panel-heading">
              <div>
                <span>Manual claim</span>
                <h2>Add evidence</h2>
              </div>
            </div>
            <label>
              Evidence type
              <select value={kind} onChange={(event) => setKind(event.target.value)}>
                <option value="skill">Skill</option>
                <option value="employment">Employment</option>
                <option value="project">Project</option>
                <option value="accomplishment">Accomplishment</option>
                <option value="education">Education</option>
                <option value="certification">Certification</option>
                <option value="preference">Preference</option>
              </select>
            </label>
            <label>
              Exact claim
              <textarea
                required
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder="What can you support with a source?"
              />
            </label>
            <button className="button primary" disabled={busy || value.trim().length < 3}>
              <Plus size={16} /> Add pending claim
            </button>
          </form>
          <form
            className="work-panel form-panel"
            onSubmit={(event) => {
              event.preventDefault();
              void onAct(
                () =>
                  api("/v1/profile/versions", {
                    method: "POST",
                    body: JSON.stringify({ authorizationWording: authorization }),
                  }),
                "A new profile version was saved.",
              );
            }}
          >
            <div className="panel-heading">
              <div>
                <span>Locked wording</span>
                <h2>Work authorization</h2>
              </div>
            </div>
            <label>
              Candidate-approved statement
              <textarea
                value={authorization}
                onChange={(event) => setAuthorization(event.target.value)}
                placeholder="Use your own exact wording."
              />
            </label>
            <p className="field-note">
              Packet assurance blocks any silent wording change. This is not legal advice.
            </p>
            <button className="button quiet" disabled={busy}>
              Save profile version
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

function Jobs({
  dashboard,
  onAct,
  busy,
}: {
  dashboard: Dashboard;
  onAct: ActionRunner;
  busy: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);
  const latest = useMemo(
    () => new Map(dashboard.matches.map((match) => [match.jobId, match])),
    [dashboard.matches],
  );
  const addJob = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const requirements = String(data.get("requirements") ?? "")
      .split("\n")
      .filter(Boolean);
    const benefits = String(data.get("benefits") ?? "")
      .split("\n")
      .map((value) => value.trim())
      .filter(Boolean);
    const numberOrNull = (value: FormDataEntryValue | null) => {
      const text = String(value ?? "").trim();
      return text ? Number(text) : null;
    };
    void onAct(
      () =>
        api("/v1/jobs", {
          method: "POST",
          body: JSON.stringify({
            title: data.get("title"),
            company: data.get("company"),
            description: data.get("description"),
            location: data.get("location"),
            workMode: data.get("workMode"),
            compensationMin: numberOrNull(data.get("compensationMin")),
            compensationMax: numberOrNull(data.get("compensationMax")),
            benefits,
            interviewEvidence: data.get("interviewEvidence"),
            interviewSource: data.get("interviewSource"),
            url: data.get("url"),
            requirements,
          }),
        }),
      "Role added.",
    ).then(() => setAdding(false));
  };
  const importSource = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void onAct(
      () =>
        api("/v1/jobs/import", {
          method: "POST",
          body: JSON.stringify({ provider: data.get("provider"), board: data.get("board") }),
        }),
      "Allowlisted source refreshed.",
    ).then(() => setSourceOpen(false));
  };
  return (
    <>
      <PageIntro
        eyebrow="Role discovery"
        title="Compare roles to evidence—not identity."
        copy="Nimanto explains required qualifications, accomplishments, role-level alignment, skills overlap, coverage, and explicit sponsorship blockers."
        action={
          <div className="button-group">
            <button
              className="button quiet"
              type="button"
              onClick={() => setSourceOpen((value) => !value)}
            >
              <RefreshCw size={16} /> Import source
            </button>
            <button
              className="button primary"
              type="button"
              onClick={() => setAdding((value) => !value)}
            >
              <Plus size={16} /> Add role
            </button>
          </div>
        }
      />
      {(adding || sourceOpen) && (
        <div className="inline-form-row">
          {adding && (
            <form className="work-panel form-panel" onSubmit={addJob}>
              <div className="panel-heading">
                <div>
                  <span>Manual intake</span>
                  <h2>Add a role</h2>
                </div>
              </div>
              <div className="field-grid">
                <label>
                  Role title
                  <input name="title" required />
                </label>
                <label>
                  Company
                  <input name="company" required />
                </label>
                <label>
                  Location
                  <input name="location" />
                </label>
                <label>
                  Work mode
                  <select name="workMode" defaultValue="unspecified">
                    <option value="unspecified">Not specified</option>
                    <option value="remote">Remote</option>
                    <option value="hybrid">Hybrid</option>
                    <option value="onsite">On-site</option>
                  </select>
                </label>
                <label>
                  Posting URL
                  <input name="url" type="url" />
                </label>
              </div>
              <label>
                Description
                <textarea name="description" required />
              </label>
              <label>
                Requirements, one per line
                <textarea name="requirements" required />
              </label>
              <div className="field-grid">
                <label>
                  Posted annual minimum (USD)
                  <input name="compensationMin" type="number" min="0" step="1000" />
                </label>
                <label>
                  Posted annual maximum (USD)
                  <input name="compensationMax" type="number" min="0" step="1000" />
                </label>
              </div>
              <label>
                Stated benefits, one per line
                <textarea name="benefits" />
              </label>
              <label>
                Interview-process evidence
                <textarea
                  name="interviewEvidence"
                  placeholder="Only sourced or user-provided stages."
                />
              </label>
              <label>
                Interview source
                <input name="interviewSource" placeholder="Official page or user-provided note" />
              </label>
              <button className="button primary" disabled={busy}>
                Save role
              </button>
            </form>
          )}
          {sourceOpen && (
            <form className="work-panel form-panel compact-form" onSubmit={importSource}>
              <div className="panel-heading">
                <div>
                  <span>Allowlisted ATS</span>
                  <h2>Refresh a public board</h2>
                </div>
              </div>
              <label>
                Provider
                <select name="provider">
                  <option value="greenhouse">Greenhouse</option>
                  <option value="lever">Lever</option>
                  <option value="ashby">Ashby</option>
                </select>
              </label>
              <label>
                Public board identifier
                <input name="board" required pattern="[A-Za-z0-9_-]+" placeholder="company-slug" />
              </label>
              <p className="field-note">
                Nimanto contacts only the selected provider API and rejects redirects.
              </p>
              <button className="button quiet" disabled={busy}>
                Import current roles
              </button>
            </form>
          )}
        </div>
      )}
      <div className="job-list">
        {dashboard.jobs.map((job) => {
          const match = latest.get(job.id);
          return (
            <article key={job.id} className="job-row">
              <div className="job-main">
                <div className="company-initial">{job.company.charAt(0)}</div>
                <div>
                  <span className="source-label">{job.source}</span>
                  <h2>{job.title}</h2>
                  <p>
                    {job.company} · {job.location || "Location not specified"}
                  </p>
                </div>
              </div>
              <div className="job-match">
                {match ? (
                  <>
                    <span
                      className={`state ${match.result.blockers.length ? "warning" : "supported"}`}
                    >
                      {human(match.result.band)}
                    </span>
                    <small>
                      {
                        match.result.requirements.filter((item) => item.state === "supported")
                          .length
                      }
                      /{match.result.requirements.length} requirements supported
                    </small>
                  </>
                ) : (
                  <span className="state muted">Not matched</span>
                )}
              </div>
              <div className="job-actions">
                <button
                  className="button mini quiet"
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    onAct(
                      () => api(`/v1/jobs/${job.id}/match`, { method: "POST" }),
                      `Explanation ready for ${job.title}.`,
                    )
                  }
                >
                  <SlidersHorizontal size={15} /> Explain fit
                </button>
                <button
                  className="button mini primary"
                  type="button"
                  disabled={busy || dashboard.applications.some((item) => item.jobId === job.id)}
                  onClick={() =>
                    onAct(
                      () =>
                        api("/v1/applications", {
                          method: "POST",
                          body: JSON.stringify({ jobId: job.id }),
                        }),
                      `${job.title} is now tracked.`,
                    )
                  }
                >
                  <Plus size={15} />{" "}
                  {dashboard.applications.some((item) => item.jobId === job.id)
                    ? "Tracked"
                    : "Track"}
                </button>
              </div>
              {match && (
                <details className="match-detail">
                  <summary>View requirement evidence</summary>
                  <div>
                    {match.result.blockers.map((blocker) => (
                      <p className="blocker" key={blocker.code}>
                        <CircleAlert size={15} />
                        <span>
                          <strong>{human(blocker.code)}</strong>
                          {blocker.sourceText}
                        </span>
                      </p>
                    ))}
                    {match.result.requirements.map((requirement) => (
                      <div className="requirement" key={requirement.requirement}>
                        <span className={`status-dot ${requirement.state}`} />
                        <div>
                          <strong>{requirement.requirement}</strong>
                          <small>{requirement.reason}</small>
                        </div>
                        <code>
                          {requirement.evidenceIds.length} link
                          {requirement.evidenceIds.length === 1 ? "" : "s"}
                        </code>
                      </div>
                    ))}
                  </div>
                </details>
              )}
              {(job.sourceMeta.compensation ||
                job.sourceMeta.benefits?.length ||
                job.sourceMeta.interviewEvidence) && (
                <div className="job-context">
                  {job.sourceMeta.compensation && (
                    <p>
                      <strong>Posted compensation</strong>{" "}
                      {job.sourceMeta.compensation.minimum?.toLocaleString() ?? "unknown"}–
                      {job.sourceMeta.compensation.maximum?.toLocaleString() ?? "unknown"}{" "}
                      {job.sourceMeta.compensation.currency ?? "USD"} · user-supplied posting
                    </p>
                  )}
                  {Boolean(job.sourceMeta.benefits?.length) && (
                    <p>
                      <strong>Stated benefits</strong> {job.sourceMeta.benefits?.join(" · ")}
                    </p>
                  )}
                  {job.sourceMeta.interviewEvidence && (
                    <p>
                      <strong>Interview context</strong> {job.sourceMeta.interviewEvidence.text} ·{" "}
                      {job.sourceMeta.interviewEvidence.sourceLocator}
                    </p>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
      <Signals dashboard={dashboard} onAct={onAct} busy={busy} />
    </>
  );
}

function Signals({
  dashboard,
  onAct,
  busy,
}: {
  dashboard: Dashboard;
  onAct: ActionRunner;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    void onAct(
      () =>
        api("/v1/h1b-signals", {
          method: "POST",
          body: JSON.stringify({
            ...data,
            confidence: "low",
            observedAt: new Date().toISOString(),
          }),
        }),
      "Historical sponsorship evidence added.",
    ).then(() => setOpen(false));
  };
  return (
    <section className="signals">
      <div className="panel-heading">
        <div>
          <span>Historical context</span>
          <h2>H-1B evidence signals</h2>
          <p>Signals never override role wording and never promise current support.</p>
        </div>
        <button
          className="button mini quiet"
          type="button"
          onClick={() => setOpen((value) => !value)}
        >
          <Plus size={15} /> Add sourced signal
        </button>
      </div>
      {open && (
        <form className="signal-form" onSubmit={submit}>
          <label>
            Company
            <input name="company" required />
          </label>
          <label>
            Signal
            <select name="label">
              <option value="uncertain">Uncertain</option>
              <option value="possible">Possible</option>
              <option value="recent_positive_history">Recent positive history</option>
              <option value="current_role_transfer_support">
                Current role says transfer support
              </option>
              <option value="no_sponsorship_of_any_kind">No sponsorship of any kind</option>
            </select>
          </label>
          <label>
            Source type
            <input name="sourceType" required placeholder="USCIS disclosure, role text…" />
          </label>
          <label>
            Source period
            <input name="sourcePeriod" required placeholder="FY 2025" />
          </label>
          <label className="wide-field">
            Source locator
            <input name="sourceLocator" required placeholder="Public URL or document locator" />
          </label>
          <label className="wide-field">
            Limitations
            <textarea name="limitations" required placeholder="What this source cannot establish" />
          </label>
          <button className="button primary" disabled={busy}>
            Save evidence signal
          </button>
        </form>
      )}
      <div className="signal-list">
        {dashboard.h1bSignals.map((signal) => (
          <article key={signal.id}>
            <div>
              <strong>{signal.company}</strong>
              <span className="state warning">{human(signal.label)}</span>
            </div>
            <p>
              {signal.sourceType} · {signal.sourcePeriod}
            </p>
            <small>{signal.limitations}</small>
          </article>
        ))}
      </div>
    </section>
  );
}

function Applications({
  dashboard,
  onAct,
  busy,
  onGo,
}: {
  dashboard: Dashboard;
  onAct: ActionRunner;
  busy: boolean;
  onGo: (section: Section) => void;
}) {
  const [outcomeFor, setOutcomeFor] = useState<string | null>(null);
  const submitOutcome = (event: FormEvent<HTMLFormElement>, id: string) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    void onAct(
      () => api(`/v1/applications/${id}/outcomes`, { method: "POST", body: JSON.stringify(data) }),
      "Outcome recorded.",
    ).then(() => setOutcomeFor(null));
  };
  return (
    <>
      <PageIntro
        eyebrow="Applications"
        title="Track the real process."
        copy="Keep preparation, external submission, and candidate-reported outcomes separate. Nimanto never infers an outcome from silence."
        action={
          <button className="button quiet" type="button" onClick={() => onGo("jobs")}>
            <Plus size={16} /> Track another role
          </button>
        }
      />
      <div className="funnel-strip" aria-label="Personal application funnel">
        <span>
          <strong>{dashboard.personalFunnel.sampleSize}</strong> tracked
        </span>
        <span>
          <strong>{dashboard.personalFunnel.replies}</strong> replies
        </span>
        <span>
          <strong>{dashboard.personalFunnel.screens}</strong> screens
        </span>
        <span>
          <strong>{dashboard.personalFunnel.interviews}</strong> interviews
        </span>
        <span>
          <strong>{dashboard.personalFunnel.offers}</strong> offers
        </span>
        <small>{dashboard.personalFunnel.scope}</small>
      </div>
      <section className="application-table" aria-label="Tracked applications">
        <div className="table-head" aria-hidden="true">
          <span>Role</span>
          <span>Status</span>
          <span>Outcomes</span>
          <span>Next step</span>
        </div>
        {dashboard.applications.map((application) => (
          <article key={application.id} className="table-row">
            <div>
              <strong>{application.job?.title ?? "Unknown role"}</strong>
              <small>{application.job?.company}</small>
            </div>
            <label>
              <span className="sr-only">Status for {application.job?.title}</span>
              <select
                value={application.status}
                disabled={busy}
                onChange={(event) =>
                  onAct(
                    () =>
                      api(`/v1/applications/${application.id}/status`, {
                        method: "PUT",
                        body: JSON.stringify({ status: event.target.value }),
                      }),
                    "Application status updated.",
                  )
                }
              >
                <option value="tracked">Tracked</option>
                <option value="prepared">Prepared</option>
                <option value="approved_for_export">Approved for export</option>
                <option value="submitted_externally">Submitted externally</option>
                <option value="withdrawn">Withdrawn</option>
              </select>
            </label>
            <div className="outcome-chips">
              {application.outcomes?.length ? (
                application.outcomes.map((outcome) => (
                  <span key={outcome.id}>{human(outcome.type)}</span>
                ))
              ) : (
                <small>No outcome recorded</small>
              )}
            </div>
            <button
              className="button mini quiet"
              type="button"
              onClick={() => setOutcomeFor(outcomeFor === application.id ? null : application.id)}
            >
              <Plus size={15} /> Outcome
            </button>
            {outcomeFor === application.id && (
              <form
                className="outcome-form"
                onSubmit={(event) => submitOutcome(event, application.id)}
              >
                <select name="type">
                  <option value="reply">Reply</option>
                  <option value="screen">Screen</option>
                  <option value="interview">Interview</option>
                  <option value="offer">Offer</option>
                  <option value="rejection">Rejection</option>
                  <option value="withdrawal">Withdrawal</option>
                </select>
                <input name="note" placeholder="Optional note" />
                <button className="button mini primary" disabled={busy}>
                  Record
                </button>
              </form>
            )}
          </article>
        ))}
      </section>
      {dashboard.applications.length === 0 && (
        <Empty
          icon={BriefcaseBusiness}
          title="No applications tracked"
          copy="Choose Track from Role discovery when a position is worth pursuing."
        />
      )}
    </>
  );
}

function Packets({
  dashboard,
  onAct,
  busy,
}: {
  dashboard: Dashboard;
  onAct: ActionRunner;
  busy: boolean;
}) {
  const packetByApplication = new Map(
    dashboard.packets.map((packet) => [packet.applicationId, packet]),
  );
  return (
    <>
      <PageIntro
        eyebrow="Review packets"
        title="Generate once. Inspect every format."
        copy="Packets are assembled from confirmed evidence and locked authorization wording. Assurance runs before candidate approval."
      />
      <div className="packet-list">
        {dashboard.applications.map((application) => {
          const packet = packetByApplication.get(application.id);
          return (
            <article key={application.id} className="packet-row">
              <div className="packet-icon">
                <FileCheck2 />
              </div>
              <div>
                <span>{application.job?.company}</span>
                <h2>{application.job?.title}</h2>
                <small>{packet ? `Packet ${packet.id.slice(0, 8)}` : "No packet generated"}</small>
              </div>
              <div>
                {packet ? (
                  <span
                    className={`state ${packet.status === "approved" ? "supported" : packet.status === "assurance_blocked" ? "danger" : "warning"}`}
                  >
                    {human(packet.status)}
                  </span>
                ) : (
                  <span className="state muted">Not prepared</span>
                )}
              </div>
              <div className="packet-actions">
                {!packet ? (
                  <button
                    className="button mini primary"
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      onAct(
                        () =>
                          api("/v1/packets", {
                            method: "POST",
                            body: JSON.stringify({ applicationId: application.id }),
                          }),
                        "Packet generated in four formats.",
                      )
                    }
                  >
                    <FileOutput size={15} /> Generate
                  </button>
                ) : (
                  <>
                    <button
                      className="button mini quiet"
                      type="button"
                      disabled={busy || packet.status === "approved"}
                      onClick={() =>
                        onAct(
                          () => api(`/v1/packets/${packet.id}/assure`, { method: "POST" }),
                          "Assurance check complete.",
                        )
                      }
                    >
                      <ShieldCheck size={15} /> Assure
                    </button>
                    <button
                      className="button mini primary"
                      type="button"
                      disabled={busy || packet.status !== "assurance_passed"}
                      onClick={() =>
                        onAct(
                          () => api(`/v1/packets/${packet.id}/approve`, { method: "POST" }),
                          "Packet approved for export.",
                        )
                      }
                    >
                      <Check size={15} /> Approve
                    </button>
                  </>
                )}
              </div>
              {packet?.artifactManifest.artifacts && (
                <div className="artifact-links">
                  {packet.artifactManifest.artifacts.map((artifact) => (
                    <a
                      key={artifact.format}
                      href={`${API}/v1/packets/${packet.id}/artifacts/${artifact.format}`}
                      title={`SHA-256 ${artifact.sha256}`}
                    >
                      <Download size={14} /> {artifact.format.toUpperCase()}
                      <small>{artifact.sha256.slice(0, 12)}…</small>
                    </a>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </div>
      {dashboard.applications.length === 0 && (
        <Empty
          icon={FileOutput}
          title="Nothing to prepare yet"
          copy="Track an application first, then Nimanto can build its review packet."
        />
      )}
    </>
  );
}

function Actions({
  dashboard,
  onAct,
  busy,
}: {
  dashboard: Dashboard;
  onAct: ActionRunner;
  busy: boolean;
}) {
  const approvedPackets = dashboard.packets.filter((packet) => packet.status === "approved");
  const [open, setOpen] = useState(false);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    void onAct(
      () => api("/v1/actions", { method: "POST", body: JSON.stringify(data) }),
      "Action created and waiting for approval.",
    ).then(() => setOpen(false));
  };
  return (
    <>
      <PageIntro
        eyebrow="Approved actions"
        title="Nothing leaves without two keys."
        copy="Approve the exact action, then turn on the reset-on-restart execution switch. This beta offers only a user-opened mail link and a private local test outbox; connected accounts are not enabled."
        action={
          <button
            className="button primary"
            type="button"
            disabled={approvedPackets.length === 0}
            onClick={() => setOpen((value) => !value)}
          >
            <Plus size={16} /> Prepare action
          </button>
        }
      />
      <div className="runtime-gate">
        <div>
          <span
            className={
              dashboard.runtime.externalActionsEnabled ? "runtime-light on" : "runtime-light"
            }
          />
          <div>
            <strong>
              Execution runtime is {dashboard.runtime.externalActionsEnabled ? "on" : "off"}
            </strong>
            <p>It always starts off after the service restarts.</p>
          </div>
        </div>
        <button
          className={
            dashboard.runtime.externalActionsEnabled
              ? "button mini danger-button"
              : "button mini inverted"
          }
          type="button"
          disabled={busy}
          onClick={() =>
            onAct(
              () =>
                api("/v1/actions/runtime", {
                  method: "PUT",
                  body: JSON.stringify({ enabled: !dashboard.runtime.externalActionsEnabled }),
                }),
              dashboard.runtime.externalActionsEnabled
                ? "Execution switch turned off."
                : "Execution switch turned on for this runtime.",
            )
          }
        >
          {dashboard.runtime.externalActionsEnabled ? (
            <>
              <X size={15} /> Turn off
            </>
          ) : (
            <>
              <Play size={15} /> Turn on
            </>
          )}
        </button>
      </div>
      {open && (
        <form className="work-panel form-panel action-form" onSubmit={submit}>
          <div className="panel-heading">
            <div>
              <span>Exact handoff</span>
              <h2>Prepare an action</h2>
            </div>
          </div>
          <div className="field-grid">
            <label>
              Approved packet
              <select name="packetId">
                {approvedPackets.map((packet) => (
                  <option key={packet.id} value={packet.id}>
                    {packet.id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Provider
              <select name="provider">
                <option value="deep_link">Email deep link</option>
                <option value="test_outbox">Local test outbox</option>
              </select>
            </label>
            <label>
              Recipient
              <input name="to" type="email" required maxLength={254} />
            </label>
            <label>
              Subject
              <input name="subject" required maxLength={200} defaultValue="Application materials" />
            </label>
          </div>
          <label>
            Message
            <textarea
              name="body"
              required
              maxLength={20000}
              defaultValue="Please find my reviewed application materials attached separately."
            />
          </label>
          <button className="button primary" disabled={busy}>
            Create approval request
          </button>
        </form>
      )}
      <div className="action-list">
        {dashboard.externalActions.map((action) => (
          <article key={action.id} className="action-row">
            <div className="provider-mark">
              <MailCheck />
            </div>
            <div>
              <span>{human(action.provider)}</span>
              <strong>{action.payload.subject}</strong>
              <small>
                To: {action.target.to} · packet {action.packetId.slice(0, 8)}
              </small>
              <p className="action-message">{action.payload.body}</p>
            </div>
            <span
              className={`state ${action.state === "succeeded" ? "supported" : action.state === "failed" ? "danger" : "warning"}`}
            >
              {human(action.state)}
            </span>
            <div className="action-buttons">
              {action.state === "pending_approval" && (
                <>
                  <button
                    className="button mini primary"
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      onAct(
                        () => api(`/v1/actions/${action.id}/approve`, { method: "POST" }),
                        "Action approved. Execution is still separate.",
                      )
                    }
                  >
                    <Check size={15} /> Approve
                  </button>
                  <button
                    className="button mini quiet"
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      onAct(
                        () => api(`/v1/actions/${action.id}/cancel`, { method: "POST" }),
                        "Action cancelled.",
                      )
                    }
                  >
                    <X size={15} /> Cancel
                  </button>
                </>
              )}
              {action.state === "approved" && (
                <button
                  className="button mini primary"
                  type="button"
                  disabled={busy || !dashboard.runtime.externalActionsEnabled}
                  onClick={() =>
                    onAct(
                      () => api(`/v1/actions/${action.id}/execute`, { method: "POST" }),
                      action.provider === "deep_link"
                        ? "Email deep link prepared."
                        : "Approved action executed.",
                    )
                  }
                >
                  <Send size={15} /> Execute
                </button>
              )}
            </div>
            {action.result?.providerReference && (
              <code className="action-reference">{action.result.providerReference}</code>
            )}
          </article>
        ))}
      </div>
      {dashboard.externalActions.length === 0 && (
        <Empty
          icon={MailCheck}
          title="No actions prepared"
          copy="Approve a packet before creating a local test-outbox message or a user-opened email deep link. Connected-account sending remains outside this release."
        />
      )}
    </>
  );
}

function DataControls({
  dashboard,
  onAct,
  busy,
}: {
  dashboard: Dashboard;
  onAct: ActionRunner;
  busy: boolean;
}) {
  const [confirmation, setConfirmation] = useState("");
  const download = async () => {
    const response = await fetch(`${API}/v1/export`, { credentials: "include" });
    if (!response.ok) throw new Error("Export failed.");
    const url = URL.createObjectURL(await response.blob());
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "nimanto-export.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };
  return (
    <>
      <PageIntro
        eyebrow="Data controls"
        title="Take the record. Or erase it."
        copy="Export your workspace record and artifact manifests as JSON. Local deletion cascades through evidence, roles, packets, actions, sessions, and receipts."
      />
      <div className="data-grid">
        <section className="work-panel data-panel">
          <Download />
          <div>
            <span>Portable export</span>
            <h2>Download the workspace record</h2>
            <p>
              Includes {dashboard.evidence.length} evidence items, {dashboard.applications.length}{" "}
              applications, the local receipt trail, and packet manifests. Generated packet files
              remain available as individual downloads.
            </p>
          </div>
          <button
            className="button primary"
            type="button"
            disabled={busy}
            onClick={() => onAct(download, "Export downloaded.")}
          >
            <Download size={16} /> Download JSON
          </button>
        </section>
        <section className="work-panel data-panel danger-zone">
          <Trash2 />
          <div>
            <span>Immediate deletion</span>
            <h2>Delete this workspace</h2>
            <p>
              This cannot be undone. Packet files and local outbox files should also be removed from
              the data directory.
            </p>
          </div>
          <label>
            Type <code>DELETE MY NIMANTO DATA</code>
            <input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
          </label>
          <button
            className="button danger-button"
            type="button"
            disabled={busy || confirmation !== "DELETE MY NIMANTO DATA"}
            onClick={() =>
              onAct(
                () => api("/v1/data", { method: "DELETE", body: JSON.stringify({ confirmation }) }),
                "Workspace deleted.",
              )
            }
          >
            <Trash2 size={16} /> Delete all data
          </button>
        </section>
      </div>
      <section className="boundary-note">
        <ShieldCheck />
        <div>
          <h2>Beta boundary</h2>
          <p>
            The current beta is a local candidate tool. It is not an attorney, an employer screening
            system, or a guarantee that a company supports H-1B transfers today.
          </p>
        </div>
      </section>
    </>
  );
}
