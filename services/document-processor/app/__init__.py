
from pathlib import Path
import sys

_SHARED_AI_CLIENTS = (
    Path(__file__).resolve().parents[2] / "platform" / "libs" / "ai-clients"
)
_shared_path = str(_SHARED_AI_CLIENTS)
if _shared_path not in sys.path:
    sys.path.insert(0, _shared_path)
