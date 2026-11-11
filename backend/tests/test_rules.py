import json
from pathlib import Path

import pytest

from app.services.recommend.rules import recommend_rules

FIX = json.loads(
    (Path(__file__).resolve().parents[2] / "shared" / "fixtures" / "recommendation_cases.json").read_text(encoding="utf-8")
)


@pytest.mark.parametrize("case", FIX["cases"], ids=[c["name"] for c in FIX["cases"]])
def test_matches_fixture(case):
    out = recommend_rules(case["input"])
    e = case["expected"]
    assert out["referral"]["level"] == e["referral"]["level"]
    assert sorted(out["referral"]["reasons"]) == sorted(e["referral"]["reasons"])
    assert out["referral"]["blocks_lens_advice"] == e["referral"]["blocks_lens_advice"]
    assert out["lens"]["type"] == e["lens"]["type"]
    assert out["coatings"] == e["coatings"]
    assert out["power"] == e["power"]
    assert out["astigmatism_hint"] == e["astigmatism_hint"]
    assert out["color_hint"] == e["color_hint"]
    assert out["skipped"] == e["skipped"]
    for r in e.get("lens_reasons_include", []):
        assert r in out["lens"]["reasons"]


def test_at_least_15_cases():
    assert len(FIX["cases"]) >= 15


def test_engine_returns_codes_not_sentences():
    out = recommend_rules(FIX["cases"][0]["input"])
    for r in out["lens"]["reasons"] + out["referral"]["reasons"]:
        assert r.replace("_", "").isalnum() and r.isupper()
