import json
from typing import Annotated, Literal, Optional

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import JSONResponse

from .. import config
from ..schemas import VoiceOut
from ..services import asr, vocab

router = APIRouter()


@router.post("/voice/transcribe", response_model=VoiceOut)
async def transcribe(
    audio: Annotated[UploadFile, File()],
    lang: Literal["en", "hi", "or"] = Query(...),
    expect: Literal["yesno", "number", "choice"] = Query(...),
    choices: Annotated[Optional[str], Form()] = None,
):
    data = await audio.read(config.MAX_AUDIO_BYTES + 1)
    if len(data) > config.MAX_AUDIO_BYTES:
        raise HTTPException(413, "Audio is too large (limit 2 MB).")
    if not data:
        raise HTTPException(422, "Audio is empty.")

    choice_list = []
    if expect == "choice":
        try:
            choice_list = json.loads(choices or "[]")
            assert isinstance(choice_list, list) and all("value" in c and "label" in c for c in choice_list)
        except Exception:
            raise HTTPException(422, "choices must be a JSON list of {value, label}.")

    try:
        text = asr.transcribe(data, lang)
    except asr.OdiaNotConfigured:
        return JSONResponse(status_code=422, content={"detail": {"reason": "odia_asr_not_configured"}})
    except asr.AsrUnavailable:
        return JSONResponse(status_code=503, content={"detail": {"reason": "asr_unavailable"}})
    except Exception:
        raise HTTPException(422, "The audio could not be read.")

    if expect == "yesno":
        matched = vocab.match_yesno(text, lang)
    elif expect == "number":
        matched = vocab.match_number(text, lang)
    else:
        matched = vocab.match_choice(text, choice_list)
    return VoiceOut(text=text, matched=matched, confidence=vocab.confidence_for(matched))
