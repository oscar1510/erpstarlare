"use client";

import { useFormStatus } from "react-dom";

function Inner({ label, pendingLabel, confirm, className }: { label: string; pendingLabel: string; confirm: string; className: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(e) => {
        if (!window.confirm(confirm)) e.preventDefault();
      }}
      className={className}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

/**
 * Generic action button that asks for confirmation before firing its form
 * action (neutral styling, unlike DeleteButton). Wrap in <form action={...}>.
 */
export function ConfirmButton({
  action,
  label,
  pendingLabel = "Working…",
  confirm,
  className = "btn-secondary",
}: {
  action: () => void | Promise<void>;
  label: string;
  pendingLabel?: string;
  confirm: string;
  className?: string;
}) {
  return (
    <form action={action}>
      <Inner label={label} pendingLabel={pendingLabel} confirm={confirm} className={className} />
    </form>
  );
}
