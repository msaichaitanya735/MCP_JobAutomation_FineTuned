/**
 * Server-side helpers for loading run records.
 *
 * Public sample runs live as JSON files in `frontend/data/sample-runs/`
 * (NOT in `public/` — that would expose them as direct URLs and bypass our
 * curation). The runs list and viewer pages read them via fs at render time,
 * which on Amplify becomes filesystem I/O against the deployed bundle.
 *
 * Live runs (Option C) are persisted to DynamoDB by the backend Lambda;
 * those are loaded via the backend API instead. This module only handles
 * the static, curated sample-runs path.
 */

import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { RunRecord } from "@/lib/types";

const SAMPLE_RUNS_DIR = path.join(process.cwd(), "data", "sample-runs");

export async function loadAllSampleRuns(): Promise<RunRecord[]> {
  let entries: string[];
  try {
    entries = await fs.readdir(SAMPLE_RUNS_DIR);
  } catch {
    return [];
  }
  const jsons = entries.filter((f) => f.endsWith(".json"));
  const runs = await Promise.all(
    jsons.map(async (filename) => {
      const raw = await fs.readFile(path.join(SAMPLE_RUNS_DIR, filename), "utf-8");
      return JSON.parse(raw) as RunRecord;
    })
  );
  return runs.sort(
    (a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

export async function loadSampleRun(id: string): Promise<RunRecord | null> {
  // Defensive: only accept hex-ish slugs to avoid path traversal.
  if (!/^[A-Za-z0-9_-]+$/.test(id)) return null;
  const filepath = path.join(SAMPLE_RUNS_DIR, `${id}.json`);
  try {
    const raw = await fs.readFile(filepath, "utf-8");
    return JSON.parse(raw) as RunRecord;
  } catch {
    return null;
  }
}
