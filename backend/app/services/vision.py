"""Photo analysis. Everything is done in memory. No image is ever written to disk.

Face photo: pupil distance and face width, using the iris (about 11.7 mm) as a ruler.
Glasses photo: frame width, using a bank card (85.6 mm) lying next to the glasses as a ruler.
"""
import math

import cv2
import numpy as np

from .. import config
from .recommend.rules import RULES

IRIS_MM = RULES["iris_diameter_mm"]
CARD_W, CARD_H = RULES["card_mm"]["width"], RULES["card_mm"]["height"]
CARD_RATIO = CARD_W / CARD_H  # about 1.586


class PhotoError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def _d(a, b) -> float:
    return float(math.hypot(a[0] - b[0], a[1] - b[1]))


def frame_size(width_mm: float, kind: str) -> str:
    cfg = RULES["frame_size_mm"][kind]
    if width_mm < cfg["small_lt"]:
        return "small"
    if width_mm > cfg["large_gt"]:
        return "large"
    return "medium"


def _round_half_mm(v: float) -> float:
    return round(v * 2) / 2


def eye_aspect(lm: np.ndarray, top: int, bottom: int, c1: int, c2: int) -> float:
    return _d(lm[top], lm[bottom]) / max(_d(lm[c1], lm[c2]), 1e-6)


def face_measurements(lm: np.ndarray) -> dict:
    """lm: array (478, 2) of landmark positions in PIXELS. Pure geometry, easy to test."""
    if lm.shape[0] < 478:
        raise PhotoError("no_iris", "The eyes could not be found. Please use a clearer, brighter photo.")
    iris_r = _d(lm[469], lm[471])
    iris_l = _d(lm[474], lm[476])
    iris = (iris_r + iris_l) / 2
    if iris < 20:
        raise PhotoError("too_small", "The face is too small in the photo. Please take it closer.")
    # Head turned: nose tip must sit near the middle between the eyes.
    mid_x = (lm[33][0] + lm[263][0]) / 2
    span = abs(lm[263][0] - lm[33][0])
    if span > 0 and abs(lm[1][0] - mid_x) / span > 0.10:
        raise PhotoError("turned", "The head is turned. Please look straight at the camera.")
    # Eyes closed: lid gap is tiny compared with eye width.
    ear = min(eye_aspect(lm, 159, 145, 33, 133), eye_aspect(lm, 386, 374, 362, 263))
    if ear < 0.12:
        raise PhotoError("eyes_closed", "The eyes look closed. Please keep them open.")
    scale = IRIS_MM / iris  # mm per pixel
    pd = _round_half_mm(_d(lm[468], lm[473]) * scale)
    face_w = round(_d(lm[234], lm[454]) * scale, 1)
    return {"pd_mm": pd, "face_width_mm": face_w, "frame_size": frame_size(face_w, "face")}


_landmarker = None


def _face_landmarker():
    global _landmarker
    if _landmarker is None:
        path = config.face_model_path()
        if path is None:
            raise PhotoError("no_model", "The face model file is missing on the server.")
        from mediapipe.tasks.python import BaseOptions, vision

        opts = vision.FaceLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=str(path)),
            running_mode=vision.RunningMode.IMAGE,
            num_faces=2,
        )
        _landmarker = vision.FaceLandmarker.create_from_options(opts)
    return _landmarker


def decode(data: bytes) -> np.ndarray:
    img = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        raise PhotoError("bad_image", "This file is not a readable photo.")
    return img


def analyze_face(data: bytes) -> dict:
    import mediapipe as mp

    img = decode(data)
    h, w = img.shape[:2]
    rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    result = _face_landmarker().detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb))
    faces = result.face_landmarks
    if len(faces) == 0:
        raise PhotoError("no_face", "No face was found. Please use a brighter photo, looking at the camera.")
    if len(faces) > 1:
        raise PhotoError("many_faces", "More than one face was found. Please photograph one person.")
    lm = np.array([[p.x * w, p.y * h] for p in faces[0]])
    return face_measurements(lm)


def find_card(img: np.ndarray):
    """Largest 4 sided shape with the aspect ratio of a bank card. Returns (long_side_px, polygon) or None."""
    gray = cv2.GaussianBlur(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY), (5, 5), 0)
    edges = cv2.dilate(cv2.Canny(gray, 30, 120), None, iterations=1)
    contours, _ = cv2.findContours(edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    best = None
    min_area = img.shape[0] * img.shape[1] * 0.01
    for c in contours:
        area = cv2.contourArea(c)
        if area < min_area:
            continue
        approx = cv2.approxPolyDP(c, 0.02 * cv2.arcLength(c, True), True)
        if len(approx) != 4 or not cv2.isContourConvex(approx):
            continue
        (cx, cy), (rw, rh), _ = cv2.minAreaRect(approx)
        long_s, short_s = max(rw, rh), min(rw, rh)
        if short_s < 1 or abs(long_s / short_s - CARD_RATIO) > 0.18 * CARD_RATIO:
            continue
        if best is None or area > best[0]:
            best = (area, long_s, approx)
    return (best[1], best[2]) if best else None


def analyze_glasses(data: bytes) -> dict:
    img = decode(data)
    card = find_card(img)
    if card is None:
        return {"needs_manual": True, "message": "The card was not found. Tap the frame and card edges instead."}
    long_px, poly = card
    mm_per_px = CARD_W / long_px
    # Blank out the card, then find the biggest dark shape (the glasses).
    work = img.copy()
    cv2.fillPoly(work, [poly.astype(np.int32)], (255, 255, 255))
    gray = cv2.GaussianBlur(cv2.cvtColor(work, cv2.COLOR_BGR2GRAY), (7, 7), 0)
    _, mask = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return {"needs_manual": True, "message": "The glasses were not found. Tap the frame and card edges instead."}
    # Join all dark parts that are big enough (two lenses and a bridge may be separate shapes).
    big = [c for c in contours if cv2.contourArea(c) > img.shape[0] * img.shape[1] * 0.002]
    if not big:
        return {"needs_manual": True, "message": "The glasses were not found. Tap the frame and card edges instead."}
    x, y, w, h = cv2.boundingRect(np.vstack(big))
    width_mm = w * mm_per_px
    if not 90 <= width_mm <= 200:  # not a believable frame
        return {"needs_manual": True, "message": "The measurement looks wrong. Tap the frame and card edges instead."}
    return {"frame_width_mm": round(width_mm, 1), "frame_size": frame_size(width_mm, "glasses")}


def from_manual_points(points: list[list[float]]) -> dict:
    """Four taps: frame left, frame right, card start, card end (card long side)."""
    if len(points) != 4:
        raise PhotoError("bad_points", "Four points are needed.")
    frame_px = _d(points[0], points[1])
    card_px = _d(points[2], points[3])
    if card_px < 5 or frame_px < 5:
        raise PhotoError("bad_points", "The points are too close together.")
    width_mm = frame_px * CARD_W / card_px
    return {"frame_width_mm": round(width_mm, 1), "frame_size": frame_size(width_mm, "glasses")}
