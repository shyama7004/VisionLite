"""Renders sample reports (en, hi, or) to docs/ as PDF and PNG so a person can look at them."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend" / "tests"))
import os
os.environ.setdefault("WHISPER_PRELOAD", "0")

import pypdfium2 as pdfium
from test_report import visit
from app.services import report

docs = Path(__file__).resolve().parents[1] / "docs"
docs.mkdir(exist_ok=True)
for lang in ("en", "hi", "or"):
    pdf = report.build_pdf(visit(lang))
    (docs / f"sample-report-{lang}.pdf").write_bytes(pdf)
    page = pdfium.PdfDocument(pdf)[0]
    page.render(scale=1.4).to_pil().save(docs / f"sample-report-{lang}.png")
    print(lang, "ok")
