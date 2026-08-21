import {
  Apple,
  ArrowRight,
  ArrowUpRight,
  Check,
  Container,
  FileCheck2,
  GitBranch,
  LifeBuoy,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import { Brand } from "../components/brand.js";
import { CommandPalette } from "../components/command-palette.js";
import { CopyLine } from "../components/copy-line.js";
import { Emblem } from "../components/emblem.js";

const METHOD = [
  {
    step: "01",
    title: "Collect",
    body: "Review the exact bounded claim projection from TXT, Markdown, JSON, DOCX, a text-layer PDF, or approved LinkedIn archive fields. Evidence fields stay with the signed-in tab while you move between sections; every new claim still waits for you.",
  },
  {
    step: "02",
    title: "Compare",
    body: "Bring manual, allowlisted URL, Greenhouse, Lever, and Ashby roles into one normalized current-record shape, then publish deterministic matching against one exact profile version and job-content snapshot. Four documented dimensions keep coverage limits and blockers visible.",
  },
  {
    step: "03",
    title: "Remember",
    body: "Review application records after 336 quiet hours, count explicit creation-time cohorts, and inspect retained profile, match, packet and assurance history. The workbench shows literal stored values without inventing a cause or employer outcome.",
  },
  {
    step: "04",
    title: "Prepare",
    body: "Inspect canonical claims, authorization wording, format checks and assurance bound to the exact frozen artifact and manifest before reviewable JSON, text, modern and ATS-safe DOCX/PDF leave the workbench.",
  },
  {
    step: "05",
    title: "Approve",
    body: "Pass assurance, approve the current packet, approve the exact action, then turn on a runtime switch that resets itself off. A newer packet retires older handoffs before they can run, and hash-checked local receipts never claim an employer received it.",
  },
];

const BOUNDARY = [
  {
    title: "No employer screening.",
    body: "Nimanto never ranks people for employers and never estimates anyone’s hiring probability.",
  },
  {
    title: "No hidden verification.",
    body: "An imported claim stays pending until you confirm it. A parser saying so is not evidence.",
  },
  {
    title: "No silent send.",
    body: "Nothing leaves this machine without assurance, approval of the current packet, an exact action approval, and a live switch.",
  },
  {
    title: "No invented history.",
    body: "Application timelines and retained comparisons contain only stored records. A gap or difference is not a rejection, a cause, or a prediction.",
  },
];

export default function Home() {
  const hosted = process.env.NIMANTO_GITHUB_PAGES === "true";
  const startHref = hosted ? "https://github.com/udhawan97/Nimanto#run-it" : "./workspace/";
  const assetBase = hosted ? "/Nimanto" : "";

  return (
    <>
      <header className="site-header">
        <a href="#main" className="brand-link">
          <Brand />
        </a>
        <nav aria-label="Main navigation">
          <a href="#workbench">Workbench</a>
          <a href="#method">Method</a>
          <a href="#boundary">Boundary</a>
          <a href="#run">Run it</a>
          <a href="#help">Help</a>
          <a href="https://github.com/udhawan97/Nimanto">GitHub</a>
        </nav>
        <CommandPalette hosted={hosted} />
      </header>

      <main id="main">
        {/* 00 — the invitation opens toward the literal product job. */}
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="placard">Source-distributed local beta · v0.5.4</p>
            <h1 id="hero-title">Nimanto</h1>
            <h2>Build the evidence. Work the application. Keep the truth yours.</h2>
            <p className="hero-line">
              A local-first workbench for H-1B professionals: compare roles to confirmed career
              evidence, track candidate-reported outcomes, and approve every handoff yourself.
            </p>
            <ul className="hero-boundaries" aria-label="Product boundaries">
              <li>Local-first</li>
              <li>Candidate controlled</li>
              <li>No silent send</li>
            </ul>
            <div className="hero-actions">
              <a className="button primary" href={startHref}>
                {hosted ? "Run locally" : "Open the workbench"} <ArrowRight size={16} />
              </a>
              <a className="button quiet" href="https://github.com/udhawan97/Nimanto">
                View source <ArrowUpRight size={15} />
              </a>
              <a
                className="button quiet"
                href="https://github.com/udhawan97/Nimanto/releases/latest"
              >
                Releases &amp; checksums <ArrowUpRight size={15} />
              </a>
            </div>
          </div>
          <div className="hero-emblem" aria-hidden="true">
            <Emblem />
            <span className="invitation-thread" />
          </div>
        </section>

        {/* 01 — thesis */}
        <section id="thesis" className="band thesis" aria-labelledby="thesis-title">
          <div className="shell thesis-grid">
            <p className="placard">01 — Thesis</p>
            <h2 id="thesis-title" className="display">
              Evidence first.
              <br />
              <em>Applications second.</em>
            </h2>
            <div className="thesis-body flow">
              <p>
                A job search usually becomes a pile of resumes, saved roles, sponsorship rumours and
                half-finished forms. Nimanto gives that work one inspectable path: build a confirmed
                career record once, see exactly why a role fits, compare what you actually stored,
                and approve every handoff yourself.
              </p>
              <p className="quiet">
                It is a candidate tool. It does not screen you for employers, guess your odds, or
                promise that a company sponsors transfers today.
              </p>
            </div>
          </div>
        </section>

        {/* 02 — current synthetic runtime evidence */}
        <section id="workbench" className="band proof" aria-labelledby="workbench-title">
          <div className="shell proof-grid">
            <div className="band-head flow">
              <p className="placard">02 — Workbench</p>
              <h2 id="workbench-title">The next action comes before the analytics.</h2>
              <p className="band-lede">
                Applications opens on the record you can work. Draft actions, outcomes, filters, and
                review inputs stay in the signed-in tab while you move between sections; slow saves
                preserve newer typing, and an identity change clears the old workspace first.
              </p>
              <p className="quiet">
                The screen is synthetic current-runtime evidence. Outcomes are records entered by
                the candidate—not inferred employer state.
              </p>
            </div>
            <figure className="workbench-proof">
              <img
                src={`${assetBase}/assets/nimanto-workbench.png`}
                width="1440"
                height="900"
                loading="lazy"
                alt="Synthetic Nimanto Applications workbench with the action-first pipeline and Record outcome controls"
              />
              <figcaption>
                v0.5.4 · server-confirmed Applications · synthetic local workspace
              </figcaption>
            </figure>
          </div>
        </section>

        {/* 03 — method, five plates on one brass spine */}
        <section id="method" className="band method" aria-labelledby="method-title">
          <div className="shell">
            <div className="band-head flow">
              <p className="placard">03 — Method</p>
              <h2 id="method-title">A career record you can inspect.</h2>
              <p className="band-lede">
                Source, claim, requirement and output stay connected end to end. Nothing becomes
                verified merely because a parser or a model said so.
              </p>
            </div>
            <ol className="spine">
              {METHOD.map((entry) => (
                <li key={entry.step}>
                  <span className="spine-step">{entry.step}</span>
                  <div className="spine-body flow">
                    <h3>{entry.title}</h3>
                    <p>{entry.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* 04 — the rail: one worked example, drawn */}
        <section className="band rail-band" aria-labelledby="rail-title">
          <div className="shell rail-grid">
            <div className="band-head flow">
              <p className="placard">04 — Worked example</p>
              <h2 id="rail-title">Every match shows its work.</h2>
              <p className="band-lede">
                A requirement is only supported when a confirmed claim supports it, and the link
                between the two is drawn rather than implied.
              </p>
            </div>

            <figure className="rail" aria-label="Synthetic example of an explained match">
              <figcaption>
                <span className="placard">Synthetic example</span>
                <strong>Platform Engineer · Northwind</strong>
              </figcaption>

              <div className="rail-node">
                <span className="rail-index">01</span>
                <div className="flow-tight">
                  <p className="placard">Role requirement</p>
                  <strong>TypeScript service delivery</strong>
                </div>
                <span className="chip ok">
                  <Check size={13} /> Supported
                </span>
              </div>

              <div className="rail-link" aria-hidden="true">
                <span />
              </div>

              <div className="rail-node">
                <FileCheck2 size={18} aria-hidden="true" />
                <div className="flow-tight">
                  <p className="placard">Confirmed evidence</p>
                  <strong>Led a typed service migration</strong>
                  <p className="rail-source">Project record · source line 3</p>
                </div>
              </div>

              <div className="rail-link" aria-hidden="true">
                <span />
              </div>

              <div className="rail-node">
                <GitBranch size={18} aria-hidden="true" />
                <div className="flow-tight">
                  <p className="placard">Why it matters</p>
                  <strong>Direct skills overlap, linked to one confirmed claim</strong>
                </div>
              </div>

              <div className="rail-node is-blocked">
                <span className="rail-index">02</span>
                <div className="flow-tight">
                  <p className="placard">Visible blocker</p>
                  <strong>Posting states no sponsorship of any kind</strong>
                </div>
                <span className="chip live">Blocker</span>
              </div>
            </figure>
          </div>
        </section>

        {/* 05 — boundary: the only large light field in the system */}
        <section id="boundary" className="band boundary" aria-labelledby="boundary-title">
          <div className="shell flow">
            <p className="placard">05 — Boundary</p>
            <h2 id="boundary-title" className="display-s">
              What Nimanto refuses to do.
            </h2>
            <ul className="refusals">
              {BOUNDARY.map((entry) => (
                <li key={entry.title} className="flow-tight">
                  <strong>{entry.title}</strong>
                  <p>{entry.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 06 — run it */}
        <section id="run" className="band run" aria-labelledby="run-title">
          <div className="shell flow">
            <div className="band-head flow">
              <p className="placard">06 — Run it</p>
              <h2 id="run-title">Choose how to start.</h2>
              <p className="band-lede">
                Node 24–26 and pnpm 11 on macOS, Linux or Windows. Your evidence stays on the
                machine running Nimanto. There is no hosted backend to opt out of.
              </p>
            </div>
            <div className="run-paths" aria-label="Ways to run Nimanto">
              <article className="run-path flow-tight">
                <Apple aria-hidden="true" />
                <p className="placard">macOS</p>
                <h3>Double-click launcher</h3>
                <p>
                  Clone or download the source, then open <code>START-NIMANTO.command</code>.
                </p>
                <small>Node 24–26 · pnpm 11 · unsigned source launcher</small>
              </article>
              <article className="run-path flow-tight">
                <Terminal aria-hidden="true" />
                <p className="placard">macOS · Linux · Windows</p>
                <h3>Terminal</h3>
                <p>Install the exact locked graph and start the local API, worker, and website.</p>
                <small>Node 24–26 · pnpm 11 · loopback services</small>
              </article>
              <article className="run-path flow-tight">
                <Container aria-hidden="true" />
                <p className="placard">Self-hosted QA</p>
                <h3>Docker on loopback</h3>
                <p>
                  Build the source image with demo login off and data in a named private volume.
                </p>
                <small>Ports stay bound to 127.0.0.1 · not internet-certified</small>
              </article>
            </div>
            <div className="run-grid">
              <div className="run-block flow">
                <p className="placard">Terminal start</p>
                <CopyLine command="git clone https://github.com/udhawan97/Nimanto.git" />
                <CopyLine command="cd Nimanto && git checkout v0.5.4" />
                <CopyLine command="corepack enable && pnpm install --frozen-lockfile && pnpm dev" />
                <p className="run-note">
                  Open the private workspace URL printed by the API. Its launch key stays in the URL
                  fragment only long enough for the workbench to capture and remove it.
                </p>
              </div>
              <aside className="release-proof flow" aria-labelledby="release-proof-title">
                <ShieldCheck aria-hidden="true" />
                <p className="placard">Source release · v0.5.4</p>
                <h3 id="release-proof-title">Verify the published inventories.</h3>
                <p>
                  Nimanto publishes CycloneDX and SPDX inventories with a SHA-256 manifest covering
                  those two files. GitHub generates the tag archives; the manifest does not
                  authenticate them, and Nimanto ships no signed installer or desktop binary.
                </p>
                <a
                  className="text-link"
                  href="https://github.com/udhawan97/Nimanto/releases/tag/v0.5.4"
                >
                  Open the v0.5.4 source release <ArrowRight size={15} />
                </a>
                <a
                  className="text-link"
                  href="https://github.com/udhawan97/Nimanto/blob/v0.5.4/docs/releases/v0.5.4.md"
                >
                  Read the v0.5.4 notes <ArrowRight size={15} />
                </a>
                <a
                  className="text-link"
                  href="https://github.com/udhawan97/Nimanto/blob/v0.5.4/README.md#verify-a-source-release"
                >
                  Check hashes and inventories <ArrowRight size={15} />
                </a>
              </aside>
            </div>
          </div>
        </section>

        <section id="help" className="band help" aria-labelledby="help-title">
          <div className="shell help-grid">
            <div className="band-head flow">
              <p className="placard">07 — Help</p>
              <h2 id="help-title">If the local path breaks, start with evidence.</h2>
              <p className="band-lede">
                The operations guide names the launch-key, port, backup, provider, and recovery
                boundaries. Security reports have a separate private route.
              </p>
            </div>
            <nav className="help-links" aria-label="Help and continuation">
              <a href="https://github.com/udhawan97/Nimanto/blob/main/docs/operations/local-beta.md">
                <LifeBuoy aria-hidden="true" />
                <span>
                  <strong>Run and troubleshoot</strong>
                  <small>Local setup, backup, invitation, and recovery</small>
                </span>
                <ArrowUpRight aria-hidden="true" />
              </a>
              <a href="https://github.com/udhawan97/Nimanto/blob/main/SECURITY.md">
                <ShieldCheck aria-hidden="true" />
                <span>
                  <strong>Report a security issue</strong>
                  <small>Use the private disclosure path, not a public issue</small>
                </span>
                <ArrowUpRight aria-hidden="true" />
              </a>
              <a href="https://github.com/udhawan97/Nimanto/issues">
                <GitBranch aria-hidden="true" />
                <span>
                  <strong>Inspect or report a bug</strong>
                  <small>Public product issues and reproducible failures</small>
                </span>
                <ArrowUpRight aria-hidden="true" />
              </a>
            </nav>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="shell site-footer-grid">
          <div className="flow-tight">
            <Brand />
            <p>Your career record stays yours.</p>
          </div>
          <nav aria-label="Footer">
            <a href="https://github.com/udhawan97/Nimanto">Source</a>
            <a href="https://github.com/udhawan97/Nimanto/blob/main/SECURITY.md">Security</a>
            <a href="https://github.com/udhawan97/Nimanto/blob/main/docs/operations/local-beta.md">
              Operations
            </a>
            <a href="https://github.com/udhawan97/Nimanto/blob/v0.5.4/docs/releases/v0.5.4.md">
              v0.5.4 notes
            </a>
            <a href="https://github.com/udhawan97/Nimanto/blob/main/LICENSE">Apache-2.0</a>
          </nav>
          <p className="placard">Private by default · Candidate controlled</p>
        </div>
      </footer>
    </>
  );
}
