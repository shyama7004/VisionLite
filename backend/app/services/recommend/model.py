"""Loads the three LightGBM files once. If they are missing, callers fall back to the rules table."""
import numpy as np

from ... import config

FEATURES = [
    "age", "better_logmar", "this_eye_logmar", "eye_diff", "near_logmar",
    "screen_hours_code", "headache_code", "night_trouble", "wears_glasses", "astig_hint",
]
_boosters: dict | None = None


def _load() -> dict:
    global _boosters
    if _boosters is None:
        _boosters = {}
        try:
            import lightgbm as lgb

            for name in ("q15", "q50", "q85"):
                path = config.MODEL_DIR / f"sphere_{name}.txt"
                if not path.is_file():
                    _boosters = {}
                    break
                _boosters[name] = lgb.Booster(model_file=str(path))
        except Exception:
            _boosters = {}
    return _boosters


def available() -> bool:
    return len(_load()) == 3


def reload() -> None:
    global _boosters
    _boosters = None


def predict_sphere(features: dict) -> tuple[float, float] | None:
    """Returns (low, high) where low is nearer to zero and high is further from zero, in dioptres."""
    b = _load()
    if len(b) != 3:
        return None
    x = np.array([[features[k] for k in FEATURES]], dtype=float)
    q15, q85 = float(b["q15"].predict(x)[0]), float(b["q85"].predict(x)[0])
    if q15 * q85 < 0:
        # The range crosses zero (could be short or long sight). That is not a usable range.
        return None
    lo, hi = sorted([q15, q85], key=abs)
    return lo, hi
