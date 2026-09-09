import { next } from "@vercel/edge";

// Server-side HTTP Basic Auth for the whole site (runs on Vercel's Edge before
// any file is served, so it can't be bypassed by reading the client code).
//
// Protection is OFF until you set the SITE_PASSWORD environment variable in
// Vercel — that way a deploy never locks you out before the password exists.
// Optional: SITE_USER (defaults to "veganologie").
export const config = { matcher: "/:path*" };

export default function middleware(request: Request) {
  const password = process.env.SITE_PASSWORD;
  if (!password) return next(); // no password configured -> site open

  const user = process.env.SITE_USER || "veganologie";
  const expected = "Basic " + btoa(`${user}:${password}`);
  const provided = request.headers.get("authorization") || "";

  if (provided === expected) return next();

  return new Response("Authentication required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Veganologie", charset="UTF-8"',
    },
  });
}
