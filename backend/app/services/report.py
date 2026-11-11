"""Builds the one page report: HTML first, then PDF.

PDF engine: WeasyPrint (as in the plan). If its system libraries are missing (for example on a Windows
laptop without GTK), we fall back to headless Chromium so the report can still be made. Docker uses WeasyPrint.
"""
import json
from datetime import datetime
from functools import lru_cache

from jinja2 import Environment, FileSystemLoader, select_autoescape

from .. import config
from .recommend import recommend
from .recommend.rules import RULES

TEMPLATES = config.APP_DIR / "templates"
env = Environment(loader=FileSystemLoader(TEMPLATES), autoescape=select_autoescape(["html"]))


@lru_cache(maxsize=None)
def strings(lang: str) -> dict:
    return json.loads((config.I18N_DIR / f"{lang}.json").read_text(encoding="utf-8"))


def _fmt(n: float) -> str:
    return f"{'+' if n > 0 else ''}{n:.2f}"


def _range(r: dict | None) -> str:
    return f"{_fmt(r['low'])} ~ {_fmt(r['high'])}" if r else ""


def build_html(visit: dict) -> str:
    payload = visit["payload"]
    lang = payload.get("language", "en")
    t = strings(lang)
    rec = recommend(payload)
    tests = payload.get("tests") or {}

    def eye(r):
        if not r:
            return t["res_not_done"]
        lm = round(r["logmar"], 1)
        return f"{RULES['snellen'].get(f'{lm:.1f}', '6/60+')}  (logMAR {lm:.1f})"

    chart = tests.get("chart") or {}
    skipped = rec["skipped"]
    power_lines = []
    if rec["power"]["right"]:
        power_lines.append(f"{t['res_right']}: {_range(rec['power']['right'])}")
    if rec["power"]["left"]:
        power_lines.append(f"{t['res_left']}: {_range(rec['power']['left'])}")
    if rec["power"]["add"]:
        power_lines.append(f"{t['res_add']}: {_range(rec['power']['add'])}")

    coatings = []
    for c in rec["coatings"]:
        coatings.append({
            "name": t[f"coat_{c['name']}"],
            "why": t[f"code_{c['why']}"],
            "note": t["blue_light_note"] if c["name"] == "blue_light" else "",
        })

    photo = payload.get("photo") or {}
    parts = []
    if photo.get("pd_mm"):
        parts.append(f"{t['res_pd']}: {photo['pd_mm']} mm")
    if photo.get("frame_size"):
        parts.append(f"{t['photo_size']}: {t['size_' + photo['frame_size']]}")

    cust = payload.get("customer") or {}
    created = visit.get("created_at") or payload.get("created_at") or datetime.now().isoformat()
    ctx = {
        "lang": lang,
        "t": t,
        "css": (TEMPLATES / "report.css").read_text(encoding="utf-8"),
        "date": created[:10],
        "store": config.STORE_NAME,
        "customer": cust.get("name") if payload.get("consent") else "",
        "rec": rec,
        "codes": {k[5:]: v for k, v in t.items() if k.startswith("code_")},
        "eyes": {"right": eye(chart.get("right")), "left": eye(chart.get("left")), "near": eye(tests.get("near"))},
        "astig": t["res_not_done"] if "astig" in skipped else (t["res_yes"] if rec["astigmatism_hint"] else t["res_no"]),
        "color": t["res_not_done"] if "color" in skipped else (t["res_yes"] if rec["color_hint"] else t["res_no"]),
        "lens_text": t[f"lens_{rec['lens']['type']}"],
        "lens_reasons": [t[f"code_{c}"] for c in rec["lens"]["reasons"]],
        "power_lines": power_lines,
        "coatings": coatings,
        "frame_line": "  ".join(parts),
        "skipped": ", ".join(t[f"skip_{s}"] for s in skipped),
        "visit_id": visit["id"][:8],
    }
    return env.get_template("report.html").render(**ctx)


def render_pdf(html: str) -> bytes:
    try:
        from weasyprint import HTML

        return HTML(string=html, base_url=str(TEMPLATES)).write_pdf()
    except (ImportError, OSError):
        return _chromium_pdf(html)


def _chromium_pdf(html: str) -> bytes:
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.set_content(html)
        pdf = page.pdf(format="A4", print_background=True, prefer_css_page_size=True)
        browser.close()
    return pdf


def build_pdf(visit: dict) -> bytes:
    return render_pdf(build_html(visit))
