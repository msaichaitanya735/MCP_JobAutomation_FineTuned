/**
 * TypeScript mirror of the Pydantic schemas in
 * src/job_pipeline/schemas/. Kept in sync by hand for v1; if this drifts
 * we'll generate it from the Python via datamodel-code-generator.
 */

export type Outcome =
  | "applied"
  | "skipped_hard_screen"
  | "skipped_eligibility"
  | "skipped_user"
  | "failed_validation"
  | "error";

export type Seniority = "junior" | "mid" | "senior" | "staff" | "principal" | "unknown";
export type UserDecision = "proceed" | "skip";

export interface JDAnalysis {
  role_family: string;
  seniority: Seniority;
  yoe_required: number | null;
  required_skills: string[];
  nice_to_have: string[];
  domain: string;
  company: string | null;
  role_title: string | null;
}

export interface EligibilityVerdict {
  hard_block: boolean;
  soft_block: boolean;
  fit_ok: boolean;
  worth_it: boolean;
  reason: string;
  explanation: string;
}

export interface NodeMetrics {
  node_name: string;
  started_at: string;
  ended_at: string;
  latency_ms: number;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  model: string | null;
  success: boolean;
  error: string | null;
  extra: Record<string, unknown>;
}

export interface ATSScore {
  overall_score: number;
  keyword_coverage: number;
  cosine_similarity: number;
  section_completeness: number;
  matched_keywords: string[];
  missing_keywords: string[];
  threshold: number;
  passed: boolean;
  gap_summary: string;
}

export interface SelectedStoriesEntry {
  story_id: string;
  relevance: number;
  resume_bullet: string;
  company: string;
}

export interface RunRecord {
  run_id: string;
  timestamp: string;
  jd_excerpt: string;
  company: string | null;
  role_title: string | null;
  outcome: Outcome;
  skip_reason: string | null;
  path_taken: string[];
  jd_analysis?: JDAnalysis | null;
  eligibility_verdict: EligibilityVerdict | null;
  hitl_triggered: boolean;
  hitl_decision: UserDecision | null;
  selected_stories?: SelectedStoriesEntry[] | null;
  rendered_pdf_path: string | null;
  rendered_docx_path?: string | null;
  ats_score: ATSScore | null;
  total_latency_ms: number;
  total_tokens_in: number;
  total_tokens_out: number;
  total_cost_usd: number;
  node_metrics: NodeMetrics[];
}

/** Metadata for each node in the pipeline diagram. Used by the
 *  React Flow viz and by interview-mode tooltips. */
export interface NodeKindMeta {
  id: string;
  label: string;
  kind: "code" | "ai" | "hitl" | "terminal";
  description: string;
  /** What the node does in one technical sentence. */
  detail: string;
}

export const NODE_META: NodeKindMeta[] = [
  {
    id: "hard_screen",
    label: "hard_screen",
    kind: "code",
    description: "Substring + YoE regex pre-screen.",
    detail:
      "Deterministic Python. Substring-matches blocker phrases (citizenship, clearance, ITAR). Regex extracts the floor of YoE phrases and blocks at threshold. ~1 ms, $0.",
  },
  {
    id: "ai_eligibility_and_fit",
    label: "ai_eligibility_and_fit",
    kind: "ai",
    description: "One LLM call: JD analysis + verdict.",
    detail:
      "One Anthropic call returns BOTH the parsed JDAnalysis (role family, seniority, skills, domain) and an EligibilityVerdict (hard/soft block, fit, worth-it). One call to amortize input context cost.",
  },
  {
    id: "human_in_the_loop",
    label: "human_in_the_loop",
    kind: "hitl",
    description: "User review on borderline cases.",
    detail:
      "Triggered when fit_ok=False or (soft_block AND !worth_it). CLI mode prompts via stdin. Deployed mode is configured to auto-skip (treating submit-action as implicit proceed).",
  },
  {
    id: "select_stories",
    label: "select_stories",
    kind: "code",
    description: "Deterministic per-company top-K.",
    detail:
      "0.7 * required_skill_overlap + 0.3 * nice_to_have_overlap on (story.skills ∪ story.best_for). Per-company top-K with overrides. Phase 2 upgrade: hybrid AI fine-pick on a deterministic shortlist.",
  },
  {
    id: "compose_resume_content",
    label: "compose_resume_content",
    kind: "ai",
    description: "Summary + lightly tailored bullets.",
    detail:
      "One LLM call producing the dynamic content the editor needs. Schema-constrained output. Skills section is built deterministically in the same node from skill_categories.yaml. Retried with the prior gap list when ATS score is below threshold.",
  },
  {
    id: "resume_editor",
    label: "resume_editor",
    kind: "code",
    description: "docxtpl render of the DOCX template.",
    detail:
      "Jinja-style placeholders inside Word. The template owns header / education / projects untouched; only summary, technical_skills, and experience are rendered from ResumeContent.",
  },
  {
    id: "pdf_converter",
    label: "pdf_converter",
    kind: "code",
    description: "DOCX → PDF.",
    detail:
      "Headless LibreOffice in CLI mode; in deployed mode a pure-Python DOCX-to-PDF path is used to avoid bundling LibreOffice into the Lambda image.",
  },
  {
    id: "ats_score",
    label: "ats_score",
    kind: "code",
    description: "TF-IDF + keyword + section completeness.",
    detail:
      "Deterministic scoring. 0.4 * cosine + 0.4 * keyword_coverage + 0.2 * section_completeness. Threshold 0.75. Failure pushes the missing-keyword list back to compose_resume_content; bounded to 2 retries.",
  },
  {
    id: "logger",
    label: "logger",
    kind: "terminal",
    description: "RunRecord append.",
    detail:
      "Sits at every terminal edge. CLI mode appends to runs/runs.jsonl; deployed mode also writes to DynamoDB and pushes the PDF/DOCX to S3 with presigned-URL access.",
  },
];
