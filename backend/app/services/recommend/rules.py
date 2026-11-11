"""Rules only recommendation engine.

Mirror of frontend/src/lib/rules.ts. Both read shared/rules.json and both are
tested against shared/fixtures/recommendation_cases.json.
The engine returns codes only, never English sentences.
"""
import json
from pathlib import Path

EPS = 1e-9
RULES_PATH = Path(__file__).resolve().parents[4] / "shared" / "rules.json"
RULES = json.loads(RULES_PATH.read_text(encoding="utf-8"))

RED_FLAG_CODES = {
    "sudden_vision_change": "RED_FLAG_SUDDEN",
    "eye_pain_or_redness": "RED_FLAG_PAIN",
    "flashes_or_floaters": "RED_FLAG_FLASHES",
    "double_vision": "RED_FLAG_DOUBLE",
    "diabetes": "RED_FLAG_DIABETES",
    "eye_injury_or_surgery": "RED_FLAG_INJURY",
}


def _round_half_up(x: float) -> float:
    # JavaScript Math.round rounds halves up. Python round() does not. Match JS.
    import math
    return math.floor(x + 0.5)


def round_step(v: float, step: float = None) -> float:
    step = step or RULES["power_clamp"]["step"]
    return _round_half_up(v / step) * step


def clean_range(a: float, b: float) -> dict:
    c = RULES["power_clamp"]
    low, high = round_step(a), round_step(b)
    direction = -1 if high < low else (1 if high > low else -1)
    if abs(high - low) < c["min_range_width"] - EPS:
        high = low + direction * c["min_range_width"]
    low = min(c["max"], max(c["min"], low))
    high = min(c["max"], max(c["min"], high))
    return {"low": low, "high": high}


def rules_only_sphere(logmar: float):
    for row in RULES["rules_only_sphere"]:
        if row["from"] - EPS <= logmar <= row["to"] + EPS:
            return clean_range(row["low"], row["high"])
    return None


def reading_add(age: float) -> dict:
    p = RULES["presbyopia"]
    centre = p["add_by_age"][0][2]
    for lo, hi, add in p["add_by_age"]:
        if lo <= age <= hi:
            centre = add
    h = p["add_range_half_width"]
    return {"low": round_step(centre - h), "high": round_step(centre + h)}


def _get(d, *path):
    for key in path:
        if d is None:
            return None
        d = d.get(key) if isinstance(d, dict) else None
    return d


