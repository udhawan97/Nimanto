import { describe, expect, it, vi } from "vitest";
import {
  createWorkspaceNavigationTransitions,
  focusSectionBelowHeader,
  sectionFromHash,
  sectionHash,
} from "../lib/navigation-transitions.js";

describe("workspace navigation transitions", () => {
  it("accepts only bare known section hashes", () => {
    expect(sectionFromHash("#applications")).toBe("applications");
    expect(sectionFromHash("#invite=secret")).toBeNull();
    expect(sectionFromHash("#record/7")).toBeNull();
    expect(sectionHash("packets")).toBe("#packets");
  });

  it("coordinates section state, history, notice, mobile state, and focus", () => {
    const events: string[] = [];
    const navigation = createWorkspaceNavigationTransitions({
      routeReady: () => true,
      currentHash: () => "#overview",
      writeHash: (hash) => events.push(`hash:${hash}`),
      setSection: (section) => events.push(`section:${section}`),
      clearNotice: () => events.push("notice:clear"),
      setMobileOpen: (open) => events.push(`mobile:${open}`),
      schedule: (work) => {
        events.push("schedule");
        work();
      },
      focusSection: () => events.push("focus:section"),
      focusMenu: () => events.push("focus:menu"),
      focusNotice: () => events.push("focus:notice"),
    });

    navigation.go("applications");
    expect(events).toEqual([
      "section:applications",
      "notice:clear",
      "mobile:false",
      "hash:#applications",
      "schedule",
      "focus:section",
    ]);
  });

  it("restores Back/Forward routing and returns focus when closing mobile navigation", () => {
    const setSection = vi.fn();
    const focusMenu = vi.fn();
    const navigation = createWorkspaceNavigationTransitions({
      routeReady: () => true,
      currentHash: () => "#overview",
      writeHash: vi.fn(),
      setSection,
      clearNotice: vi.fn(),
      setMobileOpen: vi.fn(),
      schedule: (work) => work(),
      focusSection: vi.fn(),
      focusMenu,
      focusNotice: vi.fn(),
    });
    navigation.restore("#packets");
    expect(setSection).toHaveBeenCalledWith("packets");
    navigation.closeMobile();
    expect(focusMenu).toHaveBeenCalledOnce();
  });
});

/* Section focus is scheduled on an animation frame, so it can land after the
 * candidate has already started typing in the section they navigated to. When
 * it does, it takes focus off the field and the rest of the keystrokes go
 * nowhere — which is how characters vanished from the deletion phrase. */
describe("section focus does not interrupt work already underway", () => {
  function harness() {
    const target = document.createElement("div");
    target.tabIndex = -1;
    const field = document.createElement("input");
    target.append(field);
    document.body.append(target);
    const focused: string[] = [];
    target.focus = () => focused.push("section");
    return { target, field, focused };
  }

  it("focuses the section when focus is still outside it", () => {
    const { target, focused } = harness();
    focusSectionBelowHeader({
      target,
      header: null,
      root: document.documentElement,
      scrollY: 0,
      scrollTo: () => undefined,
      scrollBy: () => undefined,
      schedule: (work) => work(),
    });
    expect(focused).toEqual(["section"]);
    target.remove();
  });

  it("leaves focus alone once it has moved inside the section", () => {
    const { target, field, focused } = harness();
    field.focus();
    focusSectionBelowHeader({
      target,
      header: null,
      root: document.documentElement,
      scrollY: 0,
      scrollTo: () => undefined,
      scrollBy: () => undefined,
      schedule: (work) => work(),
    });
    expect(focused).toEqual([]);
    expect(document.activeElement).toBe(field);
    target.remove();
  });
});
