"""데이터베이스 에이전트 - Supabase 스키마 및 마이그레이션"""
from pathlib import Path

PROMPT_FILE = Path(__file__).parent.parent.parent / "config" / "prompts" / "database.md"

def get_system_prompt() -> str:
    return PROMPT_FILE.read_text(encoding="utf-8")

ALLOWED_TOOLS = ["Read", "Write", "Bash", "Glob", "WebSearch"]
MODEL = "claude-sonnet-4-6"
MAX_TURNS = 20
