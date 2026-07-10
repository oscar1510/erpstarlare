"use client";

import { useFormStatus } from "react-dom";

function Inner({ label, confirm }: { label: string; confirm: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(e) => {
        if (!window.confirm(confirm)) e.preventDefault();
      }}
      className="btn-secondary text-red-600 border-red-200 hover:bg-red-50"
    >
      {pending ? "Deleting…" : label}
    </button>
  );
}

/**
 * Delete control that asks for confirmation before firing its form action, and
 * shows a pending state. Wrap it in a <form action={deleteServerAction}>.
 */
export function DeleteButton({
  action,
  label = "🗑 Delete",
  confirm = "Delete this? This cannot be undone.",
}: {
  action: () => void | Promise<void>;
  label?: string;
  confirm?: string;
}) {
  return (
    <form action={action}>
      <Inner label={label} confirm={confirm} />
    </form>
  );
}