def recommend_rules(s: dict) -> dict:
    iv = s.get("interview")
    age = (iv or {}).get("age", 30)
    R = RULES["referral"]
    tests = s.get("tests") or {}
    eye_r = _get(tests, "chart", "right", "logmar")
    eye_l = _get(tests, "chart", "left", "logmar")
    near = _get(tests, "near", "logmar")
    eyes = [x for x in (eye_r, eye_l) if x is not None]
    better = min(eyes) if eyes else None
    worst = max(eyes) if eyes else None

    skipped = []
    if eye_r is None or eye_l is None:
        skipped.append("chart")
    if near is None:
        skipped.append("near")
    if not _get(tests, "astig", "right") and not _get(tests, "astig", "left"):
        skipped.append("astig")
    if not tests.get("color"):
        skipped.append("color")
    both_skipped = len(eyes) == 0

    # 1. Referral
    refer, blocks = [], False
    flags = (iv or {}).get("red_flags") or {}
    for key, code in RED_FLAG_CODES.items():
        if flags.get(key):
            refer.append(code)
            if R["block_if_any_red_flag"]:
                blocks = True
    if age < R["min_age_for_lens_advice"]:
        refer.append("AGE_TOO_YOUNG")
        blocks = True
    if worst is not None and worst >= R["any_eye_logmar_refer_at_or_above"] - EPS:
        refer.append("EYE_VERY_LOW")
        blocks = True
    if better is not None and better >= R["better_eye_logmar_refer_at_or_above"] - EPS and "EYE_VERY_LOW" not in refer:
        refer.append("BETTER_EYE_LOW")
    if eye_r is not None and eye_l is not None and abs(eye_r - eye_l) >= R["eye_difference_refer_at_or_above"] - EPS:
        refer.append("EYE_DIFFERENCE_LARGE")
    overdue = iv is not None and age >= R["advise_exam_min_age"] and iv.get("last_eye_exam") in R["advise_exam_if_last_exam_in"]
    reasons = list(refer)
    level = "none"
    if refer:
        level = "refer"
    elif overdue:
        level = "advise"
        reasons.append("EXAM_OVERDUE")

    astig_hint = bool(_get(tests, "astig", "right", "unequal") or _get(tests, "astig", "left", "unequal"))
    color = tests.get("color")
    color_hint = bool(color and not color.get("invalid") and color.get("flag"))
    photo = s.get("photo") or {}
    base = {
        "astigmatism_hint": astig_hint,
        "color_hint": color_hint,
        "frame": {"pd_mm": photo.get("pd_mm"), "size": photo.get("frame_size")},
        "skipped": skipped,
        "disclaimer_key": "disclaimer_default",
    }

    # 2. Blocked
    if blocks:
        return {
            "referral": {"level": level, "reasons": reasons, "blocks_lens_advice": True},
            "lens": {"type": "NONE_UNTIL_DOCTOR", "reasons": []},
            "power": {"right": None, "left": None, "add": None, "source": "none"},
            "coatings": [],
            **base,
        }

    # 3. Lens type
    P = RULES["presbyopia"]
    distance_problem = better is not None and better >= RULES["distance_problem_logmar_at_or_above"] - EPS
    near_problem = near is not None and (
        (age >= P["min_age"] and near > P["near_logmar_worse_than"] + EPS)
        or (better is not None and near - better >= 0.3 - EPS)
    )
    if distance_problem and near_problem and age >= 40:
        ltype = "PROGRESSIVE_OR_BIFOCAL"
    elif distance_problem:
        ltype = "SINGLE_VISION_DISTANCE"
    elif near_problem:
        ltype = "SINGLE_VISION_NEAR"
    else:
        ltype = "NO_CORRECTION_LIKELY"
    lens_reasons = []
    if distance_problem:
        lens_reasons.append("DISTANCE_PROBLEM")
    if near_problem:
        lens_reasons.append("NEAR_PROBLEM")
    if ltype == "NO_CORRECTION_LIKELY":
        lens_reasons += ["NO_PROBLEM", "RECHECK_YEARLY"]
    if both_skipped:
        lens_reasons.append("BOTH_CHARTS_SKIPPED")

    # 4. Power (rules only. recommend.py may replace the sphere with the model)
    right = left = add = None
    if ltype in ("SINGLE_VISION_DISTANCE", "PROGRESSIVE_OR_BIFOCAL"):
        right = rules_only_sphere(eye_r) if eye_r is not None else None
        left = rules_only_sphere(eye_l) if eye_l is not None else None
    if ltype in ("SINGLE_VISION_NEAR", "PROGRESSIVE_OR_BIFOCAL"):
        add = reading_add(age)
    source = "rules" if (right or left or add) else "none"

    # 5. Coatings
    coatings = []
    sh = (iv or {}).get("screen_hours")
    screen6 = sh in ("6to9", "gt9")
    if (iv or {}).get("night_driving_trouble") == "yes":
        coatings.append({"name": "anti_glare", "why": "night_driving_trouble"})
    elif screen6:
        coatings.append({"name": "anti_glare", "why": "screen_hours_6plus"})
    if screen6:
        coatings.append({"name": "blue_light", "why": "screen_hours_6plus"})

    return {
        "referral": {"level": level, "reasons": reasons, "blocks_lens_advice": False},
        "lens": {"type": ltype, "reasons": lens_reasons},
        "power": {"right": right, "left": left, "add": add, "source": source},
        "coatings": coatings,
        **base,
    }
