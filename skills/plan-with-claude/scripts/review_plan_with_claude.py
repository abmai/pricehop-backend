#!/usr/bin/env python3

import argparse
import json
import subprocess
import sys
from pathlib import Path
from typing import Optional


SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "approved": {"type": "boolean"},
        "summary": {"type": "string"},
        "blocking_gaps": {"type": "array", "items": {"type": "string"}},
        "edge_cases": {"type": "array", "items": {"type": "string"}},
        "improvements": {"type": "array", "items": {"type": "string"}},
        "questions": {"type": "array", "items": {"type": "string"}},
    },
    "required": [
        "approved",
        "summary",
        "blocking_gaps",
        "edge_cases",
        "improvements",
        "questions",
    ],
}


def read_text(path: Optional[Path]) -> str:
    if path is None:
        return ""
    return path.read_text(encoding="utf-8").strip()


def build_prompt(task: str, plan: str, history: str) -> str:
    sections = [
        "You are reviewing a task execution plan prepared by another coding agent.",
        "Reject the plan unless it is executable, ordered correctly, and covers meaningful edge cases.",
        "Be strict about missing assumptions, dependencies, validation, failure modes, rollback, and operational risks when those concerns are relevant.",
        "",
        "Task:",
        task or "[missing]",
        "",
        "Current plan:",
        plan or "[missing]",
    ]

    if history:
        sections.extend(["", "Prior review history:", history])

    sections.extend(
        [
            "",
            "Review instructions:",
            "- Approve only if the plan is ready to execute with no blocking omissions.",
            "- Put must-fix items in blocking_gaps.",
            "- Put missing scenario coverage in edge_cases.",
            "- Put non-blocking refinements in improvements.",
            "- Put clarifying questions in questions.",
            "- Keep every list concise and high signal.",
        ]
    )

    return "\n".join(sections)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Review a task plan with Claude Code in headless mode."
    )
    parser.add_argument("--task-file", required=True, type=Path)
    parser.add_argument("--plan-file", required=True, type=Path)
    parser.add_argument("--history-file", type=Path)
    parser.add_argument("--model", default="sonnet")
    parser.add_argument(
        "--effort", default="medium", choices=["low", "medium", "high", "max"]
    )
    parser.add_argument("--max-budget-usd", type=float)
    parser.add_argument("--timeout-seconds", type=int, default=90)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print the Claude command and prompt instead of executing it.",
    )
    args = parser.parse_args()

    task = read_text(args.task_file)
    plan = read_text(args.plan_file)
    history = read_text(args.history_file)
    prompt = build_prompt(task, plan, history)

    command = [
        "claude",
        "-p",
        "--output-format",
        "json",
        "--json-schema",
        json.dumps(SCHEMA),
        "--tools",
        "StructuredOutput",
        "--strict-mcp-config",
        "--mcp-config",
        '{"mcpServers":{}}',
        "--disable-slash-commands",
        "--model",
        args.model,
        "--effort",
        args.effort,
        "--no-session-persistence",
        prompt,
    ]

    if args.max_budget_usd is not None:
        command.extend(["--max-budget-usd", str(args.max_budget_usd)])

    if args.dry_run:
        print(
            json.dumps(
                {
                    "command": command,
                    "prompt_preview": prompt,
                },
                indent=2,
            )
        )
        return 0

    try:
        completed = subprocess.run(
            command,
            check=True,
            capture_output=True,
            text=True,
            timeout=args.timeout_seconds,
        )
    except FileNotFoundError:
        print("claude CLI not found in PATH", file=sys.stderr)
        return 127
    except subprocess.TimeoutExpired:
        print(
            f"claude review timed out after {args.timeout_seconds} seconds",
            file=sys.stderr,
        )
        return 124
    except subprocess.CalledProcessError as exc:
        if exc.stderr:
            print(exc.stderr.strip(), file=sys.stderr)
        if exc.stdout:
            print(exc.stdout.strip(), file=sys.stderr)
        return exc.returncode

    stdout = completed.stdout.strip()
    if not stdout:
        print("claude returned empty output", file=sys.stderr)
        return 1

    try:
        payload = json.loads(stdout)
    except json.JSONDecodeError as exc:
        print(f"invalid JSON from claude: {exc}", file=sys.stderr)
        print(stdout, file=sys.stderr)
        return 1

    required_keys = set(SCHEMA["required"])
    if not isinstance(payload, dict) or not required_keys.issubset(payload.keys()):
        print("unexpected response format from claude", file=sys.stderr)
        print(json.dumps(payload, indent=2), file=sys.stderr)
        return 1

    print(json.dumps(payload, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
