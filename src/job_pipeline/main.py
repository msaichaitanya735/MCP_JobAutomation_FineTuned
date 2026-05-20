"""CLI entry point.

Examples
--------

    job-pipeline run --jd-file path/to/jd.txt
    cat jd.txt | job-pipeline run --jd-stdin
"""

from __future__ import annotations

import logging
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

import typer
from dotenv import load_dotenv
from rich.console import Console
from rich.panel import Panel
from rich.table import Table

from job_pipeline.config import (
    TEMPLATES_DIR,
    ensure_runtime_dirs,
)
from job_pipeline.graph import build_graph
from job_pipeline.schemas import GraphState

app = typer.Typer(add_completion=False, no_args_is_help=True)
console = Console()


@app.command()
def run(
    jd_file: Path | None = typer.Option(
        None, "--jd-file", help="Path to a text file containing the JD."
    ),
    jd_stdin: bool = typer.Option(
        False, "--jd-stdin", help="Read the JD from stdin instead of a file."
    ),
    template: Path | None = typer.Option(
        None,
        "--template",
        help="Path to the resume DOCX template (defaults to templates/resume_template.docx).",
    ),
    verbose: bool = typer.Option(False, "-v", "--verbose"),
) -> None:
    """Run the pipeline once for a single JD."""
    load_dotenv()
    logging.basicConfig(
        level=logging.DEBUG if verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s | %(message)s",
    )
    ensure_runtime_dirs()

    jd_text = _read_jd(jd_file=jd_file, from_stdin=jd_stdin)
    if not jd_text.strip():
        console.print("[red]No JD text provided.[/red]")
        raise typer.Exit(code=2)

    template_path = template or TEMPLATES_DIR / "resume_template.docx"

    initial = GraphState(
        jd_text=jd_text,
        base_resume_template_path=str(template_path),
        run_id=uuid.uuid4().hex[:12],
        started_at=datetime.now(timezone.utc),
    )

    console.print(
        Panel.fit(
            f"run_id: {initial.run_id}\n"
            f"jd chars: {len(jd_text)}\n"
            f"template: {template_path}",
            title="job-pipeline",
        )
    )

    graph = build_graph()
    final_state = graph.invoke(initial)

    _render_summary(final_state)


def _read_jd(*, jd_file: Path | None, from_stdin: bool) -> str:
    if from_stdin:
        return sys.stdin.read()
    if jd_file is None:
        raise typer.BadParameter("Provide --jd-file or --jd-stdin.")
    return jd_file.read_text(encoding="utf-8")


def _render_summary(final_state) -> None:
    """Pretty-print the run outcome and per-node metrics.

    LangGraph returns the final state as a dict-like; we read it both ways.
    """
    get = (
        final_state.get
        if hasattr(final_state, "get")
        else lambda k, d=None: getattr(final_state, k, d)
    )

    outcome = get("outcome", "unknown")
    skip_reason = get("skip_reason")
    pdf_path = get("rendered_pdf_path")
    ats = get("ats_score")
    metrics = get("node_metrics", []) or []
    path_taken = get("path_taken", []) or []

    console.print()
    console.print(
        Panel.fit(
            f"outcome: [bold]{outcome}[/bold]\n"
            f"skip_reason: {skip_reason}\n"
            f"path: {' -> '.join(path_taken)}\n"
            f"pdf: {pdf_path}",
            title="result",
        )
    )

    if ats is not None:
        ats_dict = ats if isinstance(ats, dict) else ats.model_dump()
        console.print(
            Panel.fit(
                "\n".join(
                    [
                        f"overall:           {ats_dict['overall_score']:.3f}",
                        f"keyword_coverage:  {ats_dict['keyword_coverage']:.3f}",
                        f"cosine_similarity: {ats_dict['cosine_similarity']:.3f}",
                        f"section_complete:  {ats_dict['section_completeness']:.3f}",
                        f"passed:            {ats_dict['passed']}",
                        f"missing:           {', '.join(ats_dict['missing_keywords']) or '-'}",
                    ]
                ),
                title="ats_score",
            )
        )

    if metrics:
        table = Table(title="per-node metrics")
        for col in ("node", "ms", "in", "out", "$", "ok"):
            table.add_column(col, justify="right" if col != "node" else "left")
        for m in metrics:
            md = m if isinstance(m, dict) else m.model_dump()
            table.add_row(
                str(md["node_name"]),
                f"{md['latency_ms']:.0f}",
                str(md["tokens_in"]),
                str(md["tokens_out"]),
                f"{md['cost_usd']:.4f}",
                "y" if md["success"] else "n",
            )
        console.print(table)


if __name__ == "__main__":
    app()
