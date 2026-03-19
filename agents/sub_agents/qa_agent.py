"""QA 에이전트 - 코드 리뷰 및 인수 기준 검증"""
from pathlib import Path

PROMPT_FILE = Path(__file__).parent.parent.parent / "config" / "prompts" / "qa.md"

def get_system_prompt() -> str:
    return PROMPT_FILE.read_text(encoding="utf-8")

ALLOWED_TOOLS = ["Read", "Write", "Bash", "Glob", "Grep", "WebSearch"]
MODEL = "claude-opus-4-6"
MAX_TURNS = 30
