from fastapi import APIRouter

from .. import config
from ..schemas import HealthOut
from ..services import asr
from ..services.recommend import model

router = APIRouter()


@router.get("/health", response_model=HealthOut)
def health() -> HealthOut:
    a = asr.status()
    return HealthOut(
        ok=True,
        whisper=a["available"],
        whisper_loaded=a["loaded"],
        model=model.available(),
        odia_asr=a["odia"],
        version=config.VERSION,
    )
