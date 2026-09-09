import { useState, type ReactNode } from "react";
import { BrandLogo } from "./Logo";

// Lightweight password gate. The password is set via the VITE_SITE_PASSWORD
// environment variable in Vercel (baked in at build time). If it's not set, the
// site is open — so nothing breaks before you configure it.
//
// Note: this is a client-side gate (a deterrent to keep casual visitors out),
// not bank-grade security — the check runs in the browser. For a hard lock you'd
// need a paid Vercel plan or a backend. All data stays in the visitor's browser
// anyway, so there's nothing server-side to steal.
const PASSWORD = (import.meta.env.VITE_SITE_PASSWORD as string | undefined)?.trim() || "";
const KEY = "vg_auth_v1";

export function PasswordGate({ children }: { children: ReactNode }) {
  const [ok, setOk] = useState<boolean>(() => {
    if (!PASSWORD) return true; // no password configured -> open
    try {
      return localStorage.getItem(KEY) === btoa(PASSWORD);
    } catch {
      return false;
    }
  });
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);

  if (ok) return <>{children}</>;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value === PASSWORD) {
      try {
        localStorage.setItem(KEY, btoa(PASSWORD));
      } catch {
        /* ignore */
      }
      setOk(true);
    } else {
      setError(true);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-4">
      <form onSubmit={submit} className="card w-full max-w-sm p-7 text-center">
        <div className="mb-5 flex justify-center">
          <BrandLogo height={30} />
        </div>
        <h1 className="text-sm font-semibold uppercase tracking-[0.18em] text-forest-500">
          Restricted access
        </h1>
        <p className="mt-1 text-sm text-forest-600">Enter the password to continue.</p>
        <input
          type="password"
          autoFocus
          className="input mt-4 text-center"
          placeholder="Password"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(false);
          }}
        />
        {error && <div className="mt-2 text-sm text-red-600">Incorrect password.</div>}
        <button type="submit" className="btn-primary mt-4 w-full">
          Enter
        </button>
      </form>
    </div>
  );
}
