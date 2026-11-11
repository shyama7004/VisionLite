"""Speech to text with faster-whisper (CPU, int8).

Hindi and English use the normal Whisper model. Odia is only used when ODIA_ASR_MODEL points to a
CTranslate2 model, because the stock Whisper models are not usable for Odia.
"""
import io
import threading

from .. import config


class OdiaNotConfigured(Exception):
    pass


class AsrUnavailable(Exception):
    pass


_models: dict[str, object] = {}
_lock = threading.Lock()


def _importable() -> bool:
    try:
        import faster_whisper  # noqa: F401

        return True
    except Exception:
        return False


def odia_configured() -> bool:
    return bool(config.ODIA_ASR_MODEL)


def status() -> dict:
    return {"available": _importable(), "loaded": "default" in _models, "odia": odia_configured()}


def _get(kind: str):
    with _lock:
        if kind not in _models:
            try:
                from faster_whisper import WhisperModel

                name = config.ODIA_ASR_MODEL if kind == "odia" else config.WHISPER_MODEL
                _models[kind] = WhisperModel(name, device="cpu", compute_type="int8")
            except Exception as e:  # download failed, no internet, bad path
                raise AsrUnavailable(str(e)) from e
        return _models[kind]


def preload() -> None:
    """Load the default model in the background so the first request is not slow."""
    def run():
        try:
            _get("default")
        except Exception:
            pass

    threading.Thread(target=run, daemon=True).start()


def transcribe(audio: bytes, lang: str) -> str:
    if lang == "or" and not odia_configured():
        raise OdiaNotConfigured()
    model = _get("odia" if lang == "or" else "default")
    # faster-whisper decodes webm and mp4 itself (through PyAV), so no temp file and no ffmpeg call is needed.
    segments, _ = model.transcribe(io.BytesIO(audio), language=lang, vad_filter=True, beam_size=1)
    return " ".join(s.text.strip() for s in segments).strip()
