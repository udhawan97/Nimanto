"use client";

import { CircleAlert } from "lucide-react";

export function RoleIdentityReviewNotice({
  roleId,
  reason,
  editorOpen,
  editBlocked,
  busy,
  onReview,
}: {
  roleId: string;
  reason: string | null;
  editorOpen: boolean;
  editBlocked: boolean;
  busy: boolean;
  onReview: () => void;
}) {
  const headingId = `role-identity-review-${roleId}`;
  return (
    <section className="role-identity-review" aria-labelledby={headingId}>
      <CircleAlert size={18} aria-hidden="true" />
      <div>
        <strong id={headingId}>Candidate review required for this migrated role</strong>
        <p>
          This older manual record may have been identified from only part of the posting. Review
          the exact stored title, company, URL, description, and requirements before relying on it.
        </p>
        <small>
          Stored role ID <code>{roleId}</code>
          {reason ? (
            <>
              {" "}
              · migration reason <code>{reason}</code>
            </>
          ) : null}
        </small>
      </div>
      <button
        className="button mini quiet"
        type="button"
        disabled={busy || editBlocked || editorOpen}
        aria-describedby={headingId}
        title={
          editBlocked
            ? "Finish or discard the other unsaved role draft before reviewing this record"
            : undefined
        }
        onClick={onReview}
      >
        {editorOpen ? "Review editor open" : "Review exact stored posting"}
      </button>
    </section>
  );
}
