import {
  ArrowRight,
  Check,
  FileCheck2,
  Fingerprint,
  GitBranch,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { Brand } from "../components/brand.js";
import { CommandPalette } from "../components/command-palette.js";

export default function Home() {
  const hosted = process.env.NIMANTO_GITHUB_PAGES === "true";
  const startHref = hosted
    ? "https://github.com/udhawan97/Nimanto#run-the-local-beta"
    : "./workspace/";
  return (
    <>
      <header className="site-header">
        <a href="#main" className="brand-link">
          <Brand />
        </a>
        <nav aria-label="Main navigation">
          <a href="#evidence">Method</a>
          <a href="#trust">Trust</a>
          <a href="https://github.com/udhawan97/Nimanto">GitHub</a>
        </nav>
        <CommandPalette hosted={hosted} />
      </header>

      <main id="main">
        <section className="hero shell">
          <div className="hero-copy">
            <p className="eyebrow">
              <span /> Local-first beta · candidate controlled
            </p>
            <div
              className="cultural-line"
              aria-label="From evidence to action; from evidence to progress"
            >
              <span lang="ja">証拠から、行動へ。</span>
              <i aria-hidden="true" />
              <span lang="hi">प्रमाण से, प्रगति तक।</span>
            </div>
            <h1>
              Evidence first.
              <br />
              Applications second.
            </h1>
            <p className="hero-lede">
              Build one verified career record, see exactly why a role fits, and approve every
              handoff yourself.
            </p>
            <div className="hero-actions">
              <a className="button primary" href={startHref}>
                {hosted ? "Run Nimanto locally" : "Open local workbench"} <ArrowRight size={17} />
              </a>
              <a className="button quiet" href="https://github.com/udhawan97/Nimanto">
                View source
              </a>
            </div>
            <p className="hero-note">
              <LockKeyhole size={15} /> Your evidence stays on the machine running Nimanto by
              default.
            </p>
          </div>

          <div className="evidence-rail" aria-label="Synthetic example of a live evidence trail">
            <span className="evidence-seal" lang="ja" aria-hidden="true">
              証
            </span>
            <svg className="jaali-ornament" viewBox="0 0 82 18" aria-hidden="true">
              <path d="m1 9 8-8 8 8-8 8Zm16 0 8-8 8 8-8 8Zm16 0 8-8 8 8-8 8Zm16 0 8-8 8 8-8 8Zm16 0 8-8 8 8-8 8Z" />
              <circle cx="41" cy="9" r="2.2" />
            </svg>
            <div className="rail-heading">
              <span>Synthetic example</span>
              <strong>Platform Engineer</strong>
            </div>
            <div className="rail-requirement">
              <span className="rail-index">01</span>
              <div>
                <small>Role requirement</small>
                <strong>TypeScript service delivery</strong>
              </div>
              <span className="state supported">
                <Check size={13} /> Supported
              </span>
            </div>
            <div className="rail-line" aria-hidden="true">
              <span />
            </div>
            <div className="rail-source">
              <FileCheck2 size={19} />
              <div>
                <small>Confirmed evidence</small>
                <strong>Led a typed service migration</strong>
                <span>Project record · source line 3</span>
              </div>
            </div>
            <div className="rail-line" aria-hidden="true">
              <span />
            </div>
            <div className="rail-decision">
              <GitBranch size={18} />
              <div>
                <small>Why it matters</small>
                <strong>Direct skills overlap, linked to one confirmed claim</strong>
              </div>
            </div>
          </div>
        </section>

        <section id="evidence" className="method shell" aria-labelledby="method-title">
          <div className="method-intro">
            <div className="section-number">01 / Method</div>
            <p className="jp-caption" lang="ja">
              記録を確かめる
            </p>
            <h2 id="method-title">A career record you can inspect.</h2>
            <p>
              Nimanto keeps source, claim, role requirement, and output connected. Nothing becomes
              “verified” merely because a parser or model said so.
            </p>
          </div>
          <div className="method-steps">
            <article>
              <span>01</span>
              <div>
                <h3>Collect</h3>
                <p>
                  Import TXT, Markdown, JSON, DOCX, a text-layer PDF, or approved fields from a
                  downloaded LinkedIn archive. Messages and contacts are ignored; macros, embedded
                  objects, image-only scans, and prohibited legal documents fail closed. New claims
                  wait for your confirmation.
                </p>
              </div>
            </article>
            <article>
              <span>02</span>
              <div>
                <h3>Compare</h3>
                <p>
                  Run deterministic matching with visible requirements, evidence links, blockers,
                  and coverage limits.
                </p>
              </div>
            </article>
            <article>
              <span>03</span>
              <div>
                <h3>Prepare</h3>
                <p>
                  Generate reviewable JSON/text plus modern and ATS-safe DOCX/PDF packets from
                  confirmed evidence only.
                </p>
              </div>
            </article>
            <article>
              <span>04</span>
              <div>
                <h3>Approve</h3>
                <p>
                  Pass assurance, approve the packet, approve the handoff, then enable the execution
                  switch.
                </p>
              </div>
            </article>
          </div>
        </section>

        <section id="trust" className="trust-band">
          <div className="shell trust-grid">
            <div>
              <p className="eyebrow inverted">
                <span /> Product boundary
              </p>
              <p className="jp-caption inverted" lang="ja">
                候補者のための道具
              </p>
              <h2>Built for the candidate’s side of the table.</h2>
            </div>
            <div className="trust-points">
              <p>
                <ShieldCheck />
                <span>
                  <strong>No employer screening.</strong> Nimanto does not rank people for employers
                  or estimate hiring probability.
                </span>
              </p>
              <p>
                <Fingerprint />
                <span>
                  <strong>No hidden verification.</strong> Imported claims remain pending until the
                  candidate confirms them.
                </span>
              </p>
              <p>
                <LockKeyhole />
                <span>
                  <strong>No silent send.</strong> External actions need assurance, packet approval,
                  action approval, and a live runtime switch.
                </span>
              </p>
            </div>
          </div>
        </section>

        <section className="scope shell" aria-labelledby="scope-title">
          <div>
            <div className="section-number">02 / Beta scope</div>
            <h2 id="scope-title">Useful now. Honest about what comes next.</h2>
            <p>
              The local beta includes the core workbench and provider seams. Hosted identity,
              production legal review, and signed desktop distribution remain explicit release
              gates.
            </p>
          </div>
          <a className="text-link" href="https://github.com/udhawan97/Nimanto#beta-boundaries">
            Read beta boundaries <ArrowRight size={16} />
          </a>
        </section>
      </main>

      <footer className="site-footer shell">
        <Brand />
        <p>
          Your career record stays yours.
          <small>
            <span lang="ja">記録は、あなたのもの。</span>
            <i aria-hidden="true">·</i>
            <span lang="hi">रिकॉर्ड आपका है।</span>
          </small>
        </p>
        <div>
          <a href="https://github.com/udhawan97/Nimanto">Source</a>
          <a href="https://github.com/udhawan97/Nimanto/blob/main/SECURITY.md">Security</a>
          <a href="https://github.com/udhawan97/Nimanto/blob/main/LICENSE">Apache-2.0</a>
        </div>
      </footer>
    </>
  );
}
