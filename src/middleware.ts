import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, verifySessionToken } from "@/lib/auth";

/**
 * Protects every page and API route behind the password gate when APP_PASSWORD
 * is configured. Unauthenticated requests are redirected to /login. The login
 * page, the auth action, the daily-backup cron (guarded by its own CRON_SECRET)
 * and static assets are always allowed through.
 */
export async function middleware(request: NextRequest) {
  // Auth disabled (no password configured) — let everything through.
  if (!process.env.APP_PASSWORD) return NextResponse.next();

  const token = request.cookies.get(AUTH_COOKIE)?.value;
  if (await verifySessionToken(token)) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(request.nextUrl.pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Run on everything except the login page, the cron endpoint, Next internals
  // and static asset files.
  matcher: ["/((?!login|api/cron|_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:png|jpg|jpeg|svg|ico|webp|woff2?)$).*)"],
};
