"""Turns a session into the numbers the model expects (same order as ml/generate_data.FEATURES)."""
SCREEN_CODE = {"lt2": 0, "2to5": 1, "6to9": 2, "gt9": 3}
HEADACHE_CODE = {"never": 0, "sometimes": 1, "often": 2}


def eye_features(session: dict, eye: str) -> dict | None:
    """Features for one eye, or None if that eye's chart was skipped."""
    tests = session.get("tests") or {}
    chart = tests.get("chart") or {}
    this = (chart.get(eye) or {}).get("logmar")
    other_name = "left" if eye == "right" else "right"
    other = (chart.get(other_name) or {}).get("logmar")
    if this is None:
        return None
    eyes = [x for x in (this, other) if x is not None]
    better = min(eyes)
    iv = session.get("interview") or {}
    near = (tests.get("near") or {}).get("logmar")
    astig = tests.get("astig") or {}
    astig_hint = bool((astig.get("right") or {}).get("unequal") or (astig.get("left") or {}).get("unequal"))
    return {
        "age": iv.get("age", 30),
        "better_logmar": better,
        "this_eye_logmar": this,
        "eye_diff": round(abs(this - other), 1) if other is not None else 0.0,
        "near_logmar": near if near is not None else better,
        "screen_hours_code": SCREEN_CODE.get(iv.get("screen_hours"), 0),
        "headache_code": HEADACHE_CODE.get(iv.get("headaches"), 0),
        "night_trouble": 1 if iv.get("night_driving_trouble") == "yes" else 0,
        "wears_glasses": 1 if iv.get("wears_glasses") else 0,
        "astig_hint": 1 if astig_hint else 0,
    }
