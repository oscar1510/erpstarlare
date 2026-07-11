"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

/**
 * Submit button that gives end-to-end feedback for a form action:
 *  - while the action is in flight it shows a spinner + "working" label and
 *    disables itself so the action can't be double-fired;
 *  - the moment the action finishes it flashes a green "✓ Saved" confirmation
 *    for a couple of seconds, then returns to normal.
 *
 * This is the app-wide answer to "I clicked Save and I don't know if anything
 * happened / I never get a confirmation" — every form now confirms visibly.
 */
export function SubmitButton({
  children,
  pendingLabel,
  savedLabel = "Saved",
  className = "btn-primary",
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  savedLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  const wasPending = useRef(false);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    if (pending) {
      wasPending.current = true;
      if (justSaved) setJustSaved(false);
    } else if (wasPending.current) {
      // pending fell true -> false: the action resolved.
      wasPending.current = false;
      setJustSaved(true);
      const t = setTimeout(() => setJustSaved(false), 2500);
      return () => clearTimeout(t);
    }
  }, [pending]); // eslint-disable-line react-hooks/exhaustive-deps

  if (justSaved) {
    return (
      <button type="submit" className={className} style={{ backgroundColor: "#16a34a", borderColor: "#16a34a", color: "#fff" }}>
        <span className="inline-flex items-center gap-1.5">
          <span>✓</span>
          <span>{savedLabel}</span>
        </span>
      </button>
    );
  }

  return (
    <button type="submit" disabled={pending} className={className}>
      <span className="inline-flex items-center gap-1.5">
        {pending && (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
        )}
        <span>{pending ? pendingLabel ?? "Working…" : children}</span>
      </span>
    </button>
  );
}
