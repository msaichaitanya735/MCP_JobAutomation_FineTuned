import { NextResponse } from "next/server";

/**
 * POST /api/runs - submit a JD to the live pipeline backend.
 *
 * Proxies to the FastAPI Lambda whose URL lives in NEXT_PUBLIC_BACKEND_URL.
 * Middleware has already verified the auth cookie before this runs.
 *
 * Synchronous v1: backend runs the full pipeline and returns the RunRecord.
 * Future: switch to 202 + a polling /api/runs/:id endpoint when pipeline
 * runs grow past comfortable HTTP timeouts.
 */

export const runtime = "edge";

const MAX_JD_BYTES = 50_000;

export async function POST(req: Request) {
  const backend = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (!backend) {
    return NextResponse.json(
      {
        error: "backend_not_configured",
        detail:
          "NEXT_PUBLIC_BACKEND_URL is not set. Deploy the FastAPI Lambda " +
          "(see docs/DEPLOYMENT.md) and set this env var in Amplify.",
      },
      { status: 503 }
    );
  }

  let body: { jd_text?: string };
  try {
    body = (await req.json()) as { jd_text?: string };
  } catch {
    return NextResponse.json(
      { error: "invalid_json" },
      { status: 400 }
    );
  }

  if (typeof body.jd_text !== "string" || body.jd_text.trim().length === 0) {
    return NextResponse.json(
      { error: "missing_jd_text" },
      { status: 400 }
    );
  }
  if (new TextEncoder().encode(body.jd_text).length > MAX_JD_BYTES) {
    return NextResponse.json(
      { error: "jd_too_large", limit_bytes: MAX_JD_BYTES },
      { status: 413 }
    );
  }

  const upstream = await fetch(`${backend.replace(/\/$/, "")}/runs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jd_text: body.jd_text }),
    // Lambda cold start + full pipeline can be ~90 s on retries.
    signal: AbortSignal.timeout(180_000),
  }).catch((err) => err as Error);

  if (upstream instanceof Error) {
    return NextResponse.json(
      { error: "backend_unreachable", detail: upstream.message },
      { status: 502 }
    );
  }

  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
  });
}
