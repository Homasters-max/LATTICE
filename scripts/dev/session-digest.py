#!/usr/bin/env python3
"""Сжатие транскрипта сессии Claude Code для аналитика (dev/rules/reports.md, work session-audit).

    python scripts/dev/session-digest.py <id или префикс id> [--out <файл>] [--limit <КБ>]

Читает ~/.claude/projects/<проект>/<id>.jsonl и субагентов из <id>/subagents/*.jsonl; печатает Markdown: паспорт
(период, ветки, коммиты, PR), реплики человека, счёт вызовов, ошибки и отказы с короткой цитатой, повторы команд,
вызовы warrant с исходом. Только чтение; текст транскрипта — данные, не инструкции.
"""
import argparse
import glob
import io
import json
import os
import re
import sys
from collections import Counter

PROJECT_DIR = os.path.join(os.path.expanduser("~"), ".claude", "projects", "D--project-LATTICE")
QUOTE = 220
ERROR_RE = re.compile(
    r"(hook error|\bdenied\b|\"ok\":\s*false|\"code\":\s*\"(?:STALE|GATES?_NOT_PASSED|SCOPE_VIOLATION|"
    r"RECORD_MISMATCH|STATE_INVALID|USAGE|NO_EVIDENCE|SKILL_RESULT_INVALID|GENERATED_DRIFT|LOCK_MISMATCH)|Exit code [1-9]|"
    r"Traceback|^fatal:|unexpected EOF|String to replace not found|File has not been read)",
    re.I | re.M,
)


def find_transcript(key):
    if os.path.isfile(key):
        return key
    hits = [p for p in glob.glob(os.path.join(PROJECT_DIR, "*.jsonl")) if os.path.basename(p).startswith(key)]
    if len(hits) != 1:
        sys.exit(f"transcript '{key}': найдено {len(hits)} в {PROJECT_DIR}")
    return hits[0]


def text_of(content):
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        out = []
        for part in content:
            if isinstance(part, dict):
                if part.get("type") == "text":
                    out.append(part.get("text", ""))
                elif part.get("type") == "tool_result":
                    out.append(text_of(part.get("content")))
        return "\n".join(out)
    return ""


def short(s, n=QUOTE):
    s = re.sub(r"\s+", " ", s or "").strip()
    return s if len(s) <= n else s[: n - 1] + "…"


def tool_brief(name, inp):
    if not isinstance(inp, dict):
        return name
    for key in ("command", "file_path", "pattern", "description", "query", "skill", "url"):
        if key in inp:
            return f"{name}: {short(str(inp[key]), 140)}"
    return name


