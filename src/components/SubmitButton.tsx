"use client";

import { useFormStatus } from "react-dom";

/**
 * Submit button that shows a spinner + "working" label while its form action
 * is in flight, and disables itself so the action can't be double-fired. This
 * is the app-wide fix for "I clicked and nothing happened / I don't know if it
 * saved" — every form now gives immediate visual feedback.
 */
export function SubmitButton({
  children,
  pendingLabel,
  className = "btn-primary",
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending && (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      )}
      {pending ? pendingLabel ?? "Working…" : children}
    </button>
  );
}
