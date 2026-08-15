"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Command, Search, X } from "lucide-react";

/* A palette entry is a destination, never an action.
 *
 * Site entries carry an href; workbench entries carry a section id that the
 * workspace maps to setSection. Neither shape can hold a callback, which is the
 * point: Nimanto gates packet approval, action approval, the runtime switch and
 * deletion behind explicit affordances, and "the palette only navigates" has to
 * be a property of the type rather than a promise in a comment. */
export type PaletteEntry = {
  label: string;
  detail: string;
  href?: string;
  section?: string;
};

const siteCommands: PaletteEntry[] = [
  { label: "How the method works", detail: "Collect, compare, prepare, approve", href: "#method" },
  { label: "What Nimanto refuses to do", detail: "The product boundary", href: "#boundary" },
  { label: "Run it locally", detail: "Clone, install, start", href: "#run" },
  {
    label: "Read the source",
    detail: "Apache-2.0 on GitHub",
    href: "https://github.com/udhawan97/Nimanto",
  },
];

export function CommandPalette({
  hosted = false,
  entries,
  onNavigate,
  label = "Navigate",
}: {
  hosted?: boolean;
  /** Workbench entries. When omitted the palette serves the public site. */
  entries?: PaletteEntry[];
  /** Receives a section id. The only thing an entry can ask for. */
  onNavigate?: (section: string) => void;
  label?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);

  const commands: PaletteEntry[] = entries ?? [
    {
      label: hosted ? "Run the local beta" : "Open the workbench",
      detail: hosted ? "Read the private setup guide" : "Run the private local beta",
      href: hosted ? "https://github.com/udhawan97/Nimanto#run-the-local-beta" : "./workspace/",
    },
    ...siteCommands,
  ];

  const filtered = commands.filter((item) =>
    `${item.label} ${item.detail}`
      .toLocaleLowerCase("en-US")
      .includes(query.toLocaleLowerCase("en-US")),
  );

  const show = () => {
    if (dialog.current?.open) {
      input.current?.focus();
      return;
    }
    setQuery("");
    setActive(0);
    setOpen(true);
    dialog.current?.showModal();
    requestAnimationFrame(() => input.current?.focus());
  };

  const close = () => {
    setOpen(false);
    if (dialog.current?.open) dialog.current.close();
  };

  const choose = (entry: PaletteEntry | undefined) => {
    if (!entry) return;
    if (entry.section && onNavigate) {
      onNavigate(entry.section);
      close();
      return;
    }
    if (entry.href) location.href = entry.href;
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase("en-US") === "k") {
        event.preventDefault();
        show();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <button
        className="command-trigger"
        type="button"
        onClick={show}
        aria-label="Open quick navigation"
      >
        <Search size={15} aria-hidden="true" />
        <span>{label}</span>
        <kbd>
          <Command size={12} aria-label="Command" />K
        </kbd>
      </button>
      <dialog
        className="command-dialog"
        ref={dialog}
        onClose={() => setOpen(false)}
        onClick={(event) => event.target === dialog.current && close()}
      >
        <div className="command-panel">
          <div className="command-search">
            <Search size={19} aria-hidden="true" />
            <input
              ref={input}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setActive((value) => Math.min(value + 1, filtered.length - 1));
                }
                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setActive((value) => Math.max(value - 1, 0));
                }
                if (event.key === "Enter") {
                  event.preventDefault();
                  choose(filtered[active]);
                }
                if (event.key === "Escape") close();
              }}
              placeholder="Where do you want to go?"
              aria-label="Search Nimanto"
            />
            <button
              type="button"
              className="icon-button"
              onClick={close}
              aria-label="Close quick navigation"
            >
              <X size={18} />
            </button>
          </div>
          {/* Rendered only while open. A closed palette that still held an index
           * of every claim would put unconfirmed evidence text in the DOM. */}
          {open && (
            <div className="command-results" role="listbox" aria-label="Navigation results">
              {filtered.map((item, index) => (
                <a
                  key={`${item.section ?? item.href}-${item.label}`}
                  href={item.href ?? "#"}
                  className={index === active ? "command-result is-active" : "command-result"}
                  role="option"
                  aria-selected={index === active}
                  onMouseEnter={() => setActive(index)}
                  onClick={(event) => {
                    if (!item.section) return;
                    event.preventDefault();
                    choose(item);
                  }}
                >
                  <span>{item.label}</span>
                  <small>{item.detail}</small>
                  <ArrowRight size={16} aria-hidden="true" />
                </a>
              ))}
              {filtered.length === 0 && <p className="command-empty">Nothing matches that.</p>}
            </div>
          )}
        </div>
      </dialog>
    </>
  );
}
