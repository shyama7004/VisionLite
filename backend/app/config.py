"""Settings from environment variables, with safe defaults."""
import os
from pathlib import Path

APP_DIR = Path(__file__).resolve().parent
REPO_DIR = APP_DIR.parents[1]

VERSION = "0.1.0"
DATA_DIR = Path(os.environ.get("DATA_DIR", REPO_DIR / "data"))
UPLOAD_DIR = DATA_DIR / "uploads"  # stays empty: photos and audio are handled in memory
WHISPER_MODEL = os.environ.get("WHISPER_MODEL", "base")
# Path to a CTranslate2 converted Whisper model for Odia. Odia voice stays off without it.
ODIA_ASR_MODEL = os.environ.get("ODIA_ASR_MODEL", "")
WHISPER_PRELOAD = os.environ.get("WHISPER_PRELOAD", "1") == "1"
STORE_NAME = os.environ.get("STORE_NAME", "")
RETENTION_DAYS = int(os.environ.get("RETENTION_DAYS", "90"))
CORS_ORIGINS = [o for o in os.environ.get("CORS_ORIGINS", "http://localhost:5173,https://localhost:5173").split(",") if o]

MAX_AUDIO_BYTES = 2 * 1024 * 1024
MAX_PHOTO_BYTES = 5 * 1024 * 1024

MODEL_DIR = APP_DIR / "ml" / "models"
# The face model is the same file the browser uses. Found in the frontend folder or copied next to the ML models.
FACE_MODEL_CANDIDATES = [
    Path(os.environ.get("FACE_MODEL", "")) if os.environ.get("FACE_MODEL") else None,
    MODEL_DIR / "face_landmarker.task",
    REPO_DIR / "frontend" / "public" / "models" / "face_landmarker.task",
]
RULES_PATH = Path(os.environ.get("RULES_PATH", REPO_DIR / "shared" / "rules.json"))
I18N_DIR = Path(os.environ.get("I18N_DIR", REPO_DIR / "frontend" / "src" / "i18n"))
STATIC_DIR = Path(os.environ.get("STATIC_DIR", APP_DIR / "static"))


def face_model_path():
    for p in FACE_MODEL_CANDIDATES:
        if p and p.is_file():
            return p
    return None
