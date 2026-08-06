import type { Metadata } from "next";
import { ErrorBoundary } from "../../components/error-boundary.js";
import { Workspace } from "../../components/workspace.js";

export const metadata: Metadata = {
  title: "Workbench",
  description: "Your private Nimanto evidence and application workbench.",
};

export default function WorkspacePage() {
  return (
    <ErrorBoundary>
      <Workspace />
    </ErrorBoundary>
  );
}
