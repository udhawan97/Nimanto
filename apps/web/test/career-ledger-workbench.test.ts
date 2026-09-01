import { describe, expect, it } from "vitest";
import {
  careerLedgerWorkbenchReducer,
  createCareerLedgerWorkbenchState,
  emptyOfferDraft,
} from "../lib/career-ledger-workbench.js";

describe("Career Ledger working state", () => {
  it("keeps every working draft and the active tab above section unmounts", () => {
    let state = createCareerLedgerWorkbenchState();
    state = careerLedgerWorkbenchReducer(state, {
      type: "applications_reconciled",
      applicationIds: ["application-a"],
      initialOffer: null,
    });
    state = careerLedgerWorkbenchReducer(state, { type: "tab_changed", tab: "offers" });
    state = careerLedgerWorkbenchReducer(state, {
      type: "activity_changed",
      draft: { ...state.activity, title: "Draft activity" },
    });
    state = careerLedgerWorkbenchReducer(state, {
      type: "interview_changed",
      draft: { ...state.interview, prepNotes: "Draft preparation" },
    });
    state = careerLedgerWorkbenchReducer(state, {
      type: "contact_changed",
      draft: { ...state.contact, name: "Draft contact" },
    });
    state = careerLedgerWorkbenchReducer(state, {
      type: "answer_changed",
      draft: { ...state.answer, prompt: "Draft prompt" },
    });
    state = careerLedgerWorkbenchReducer(state, {
      type: "review_name_changed",
      name: "Draft review",
    });
    state = careerLedgerWorkbenchReducer(state, {
      type: "offer_changed",
      draft: { ...state.offer, base: "145000" },
    });

    expect(state).toMatchObject({
      tab: "offers",
      activity: { applicationId: "application-a", title: "Draft activity" },
      interview: { applicationId: "application-a", prepNotes: "Draft preparation" },
      contact: { applicationId: "application-a", name: "Draft contact" },
      answer: { prompt: "Draft prompt" },
      reviewName: "Draft review",
      offer: { applicationId: "application-a", base: "145000" },
    });
  });

  it("clears only the exact submitted snapshot after delayed completion", () => {
    let state = createCareerLedgerWorkbenchState();
    const submitted = { ...state.activity, applicationId: "application-a", title: "First" };
    state = careerLedgerWorkbenchReducer(state, { type: "activity_changed", draft: submitted });
    state = careerLedgerWorkbenchReducer(state, {
      type: "activity_changed",
      draft: { ...submitted, title: "Typed while saving" },
    });
    state = careerLedgerWorkbenchReducer(state, { type: "activity_committed", submitted });
    expect(state.activity.title).toBe("Typed while saving");

    const latest = state.activity;
    state = careerLedgerWorkbenchReducer(state, {
      type: "activity_committed",
      submitted: latest,
    });
    expect(state.activity.title).toBe("");
  });

  it("hydrates once, preserves deliberate edits, and clears at the identity boundary", () => {
    let state = createCareerLedgerWorkbenchState();
    const offer = { ...emptyOfferDraft("application-a"), base: "90000" };
    state = careerLedgerWorkbenchReducer(state, {
      type: "applications_reconciled",
      applicationIds: [],
      initialOffer: null,
    });
    expect(state.applicationsInitialized).toBe(false);
    state = careerLedgerWorkbenchReducer(state, {
      type: "applications_reconciled",
      applicationIds: ["application-a"],
      initialOffer: offer,
    });
    state = careerLedgerWorkbenchReducer(state, {
      type: "contact_changed",
      draft: { ...state.contact, applicationId: "" },
    });
    state = careerLedgerWorkbenchReducer(state, {
      type: "offer_changed",
      draft: { ...state.offer, base: "91000" },
    });
    state = careerLedgerWorkbenchReducer(state, {
      type: "applications_reconciled",
      applicationIds: ["application-a"],
      initialOffer: offer,
    });
    expect(state.contact.applicationId).toBe("");
    expect(state.offer.base).toBe("91000");

    expect(careerLedgerWorkbenchReducer(state, { type: "reset" })).toEqual(
      createCareerLedgerWorkbenchState(),
    );
  });
});
