export type Section =
  | "overview"
  | "evidence"
  | "jobs"
  | "applications"
  | "packets"
  | "history"
  | "actions"
  | "activity"
  | "data";

const SECTIONS: readonly Section[] = [
  "overview",
  "evidence",
  "jobs",
  "applications",
  "packets",
  "history",
  "actions",
  "activity",
  "data",
];

export function sectionFromHash(hash: string): Section | null {
  if (!/^#[a-z]+$/u.test(hash)) return null;
  const value = hash.slice(1) as Section;
  return SECTIONS.includes(value) ? value : null;
}

export function sectionHash(section: Section): string {
  return `#${section}`;
}

type NavigationAdapters = {
  routeReady: () => boolean;
  currentHash: () => string;
  writeHash: (hash: string) => void;
  setSection: (section: Section) => void;
  clearNotice: () => void;
  setMobileOpen: (open: boolean) => void;
  schedule: (work: () => void) => void;
  focusSection: () => void;
  focusMenu: () => void;
  focusNotice: () => void;
};

/** Browser-local routing and focus ordering, without credential handling. */
export function createWorkspaceNavigationTransitions(adapters: NavigationAdapters) {
  return {
    go(section: Section): void {
      adapters.setSection(section);
      adapters.clearNotice();
      adapters.setMobileOpen(false);
      if (adapters.routeReady() && sectionFromHash(adapters.currentHash()) !== section) {
        adapters.writeHash(sectionHash(section));
      }
      adapters.schedule(adapters.focusSection);
    },

    restore(hash: string): void {
      adapters.setSection(sectionFromHash(hash) ?? "overview");
      adapters.clearNotice();
      adapters.schedule(adapters.focusSection);
    },

    closeMobile(): void {
      adapters.setMobileOpen(false);
      adapters.schedule(adapters.focusMenu);
    },

    openMobile(): void {
      adapters.setMobileOpen(true);
    },

    closeForDesktop(): void {
      adapters.setMobileOpen(false);
    },

    presentGlobalError(): void {
      adapters.schedule(adapters.focusNotice);
    },

    scheduleFocus(work: () => void): void {
      adapters.schedule(work);
    },
  };
}

export function focusSectionBelowHeader(input: {
  target: HTMLElement | null;
  header: HTMLElement | null;
  root: HTMLElement;
  scrollY: number;
  scrollTo: (top: number) => void;
  scrollBy: (delta: number) => void;
  schedule: (work: () => void) => void;
}): void {
  const target = input.target;
  if (!target) return;
  target.focus({ preventScroll: true });
  const targetTop = input.scrollY + target.getBoundingClientRect().top;
  const previousScrollBehavior = input.root.style.scrollBehavior;
  input.root.style.scrollBehavior = "auto";
  input.scrollTo(Math.max(0, targetTop - (input.header?.getBoundingClientRect().height ?? 0) - 8));
  input.schedule(() => {
    const heading = target.querySelector("h1") ?? target;
    const headerBottom = input.header?.getBoundingClientRect().bottom ?? 0;
    const headingTop = heading.getBoundingClientRect().top;
    const clearance = 8;
    if (headingTop < headerBottom + clearance) {
      input.scrollBy(headingTop - headerBottom - clearance);
    }
    input.root.style.scrollBehavior = previousScrollBehavior;
  });
}

export function trapMobileNavigationKey(
  event: KeyboardEvent,
  input: {
    panel: HTMLElement | null;
    closeButton: HTMLElement | null;
    firstNavigationButton: HTMLElement | null;
    close: () => void;
  },
): void {
  if (event.key === "Escape") {
    input.close();
    return;
  }
  if (event.key !== "Tab") return;
  const focusable = [
    ...(input.panel?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ) ?? []),
  ].filter((element) => !element.hidden && element.getClientRects().length > 0);
  const first = focusable.at(0);
  const last = focusable.at(-1);
  if (!first || !last) return;
  const active = document.activeElement;
  if (!event.shiftKey && active === input.closeButton) {
    event.preventDefault();
    input.firstNavigationButton?.focus();
    return;
  }
  if (event.shiftKey && active === input.firstNavigationButton) {
    event.preventDefault();
    input.closeButton?.focus();
    return;
  }
  if (event.shiftKey && (active === first || !input.panel?.contains(active))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (active === last || !input.panel?.contains(active))) {
    event.preventDefault();
    first.focus();
  }
}
