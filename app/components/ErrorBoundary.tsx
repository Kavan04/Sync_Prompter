"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

// Shows a recovery message in place of the page when rendering fails, so a
// storage or render error does not leave a blank screen.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("SyncPrompter failed to render:", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div role="alert" className="min-h-[100dvh] bg-[#121212] text-white flex flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-lg font-bold">Something went wrong while loading SyncPrompter.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="bg-white text-black rounded-full py-3 px-8 font-bold"
        >
          Reload
        </button>
      </div>
    );
  }
}
