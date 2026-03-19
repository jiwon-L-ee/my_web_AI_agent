"""태스크 상태 추적 및 모니터링 - SDK 메시지 스트림 처리"""
from __future__ import annotations

import io
import os
import sys
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

from rich.console import Console
from rich.live import Live
from rich.panel import Panel
from rich.progress import BarColumn, Progress, SpinnerColumn, TextColumn, TimeElapsedColumn
from rich.table import Table
from rich.text import Text

# Windows에서 UTF-8 출력 강제 설정
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
        sys.stderr.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
    except AttributeError:
        pass

try:
    from claude_code_sdk import AssistantMessage, ResultMessage, SystemMessage, UserMessage
except ImportError:
    # 타입 힌트용 폴백 — SDK 없이도 임포트 가능
    AssistantMessage = ResultMessage = SystemMessage = UserMessage = object  # type: ignore


class TaskStatus(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETE = "COMPLETE"
    FAILED = "FAILED"


STATUS_STYLE = {
    TaskStatus.PENDING: "dim",
    TaskStatus.RUNNING: "bold yellow",
    TaskStatus.COMPLETE: "bold green",
    TaskStatus.FAILED: "bold red",
}

STATUS_ICON = {
    TaskStatus.PENDING: "⏳",
    TaskStatus.RUNNING: "🔄",
    TaskStatus.COMPLETE: "✅",
    TaskStatus.FAILED: "❌",
}


@dataclass
class Task:
    id: str
    title: str
    agent: str
    status: TaskStatus = TaskStatus.PENDING
    failure_count: int = 0
    started_at: float = 0.0
    finished_at: float = 0.0
    last_message: str = ""

    @property
    def elapsed(self) -> float:
        if self.started_at == 0:
            return 0.0
        end = self.finished_at if self.finished_at else time.time()
        return end - self.started_at


class ProgressTracker:
    """SDK 메시지 스트림을 수신하여 태스크 상태를 추적하고 콘솔에 출력합니다."""

    def __init__(self) -> None:
        self.tasks: dict[str, Task] = {}
        # Windows: force_terminal + UTF-8 스트림으로 인코딩 문제 방지
        self.console = Console(force_terminal=True, highlight=False)
        self._current_tool: str | None = None
        self._buffer: list[str] = []

    # ------------------------------------------------------------------
    # 태스크 관리 API
    # ------------------------------------------------------------------

    def register_task(self, task_id: str, title: str, agent: str) -> None:
        """태스크를 등록합니다 (PENDING 상태)."""
        self.tasks[task_id] = Task(id=task_id, title=title, agent=agent)

    def start_task(self, task_id: str) -> None:
        task = self._get_or_create(task_id)
        task.status = TaskStatus.RUNNING
        task.started_at = time.time()
        self.console.print(
            f"[bold yellow]▶ 시작:[/bold yellow] [{task.agent}] {task.title}"
        )

    def complete_task(self, task_id: str, message: str = "") -> None:
        task = self._get_or_create(task_id)
        task.status = TaskStatus.COMPLETE
        task.finished_at = time.time()
        task.last_message = message
        elapsed = f"{task.elapsed:.1f}s"
        self.console.print(
            f"[bold green]✔ 완료:[/bold green] [{task.agent}] {task.title} ({elapsed})"
        )

    def fail_task(self, task_id: str, message: str = "") -> bool:
        """태스크 실패 처리. 반환값: True = 에스컬레이션 필요 (2회 실패)."""
        task = self._get_or_create(task_id)
        task.failure_count += 1
        task.finished_at = time.time()
        task.last_message = message
        if task.failure_count >= 2:
            task.status = TaskStatus.FAILED
            self.console.print(
                f"[bold red]✘ 실패 (에스컬레이션):[/bold red] [{task.agent}] {task.title} "
                f"— {message}"
            )
            return True
        else:
            task.status = TaskStatus.PENDING  # 재시도 허용
            self.console.print(
                f"[yellow]↩ 재시도 ({task.failure_count}/2):[/yellow] [{task.agent}] {task.title}"
            )
            return False

    def update_progress(self, task_id: str, message: str) -> None:
        task = self._get_or_create(task_id)
        task.last_message = message
        short = message[:80] + "…" if len(message) > 80 else message
        self.console.print(f"  [dim]  └─ {short}[/dim]")

    # ------------------------------------------------------------------
    # SDK 메시지 처리
    # ------------------------------------------------------------------

    async def process_message(self, message: Any) -> None:
        """claude_code_sdk 메시지를 처리합니다."""
        # AssistantMessage: 텍스트 블록 및 도구 호출 포함
        if hasattr(message, "content") and isinstance(message.content, list):
            for block in message.content:
                await self._handle_content_block(block)

        # ResultMessage: 최종 결과
        elif hasattr(message, "result"):
            self._handle_result(message)

    async def _handle_content_block(self, block: Any) -> None:
        block_type = getattr(block, "type", None)

        if block_type == "text":
            text = getattr(block, "text", "")
            if text.strip():
                self.console.print(f"[cyan]🤖 오케스트레이터:[/cyan] {text.strip()}")

        elif block_type == "tool_use":
            tool_name = getattr(block, "name", "unknown")
            tool_input = getattr(block, "input", {})
            self._current_tool = tool_name

            if tool_name == "Agent":
                # 하위 에이전트 시작 이벤트
                prompt = tool_input.get("prompt", "") if isinstance(tool_input, dict) else ""
                agent_type = self._infer_agent_type(prompt)
                task_id = f"agent-{int(time.time() * 1000)}"
                self.start_task(task_id)
                self.console.print(
                    Panel(
                        f"[bold]{agent_type} 에이전트[/bold] 실행 중\n\n{prompt[:200]}{'…' if len(prompt) > 200 else ''}",
                        title="[bold blue]하위 에이전트 위임[/bold blue]",
                        border_style="blue",
                    )
                )
            else:
                self.console.print(
                    f"  [dim]🔧 도구 사용: {tool_name}[/dim]"
                )

    def _handle_result(self, message: Any) -> None:
        is_error = getattr(message, "is_error", False)
        result_text = getattr(message, "result", "") or ""
        cost = getattr(message, "total_cost_usd", None)
        duration_ms = getattr(message, "duration_ms", None)

        if is_error:
            self.console.print(
                Panel(
                    f"[red]{result_text}[/red]",
                    title="[bold red]오류 발생[/bold red]",
                    border_style="red",
                )
            )
        else:
            parts = [result_text[:500]] if result_text else []
            if cost is not None:
                parts.append(f"비용: ${cost:.4f}")
            if duration_ms is not None:
                parts.append(f"소요시간: {duration_ms / 1000:.1f}s")
            self.console.print(
                Panel(
                    "\n".join(parts) or "(결과 없음)",
                    title="[bold green]완료[/bold green]",
                    border_style="green",
                )
            )

    # ------------------------------------------------------------------
    # 상태 대시보드
    # ------------------------------------------------------------------

    def print_dashboard(self) -> None:
        """모든 태스크의 현황 대시보드를 출력합니다."""
        if not self.tasks:
            self.console.print("[dim]등록된 태스크가 없습니다.[/dim]")
            return

        table = Table(title="태스크 현황 대시보드", show_header=True, header_style="bold magenta")
        table.add_column("ID", style="dim", width=12)
        table.add_column("에이전트", width=12)
        table.add_column("제목", width=30)
        table.add_column("상태", width=10)
        table.add_column("실패", justify="right", width=5)
        table.add_column("경과시간", justify="right", width=10)
        table.add_column("마지막 메시지", width=30)

        for task in self.tasks.values():
            style = STATUS_STYLE[task.status]
            icon = STATUS_ICON[task.status]
            elapsed = f"{task.elapsed:.1f}s" if task.elapsed > 0 else "-"
            last_msg = (task.last_message[:28] + "…") if len(task.last_message) > 28 else task.last_message
            table.add_row(
                task.id,
                task.agent,
                task.title,
                Text(f"{icon} {task.status.value}", style=style),
                str(task.failure_count) if task.failure_count else "-",
                elapsed,
                last_msg,
            )

        self.console.print(table)

        # 요약
        counts = {s: 0 for s in TaskStatus}
        for t in self.tasks.values():
            counts[t.status] += 1

        summary_parts = []
        for status, count in counts.items():
            if count:
                summary_parts.append(
                    f"[{STATUS_STYLE[status]}]{STATUS_ICON[status]} {status.value}: {count}[/{STATUS_STYLE[status]}]"
                )
        self.console.print("  " + "  |  ".join(summary_parts))

    # ------------------------------------------------------------------
    # 내부 유틸리티
    # ------------------------------------------------------------------

    def _get_or_create(self, task_id: str) -> Task:
        if task_id not in self.tasks:
            self.tasks[task_id] = Task(id=task_id, title=task_id, agent="unknown")
        return self.tasks[task_id]

    @staticmethod
    def _infer_agent_type(prompt: str) -> str:
        """프롬프트 내용에서 에이전트 유형을 추론합니다."""
        prompt_lower = prompt.lower()
        if any(kw in prompt_lower for kw in ["기획", "spec", "planner", "사양서"]):
            return "planner"
        if any(kw in prompt_lower for kw in ["디자인", "design", "css", "token"]):
            return "design"
        if any(kw in prompt_lower for kw in ["데이터베이스", "database", "migration", "supabase", "sql"]):
            return "database"
        if any(kw in prompt_lower for kw in ["백엔드", "backend", "api", "server"]):
            return "backend"
        if any(kw in prompt_lower for kw in ["프론트엔드", "frontend", "html", "javascript"]):
            return "frontend"
        if any(kw in prompt_lower for kw in ["qa", "test", "검증", "리뷰"]):
            return "qa"
        return "sub-agent"
