"""Geometry checks with made up landmark arrays (no real face photo is in the repo)."""
import numpy as np
import pytest

from app.services.vision import PhotoError, face_measurements, frame_size


def landmarks(iris_px=40.0, pd_px=250.0, face_px=500.0, nose_shift=0.0, lid_gap=14.0, eye_w=100.0):
    lm = np.zeros((478, 2))
    cy = 300.0
    cx = 500.0
    # iris centres and edges
    lm[468] = (cx - pd_px / 2, cy)
    lm[473] = (cx + pd_px / 2, cy)
    for c, (a, b) in {468: (469, 471), 473: (474, 476)}.items():
        lm[a] = (lm[c][0] - iris_px / 2, cy)
        lm[b] = (lm[c][0] + iris_px / 2, cy)
    lm[33] = (cx - pd_px / 2 - eye_w / 2, cy)
    lm[263] = (cx + pd_px / 2 + eye_w / 2, cy)
    lm[133] = (lm[33][0] + eye_w, cy)
    lm[362] = (lm[263][0] - eye_w, cy)
    lm[159] = (lm[468][0], cy - lid_gap / 2)
    lm[145] = (lm[468][0], cy + lid_gap / 2)
    lm[386] = (lm[473][0], cy - lid_gap / 2)
    lm[374] = (lm[473][0], cy + lid_gap / 2)
    lm[1] = (cx + nose_shift, cy + 80)
    lm[234] = (cx - face_px / 2, cy)
    lm[454] = (cx + face_px / 2, cy)
    return lm


def test_pd_and_face_width_from_iris_scale():
    # iris 40 px = 11.7 mm -> 0.2925 mm/px. PD 250 px -> 73.1 mm, rounded to 73.0. Face 500 px -> 146.3 mm.
    r = face_measurements(landmarks())
    assert r["pd_mm"] == 73.0
    assert r["face_width_mm"] == pytest.approx(146.2, abs=0.2)
    assert r["frame_size"] == "large"


def test_pd_is_rounded_to_half_mm():
    r = face_measurements(landmarks(iris_px=40, pd_px=214))  # 62.6 mm
    assert r["pd_mm"] == 62.5


@pytest.mark.parametrize("kw,code", [
    (dict(iris_px=15), "too_small"),
    (dict(nose_shift=40), "turned"),
    (dict(lid_gap=2), "eyes_closed"),
])
def test_bad_photos_are_refused(kw, code):
    with pytest.raises(PhotoError) as e:
        face_measurements(landmarks(**kw))
    assert e.value.code == code and e.value.message


def test_too_few_landmarks():
    with pytest.raises(PhotoError):
        face_measurements(np.zeros((468, 2)))


@pytest.mark.parametrize("mm,kind,want", [
    (125, "face", "small"), (136, "face", "medium"), (150, "face", "large"),
    (120, "glasses", "small"), (133, "glasses", "medium"), (145, "glasses", "large"),
])
def test_frame_size_bins(mm, kind, want):
    assert frame_size(mm, kind) == want
