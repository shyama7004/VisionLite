import json
from typing import Annotated, Literal, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from .. import config
from ..schemas import PhotoOut
from ..services import vision

router = APIRouter()


@router.post("/vision/photo", response_model=PhotoOut)
async def photo(
    image: Annotated[UploadFile, File()],
    kind: Annotated[Literal["face", "glasses"], Form()],
    points: Annotated[Optional[str], Form()] = None,
):
    data = await image.read(config.MAX_PHOTO_BYTES + 1)
    if len(data) > config.MAX_PHOTO_BYTES:
        raise HTTPException(413, "Photo is too large (limit 5 MB).")
    try:
        if kind == "face":
            return PhotoOut(ok=True, **vision.analyze_face(data))
        if points:
            try:
                pts = json.loads(points)
            except Exception:
                raise HTTPException(422, "points must be JSON.")
            return PhotoOut(ok=True, **vision.from_manual_points(pts))
        r = vision.analyze_glasses(data)
        if r.get("needs_manual"):
            return PhotoOut(ok=False, needs_manual=True, message=r["message"])
        return PhotoOut(ok=True, **r)
    except vision.PhotoError as e:
        # A friendly message, not an error page. The photo is only in memory and is dropped here.
        return PhotoOut(ok=False, code=e.code, message=e.message)
    finally:
        del data
