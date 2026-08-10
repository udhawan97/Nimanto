import { ArrowRight, ArrowUpRight, Check, FileCheck2, GitBranch } from "lucide-react";
import { Brand } from "../components/brand.js";
import { CommandPalette } from "../components/command-palette.js";
import { CopyLine } from "../components/copy-line.js";
import { Emblem } from "../components/emblem.js";

const METHOD = [
  {
    step: "01",
    title: "Collect",
    body: "Import TXT, Markdown, JSON, DOCX, a text-layer PDF, or approved fields from a downloaded LinkedIn archive. Messages and contacts are ignored. Macros, embedded objects and image-only scans fail closed. Every new claim waits for you.",
  },
  {
    step: "02",
    title: "Compare",
    body: "Narrow roles with private, unsaved filters, then inspect deterministic matching against confirmed evidence only. Four documented dimensions, requirement by requirement, with coverage limits and blockers left visible rather than averaged away.",
  },
  {
    step: "03",
    title: "Prepare",
    body: "Inspect canonical claims, authorization wording, format checks and stored assurance findings before reviewable JSON, text, modern and ATS-safe DOCX/PDF leave the workbench.",
  },
  {
    step: "04",
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
    body: "Application timelines contain only what you recorded. A gap is not a rejection, a delay, or a prediction.",
  },
];

export default function Home() {
  const hosted = process.env.NIMANTO_GITHUB_PAGES === "true";
  const startHref = hosted ? "https://github.com/udhawan97/Nimanto#run-it" : "./workspace/";

  return (
    <>
      <header className="site-header">
        <a href="#main" className="brand-link">
          <Brand />
        </a>
        <nav aria-label="Main navigation">
          <a href="#method">Method</a>
          <a href="#boundary">Boundary</a>
          <a href="#run">Run it</a>
          <a href="https://github.com/udhawan97/Nimanto">GitHub</a>
        </nav>
        <CommandPalette hosted={hosted} />
      </header>

      <main id="main">
        {/* 00 — the mark is the page */}
        <section className="hero" aria-labelledby="hero-title">
          <Emblem />
          <div className="hero-copy">
            <h1 id="hero-title">Nimanto</h1>
            <p className="hero-line">
              An invitation you open yourself. Nothing goes out until you say so.
            </p>
            <div className="hero-actions">
              <a className="button primary" href={startHref}>
                {hosted ? "Run it locally" : "Open the workbench"} <ArrowRight size={16} />
              </a>
              <a className="button quiet" href="https://github.com/udhawan97/Nimanto">
                View source <ArrowUpRight size={15} />
              </a>
            </div>
          </div>
          <a className="scroll-cue" href="#thesis" aria-label="Scroll to the introduction">
            <span />
          </a>
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
                half-finished forms. Nimanto gives that work one inspectable path: build a verified
                career record once, see exactly why a role fits, and approve every handoff yourself.
              </p>
              <p className="quiet">
                It is a candidate tool. It does not screen you for employers, guess your odds, or
                promise that a company sponsors transfers today.
              </p>
            </div>
          </div>
        </section>

        {/* 02 — method, four plates on one brass spine */}
        <section id="method" className="band method" aria-labelledby="method-title">
          <div className="shell">
            <div className="band-head flow">
              <p className="placard">02 — Method</p>
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

        {/* 03 — the rail: one worked example, drawn */}
        <section className="band rail-band" aria-labelledby="rail-title">
          <div className="shell rail-grid">
            <div className="band-head flow">
              <p className="placard">03 — Worked example</p>
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

        {/* 04 — boundary: the only large light field in the system */}
        <section id="boundary" className="band boundary" aria-labelledby="boundary-title">
          <div className="shell flow">
            <p className="placard">04 — Boundary</p>
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

        {/* 05 — run it */}
        <section id="run" className="band run" aria-labelledby="run-title">
          <div className="shell run-grid">
            <div className="band-head flow">
              <p className="placard">05 — Run it</p>
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
              <a className="text-link" href="https://github.com/udhawan97/Nimanto#beta-boundaries">
                Read the beta boundaries <ArrowRight size={15} />
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
            <a href="https://github.com/udhawan97/Nimanto/blob/main/LICENSE">Apache-2.0</a>
          </nav>
          <p className="placard">Private by default · Candidate controlled</p>
        </div>
      </footer>
    </>
  );
}
