from fastapi import APIRouter

from ..schemas import SessionIn
from ..services.recommend import recommend

router = APIRouter()


@router.post("/recommend")
def post_recommend(s: SessionIn) -> dict:
    return recommend(s.model_dump())
