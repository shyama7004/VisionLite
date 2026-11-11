"""One command line for the whole project. Works on Windows, Mac and Linux, so `make` is not required.

  python scripts/run.py setup   install everything, fetch the face model, copy wasm, train the model
  python scripts/run.py dev     backend on :8000 and frontend on :5173 (add --https for phone testing)
  python scripts/run.py test    backend pytest and frontend vitest
  python scripts/run.py e2e     build, then run the browser tests
  python scripts/run.py build   build the web app
  python scripts/run.py run     build, then serve everything from one port (8000)
"""
import os
import shutil
import subprocess
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACK = ROOT / "backend"
FRONT = ROOT / "frontend"
WIN = os.name == "nt"
VENV_PY = BACK / ".venv" / ("Scripts/python.exe" if WIN else "bin/python")
NPM = "npm.cmd" if WIN else "npm"
NPX = "npx.cmd" if WIN else "npx"
FACE_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"


def sh(cmd, cwd=None, env=None):
    print("->", " ".join(str(c) for c in cmd))
    subprocess.run([str(c) for c in cmd], cwd=cwd, check=True, env={**os.environ, **(env or {})})


def find_python() -> str:
    # MediaPipe has wheels for Python 3.9 to 3.12. Avoid 3.13 and newer.
    for v in ("3.11", "3.12", "3.10"):
        try:
            if WIN:
                out = subprocess.run(["py", f"-{v}", "-c", "import sys;print(sys.executable)"], capture_output=True, text=True)
                if out.returncode == 0:
                    return out.stdout.strip()
            elif shutil.which(f"python{v}"):
                return f"python{v}"
        except FileNotFoundError:
            pass
    sys.exit("Need Python 3.10, 3.11 or 3.12 (MediaPipe has no wheel for newer versions).")


def setup():
    if not VENV_PY.exists():
        sh([find_python(), "-m", "venv", BACK / ".venv"])
    sh([VENV_PY, "-m", "pip", "install", "-q", "-r", BACK / "requirements.txt"])
    sh([NPM, "install"], cwd=FRONT)
    model = FRONT / "public" / "models" / "face_landmarker.task"
    if not model.exists():
        model.parent.mkdir(parents=True, exist_ok=True)
        print("Downloading face model (about 4 MB)...")
        urllib.request.urlretrieve(FACE_URL, model)
    wasm_src = FRONT / "node_modules" / "@mediapipe" / "tasks-vision" / "wasm"
    wasm_dst = FRONT / "public" / "mediapipe" / "wasm"
    wasm_dst.mkdir(parents=True, exist_ok=True)
    for f in wasm_src.iterdir():
        shutil.copy2(f, wasm_dst / f.name)
    sh([VENV_PY, BACK / "app" / "ml" / "train.py"])
    sh([VENV_PY, "-m", "playwright", "install", "chromium"])
    sh([NPX, "playwright", "install", "chromium"], cwd=FRONT)
    print("\nSetup done. Next: python scripts/run.py dev")


def dev(https: bool):
    api = subprocess.Popen([str(VENV_PY), "-m", "uvicorn", "app.main:app", "--reload", "--port", "8000"], cwd=BACK)
    try:
        sh([NPM, "run", "dev"], cwd=FRONT, env={"HTTPS": "1"} if https else None)
    finally:
        api.terminate()


def test():
    sh([VENV_PY, "-m", "pytest", "-q"], cwd=BACK)
    sh([NPX, "vitest", "run"], cwd=FRONT)


def build():
    sh([NPM, "run", "build"], cwd=FRONT)


def e2e():
    build()
    sh([NPX, "playwright", "test"], cwd=FRONT)


def run():
    build()
    sh([VENV_PY, "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"], cwd=BACK,
       env={"STATIC_DIR": str(FRONT / "dist")})


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "dev":
        dev("--https" in sys.argv)
    elif cmd in ("setup", "test", "e2e", "build", "run"):
        globals()[cmd]()
    else:
        print(__doc__)