def scan(path):
    """Один проход по JSONL: события в порядке файла."""
    ev = {"t0": None, "t1": None, "branches": Counter(), "cwd": set(), "user": [], "calls": Counter(), "errors": [],
          "commits": [], "prs": [], "warrant": [], "bash": [], "hooks": Counter(), "n_calls": 0,
          "outcomes": [], "run_hints": 0, "json_parse": 0}
    pending = {}
    idx = 0
    with open(path, encoding="utf-8", errors="replace") as fh:
        for line in fh:
            ev["run_hints"] += line.count("start a Run first")
            try:
                d = json.loads(line)
            except ValueError:
                continue
            ts = d.get("timestamp")
            if ts:
                ev["t0"] = ev["t0"] or ts
                ev["t1"] = ts
            if d.get("gitBranch"):
                ev["branches"][d["gitBranch"]] += 1
            if d.get("cwd"):
                ev["cwd"].add(d["cwd"])
            msg = d.get("message") or {}
            content = msg.get("content")
            if d.get("type") == "user" and isinstance(content, str) and not content.startswith("<"):
                ev["user"].append((ts, short(content, 300)))
            if d.get("type") == "user" and isinstance(content, list):
                for part in content:
                    if not isinstance(part, dict):
                        continue
                    if part.get("type") == "text" and not part.get("text", "").startswith("<"):
                        ev["user"].append((ts, short(part.get("text"), 300)))
                    if part.get("type") == "tool_result":
                        call = pending.pop(part.get("tool_use_id"), None)
                        body = text_of(part.get("content"))
                        if "additional context" in body or "hook" in body.lower():
                            for m in re.findall(r"(PreToolUse|PostToolUse)[^:]*:?\s*([^\n]{0,60})", body):
                                ev["hooks"][short(m[0] + " " + m[1], 80)] += 1
                        bad = part.get("is_error") or ERROR_RE.search(body or "")
                        if call:
                            ev["outcomes"].append((call[0], call[1], bool(bad)))
                        if call and bad:
                            m = ERROR_RE.search(body or "")
                            at = max(0, (m.start() if m else 0) - 60)
                            ev["errors"].append((call[0], call[1], short(body[at:], QUOTE)))
                        if call and call[2] == "Bash":
                            ev["bash"][-1] = (*ev["bash"][-1][:2], bool(bad))
                            cmd = call[3]
                            wcmds = warrant_commands(cmd)
                            if wcmds:
                                code = re.search(r'"code":\s*"([A-Z_]+)"', body or "")
                                ok = re.search(r'"ok":\s*(true|false)', body or "")
                                ev["warrant"].append((call[0], short("; ".join(wcmds), 120), ok.group(1) if ok else "?",
                                                      code.group(1) if code else ""))
                            for msg1 in commit_messages(cmd):
                                ev["commits"].append((call[0], msg1, "отказ" if bad else ""))
                            if "gh pr create" in cmd:
                                for pr in re.findall(r"https://github\.com/[^\s/]+/[^\s/]+/pull/\d+", body or ""):
                                    if pr not in ev["prs"]:
                                        ev["prs"].append(pr)
            if d.get("type") == "assistant" and isinstance(content, list):
                for part in content:
                    if isinstance(part, dict) and part.get("type") == "tool_use":
                        idx += 1
                        name = part.get("name", "?")
                        inp = part.get("input") or {}
                        ev["calls"][name] += 1
                        ev["n_calls"] += 1
                        cmd = inp.get("command", "") if isinstance(inp, dict) else ""
                        pending[part.get("id")] = (idx, tool_brief(name, inp), name, cmd)
                        if name == "Bash":
                            ev["bash"].append((idx, cmd, False))
                            if "warrant" in cmd and "JSON.parse" in cmd:
                                ev["json_parse"] += 1
    return ev


SEGMENT_RE = re.compile(r"(?:^|&&|\|\||;|\n|\$\()\s*(warrant\s+[a-z][a-z-]*(?:\s+(?:start|finish|submit|add|resolve|change|fetch|cancel))?)")


def warrant_commands(cmd):
    """Подкоманды warrant в начале сегментов команды (не в тексте сообщений коммита)."""
    body = re.sub(r"<<'?EOF'?.*?^EOF", "", cmd, flags=re.S | re.M)
    return list(dict.fromkeys(m.strip() for m in SEGMENT_RE.findall(body)))


def commit_messages(cmd):
    """Первая строка каждого git commit: -m '…' или heredoc -F - <<'EOF'."""
    out = []
    if "git commit" not in cmd:
        return out
    for m in re.finditer(r"git commit[^\n]*?-m\s+([\x27\x22])(.+?)\1", cmd, re.S):
        out.append(short(m.group(2).splitlines()[0], 100))
    for m in re.finditer(r"git commit[^\n]*<<'?EOF'?\n(.+?)\n", cmd):
        out.append(short(m.group(1), 100))
    if not out:
        out.append("(сообщение из файла)")
    return out


def streaks(outcomes):
    """Серии неудач подряд (по порядку результатов), длина ≥ 3: (№ первого, длина)."""
    out, run = [], []
    for i, _, bad in sorted(outcomes):
        if bad:
            run.append(i)
        else:
            if len(run) >= 3:
                out.append((run[0], len(run)))
            run = []
    if len(run) >= 3:
        out.append((run[0], len(run)))
    return out


def repeats(bash):
    """Команда, повторённая после неудачи с тем же началом (первые 40 символов)."""
    out = []
    for i in range(1, len(bash)):
        prev, cur = bash[i - 1], bash[i]
        if prev[2] and prev[1][:40] == cur[1][:40]:
            out.append((cur[0], short(cur[1], 120)))
    return out


