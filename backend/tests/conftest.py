import os
import sys
import tempfile
from pathlib import Path

# Settings must be in place before the app is imported.
_tmp = tempfile.mkdtemp(prefix="visionlite-test-")
os.environ["DATA_DIR"] = _tmp
os.environ["WHISPER_PRELOAD"] = "0"
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
