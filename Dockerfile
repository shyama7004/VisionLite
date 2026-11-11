# NOTE: this file was written but NOT built or run on the machine used for the prototype
# (Docker is not installed there). Treat it as untested until `docker build` passes.

# 1. Build the web app
FROM node:20-slim AS web
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json frontend/
RUN cd frontend && npm ci
COPY frontend frontend
COPY shared shared
# The face model and wasm files are not in git. Fetch and copy them so the app works offline.
RUN cd frontend && mkdir -p public/models public/mediapipe/wasm \
    && cp node_modules/@mediapipe/tasks-vision/wasm/* public/mediapipe/wasm/ \
    && node -e "fetch('https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task').then(r=>r.arrayBuffer()).then(b=>require('fs').writeFileSync('public/models/face_landmarker.task',Buffer.from(b)))"
RUN cd frontend && npm run build

# 2. Python app
FROM python:3.11-slim AS app
RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg libgomp1 libpango-1.0-0 libpangoft2-1.0-0 libharfbuzz0b \
      fonts-noto-core poppler-utils \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY backend/requirements.txt backend/requirements.txt
# weasyprint is used in Docker. The Chromium fallback (playwright) is not needed here.
RUN grep -v -E "^(playwright|pypdfium2)" backend/requirements.txt > /tmp/req.txt \
    && pip install --no-cache-dir -r /tmp/req.txt
COPY backend backend
COPY shared shared
COPY frontend/src/i18n frontend/src/i18n
COPY --from=web /build/frontend/dist backend/app/static
# Face model for photo analysis (same file the browser uses).
RUN cp backend/app/static/models/face_landmarker.task backend/app/ml/models/face_landmarker.task
# Bake in the speech model and train the small model, so the first request is not slow.
ENV WHISPER_MODEL=base
RUN python -c "from faster_whisper import WhisperModel; WhisperModel('base', device='cpu', compute_type='int8')" \
    && python backend/app/ml/train.py
# Check that the Hindi and Odia fonts are really there.
RUN fc-list | grep -i -E "devanagari" && fc-list | grep -i -E "oriya"
RUN useradd -m app && mkdir -p /app/data && chown -R app /app/data /root/.cache 2>/dev/null; chown -R app /app
USER app
ENV DATA_DIR=/app/data
WORKDIR /app/backend
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
