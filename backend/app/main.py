"""VisionLite server. Serves the API under /api and the built web app for everything else."""
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from . import config, db
from .routers import health, recommend, report, sessions, vision, voice
from .services import asr


@asynccontextmanager
async def lifespan(_: FastAPI):
    db.init()
    if config.WHISPER_PRELOAD:
        asr.preload()
    yield


app = FastAPI(title="VisionLite", version=config.VERSION, lifespan=lifespan)

# CORS only for the Vite dev server. In production the app and the API share one origin.
app.add_middleware(CORSMiddleware, allow_origins=config.CORS_ORIGINS, allow_methods=["*"], allow_headers=["*"])

for r in (health, sessions, voice, vision, recommend, report):
    app.include_router(r.router, prefix="/api")


@app.get("/api/{rest:path}", include_in_schema=False)
def api_404(rest: str):
    raise HTTPException(404, "Unknown API path.")


if config.STATIC_DIR.is_dir():
    app.mount("/assets", StaticFiles(directory=config.STATIC_DIR / "assets"), name="assets") if (config.STATIC_DIR / "assets").is_dir() else None

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        # Real files (icons, wasm, model, service worker) are served as they are.
        f = (config.STATIC_DIR / path).resolve()
        if path and f.is_file() and config.STATIC_DIR.resolve() in f.parents:
            return FileResponse(f)
        # Anything else is a page route: give the app, so a refresh works.
        return FileResponse(config.STATIC_DIR / "index.html", headers={"Cache-Control": "no-cache"})
