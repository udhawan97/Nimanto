import { describe, expect, it, vi } from "vitest";
import {
  createWorkspaceNavigationTransitions,
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
