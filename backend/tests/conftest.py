import sys
from pathlib import Path

# Lets tests import "app" when pytest runs from the repo root or from backend/.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
