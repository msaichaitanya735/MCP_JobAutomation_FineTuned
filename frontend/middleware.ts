import { NextResponse, type NextRequest } from "next/server";
import { AUTH, verifySession } from "@/lib/auth";

/**
 * Password-gate the live submit page and the live submit API.
 *
 * Public:    /, /login, /runs, /runs/:id, /api/auth, all static assets.
 * Protected: /submit, /api/runs (any verb).
 *
 * The middleware runs on the Edge runtime; verifySession uses Web Crypto.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isProtected =
    pathname === "/submit" ||
    pathname.startsWith("/submit/") ||
    pathname === "/api/runs" ||
    pathname.startsWith("/api/runs/");

  if (!isProtected) return NextResponse.next();

  const secret = process.env.AUTH_COOKIE_SECRET;
  if (!secret) {
    // Server is misconfigured. Return a clear 500 rather than a confusing
    // redirect loop. The deployment doc highlights this exact env var.
    return new NextResponse(
      "Server misconfigured: AUTH_COOKIE_SECRET is not set.",
      { status: 500 }
    );
  }

  const cookie = req.cookies.get(AUTH.SESSION_COOKIE)?.value ?? "";
  const ok = await verifySession(secret, cookie);
  if (ok) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("from", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/submit", "/submit/:path*", "/api/runs", "/api/runs/:path*"],
};
