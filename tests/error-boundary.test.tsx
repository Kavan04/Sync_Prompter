import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "../app/components/ErrorBoundary";

function Broken(): never {
  throw new Error("render failed");
}

describe("ErrorBoundary", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows a recovery message instead of a blank page when a child throws", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <Broken />
      </ErrorBoundary>
    );

    expect(screen.getByRole("alert").textContent).toMatch(/something went wrong/i);
    expect(screen.getByRole("button", { name: /reload/i })).toBeTruthy();
  });

  it("renders its children when nothing throws", () => {
    render(
      <ErrorBoundary>
        <p>still here</p>
      </ErrorBoundary>
    );

    expect(screen.getByText("still here")).toBeTruthy();
  });
});
