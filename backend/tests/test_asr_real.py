"""Real Whisper on a real spoken clip (made with the Windows speech engine: tests/fixtures/yes_en.wav).
Skipped when the Whisper model cannot be loaded (for example no internet on the first run)."""
from pathlib import Path

import pytest

from app.services import asr, vocab

CLIP = Path(__file__).parent / "fixtures" / "yes_en.wav"


@pytest.mark.skipif(not CLIP.exists(), reason="no audio fixture")
def test_whisper_hears_yes():
    try:
        text = asr.transcribe(CLIP.read_bytes(), "en")
    except asr.AsrUnavailable as e:
        pytest.skip(f"Whisper model not available: {e}")
    assert vocab.match_yesno(text, "en") == "yes", text
