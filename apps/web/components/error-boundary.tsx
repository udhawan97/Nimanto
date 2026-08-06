"use client";

import { Component, type ReactNode } from "react";

/* Without this, one render throw anywhere in the workbench blanks the page and
 * the candidate is left with a white screen and no way back. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  override state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="crash" role="alert">
        <h1>The workbench stopped rendering.</h1>
        <p>
          Your data is untouched — this is a display fault, not a data fault. Nothing was sent, and
          nothing was deleted. Reloading usually clears it.
        </p>
        <pre>{error.message}</pre>
        <div className="button-group">
          <button className="button primary" type="button" onClick={() => location.reload()}>
            Reload the workbench
          </button>
          <button
            className="button quiet"
            type="button"
            onClick={() => this.setState({ error: null })}
          >
            Try to continue
          </button>
        </div>
      </div>
    );
  }
}
