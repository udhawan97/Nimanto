import type { Metadata } from "next";
import { Workspace } from "../../components/workspace.js";

export const metadata: Metadata = {
  title: "Workbench",
  description: "Your private Nimanto evidence and application workbench.",
};

export default function WorkspacePage() {
  return <Workspace />;
}
