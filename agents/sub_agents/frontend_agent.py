"""프론트엔드 에이전트 - HTML/CSS/JS 구현"""
from pathlib import Path

PROMPT_FILE = Path(__file__).parent.parent.parent / "config" / "prompts" / "frontend.md"

def get_system_prompt() -> str:
    return PROMPT_FILE.read_text(encoding="utf-8")

ALLOWED_TOOLS = ["Read", "Write", "Edit", "Bash", "Glob", "Grep"]
MODEL = "claude-sonnet-4-6"
MAX_TURNS = 30
