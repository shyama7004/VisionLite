import io
import os

import numpy as np
import pytest
from fastapi.testclient import TestClient

from app import config
from app.main import app
from app.services import asr

client = TestClient(app)


def session(sid="abcd1234", **over):
    s = {
        "id": sid,
        "created_at": "2026-11-11T10:00:00+00:00",
        "language": "en",
        "consent": True,
        "customer": {"name": "Asha", "phone": "123"},
        "interview": {"age": 30, "screen_hours": "2to5", "headaches": "never", "night_driving_trouble": "no",
                      "wears_glasses": False, "last_eye_exam": "lt1"},
        "tests": {"chart": {"right": {"logmar": 0.5}, "left": {"logmar": 0.5}}, "near": {"logmar": 0.4},
                  "astig": {"right": {"unequal": False}, "left": {"unequal": False}}, "color": {"flag": False}},
    }
    s.update(over)
    return s


def test_health():
    r = client.get("/api/health").json()
    assert r["ok"] is True and r["version"]
    assert r["model"] is True  # trained by backend/app/ml/train.py


def test_save_and_read_visit():
    assert client.put("/api/sessions/abcd1234", json=session()).json() == {"id": "abcd1234"}
    got = client.get("/api/sessions/abcd1234").json()
    assert got["payload"]["customer"]["name"] == "Asha"
    assert got["recommendation"]["lens"]["type"]


def test_name_not_stored_without_consent():
    client.put("/api/sessions/nocons01", json=session("nocons01", consent=False))
    got = client.get("/api/sessions/nocons01").json()
    assert got["payload"]["customer"] == {"name": None, "phone": None}


def test_rejects_bad_input():
    assert client.put("/api/sessions/abcd1234", json=session("zzzz9999")).status_code == 422  # id mismatch
    bad = session()
    bad["interview"]["age"] = 500
    assert client.put("/api/sessions/abcd1234", json=bad).status_code == 422


def test_unknown_api_path_is_404():
    assert client.get("/api/nope").status_code == 404


def test_sync_stores_many():
    r = client.post("/api/sync", json={"sessions": [session("sync0001"), session("sync0002")]}).json()
    assert r["ids"] == ["sync0001", "sync0002"]
    assert client.get("/api/sessions/sync0002").status_code == 200


def test_recommend_uses_model_when_available():
    out = client.post("/api/recommend", json=session()).json()
    assert out["lens"]["type"] == "SINGLE_VISION_DISTANCE"
    assert out["power"]["source"] == "model"
    r = out["power"]["right"]
    assert r["low"] != r["high"] and abs(r["high"] - r["low"]) >= 1.0 - 1e-9


def test_recommend_blocks_on_red_flag():
    s = session()
    s["interview"]["red_flags"] = {"diabetes": True}
    out = client.post("/api/recommend", json=s).json()
    assert out["referral"]["blocks_lens_advice"] and out["lens"]["type"] == "NONE_UNTIL_DOCTOR"
    assert out["power"]["right"] is None and out["coatings"] == []


# ---- voice ----
def test_voice_with_mocked_model(monkeypatch):
    monkeypatch.setattr(asr, "transcribe", lambda data, lang: "yes")
    r = client.post("/api/voice/transcribe?lang=en&expect=yesno", files={"audio": ("a.webm", b"123", "audio/webm")})
    assert r.json()["matched"] == "yes"


def test_voice_choice_and_number(monkeypatch):
    monkeypatch.setattr(asr, "transcribe", lambda data, lang: "sometimes")
    ch = '[{"value":"never","label":"Never"},{"value":"sometimes","label":"Sometimes"}]'
    r = client.post("/api/voice/transcribe?lang=en&expect=choice", files={"audio": ("a.webm", b"1", "audio/webm")}, data={"choices": ch})
    assert r.json()["matched"] == "sometimes"
    monkeypatch.setattr(asr, "transcribe", lambda data, lang: "मेरी उम्र पैंतीस है")
    r = client.post("/api/voice/transcribe?lang=hi&expect=number", files={"audio": ("a.webm", b"1", "audio/webm")})
    assert r.json()["matched"] == 35


