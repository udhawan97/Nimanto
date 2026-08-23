import type { Dispatch } from "react";
import type { ApplicationMatchBucket } from "./derive.js";

export type OutcomeDraft = {
  applicationId: string;
  type: string;
  note: string;
};

export type ReminderDraft = {
  applicationId: string;
  followUpOn: string;
};

type DraftState<T> = {
  activeApplicationId: string | null;
  byApplication: Record<string, T>;
};

export type ApplicationViewState = {
  reviewOnly: boolean;
  cohortStart: string;
  cohortEnd: string;
  cohortSource: string;
  cohortBucket: "all" | ApplicationMatchBucket;
};

export type ApplicationsWorkbenchState = {
  display: "board" | "table";
  view: ApplicationViewState;
  outcomes: DraftState<OutcomeDraft>;
  reminders: DraftState<ReminderDraft>;
};

export type ApplicationsWorkbenchAction =
  | { type: "reset"; now?: Date }
  | { type: "display_changed"; display: ApplicationsWorkbenchState["display"] }
  | { type: "view_changed"; view: ApplicationViewState }
  | { type: "outcome_opened"; applicationId: string; activeDraft?: OutcomeDraft | null }
  | { type: "outcome_changed"; draft: OutcomeDraft }
  | { type: "outcome_closed"; applicationId: string }
  | { type: "outcome_committed"; submitted: OutcomeDraft }
  | {
      type: "reminder_opened";
      applicationId: string;
      persistedDate: string;
      activeDraft?: ReminderDraft | null;
    }
  | { type: "reminder_changed"; draft: ReminderDraft }
  | { type: "reminder_closed"; applicationId: string }
  | { type: "reminder_committed"; submitted: ReminderDraft };

export type ApplicationsWorkbench = {
  state: ApplicationsWorkbenchState;
  dispatch: Dispatch<ApplicationsWorkbenchAction>;
};

function dateInputValue(value: Date, offsetDays = 0): string {
  const local = new Date(value);
  local.setDate(local.getDate() + offsetDays);
  const year = local.getFullYear();
  const month = String(local.getMonth() + 1).padStart(2, "0");
  const day = String(local.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function createApplicationsWorkbenchState(now = new Date()): ApplicationsWorkbenchState {
  return {
    display: "board",
    view: {
      reviewOnly: false,
      cohortStart: dateInputValue(now, -30),
      cohortEnd: dateInputValue(now),
      cohortSource: "all",
      cohortBucket: "all",
    },
    outcomes: { activeApplicationId: null, byApplication: {} },
    reminders: { activeApplicationId: null, byApplication: {} },
  };
}

function sameOutcome(left: OutcomeDraft, right: OutcomeDraft): boolean {
  return (
    left.applicationId === right.applicationId &&
    left.type === right.type &&
    left.note === right.note
  );
}

function sameReminder(left: ReminderDraft, right: ReminderDraft): boolean {
  return left.applicationId === right.applicationId && left.followUpOn === right.followUpOn;
}

function closeDraft<T>(state: DraftState<T>, applicationId: string): DraftState<T> {
  const byApplication = { ...state.byApplication };
  delete byApplication[applicationId];
  return {
    activeApplicationId:
      state.activeApplicationId === applicationId ? null : state.activeApplicationId,
    byApplication,
  };
}

/** One reducer seam for tab-local Application working state. The exact draft
 * submitted by a mutation is cleared only when it still matches; later typing
 * survives delayed completion. Nothing in this module reads browser storage. */
export function applicationsWorkbenchReducer(
  state: ApplicationsWorkbenchState,
  action: ApplicationsWorkbenchAction,
): ApplicationsWorkbenchState {
  switch (action.type) {
    case "reset":
      return createApplicationsWorkbenchState(action.now);
    case "display_changed":
      return { ...state, display: action.display };
    case "view_changed":
      return { ...state, view: action.view };
    case "outcome_opened": {
      const byApplication = { ...state.outcomes.byApplication };
      if (action.activeDraft) byApplication[action.activeDraft.applicationId] = action.activeDraft;
      byApplication[action.applicationId] ??= {
        applicationId: action.applicationId,
        type: "reply",
        note: "",
      };
      return {
        ...state,
        outcomes: { activeApplicationId: action.applicationId, byApplication },
      };
    }
    case "outcome_changed":
      return {
        ...state,
        outcomes: {
          ...state.outcomes,
          byApplication: {
            ...state.outcomes.byApplication,
            [action.draft.applicationId]: action.draft,
          },
        },
      };
    case "outcome_closed":
      return { ...state, outcomes: closeDraft(state.outcomes, action.applicationId) };
    case "outcome_committed": {
      const retained = state.outcomes.byApplication[action.submitted.applicationId];
      return !retained || !sameOutcome(retained, action.submitted)
        ? state
        : { ...state, outcomes: closeDraft(state.outcomes, action.submitted.applicationId) };
    }
    case "reminder_opened": {
      const byApplication = { ...state.reminders.byApplication };
      if (action.activeDraft) byApplication[action.activeDraft.applicationId] = action.activeDraft;
      byApplication[action.applicationId] ??= {
        applicationId: action.applicationId,
        followUpOn: action.persistedDate,
      };
      return {
        ...state,
        reminders: { activeApplicationId: action.applicationId, byApplication },
      };
    }
    case "reminder_changed":
      return {
        ...state,
        reminders: {
          ...state.reminders,
          byApplication: {
            ...state.reminders.byApplication,
            [action.draft.applicationId]: action.draft,
          },
        },
      };
    case "reminder_closed":
      return { ...state, reminders: closeDraft(state.reminders, action.applicationId) };
    case "reminder_committed": {
      const retained = state.reminders.byApplication[action.submitted.applicationId];
      return !retained || !sameReminder(retained, action.submitted)
        ? state
        : { ...state, reminders: closeDraft(state.reminders, action.submitted.applicationId) };
    }
  }
}
