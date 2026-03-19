"""디자인 에이전트 - 디자인 시스템 및 CSS 토큰"""
from pathlib import Path

PROMPT_FILE = Path(__file__).parent.parent.parent / "config" / "prompts" / "design.md"

def get_system_prompt() -> str:
    return PROMPT_FILE.read_text(encoding="utf-8")

ALLOWED_TOOLS = ["Read", "Write", "WebSearch", "WebFetch", "Glob"]
MODEL = "claude-haiku-4-5-20251001"
MAX_TURNS = 20
