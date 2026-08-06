"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Command, Search, X } from "lucide-react";

const baseCommands = [
  {
    label: "See how evidence works",
    detail: "Verified claims and source locators",
    href: "#evidence",
  },
  {
    label: "Review safety boundaries",
    detail: "No employer screening or outcome promises",
    href: "#trust",
  },
  {
    label: "Read the source",
    detail: "Apache-2.0 on GitHub",
    href: "https://github.com/udhawan97/Nimanto",
  },
];

export function CommandPalette({ hosted = false }: { hosted?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const commands = [
    {
      label: hosted ? "Run the local beta" : "Open the workbench",
      detail: hosted ? "Read the private setup guide" : "Run the private local beta",
      href: hosted ? "https://github.com/udhawan97/Nimanto#run-the-local-beta" : "./workspace/",
    },
    ...baseCommands,
  ];
  const filtered = commands.filter((item) =>
    `${item.label} ${item.detail}`
      .toLocaleLowerCase("en-US")
      .includes(query.toLocaleLowerCase("en-US")),
  );

  const open = () => {
    setQuery("");
    setActive(0);
    dialog.current?.showModal();
    requestAnimationFrame(() => input.current?.focus());
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase("en-US") === "k") {
        event.preventDefault();
        open();
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
        onClick={open}
        aria-label="Open quick navigation"
      >
        <Search size={15} aria-hidden="true" />
        <span>Navigate</span>
        <kbd>
          <Command size={12} aria-label="Command" />K
        </kbd>
      </button>
      <dialog
        className="command-dialog"
        ref={dialog}
        onClick={(event) => event.target === dialog.current && dialog.current?.close()}
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
                if (event.key === "Enter" && filtered[active])
                  location.href = filtered[active].href;
                if (event.key === "Escape") dialog.current?.close();
              }}
              placeholder="Where do you want to go?"
              aria-label="Search Nimanto"
            />
            <button
              type="button"
              className="icon-button"
              onClick={() => dialog.current?.close()}
              aria-label="Close quick navigation"
            >
              <X size={18} />
            </button>
          </div>
          <div className="command-results" role="listbox" aria-label="Navigation results">
            {filtered.map((item, index) => (
              <a
                key={item.href}
                href={item.href}
                className={index === active ? "command-result is-active" : "command-result"}
                role="option"
                aria-selected={index === active}
                onMouseEnter={() => setActive(index)}
              >
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.detail}</small>
                </span>
                <ArrowRight size={17} aria-hidden="true" />
              </a>
            ))}
          </div>
        </div>
      </dialog>
    </>
  );
}
