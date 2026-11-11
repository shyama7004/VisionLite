"""Trains three LightGBM quantile models for the distance sphere (low, middle, high).

Run:  python backend/app/ml/train.py                      (synthetic data, shows the code works)
      python backend/app/ml/train.py --csv volunteers.csv  (real volunteer data)

CSV columns (one row per eye, header required):
  age, better_logmar, this_eye_logmar, eye_diff, near_logmar, screen_hours_code,
  headache_code, night_trouble, wears_glasses, astig_hint, sphere
  - screen_hours_code: 0 under 2, 1 for 2 to 5, 2 for 6 to 9, 3 for over 9
  - headache_code: 0 never, 1 sometimes, 2 often
  - night_trouble, wears_glasses, astig_hint: 0 or 1
  - sphere: the spherical equivalent from the optometrist, in dioptres (negative for short sight)
"""
import argparse
import sys
from pathlib import Path

import lightgbm as lgb
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split

sys.path.insert(0, str(Path(__file__).resolve().parent))
from generate_data import FEATURES, TARGET, generate  # noqa: E402

OUT = Path(__file__).resolve().parent / "models"
ALPHAS = {"q15": 0.15, "q50": 0.5, "q85": 0.85}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", help="volunteer data (see the top of this file for columns)")
    ap.add_argument("--out", default=str(OUT))
    args = ap.parse_args()

    if args.csv:
        df = pd.read_csv(args.csv)
        missing = [c for c in FEATURES + [TARGET] if c not in df.columns]
        if missing:
            sys.exit(f"CSV is missing columns: {missing}")
        print(f"Using real data: {len(df)} rows from {args.csv}")
    else:
        df = generate()
        print(f"Using SYNTHETIC data: {len(df)} rows (made up, not clinical)")

    X, y = df[FEATURES], df[TARGET]
    Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.2, random_state=1)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    preds = {}
    for name, alpha in ALPHAS.items():
        m = lgb.LGBMRegressor(
            objective="quantile", alpha=alpha, n_estimators=250, learning_rate=0.05,
            num_leaves=15, min_child_samples=40, random_state=1, verbose=-1,
        )
        m.fit(Xtr, ytr)
        m.booster_.save_model(str(out / f"sphere_{name}.txt"))
        preds[name] = m.predict(Xte)

    mae = float(np.mean(np.abs(preds["q50"] - yte)))
    cover = float(np.mean((yte >= preds["q15"]) & (yte <= preds["q85"])))
    print(f"Held out test set: {len(Xte)} rows")
    print(f"MAE of the middle estimate: {mae:.2f} D")
    print(f"Share of true values inside the 15-85 range: {cover:.0%} (about 70% is expected)")
    print(f"Saved models to {out}")


if __name__ == "__main__":
    main()
