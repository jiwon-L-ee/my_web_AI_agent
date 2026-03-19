"""오케스트레이터 에이전트 - 하위 에이전트를 총괄하는 임원급 에이전트"""
from __future__ import annotations

import os
from pathlib import Path
from typing import AsyncGenerator, Any

import yaml

from agents.tools.progress_tracker import ProgressTracker

try:
    from claude_code_sdk import query, ClaudeCodeOptions, ResultMessage
except ImportError as e:
    raise ImportError(
        "claude-code-sdk가 설치되지 않았습니다.\n"
        "pip install claude-code-sdk 를 실행하세요."
    ) from e

# 파일 경로
_ROOT = Path(__file__).parent.parent
_CONFIG_FILE = _ROOT / "config" / "agents.yaml"
_PROMPTS_DIR = _ROOT / "config" / "prompts"


def _load_config() -> dict:
    with open(_CONFIG_FILE, encoding="utf-8") as f:
        return yaml.safe_load(f)


def _load_prompt(name: str) -> str:
    path = _PROMPTS_DIR / f"{name}.md"
    if not path.exists():
        raise FileNotFoundError(f"프롬프트 파일을 찾을 수 없습니다: {path}")
    return path.read_text(encoding="utf-8")


def _build_system_prompt(cwd: str, config: dict) -> str:
    """오케스트레이터 시스템 프롬프트에 하위 에이전트 로스터와 작업 디렉토리를 주입합니다."""
    base_prompt = _load_prompt("orchestrator")

    # 하위 에이전트 시스템 프롬프트 요약을 주입
    agent_names = ["planner", "design", "database", "backend", "frontend", "qa"]
    roster_section = "\n\n---\n\n## 하위 에이전트 시스템 프롬프트\n\n"
    roster_section += "Agent 도구 호출 시, 아래 각 에이전트의 시스템 프롬프트를 prompt 파라미터에 포함하세요.\n\n"

    for name in agent_names:
        try:
            prompt_text = _load_prompt(name)
            agent_model = config.get(name, {}).get("model", "claude-sonnet-4-6")
            roster_section += f"### {name} 에이전트 (모델: {agent_model})\n```\n{prompt_text}\n```\n\n"
        except FileNotFoundError:
            pass

    cwd_section = f"\n\n---\n\n## 작업 디렉토리\n\n현재 작업 디렉토리: `{cwd}`\n모든 파일 작업은 이 경로 기준으로 수행합니다.\n"

    return base_prompt + roster_section + cwd_section


async def run(
    user_prompt: str,
    tracker: ProgressTracker,
    cwd: str | None = None,
) -> str:
    """오케스트레이터를 실행하고 최종 결과를 반환합니다."""
    config = _load_config()
    orch_config = config.get("orchestrator", {})

    working_dir = cwd or os.getcwd()
    system_prompt = _build_system_prompt(working_dir, config)

    allowed_tools: list[str] = orch_config.get("allowed_tools", [
        "Agent", "Glob", "Grep", "Read", "Bash", "WebSearch",
    ])
    model: str = orch_config.get("model", "claude-opus-4-6")
    max_turns: int = orch_config.get("max_turns", 50)

    options = ClaudeCodeOptions(
        system_prompt=system_prompt,
        allowed_tools=allowed_tools,
        model=model,
        max_turns=max_turns,
        cwd=working_dir,
    )

    tracker.console.print(
        f"\n[bold blue]오케스트레이터 시작[/bold blue] — 모델: {model} | 최대 턴: {max_turns}\n"
    )

    final_result = ""

    async for message in query(prompt=user_prompt, options=options):
        await tracker.process_message(message)

        if isinstance(message, ResultMessage):
            if message.result:
                final_result = message.result

    return final_result
