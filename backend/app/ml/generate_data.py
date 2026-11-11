"""Builds a SYNTHETIC training set. It is made up, not measured on people.

It shows the code works. It does not show the power ranges are clinically correct.
Retrain with volunteer data before real use (see README).
"""
import math

import numpy as np
import pandas as pd

FEATURES = [
    "age", "better_logmar", "this_eye_logmar", "eye_diff", "near_logmar",
    "screen_hours_code", "headache_code", "night_trouble", "wears_glasses", "astig_hint",
]
TARGET = "sphere"


def logmar_from_defocus(defocus_d: np.ndarray) -> np.ndarray:
    """Simple geometric blur model from the spec."""
    mar = np.sqrt(1 + (0.5 * 3438 * 0.003 * np.abs(defocus_d)) ** 2)
    return np.log10(mar)


def generate(n: int = 20000, seed: int = 7) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    age = rng.integers(8, 71, n)

    # True sphere (dioptres): most people near zero, some myopia, some hyperopia.
    kind = rng.choice(["emmetrope", "myope", "hyperope"], size=n, p=[0.55, 0.35, 0.10])
    sphere = np.where(
        kind == "emmetrope",
        rng.normal(0, 0.4, n),
        np.where(kind == "myope", -(0.5 + rng.exponential(1.6, n)), rng.uniform(0.5, 4.0, n)),
    )
    sphere = np.clip(sphere, -8, 4)
    other = sphere + rng.normal(0, 0.3, n)  # the other eye is similar

    def defocus(s: np.ndarray) -> np.ndarray:
        d = np.where(s < 0, -s, 0.0)  # myopia blurs distance fully
        # Hyperopia under 40: accommodation hides most of it at distance.
        hyper = np.where(age < 40, 0.1 * s, 0.6 * s)
        return np.where(s > 0, hyper, d)

    def to_logmar(s: np.ndarray) -> np.ndarray:
        lm = logmar_from_defocus(defocus(s)) + rng.choice([-0.1, 0.0, 0.1], size=n)  # plus or minus one line
        return np.clip(np.round(lm, 1), 0.0, 1.1)

    this_eye = to_logmar(sphere)
    other_eye = to_logmar(other)
    better = np.minimum(this_eye, other_eye)
    near = np.clip(np.round(better + np.clip((age - 40) * 0.025, 0, 0.8) + rng.normal(0, 0.07, n), 1), 0.0, 0.8)

    screen = rng.choice([0, 1, 2, 3], size=n, p=[0.2, 0.4, 0.3, 0.1])
    headache = rng.choice([0, 1, 2], size=n, p=[0.5, 0.35, 0.15])
    night = (rng.random(n) < np.where(sphere < -1, 0.4, 0.12)).astype(int)
    glasses = (rng.random(n) < np.where(sphere < -1, 0.6, 0.15)).astype(int)
    astig = (rng.random(n) < 0.12).astype(int)

    return pd.DataFrame({
        "age": age, "better_logmar": better, "this_eye_logmar": this_eye,
        "eye_diff": np.round(np.abs(this_eye - other_eye), 1), "near_logmar": near,
        "screen_hours_code": screen, "headache_code": headache, "night_trouble": night,
        "wears_glasses": glasses, "astig_hint": astig, TARGET: sphere,
    })


if __name__ == "__main__":
    df = generate()
    print(df.describe().T[["mean", "min", "max"]])
    assert not math.isnan(df[TARGET].mean())
