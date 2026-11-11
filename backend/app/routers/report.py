from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from .. import db
from ..services import report

router = APIRouter()


# A plain "def" runs in a worker thread, which is what the PDF engines need.
@router.get("/sessions/{session_id}/report.pdf")
def report_pdf(session_id: str):
    visit = db.get_visit(session_id)
    if not visit:
        raise HTTPException(404, "Visit not found. Save the visit first.")
    pdf = report.build_pdf(visit)
    return Response(
        pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="visionlite-{session_id[:8]}.pdf"', "Cache-Control": "no-store"},
    )
