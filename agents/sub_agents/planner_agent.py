"""기획 에이전트 - 기술 사양서 작성"""
from pathlib import Path

PROMPT_FILE = Path(__file__).parent.parent.parent / "config" / "prompts" / "planner.md"

def get_system_prompt() -> str:
    return PROMPT_FILE.read_text(encoding="utf-8")

ALLOWED_TOOLS = ["WebSearch", "WebFetch", "Read", "Glob"]
MODEL = "claude-sonnet-4-6"
MAX_TURNS = 20
