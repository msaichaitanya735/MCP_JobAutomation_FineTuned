"""Convert the rendered DOCX to PDF via headless LibreOffice.

LibreOffice CLI is the most reliable cross-platform DOCX -> PDF path that
preserves formatting. Requires ``libreoffice`` on PATH.

If LibreOffice is unavailable or the input is the text-fallback file
produced by ``resume_editor``, this node logs a warning and copies the
input to ``<run_id>_resume.pdf.txt`` so the graph can complete.
"""

from __future__ import annotations

import logging
import shutil
import subprocess
from pathlib import Path

from job_pipeline.config import RUNS_OUTPUTS_DIR, ensure_runtime_dirs
from job_pipeline.instrumentation import track_node
from job_pipeline.schemas import GraphState

logger = logging.getLogger(__name__)


@track_node("pdf_converter")
def pdf_converter_node(state: GraphState) -> dict:
    if not state.rendered_docx_path:
        raise RuntimeError("pdf_converter requires rendered_docx_path to be set.")

    src = Path(state.rendered_docx_path)
    ensure_runtime_dirs()

    if src.suffix.lower() != ".docx":
        # Text fallback path; surface the content as-is.
        fallback = RUNS_OUTPUTS_DIR / f"{state.run_id}_resume.pdf.txt"
        shutil.copyfile(src, fallback)
        logger.warning("PDF conversion skipped (input is %s).", src.suffix)
        return {"rendered_pdf_path": str(fallback)}

    libreoffice = shutil.which("libreoffice") or shutil.which("soffice")
    if libreoffice is None:
        fallback = RUNS_OUTPUTS_DIR / f"{state.run_id}_resume.pdf.txt"
        fallback.write_text(
            f"libreoffice not on PATH; could not convert {src}.\n",
            encoding="utf-8",
        )
        logger.warning("libreoffice not found; wrote stub %s", fallback)
        return {"rendered_pdf_path": str(fallback)}

    out_dir = RUNS_OUTPUTS_DIR
    cmd = [
        libreoffice,
        "--headless",
        "--convert-to",
        "pdf",
        "--outdir",
        str(out_dir),
        str(src),
    ]
    subprocess.run(cmd, check=True, capture_output=True, timeout=120)

    pdf_path = out_dir / f"{src.stem}.pdf"
    return {"rendered_pdf_path": str(pdf_path)}
