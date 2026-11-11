"""Recommendation = rules, plus the small model for the distance sphere when it is available."""
from . import model
from .features import eye_features
from .rules import clean_range, recommend_rules, RULES


def recommend(session: dict) -> dict:
    out = recommend_rules(session)
    if out["referral"]["blocks_lens_advice"]:
        return out
    if out["lens"]["type"] not in ("SINGLE_VISION_DISTANCE", "PROGRESSIVE_OR_BIFOCAL"):
        return out
    if not model.available():
        return out

    used_model = False
    for eye in ("right", "left"):
        feats = eye_features(session, eye)
        if feats is None or feats["this_eye_logmar"] < RULES["distance_problem_logmar_at_or_above"] - 1e-9:
            continue
        pred = model.predict_sphere(feats)
        if pred is None:
            continue
        lo, hi = pred
        # A range that sits fully inside plus or minus 0.25 says nothing useful. Keep the rules range then.
        if max(abs(lo), abs(hi)) <= 0.25:
            continue
        out["power"][eye] = clean_range(lo, hi)
        used_model = True
    if used_model:
        out["power"]["source"] = "model"
    return out
