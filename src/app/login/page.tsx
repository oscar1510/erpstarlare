export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { authEnabled } from "@/lib/auth";
import { SubmitButton } from "@/components/SubmitButton";
import { login } from "./actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  // If no password is configured, there's nothing to log into.
  if (!authEnabled()) redirect("/");
  const sp = await searchParams;
  const next = sp.next ?? "/";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="text-2xl font-extrabold bg-gradient-to-r from-pink-600 via-fuchsia-600 to-blue-600 bg-clip-text text-transparent">
            STARFLARE
          </div>
          <div className="text-xs tracking-widest text-slate-400 font-semibold mt-1">ERP</div>
        </div>

        <form action={login} className="card p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              autoFocus
              required
              className="form-input"
              placeholder="Enter password"
            />
          </div>
          <input type="hidden" name="next" value={next} />
          {sp.error && <p className="text-sm text-red-600">Wrong password. Try again.</p>}
          <SubmitButton className="btn-primary w-full justify-center" pendingLabel="Signing in…">
            Sign in
          </SubmitButton>
          <p className="text-xs text-slate-400 text-center">
            On iPhone, save the password to your Keychain and unlock with Face ID next time.
          </p>
        </form>
      </div>
    </div>
  );
}
