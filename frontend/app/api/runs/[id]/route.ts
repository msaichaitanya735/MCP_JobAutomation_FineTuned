import { NextResponse } from "next/server";

/**
 * GET /api/runs/:id - fetch a live run record from the backend.
 *
 * Proxies to NEXT_PUBLIC_BACKEND_URL/runs/:id. Sample runs (Option B)
 * are loaded from the static SSG path /runs/[id], not through here.
 */

export const runtime = "edge";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!/^[A-Za-z0-9_-]+$/.test(id)) {
    return NextResponse.json({ error: "bad_id" }, { status: 400 });
  }

  const backend = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (!backend) {
    return NextResponse.json(
      { error: "backend_not_configured" },
      { status: 503 }
    );
  }

  const upstream = await fetch(
    `${backend.replace(/\/$/, "")}/runs/${id}`,
    { signal: AbortSignal.timeout(15_000) }
  ).catch((err) => err as Error);

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
