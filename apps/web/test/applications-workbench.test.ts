import { describe, expect, it } from "vitest";
import {
  applicationsWorkbenchReducer,
  createApplicationsWorkbenchState,
} from "../lib/applications-workbench.js";

describe("Applications workbench working state", () => {
  it("keeps per-Application drafts while switching the active editor", () => {
    let state = createApplicationsWorkbenchState(new Date(2026, 7, 22, 12));
    state = applicationsWorkbenchReducer(state, {
      type: "outcome_opened",
      applicationId: "application-a",
    });
    state = applicationsWorkbenchReducer(state, {
      type: "outcome_changed",
      draft: { applicationId: "application-a", type: "interview", note: "Panel" },
    });
    state = applicationsWorkbenchReducer(state, {
      type: "outcome_opened",
      applicationId: "application-b",
      activeDraft: { applicationId: "application-a", type: "interview", note: "Panel" },
    });
    expect(state.outcomes.activeApplicationId).toBe("application-b");
    expect(state.outcomes.byApplication["application-a"]).toEqual({
      applicationId: "application-a",
      type: "interview",
      note: "Panel",
    });
  });

  it("clears only the exact submitted draft after delayed completion", () => {
    let state = createApplicationsWorkbenchState(new Date(2026, 7, 22, 12));
    const submitted = { applicationId: "application-a", type: "reply", note: "First" };
    state = applicationsWorkbenchReducer(state, {
      type: "outcome_opened",
      applicationId: submitted.applicationId,
    });
    state = applicationsWorkbenchReducer(state, { type: "outcome_changed", draft: submitted });
    state = applicationsWorkbenchReducer(state, {
      type: "outcome_changed",
      draft: { ...submitted, note: "Typed while saving" },
    });
    expect(
      applicationsWorkbenchReducer(state, { type: "outcome_committed", submitted }).outcomes
        .byApplication[submitted.applicationId]?.note,
    ).toBe("Typed while saving");

    state = applicationsWorkbenchReducer(state, {
      type: "outcome_committed",
      submitted: { ...submitted, note: "Typed while saving" },
    });
    expect(state.outcomes.byApplication).toEqual({});
  });

  it("retains a newer Reminder date when an older save completes", () => {
    let state = createApplicationsWorkbenchState(new Date(2026, 7, 22, 12));
    const submitted = { applicationId: "application-a", followUpOn: "2026-08-30" };
    state = applicationsWorkbenchReducer(state, {
      type: "reminder_opened",
      applicationId: submitted.applicationId,
      persistedDate: "2026-08-29",
    });
    state = applicationsWorkbenchReducer(state, { type: "reminder_changed", draft: submitted });
    state = applicationsWorkbenchReducer(state, {
      type: "reminder_changed",
      draft: { ...submitted, followUpOn: "2026-08-31" },
    });
    expect(
      applicationsWorkbenchReducer(state, { type: "reminder_committed", submitted }).reminders
        .byApplication[submitted.applicationId]?.followUpOn,
    ).toBe("2026-08-31");

    state = applicationsWorkbenchReducer(state, {
      type: "reminder_committed",
      submitted: { ...submitted, followUpOn: "2026-08-31" },
    });
    expect(state.reminders.byApplication).toEqual({});
  });

  it("owns display, review, cohort, and Reminder working state behind one reset", () => {
    let state = createApplicationsWorkbenchState(new Date(2026, 7, 22, 12));
    state = applicationsWorkbenchReducer(state, { type: "display_changed", display: "table" });
    state = applicationsWorkbenchReducer(state, {
      type: "view_changed",
      view: { ...state.view, reviewOnly: true, cohortSource: "greenhouse" },
    });
    state = applicationsWorkbenchReducer(state, {
      type: "reminder_opened",
      applicationId: "application-a",
      persistedDate: "2026-08-30",
    });
    expect(state).toMatchObject({
      display: "table",
      view: { reviewOnly: true, cohortSource: "greenhouse" },
      reminders: { activeApplicationId: "application-a" },
    });

    state = applicationsWorkbenchReducer(state, {
      type: "reset",
      now: new Date(2026, 7, 23, 12),
    });
    expect(state).toEqual(createApplicationsWorkbenchState(new Date(2026, 7, 23, 12)));
  });
});