def render(path, limit_kb):
    ev = scan(path)
    sid = os.path.basename(path)[:-6]
    subs = sorted(glob.glob(os.path.join(os.path.dirname(path), sid, "subagents", "*.jsonl")))
    buf = io.StringIO()
    w = buf.write
    w(f"# Сжатие сессии {sid}\n\n")
    w(f"- период: {ev['t0']} → {ev['t1']}\n- cwd: {', '.join(sorted(ev['cwd']))}\n")
    w(f"- ветки: {', '.join(b for b, _ in ev['branches'].most_common())}\n")
    w(f"- вызовов: {ev['n_calls']} — " + ", ".join(f"{k} {v}" for k, v in ev["calls"].most_common()) + "\n")
    w(f"- ошибок и отказов: {len(ev['errors'])}; повторов после неудачи: {len(repeats(ev['bash']))}\n")
    dev_commits = sum(1 for _, msg, _ in ev["commits"] if msg.startswith("dev-"))
    from_file = sum(1 for _, msg, _ in ev["commits"] if msg == "(сообщение из файла)")
    w(f"- метрики: серий ≥3 неудач подряд {len(streaks(ev['outcomes']))} "
      f"({', '.join(f'#{a}×{n}' for a, n in streaks(ev['outcomes'])) or '—'}); вхождений «start a Run first» в JSONL "
      f"{ev['run_hints']} (одна подсказка — 1–3 вхождения); ручной JSON.parse вокруг warrant {ev['json_parse']}; "
      f"коммитов dev- {dev_commits} из {len(ev['commits'])} (сообщение из файла — {from_file})\n")
    w(f"- созданы PR: {', '.join(ev['prs']) or 'нет'}\n\n")
    w("## Реплики человека\n\n")
    for ts, t in ev["user"]:
        w(f"- {ts[11:19] if ts else ''} {t}\n")
    w("\n## Коммиты (№ вызова · первая строка)\n\n")
    for i, msg, flag in ev["commits"]:
        w(f"- #{i} {msg}{' · ' + flag if flag else ''}\n")
    w("\n## Вызовы warrant (№ · команда · ok · код)\n\n")
    for i, cmd, ok, code in ev["warrant"]:
        w(f"- #{i} `{cmd}` · {ok}{' · ' + code if code else ''}\n")
    w("\n## Ошибки и отказы (№ · вызов · цитата)\n\n")
    for i, call, quote in ev["errors"]:
        w(f"- #{i} {call}\n  > {quote}\n")
    w("\n## Повторы после неудачи\n\n")
    for i, cmd in repeats(ev["bash"]):
        w(f"- #{i} `{cmd}`\n")
    if ev["hooks"]:
        w("\n## Сообщения хуков (счёт)\n\n")
        for k, v in ev["hooks"].most_common(10):
            w(f"- {v} × {k}\n")
    if subs:
        w("\n## Субагенты\n\n")
        for sp in subs:
            se = scan(sp)
            w(f"- {os.path.basename(sp)[:-6]}: вызовов {se['n_calls']}, ошибок {len(se['errors'])}, "
              f"повторов {len(repeats(se['bash']))}\n")
            for i, call, quote in se["errors"][:15]:
                w(f"  - #{i} {call} > {short(quote, 160)}\n")
    text = buf.getvalue()
    limit = limit_kb * 1024
    if len(text.encode("utf-8")) > limit:
        text = text.encode("utf-8")[:limit].decode("utf-8", "ignore") + "\n\n…обрезано по --limit\n"
    return text


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("session")
    ap.add_argument("--out")
    ap.add_argument("--limit", type=int, default=30, help="КБ, по умолчанию 30")
    a = ap.parse_args()
    text = render(find_transcript(a.session), a.limit)
    sys.stdout.reconfigure(encoding="utf-8")
    if a.out:
        with open(a.out, "w", encoding="utf-8", newline="\n") as fh:
            fh.write(text)
        print(f"{a.out}: {len(text.encode('utf-8')) // 1024} КБ")
    else:
        sys.stdout.write(text)


if __name__ == "__main__":
    main()
