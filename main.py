#!/usr/bin/env python3
"""웹 프로젝트 오케스트레이터 - 대화형 REPL 진입점"""
from __future__ import annotations

import argparse
import asyncio
import os
import sys
from pathlib import Path

# .env.local 로드 (SDK 호출 전에 반드시 실행)
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent / ".env.local")
except ImportError:
    pass

from rich.console import Console
from rich.panel import Panel
from rich.rule import Rule

# 프로젝트 루트를 sys.path에 추가
sys.path.insert(0, str(Path(__file__).parent))

from agents.orchestrator import run as orchestrator_run
from agents.tools.progress_tracker import ProgressTracker

console = Console()

BANNER = """
[bold cyan]╔══════════════════════════════════════════════════════╗[/bold cyan]
[bold cyan]║   웹 프로젝트 오케스트레이터                         ║[/bold cyan]
[bold cyan]║   claude-opus-4-6 기반 멀티 에이전트 시스템          ║[/bold cyan]
[bold cyan]╚══════════════════════════════════════════════════════╝[/bold cyan]

[dim]명령어:[/dim]
  [green]<메시지>[/green]    → 오케스트레이터에게 작업 요청
  [green]status[/green]      → 태스크 현황 대시보드 출력
  [green]help[/green]        → 사용법 출력
  [green]exit[/green] / [green]quit[/green] → 종료
"""

HELP_TEXT = """
[bold]사용 예시:[/bold]
  로그인 페이지 만들어줘
  Todo 앱 만들어줘
  사용자 프로필 페이지 추가해줘

[bold]오케스트레이터 역할:[/bold]
  1. 요청 분석 → 필요시 최대 3개 질문으로 명확화
  2. ProjectPlan JSON 생성
  3. planner → design → database → backend → frontend → qa 순서로 에이전트 위임
  4. QA PASS 시 완료 보고

[bold]환경 설정:[/bold]
  .env.local 파일에 ANTHROPIC_API_KEY=sk-ant-... 필요
"""


def check_api_key() -> bool:
    """API 키 설정 여부를 확인합니다."""
    key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not key or key.startswith("sk-ant-YOUR"):
        console.print(
            Panel(
                "[red]ANTHROPIC_API_KEY가 설정되지 않았습니다.[/red]\n\n"
                ".env.local 파일에 다음을 추가하세요:\n"
                "[bold]ANTHROPIC_API_KEY=sk-ant-...[/bold]",
                title="[bold red]설정 오류[/bold red]",
                border_style="red",
            )
        )
        return False
    return True


async def run_task(task: str, tracker: ProgressTracker, cwd: str) -> None:
    """단일 태스크를 실행합니다."""
    try:
        result = await orchestrator_run(
            user_prompt=task,
            tracker=tracker,
            cwd=cwd,
        )
        if result:
            console.print(Rule("[bold green]오케스트레이터 최종 응답[/bold green]"))
            console.print(result)
    except KeyboardInterrupt:
        console.print("\n[yellow]작업이 중단되었습니다.[/yellow]")
    except Exception as e:
        console.print(f"\n[bold red]오류:[/bold red] {e}")
        raise


async def repl(cwd: str) -> None:
    """대화형 REPL 루프"""
    tracker = ProgressTracker()
    console.print(BANNER)

    if not check_api_key():
        return

    console.print(f"[dim]작업 디렉토리: {cwd}[/dim]\n")

    while True:
        try:
            user_input = console.input("[bold green]>> [/bold green]").strip()
        except (EOFError, KeyboardInterrupt):
            console.print("\n[dim]종료합니다.[/dim]")
            break

        if not user_input:
            continue

        cmd = user_input.lower()

        if cmd in ("exit", "quit", "q"):
            console.print("[dim]종료합니다.[/dim]")
            break

        if cmd == "help":
            console.print(HELP_TEXT)
            continue

        if cmd == "status":
            tracker.print_dashboard()
            continue

        # 오케스트레이터에게 위임
        await run_task(user_input, tracker, cwd)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="웹 프로젝트 오케스트레이터 — 멀티 에이전트 웹 개발 시스템",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
예시:
  python main.py                              # 대화형 REPL 실행
  python main.py --task "로그인 페이지 만들어줘"   # 직접 태스크 실행
  python main.py --task "Todo 앱 만들어줘" --cwd /path/to/project
        """,
    )
    parser.add_argument(
        "--task",
        type=str,
        default=None,
        help="직접 실행할 태스크 (미지정 시 REPL 모드)",
    )
    parser.add_argument(
        "--cwd",
        type=str,
        default=None,
        help="작업 디렉토리 (기본값: 현재 디렉토리)",
    )
    return parser.parse_args()


async def main() -> None:
    args = parse_args()
    cwd = args.cwd or os.getcwd()

    if args.task:
        # --task 모드: 배너 없이 바로 실행
        if not check_api_key():
            sys.exit(1)
        tracker = ProgressTracker()
        console.print(f"[bold blue]태스크 실행:[/bold blue] {args.task}\n")
        await run_task(args.task, tracker, cwd)
    else:
        # 대화형 REPL 모드
        await repl(cwd)


if __name__ == "__main__":
    asyncio.run(main())
