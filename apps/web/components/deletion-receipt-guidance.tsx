"use client";

import { CopyLine } from "./copy-line.js";

export function DeletionReceiptGuidance({ token }: { token: string }) {
  return (
    <>
      <p className="field-note">
        For candidate-facing access, this token is the only public credential that can check or
        resume the deletion without a session. Nimanto may still continue pending file cleanup
        internally when its local service starts; that recovery does not require you to provide the
        token. Treat the token like a password.
      </p>
      <CopyLine command={token} />
      <p className="field-note">
        Public API: check with <code>GET /v1/deletion/status?token=…</code>; resume with{" "}
        <code>POST /v1/deletion/resume</code> and JSON body <code>{'{"token":"…"}'}</code>.
      </p>
    </>
  );
}
