import uuid

from fastapi import APIRouter, HTTPException

from .. import db
from ..schemas import IdOut, SessionIn, SyncIn, SyncOut
from ..services.recommend import recommend

router = APIRouter()


def _store(s: SessionIn) -> None:
    payload = s.model_dump()
    # Privacy: name and phone are kept only when the customer agreed.
    if not s.consent:
        payload["customer"] = {"name": None, "phone": None}
    db.upsert_visit(s.id, s.created_at, s.language, payload, recommend(payload))


@router.post("/sessions", response_model=IdOut)
def create_session() -> IdOut:
    """Creates an empty visit and returns its id. The app can also make its own id and use PUT."""
    return IdOut(id=uuid.uuid4().hex)


@router.put("/sessions/{session_id}", response_model=IdOut)
def put_session(session_id: str, s: SessionIn) -> IdOut:
    if s.id != session_id:
        raise HTTPException(422, "The id in the URL and in the body must match.")
    _store(s)
    return IdOut(id=s.id)


@router.get("/sessions/{session_id}")
def get_session(session_id: str):
    v = db.get_visit(session_id)
    if not v:
        raise HTTPException(404, "Visit not found.")
    return v


@router.post("/sync", response_model=SyncOut)
def sync(body: SyncIn) -> SyncOut:
    for s in body.sessions:
        _store(s)
    return SyncOut(ids=[s.id for s in body.sessions])
