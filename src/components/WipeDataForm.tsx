"use client";

import { useState } from "react";
import { SubmitButton } from "./SubmitButton";

/**
 * Danger-zone form to erase all data. Requires the user to type DELETE and then
 * confirm a browser dialog before the server action can run — two deliberate
 * steps so it can never be triggered by accident.
 */
export function WipeDataForm({ action }: { action: (formData: FormData) => void }) {
  const [value, setValue] = useState("");
  const armed = value.trim().toUpperCase() === "DELETE";

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("This permanently deletes ALL data (clients, invoices, expenses, documents, everything). This cannot be undone. Continue?")) {
          e.preventDefault();
        }
      }}
      className="space-y-3"
    >
      <input
        name="confirm"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder='Type DELETE to confirm'
        className="form-input"
        autoComplete="off"
      />
      <SubmitButton
        className={armed ? "btn-primary bg-red-600 border-red-600 hover:bg-red-700" : "btn-primary opacity-50 cursor-not-allowed"}
        pendingLabel="Deleting all data…"
        savedLabel="All data deleted"
      >
        Delete all data
      </SubmitButton>
    </form>
  );
}
