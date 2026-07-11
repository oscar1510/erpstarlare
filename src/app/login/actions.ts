"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE, SESSION_MAX_AGE, authEnabled, createSessionToken, safeEqual } from "@/lib/auth";

export async function login(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/");
  const dest = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  const expected = process.env.APP_PASSWORD ?? "";
  if (!expected) redirect("/"); // auth disabled — nothing to check

  if (!safeEqual(password, expected)) {
    redirect(`/login?error=1&next=${encodeURIComponent(dest)}`);
  }

  const token = await createSessionToken();
  (await cookies()).set(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  redirect(dest);
}

export async function logout() {
  (await cookies()).delete(AUTH_COOKIE);
  redirect(authEnabled() ? "/login" : "/");
}
