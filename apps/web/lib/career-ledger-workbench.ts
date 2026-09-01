import type { ActivityKind, AnswerTopic, ContactKind, InterviewRoundKind } from "@nimanto/domain";
import type { Dispatch } from "react";

export type CareerLedgerTab = "now" | "people" | "answers" | "reviews" | "insights" | "offers";

export type ActivityDraft = {
  applicationId: string;
  kind: ActivityKind;
  title: string;
  dueAt: string;
  note: string;
};

export type InterviewDraft = {
  applicationId: string;
  kind: InterviewRoundKind;
  scheduledAt: string;
  format: string;
  location: string;
  participants: string;
  prepNotes: string;
};

export type ContactDraft = {
  name: string;
  organization: string;
  title: string;
  email: string;
  phone: string;
  kind: ContactKind;
  notes: string;
  applicationId: string;
};

export type AnswerDraft = {
  id: string;
  topic: AnswerTopic;
  prompt: string;
  answerText: string;
  evidenceIds: string[];
};

export type OfferDraft = {
  applicationId: string;
  currency: string;
  base: string;
  bonus: string;
  equity: string;
  benefits: string;
  startOn: string;
  expiresOn: string;
  workMode: string;
  notes: string;
};

export type CareerLedgerWorkbenchState = {
  tab: CareerLedgerTab;
  applicationsInitialized: boolean;
  activity: ActivityDraft;
  interview: InterviewDraft;
  interviewOutcomes: Record<string, string>;
  contact: ContactDraft;
  answer: AnswerDraft;
  reviewName: string;
  offer: OfferDraft;
};

export type CareerLedgerWorkbenchAction =
  | { type: "reset" }
  | { type: "tab_changed"; tab: CareerLedgerTab }
  | {
      type: "applications_reconciled";
      applicationIds: string[];
      initialOffer: OfferDraft | null;
    }
  | { type: "activity_changed"; draft: ActivityDraft }
  | { type: "activity_committed"; submitted: ActivityDraft }
  | { type: "interview_changed"; draft: InterviewDraft }
  | { type: "interview_committed"; submitted: InterviewDraft }
  | { type: "interview_outcome_changed"; interviewId: string; notes: string }
  | { type: "interview_outcome_committed"; interviewId: string; submitted: string }
  | { type: "contact_changed"; draft: ContactDraft }
  | { type: "contact_committed"; submitted: ContactDraft }
  | { type: "answer_changed"; draft: AnswerDraft }
  | { type: "answer_committed"; submitted: AnswerDraft }
  | { type: "review_name_changed"; name: string }
  | { type: "review_name_committed"; submitted: string }
  | { type: "offer_changed"; draft: OfferDraft };

export type CareerLedgerWorkbench = {
  state: CareerLedgerWorkbenchState;
  dispatch: Dispatch<CareerLedgerWorkbenchAction>;
};

export function emptyAnswerDraft(): AnswerDraft {
  return { id: "", topic: "why_role", prompt: "", answerText: "", evidenceIds: [] };
}

export function emptyOfferDraft(applicationId = ""): OfferDraft {
  return {
    applicationId,
    currency: "USD",
    base: "",
    bonus: "",
    equity: "",
    benefits: "",
    startOn: "",
    expiresOn: "",
    workMode: "",
    notes: "",
  };
}

export function createCareerLedgerWorkbenchState(): CareerLedgerWorkbenchState {
  return {
    tab: "now",
    applicationsInitialized: false,
    activity: {
      applicationId: "",
      kind: "follow_up",
      title: "",
      dueAt: "",
      note: "",
    },
    interview: {
      applicationId: "",
      kind: "recruiter_screen",
      scheduledAt: "",
      format: "Video",
      location: "",
      participants: "",
      prepNotes: "",
    },
    interviewOutcomes: {},
    contact: {
      name: "",
      organization: "",
      title: "",
      email: "",
      phone: "",
      kind: "recruiter",
      notes: "",
      applicationId: "",
    },
    answer: emptyAnswerDraft(),
    reviewName: "",
    offer: emptyOfferDraft(),
  };
}

function sameArray(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sameRecord<T extends Record<string, unknown>>(left: T, right: T): boolean {
  const keys = Object.keys(left) as Array<keyof T>;
  return (
    keys.length === Object.keys(right).length &&
    keys.every((key) => {
      const leftValue = left[key];
      const rightValue = right[key];
      return Array.isArray(leftValue) && Array.isArray(rightValue)
        ? sameArray(leftValue, rightValue)
        : leftValue === rightValue;
    })
  );
}

export function careerLedgerWorkbenchReducer(
  state: CareerLedgerWorkbenchState,
  action: CareerLedgerWorkbenchAction,
): CareerLedgerWorkbenchState {
  switch (action.type) {
    case "reset":
      return createCareerLedgerWorkbenchState();
    case "tab_changed":
      return { ...state, tab: action.tab };
    case "applications_reconciled": {
      if (action.applicationIds.length === 0) return state;
      const first = action.applicationIds[0] ?? "";
      const valid = new Set(action.applicationIds);
      const initial = !state.applicationsInitialized;
      const applicationId = (current: string) =>
        initial || (current.length > 0 && !valid.has(current)) ? first : current;
      const offerApplicationId = applicationId(state.offer.applicationId);
      const offer =
        offerApplicationId === state.offer.applicationId && !initial
          ? state.offer
          : action.initialOffer?.applicationId === offerApplicationId
            ? action.initialOffer
            : emptyOfferDraft(offerApplicationId);
      return {
        ...state,
        applicationsInitialized: true,
        activity: { ...state.activity, applicationId: applicationId(state.activity.applicationId) },
        interview: {
          ...state.interview,
          applicationId: applicationId(state.interview.applicationId),
        },
        contact: { ...state.contact, applicationId: applicationId(state.contact.applicationId) },
        offer,
      };
    }
    case "activity_changed":
      return { ...state, activity: action.draft };
    case "activity_committed":
      return !sameRecord(state.activity, action.submitted)
        ? state
        : { ...state, activity: { ...state.activity, title: "", dueAt: "", note: "" } };
    case "interview_changed":
      return { ...state, interview: action.draft };
    case "interview_committed":
      return !sameRecord(state.interview, action.submitted)
        ? state
        : {
            ...state,
            interview: {
              ...state.interview,
              scheduledAt: "",
              participants: "",
              prepNotes: "",
            },
          };
    case "interview_outcome_changed":
      return {
        ...state,
        interviewOutcomes: {
          ...state.interviewOutcomes,
          [action.interviewId]: action.notes,
        },
      };
    case "interview_outcome_committed": {
      if (state.interviewOutcomes[action.interviewId] !== action.submitted) return state;
      const interviewOutcomes = { ...state.interviewOutcomes };
      delete interviewOutcomes[action.interviewId];
      return { ...state, interviewOutcomes };
    }
    case "contact_changed":
      return { ...state, contact: action.draft };
    case "contact_committed":
      return !sameRecord(state.contact, action.submitted)
        ? state
        : {
            ...state,
            contact: {
              ...state.contact,
              name: "",
              title: "",
              email: "",
              phone: "",
              notes: "",
            },
          };
    case "answer_changed":
      return { ...state, answer: action.draft };
    case "answer_committed":
      return !sameRecord(state.answer, action.submitted)
        ? state
        : { ...state, answer: emptyAnswerDraft() };
    case "review_name_changed":
      return { ...state, reviewName: action.name };
    case "review_name_committed":
      return state.reviewName !== action.submitted ? state : { ...state, reviewName: "" };
    case "offer_changed":
      return { ...state, offer: action.draft };
  }
}
