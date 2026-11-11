import io
import re

import pytest
from pypdf import PdfReader

from app.services import report
from app.services.recommend import recommend

BANNED = [r"diagnosis", r"you have", r"disease"]


def visit(lang="en", **over):
    payload = {
        "id": "rep00001-aaaa", "created_at": "2026-11-11T10:00:00+00:00", "language": lang, "consent": True,
        "customer": {"name": "Asha Kumari", "phone": None},
        "interview": {"age": 55, "screen_hours": "6to9", "headaches": "often", "night_driving_trouble": "yes",
                      "wears_glasses": True, "last_eye_exam": "gt2", "red_flags": {}},
        "tests": {"chart": {"right": {"logmar": 0.5}, "left": {"logmar": 0.4}}, "near": {"logmar": 0.6},
                  "astig": {"right": {"unequal": True, "darkest_deg": 90}, "left": {"unequal": False}}, "color": {"flag": True}},
        "photo": {"pd_mm": 62.5, "frame_size": "medium", "source": "face"},
    }
    payload.update(over)
    return {"id": payload["id"], "created_at": payload["created_at"], "language": lang, "payload": payload}


def pages(pdf: bytes) -> int:
    return len(PdfReader(io.BytesIO(pdf)).pages)


@pytest.mark.parametrize("lang", ["en", "hi", "or"])
def test_one_page_in_each_language(lang):
    pdf = report.build_pdf(visit(lang))
    assert pdf[:4] == b"%PDF" and pages(pdf) == 1


@pytest.mark.parametrize("lang", ["en", "hi", "or"])
def test_worst_case_is_still_one_page(lang):
    # Referral (not blocking) with every note switched on and a very long name.
    v = visit(lang, customer={"name": "Venkata Subrahmanyam Lakshmi Narasimha Rao " * 2, "phone": None},
              tests={"chart": {"right": {"logmar": 0.5}, "left": {"logmar": 0.6}}, "near": {"logmar": 0.7},
                     "astig": {"right": {"unequal": True, "darkest_deg": 30}, "left": {"unequal": True, "darkest_deg": 90}},
                     "color": {"flag": True}})
    pdf = report.build_pdf(v)
    assert pages(pdf) == 1


def test_blocked_report_has_no_lens_or_power():
    v = visit("en")
    v["payload"]["interview"]["red_flags"] = {"diabetes": True}
    html = report.build_html(v)
    assert "refer" in html and "Diabetes reported" in html
    assert "Rough power range" not in html and "Coatings" not in html
    assert pages(report.render_pdf(html)) == 1


def test_english_pdf_has_disclaimer_and_no_banned_words():
    pdf = report.build_pdf(visit("en"))
    text = " ".join(p.extract_text() for p in PdfReader(io.BytesIO(pdf)).pages)
    assert "does not diagnose" in text.replace("\n", " ")
    assert "not a prescription" in text.replace("\n", " ")
    for b in BANNED:
        assert not re.search(b, text, re.I), b
    assert not re.search(r"(?<!not a )prescription", text, re.I)


def test_odia_and_hindi_html_use_real_letters():
    for lang, sample in (("hi", "स्क्रीनिंग"), ("or", "ସ୍କ୍ରିନିଂ")):
        assert sample in report.build_html(visit(lang))
