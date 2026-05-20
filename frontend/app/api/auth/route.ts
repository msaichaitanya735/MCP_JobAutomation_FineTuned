import { NextResponse } from "next/server";
import { AUTH, checkPassword, signSession } from "@/lib/auth";

export const runtime = "edge";

export async function POST(req: Request) {
  const expected = process.env.DEMO_PASSWORD;
  const secret = process.env.AUTH_COOKIE_SECRET;
  if (!expected || !secret) {
    return NextResponse.json(
      {
        error:
          "Server not configured. Set DEMO_PASSWORD and AUTH_COOKIE_SECRET in Amplify env vars.",
      },
      { status: 500 }
    );
  }

  let body: { password?: string };
  try {
    body = (await req.json()) as { password?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (typeof body.password !== "string" || body.password.length === 0) {
    return NextResponse.json({ error: "Password required." }, { status: 400 });
  }

  if (!(await checkPassword(body.password, expected))) {
    // Small delay to slow online brute force (Lambda cold path will dominate
    // anyway, but this is a courtesy).
    await new Promise((r) => setTimeout(r, 750));
    return NextResponse.json({ error: "Wrong password." }, { status: 401 });
  }

  const session = await signSession(secret);
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: AUTH.SESSION_COOKIE,
    value: session,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: AUTH.SESSION_MAX_AGE_SEC,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: AUTH.SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return res;
}