def test_odia_voice_is_off_without_a_model():
    assert config.ODIA_ASR_MODEL == ""
    r = client.post("/api/voice/transcribe?lang=or&expect=yesno", files={"audio": ("a.webm", b"123", "audio/webm")})
    assert r.status_code == 422 and r.json()["detail"]["reason"] == "odia_asr_not_configured"


def test_voice_limits():
    big = b"0" * (config.MAX_AUDIO_BYTES + 10)
    r = client.post("/api/voice/transcribe?lang=en&expect=yesno", files={"audio": ("a.webm", big, "audio/webm")})
    assert r.status_code == 413
    r = client.post("/api/voice/transcribe?lang=en&expect=yesno", files={"audio": ("a.webm", b"", "audio/webm")})
    assert r.status_code == 422
    r = client.post("/api/voice/transcribe?lang=xx&expect=yesno", files={"audio": ("a.webm", b"1", "audio/webm")})
    assert r.status_code == 422


# ---- photo ----
def _png(draw) -> bytes:
    import cv2

    img = np.full((600, 900, 3), 235, np.uint8)
    draw(img, cv2)
    ok, buf = cv2.imencode(".jpg", img)
    return buf.tobytes()


def test_glasses_photo_with_card_finds_frame_width():
    # Card 160 px long = 85.6 mm. Glasses 400 px wide -> about 214 mm is too big, so use 270 px -> 144 mm.
    def draw(img, cv2):
        cv2.rectangle(img, (60, 60), (220, 60 + 101), (90, 160, 90), -1)  # card 160 x 101 px
        cv2.rectangle(img, (300, 300), (570, 330), (20, 20, 20), -1)  # frame top bar, 270 px wide
        cv2.circle(img, (370, 380), 60, (20, 20, 20), 12)
        cv2.circle(img, (500, 380), 60, (20, 20, 20), 12)

    r = client.post("/api/vision/photo", files={"image": ("p.jpg", _png(draw), "image/jpeg")}, data={"kind": "glasses"}).json()
    assert r["ok"] is True, r
    assert 130 <= r["frame_width_mm"] <= 175
    assert r["frame_size"] in ("medium", "large")


def test_glasses_photo_without_card_asks_for_manual():
    r = client.post("/api/vision/photo", files={"image": ("p.jpg", _png(lambda i, c: None), "image/jpeg")}, data={"kind": "glasses"}).json()
    assert r["ok"] is False and r["needs_manual"] is True


def test_manual_points():
    pts = "[[100,200],[500,200],[100,100],[260,100]]"  # frame 400 px, card 160 px -> 214 mm
    r = client.post("/api/vision/photo", files={"image": ("p.jpg", _png(lambda i, c: None), "image/jpeg")},
                    data={"kind": "glasses", "points": pts}).json()
    assert r["ok"] and abs(r["frame_width_mm"] - 214.0) < 0.5 and r["frame_size"] == "large"


def test_face_photo_without_face_gives_friendly_message():
    r = client.post("/api/vision/photo", files={"image": ("p.jpg", _png(lambda i, c: None), "image/jpeg")}, data={"kind": "face"}).json()
    assert r["ok"] is False and r["code"] == "no_face" and r["message"]


def test_bad_file_is_rejected_nicely():
    r = client.post("/api/vision/photo", files={"image": ("p.jpg", b"not an image", "image/jpeg")}, data={"kind": "face"}).json()
    assert r["ok"] is False and r["code"] == "bad_image"


def test_upload_folder_stays_empty():
    assert config.UPLOAD_DIR.is_dir()
    client.post("/api/vision/photo", files={"image": ("p.jpg", b"x" * 1000, "image/jpeg")}, data={"kind": "face"})
    assert os.listdir(config.UPLOAD_DIR) == []
    leftovers = [f for f in os.listdir(config.DATA_DIR) if f.lower().endswith((".jpg", ".png", ".webm", ".wav", ".mp4"))]
    assert leftovers == []
