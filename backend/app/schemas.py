"""Pydantic models. Every request and response goes through one of these."""
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class Loose(BaseModel):
    # Unknown extra fields are kept, so the app can add fields without breaking old servers.
    model_config = ConfigDict(extra="allow")


class RedFlags(Loose):
    sudden_vision_change: bool = False
    eye_pain_or_redness: bool = False
    flashes_or_floaters: bool = False
    double_vision: bool = False
    diabetes: bool = False
    eye_injury_or_surgery: bool = False


class Interview(Loose):
    age: int = Field(ge=1, le=120)
    screen_hours: Literal["lt2", "2to5", "6to9", "gt9"] = "lt2"
    headaches: Literal["never", "sometimes", "often"] = "never"
    night_driving_trouble: Literal["yes", "no", "does_not_drive"] = "no"
    wears_glasses: bool = False
    glasses_age: Optional[Literal["lt1", "1to2", "gt2"]] = None
    last_eye_exam: Literal["never", "lt1", "1to2", "gt2"] = "lt1"
    red_flags: RedFlags = RedFlags()


class ChartResult(Loose):
    logmar: float = Field(ge=-0.3, le=1.5)
    line_results: list = []


class AstigResult(Loose):
    unequal: bool
    darkest_deg: Optional[int] = None


class ColorResult(Loose):
    plates_shown: int = 0
    plates_correct: int = 0
    flag: bool = False
    invalid: bool = False


class Chart(Loose):
    right: Optional[ChartResult] = None
    left: Optional[ChartResult] = None


class Astig(Loose):
    right: Optional[AstigResult] = None
    left: Optional[AstigResult] = None


class Tests(Loose):
    chart: Chart = Chart()
    near: Optional[ChartResult] = None
    astig: Astig = Astig()
    color: Optional[ColorResult] = None


class Customer(Loose):
    name: Optional[str] = Field(default=None, max_length=120)
    phone: Optional[str] = Field(default=None, max_length=30)


class Photo(Loose):
    pd_mm: Optional[float] = None
    face_width_mm: Optional[float] = None
    frame_size: Optional[Literal["small", "medium", "large"]] = None
    source: Optional[Literal["face", "glasses"]] = None


class SessionIn(Loose):
    id: str = Field(min_length=4, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")
    created_at: str
    language: Literal["en", "hi", "or"] = "en"
    consent: bool = False
    customer: Customer = Customer()
    interview: Optional[Interview] = None
    calibration: Optional[dict] = None
    tests: Tests = Tests()
    photo: Optional[Photo] = None
    distance_log: list = []


class IdOut(BaseModel):
    id: str


class SyncIn(BaseModel):
    sessions: list[SessionIn] = Field(max_length=200)


class SyncOut(BaseModel):
    ids: list[str]


class HealthOut(BaseModel):
    ok: bool
    whisper: bool
    whisper_loaded: bool
    model: bool
    odia_asr: bool
    version: str


class VoiceOut(BaseModel):
    text: str
    matched: Optional[str | int] = None
    confidence: float = 0.0


class PhotoOut(BaseModel):
    ok: bool
    needs_manual: bool = False
    message: Optional[str] = None
    code: Optional[str] = None
    pd_mm: Optional[float] = None
    face_width_mm: Optional[float] = None
    frame_width_mm: Optional[float] = None
    frame_size: Optional[Literal["small", "medium", "large"]] = None
