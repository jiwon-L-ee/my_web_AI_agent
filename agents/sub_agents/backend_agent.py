"""백엔드 에이전트 - API 라우트 및 미들웨어 구현"""
from pathlib import Path

PROMPT_FILE = Path(__file__).parent.parent.parent / "config" / "prompts" / "backend.md"

def get_system_prompt() -> str:
    return PROMPT_FILE.read_text(encoding="utf-8")

ALLOWED_TOOLS = ["Read", "Write", "Edit", "Bash", "Glob", "Grep", "WebSearch"]
MODEL = "claude-sonnet-4-6"
MAX_TURNS = 30
