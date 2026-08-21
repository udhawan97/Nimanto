import { ArrowRight, ArrowUpRight, Check, FileCheck2, GitBranch } from "lucide-react";
import { Brand } from "../components/brand.js";
import { CommandPalette } from "../components/command-palette.js";
import { CopyLine } from "../components/copy-line.js";
import { Emblem } from "../components/emblem.js";

const METHOD = [
  {
    step: "01",
    title: "Collect",
    body: "Review the exact bounded claim projection from TXT, Markdown, JSON, DOCX, a text-layer PDF, or approved LinkedIn archive fields. A changed preview or interrupted commit writes nothing; every new claim still waits for you.",
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
    body: "Pass assurance, approve the packet, approve the exact action, then turn on a runtime switch that resets itself off. Hash-checked local receipts preserve the thread without claiming an employer received it.",
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
    body: "Nothing leaves this machine without assurance, a packet approval, an action approval, and a live switch.",
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
          <a href="https://github.com/udhawan97/Nimanto">GitHub</a>
        </nav>
        <CommandPalette hosted={hosted} />
      </header>

      <main id="main">
        {/* 00 — the invitation opens toward the literal product job. */}
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="placard">Source-distributed local beta · v0.5.1</p>
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
              <a className="button quiet" href="https://github.com/udhawan97/Nimanto/releases">
                Source releases <ArrowUpRight size={15} />
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
                Applications opens on the record you can work: choose only a legal candidate move,
                explicitly confirm a consequential one, record an outcome from either view, or
                return to a role. The API checks the same transition before it commits.
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
                v0.5.1 · server-confirmed Applications · synthetic local workspace
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
          <div className="shell run-grid">
            <div className="band-head flow">
              <p className="placard">06 — Run it</p>
              <h2 id="run-title">Local, and yours.</h2>
              <p className="band-lede">
                Node 24–26 and pnpm 11 on macOS, Linux or Windows. Your evidence stays on the
                machine running Nimanto. There is no hosted backend to opt out of.
              </p>
            </div>
            <div className="run-block flow">
              <CopyLine command="git clone https://github.com/udhawan97/Nimanto.git" />
              <CopyLine command="cd Nimanto && corepack enable" />
              <CopyLine command="pnpm install --frozen-lockfile && pnpm dev" />
              <p className="run-note">
                On macOS you can instead double-click <code>START-NIMANTO.command</code>. It
                installs the locked dependencies, starts the local services, and opens the
                workbench.
              </p>
              <p className="run-note">
                Nimanto is source-distributed. v0.5.1 does not ship a signed installer or desktop
                binary.
              </p>
              <a className="text-link" href="https://github.com/udhawan97/Nimanto/releases">
                Open source releases <ArrowRight size={15} />
              </a>
              <a className="text-link" href="https://github.com/udhawan97/Nimanto#beta-boundaries">
                Read the beta boundaries <ArrowRight size={15} />
              </a>
              <a
                className="text-link"
                href="https://github.com/udhawan97/Nimanto/blob/main/docs/releases/v0.5.1.md"
              >
                Read the v0.5.1 release notes <ArrowRight size={15} />
              </a>
            </div>
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
            <a href="https://github.com/udhawan97/Nimanto/blob/main/docs/releases/v0.5.1.md">
              v0.5.1 notes
            </a>
            <a href="https://github.com/udhawan97/Nimanto/blob/main/LICENSE">Apache-2.0</a>
          </nav>
          <p className="placard">Private by default · Candidate controlled</p>
        </div>
      </footer>
    </>
  );
}
