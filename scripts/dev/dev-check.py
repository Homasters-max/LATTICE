#!/usr/bin/env python3
"""Проверка dev/ (dev/README.md) и данные блока «▶️ Старт» (dev/rules/output.md).

    python scripts/dev/dev-check.py            ошибки формы и ссылок (код 1) и сигналы
    python scripts/dev/dev-check.py --start    цепочка focus, следующий шаг, сигналы, очередь человека, сессии
    python scripts/dev/dev-check.py --sessions транскрипты без SES и SES без разбора
    python scripts/dev/dev-check.py --rules env активные правила стандарта или узла — текстом
    python scripts/dev/dev-check.py --brief review  всё применимое к операции — текстом для промпта субагента (RUL-013)
    python scripts/dev/dev-check.py --footprint    след dev/: строки, объекты по типам, правила, на один ARCHIVED Change

Только чтение; зависимость — Python 3.10+ и PyYAML. `--start` вызывает `warrant status <change>` для Change в фокусе.
"""
import argparse
import datetime as dt
import glob
import json
import os
import re
import subprocess
import sys

import yaml

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DEV = os.path.join(ROOT, "dev")
TRANSCRIPTS = os.path.join(os.path.expanduser("~"), ".claude", "projects", "D--project-LATTICE")
TODAY = dt.date.today()

SECTIONS = {
    "dev/state": ["Журнал"],
    "dev/idea": ["Суть", "Исход"],
    "dev/track": ["Цель", "Журнал"],
    "dev/work+change": ["Контекст", "Решения", "Журнал"],
    "dev/work": ["Контекст", "Шаги", "Приёмка", "Решения", "Журнал"],
    "dev/issue": ["Симптом", "Причина", "Обход", "Закрытие"],
    "dev/session": ["Что делала", "Разбор"],
    "dev/report": [["Сессия", "Сессии"], "Сбои", "Не хватает", "Улучшения", "Итог"],
    "dev/guide": ["Область", "Процедуры?", "Проверка"],
    "dev/proposal": ["Контекст", "Пункты", "Исход"],
}
FOLDER = {"ideas": "dev/idea", "tracks": "dev/track", "work": "dev/work", "issues": "dev/issue",
          "sessions": "dev/session", "reports": "dev/report", "rules": "dev/guide", "proposals": "dev/proposal"}
LOCAL_RE = re.compile(r"\b((?:ISS|RUL|IDEA|RPT|PRP)-\d{3}|SES-[0-9a-f]{8})\b")
CHECK_RE = re.compile(r"^- \[( |x)\] (.*)$")
STEP_RE = re.compile(r"^(\d+) · (agent|human) · (.+)$")
REF_TAIL_RE = re.compile(r" — (\S.*)$")
BRIEF = {  # операция → стандарты сверх env, process и ловушек STATE
    "specify": ["docs"], "review": [], "implement": ["code", "quality", "tests"], "archive": [],
    "audit": ["reports", "output"], "any": [],
}
FORBIDDEN_FM = {"dev/work+change": ["steps", "done_when", "focus"], "dev/issue": ["close_when", "affects"],
                "dev/track": ["done_when"], "dev/work": ["steps", "done_when", "focus"]}


class Obj:
    def __init__(self, path, fm, body):
        self.path, self.fm, self.body = path, fm, body
        self.id = fm.get("id")
        self.type = str(fm.get("type", "")).split("@")[0]
        self.kind = self.type + ("+change" if self.type == "dev/work" and fm.get("change") else "")
        self.sections = self._sections()

    def _sections(self):
        out, cur = {}, None
        for line in self.body.split("\n"):
            m = re.match(r"^## (.+)$", line)
            if m:
                cur = m.group(1).strip()
                out[cur] = []
            elif cur:
                out[cur].append(line)
        return out

    def checklist(self, name):
        items = []
        for line in self.sections.get(name, []):
            m = CHECK_RE.match(line)
            if m:
                items.append((m.group(1) == "x", m.group(2)))
        return items

    def steps(self):
        out = []
        for done, text in self.checklist("Шаги"):
            m = STEP_RE.match(text)
            out.append((done, int(m.group(1)) if m else None, m.group(2) if m else None, text))
        return out


def load():
    objs, errors = {}, []
    for path in sorted(glob.glob(os.path.join(DEV, "**", "*.md"), recursive=True)):
        rel = os.path.relpath(path, ROOT).replace(os.sep, "/")
        if rel == "dev/README.md":
            continue
        text = open(path, encoding="utf-8").read()
        if not text.startswith("---\n"):
            errors.append(f"{rel}: нет frontmatter")
            continue
        try:
            _, fm_text, body = text.split("---", 2)
            fm = yaml.safe_load(fm_text) or {}
        except (ValueError, yaml.YAMLError) as e:
            errors.append(f"{rel}: YAML — {str(e).splitlines()[0]}")
            continue
        o = Obj(rel, fm, body)
        if not o.id:
            errors.append(f"{rel}: нет id")
            continue
        if o.id in objs:
            errors.append(f"{rel}: id {o.id} уже у {objs[o.id].path}")
        objs[o.id] = o
    return objs, errors


def rules_of(objs):
    out = {}
    for o in objs.values():
        for r in o.fm.get("rules") or []:
            out[r["id"]] = (o, r)
    return out


def known_ids(objs, rules):
    ids = set(objs) | set(rules)
    for o in objs.values():
        ids.update(o.fm.get("aliases") or [])
    for o, r in rules.values():
        ids.update(r.get("aliases") or [])
    return ids


def refs_in(value):
    if value is None:
        return []
    if isinstance(value, str):
        return [value]
    if isinstance(value, list):
        return [x for v in value for x in refs_in(v)]
    if isinstance(value, dict):
        return [x for v in value.values() for x in refs_in(v)]
    return [str(value)]


def check(objs, rules, errors, signals):
    ids = known_ids(objs, rules)
    works = {k: o for k, o in objs.items() if o.type == "dev/work"}
    for o in objs.values():
        folder = o.path.split("/")[1] if o.path.count("/") > 1 else None
        want = FOLDER.get(folder, "dev/state")
        if o.type != want:
            errors.append(f"{o.path}: type {o.type}, ожидается {want}")
        lines = o.body.lstrip("\n").split("\n")
        if not lines[0].startswith(f"# {o.id} — "):
            errors.append(f"{o.path}: заголовок не «# {o.id} — …»")
        if len(lines) < 3 or not lines[2].strip() or lines[2].startswith("#"):
            errors.append(f"{o.path}: нет абзаца-сути под заголовком")
        order = [s for s in o.sections]
        pos = 0
        for want_sec in SECTIONS.get(o.kind, []):
            opts = want_sec if isinstance(want_sec, list) else [want_sec]
            optional = any(x.endswith("?") for x in opts)
            names = [x.rstrip("?") for x in opts]
            hit = next((i for i, s in enumerate(order) if s in names), None)
            if hit is None:
                if not optional:
                    errors.append(f"{o.path}: нет раздела «{names[0]}»")
                continue
            if hit < pos:
                errors.append(f"{o.path}: раздел «{order[hit]}» не на своём месте")
            pos = hit
        for key in FORBIDDEN_FM.get(o.kind, []):
            if key in o.fm:
                errors.append(f"{o.path}: поле {key} запрещено для {o.kind} (README «Отметки»)")
        if o.kind == "dev/work+change" and "## Шаги" in o.body:
            errors.append(f"{o.path}: у Change нет шагов — задачи в tasks.md")
        if o.kind == "dev/work+change" and "tasks.md" not in "\n".join(o.sections.get("Контекст", [])):
            errors.append(f"{o.path}: «Контекст» Change не ссылается на tasks.md")
        for sec in ("Шаги", "Приёмка", "Закрытие"):
            for done, text in o.checklist(sec):
                if done and not REF_TAIL_RE.search(text):
                    errors.append(f"{o.path}: «{sec}» — отметка без ссылки: {text[:60]}")
        if o.type == "dev/work":
            nums = [n for _, n, _, _ in o.steps()]
            if None in nums:
                errors.append(f"{o.path}: шаг не по форме «n · agent|human · что»")
            if len(nums) != len(set(nums)):
                errors.append(f"{o.path}: номера шагов повторяются")
        if o.type == "dev/issue":
            items = o.checklist("Закрытие")
            if not items:
                errors.append(f"{o.path}: «Закрытие» без списка проверок")
            if o.fm.get("status") == "verified" and not all(d for d, _ in items):
                errors.append(f"{o.path}: status verified, но не все проверки отмечены")
            rb = o.fm.get("review_by")
            if o.fm.get("status") not in ("verified", "wontfix") and rb and dt.date.fromisoformat(str(rb)) < TODAY:
                signals.append(f"просрочен review_by {rb}: {o.id} — {o.fm.get('title')}")
        if o.type == "dev/session":
            tr = o.fm.get("transcript", "")
            if not str(o.id).endswith(str(tr)[:8]):
                errors.append(f"{o.path}: id не из transcript")
            if not o.fm.get("audit"):
                signals.append(f"сессия без разбора: {o.id}")
        if o.type == "dev/report":
            sess = refs_in(o.fm.get("session")) + refs_in(o.fm.get("sessions"))
            for s in sess:
                key = s if s.startswith("SES-") else "SES-" + s[:8]
                if key not in objs:
                    errors.append(f"{o.path}: сессия {s} не в реестре sessions/")
        fields = {k: o.fm.get(k) for k in ("from", "found", "waits", "refs", "track", "links", "audit", "outcome")}
        if o.type in ("dev/state", "dev/track"):
            fields["focus"] = o.fm.get("focus")
        for r in o.fm.get("rules") or []:
            fields[f"rule {r.get('id')}.source"] = r.get("source")
        for field, value in fields.items():
            for ref in refs_in(value):
                base = str(ref).split("#")[0].strip()
                if not base or "/" in base or base.endswith(".md") or base in ("null", "None"):
                    continue
                if LOCAL_RE.fullmatch(base) or base in works or base in objs:
                    if base not in ids:
                        errors.append(f"{o.path}: {field} → нет объекта {ref}")
                    tail = str(ref).split("#")[1] if "#" in str(ref) else ""
                    if base in works and tail.isdigit() and int(tail) not in [n for _, n, _, _ in works[base].steps()]:
                        if works[base].kind == "dev/work":
                            errors.append(f"{o.path}: {field} → нет шага {ref}")
                elif field in ("track", "focus", "waits", "from", "found", "audit", "refs", "links"):
                    if re.fullmatch(r"[a-z0-9][a-z0-9-]*", base):
                        errors.append(f"{o.path}: {field} → нет объекта {ref}")
        for m in LOCAL_RE.finditer(o.body):
            if m.group(1) not in ids:
                errors.append(f"{o.path}: в тексте ссылка на несуществующий {m.group(1)}")
    for rid, (o, r) in rules.items():
        if not r.get("source"):
            errors.append(f"{o.path}: {rid} без source")
        if r.get("until") and not r.get("review_by"):
            errors.append(f"{o.path}: {rid} — until без review_by")
        if r.get("status") not in ("candidate", "active", "retired"):
            errors.append(f"{o.path}: {rid} — status {r.get('status')}")
        if r.get("overrides") and not r.get("reason"):
            errors.append(f"{o.path}: {rid} — overrides без reason")
        rb = r.get("review_by")
        if r.get("status") == "active" and rb and dt.date.fromisoformat(str(rb)) < TODAY:
            signals.append(f"просрочен review_by {rb}: правило {rid}")
    for o in objs.values():
        active = [r for r in o.fm.get("rules") or [] if r.get("status") == "active"]
        if len(active) > 7 and o.type != "dev/guide":
            signals.append(f"{o.id}: активных правил {len(active)} > 7 — поднять общее или сделать формой")
        if len(active) > 7 and o.type == "dev/guide":
            signals.append(f"стандарт {o.id}: правил {len(active)} > 7 — разделить тему")


def since(objs):
    return str((objs.get("state").fm.get("env") or {}).get("sessions_since", "2026-09-27T21:45"))


def transcripts(objs):
    out = []
    cutoff = since(objs)
    for p in glob.glob(os.path.join(TRANSCRIPTS, "*.jsonl")):
        with open(p, encoding="utf-8", errors="replace") as fh:
            t0 = None
            for line in fh:
                m = re.search(r'"timestamp":"([^"]+)"', line)
                if m:
                    t0 = m.group(1)
                    break
        if t0 and t0 >= cutoff:
            out.append((t0, os.path.basename(p)[:-6]))
    return sorted(out)


def sessions_report(objs):
    reg = {str(o.fm.get("transcript")): o for o in objs.values() if o.type == "dev/session"}
    missing = [(t0, sid) for t0, sid in transcripts(objs) if sid not in reg]
    unaudited = [o.id for o in reg.values() if not o.fm.get("audit")]
    return missing, unaudited


def warrant_status(change):
    try:
        out = subprocess.run(["warrant", "status", change], capture_output=True, text=True, encoding="utf-8",
                             cwd=ROOT, timeout=60, shell=(os.name == "nt")).stdout
        data = json.loads(out).get("data", {})
        ch = (data.get("changes") or [data])[0] if isinstance(data, dict) else {}
        ver = ch.get("verification") or {}
        return ch.get("change_state", "?"), ver.get("controller_action", ""), ver.get("next", "")
    except (OSError, ValueError, subprocess.SubprocessError, IndexError, AttributeError):
        return "?", "", ""


def tasks_progress(change):
    paths = glob.glob(os.path.join(ROOT, "openspec", "changes", change, "tasks.md"))
    if not paths:
        return None
    lines = open(paths[0], encoding="utf-8").read().split("\n")
    items = [l for l in lines if re.match(r"^- \[( |x)\] ", l)]
    done = sum(1 for l in items if l.startswith("- [x]"))
    nxt = next((l[6:].split(" ")[0] for l in items if l.startswith("- [ ]")), "")
    return done, len(items), nxt


def start(objs, rules, signals):
    state = objs["state"]
    chain = ["state"]
    track = objs.get(state.fm.get("focus") or "")
    work = objs.get(track.fm.get("focus") or "") if track else None
    if track:
        chain.append(track.id)
    if work:
        chain.append(work.id)
    step_line, human = "—", []
    warrant_line = "нет активного Change в фокусе"
    if work is not None and work.fm.get("change"):
        change = work.fm["change"].split("/", 1)[1]
        st, action, nxt = warrant_status(change)
        warrant_line = f"{change}: {st}" + (f", {action}" if action else "") + (f", next {nxt}" if nxt else "")
        tp = tasks_progress(change)
        step_line = f"этап {st}" + (f" · задачи {tp[0]}/{tp[1]}, следующая {tp[2]}" if tp else "")
        if action == "WAIT":
            human.append(f"{change}: WAIT ({nxt})")
    elif work is not None:
        steps = work.steps()
        done = sum(1 for d, *_ in steps if d)
        nxt = next(((n, a, t) for d, n, a, t in steps if not d), None)
        step_line = f"шаг {nxt[0]} из {len(steps)} · {nxt[2].split(' · ', 2)[-1]} ({nxt[1]})" if nxt else f"шаги {done}/{len(steps)} — «Приёмка»"
    for o in objs.values():
        if o.type == "dev/work" and o.kind == "dev/work":
            for d, n, a, t in o.steps():
                if not d and a == "human":
                    human.append(f"{o.id}#{n}")
    missing, unaudited = sessions_report(objs)
    active_rules = sum(1 for _, r in rules.values() if r.get("status") == "active")
    print(f"▶️ Старт · {TODAY.isoformat()}")
    print(f"| Фокус     | {' → '.join(chain)} → {step_line} |")
    print(f"| WARRANT   | {warrant_line} |")
    print(f"| Сигналы   | {'; '.join(signals) if signals else 'нет'} · switch: T1 при s2, T2 при s4 · правил активных {active_rules} |")
    print(f"| Очередь   | {', '.join(human) if human else 'пусто'} |")
    sess = []
    if missing:
        sess.append("не в реестре: " + ", ".join(sid[:8] for _, sid in missing))
    if unaudited:
        sess.append("без разбора: " + ", ".join(unaudited))
    print(f"| Сессии    | {'; '.join(sess) if sess else 'все разобраны'} |")


def footprint(objs, rules):
    lines = {}
    for path in glob.glob(os.path.join(DEV, "**", "*.md"), recursive=True):
        part = os.path.relpath(path, DEV).replace(os.sep, "/").split("/")[0]
        part = part if part.endswith(".md") is False else "(корень)"
        lines[part] = lines.get(part, 0) + sum(1 for _ in open(path, encoding="utf-8"))
    archived = [d for d in glob.glob(os.path.join(ROOT, "openspec", "changes", "archive", "*")) if os.path.isdir(d)]
    by_type = {}
    for o in objs.values():
        by_type[o.type] = by_type.get(o.type, 0) + 1
    total = sum(lines.values())
    process = total - sum(v for k, v in lines.items() if k in ("issues", "reports", "sessions"))
    active = sum(1 for _, r in rules.values() if r.get("status") == "active")
    print(f"dev/: строк {total} (без issues/reports/sessions — {process}); ARCHIVED Change: {len(archived)}; "
          f"на Change — {process // max(1, len(archived))} строк процесса")
    print("строки: " + ", ".join(f"{k} {v}" for k, v in sorted(lines.items())))
    print("объекты: " + ", ".join(f"{k.split('/')[1]} {v}" for k, v in sorted(by_type.items())))
    print(f"правил: {len(rules)}, активных {active}")


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--start", action="store_true")
    ap.add_argument("--sessions", action="store_true")
    ap.add_argument("--rules", metavar="ID", help="id стандарта или узла")
    ap.add_argument("--footprint", action="store_true")
    ap.add_argument("--brief", metavar="OPERATION", choices=sorted(BRIEF), help="правила для промпта субагента")
    a = ap.parse_args()
    sys.stdout.reconfigure(encoding="utf-8")
    objs, errors = load()
    rules = rules_of(objs)
    signals = []
    check(objs, rules, errors, signals)
    if a.footprint:
        footprint(objs, rules)
        return 0
    if a.brief:
        print(f"Правила для операции {a.brief} (dev/, RUL-013) — соблюдай их:")
        for src in ["state", "env", "process"] + BRIEF[a.brief]:
            o = objs.get(src)
            for r in (o.fm.get("rules") or []) if o else []:
                op = (r.get("when") or {}).get("operation")
                if r.get("status") == "active" and (op is None or op == a.brief):
                    print(f"- {r['id']}: {' '.join(str(r['text']).split())}")
        return 0
    if a.rules:
        o = objs.get(a.rules)
        if o is None:
            print(f"нет объекта {a.rules}")
            return 1
        for r in o.fm.get("rules") or []:
            if r.get("status") == "active":
                when = f" (когда: {r['when']})" if r.get("when") else ""
                print(f"- {r['id']}: {' '.join(str(r['text']).split())}{when}")
        return 0
    if a.sessions:
        missing, unaudited = sessions_report(objs)
        for t0, sid in missing:
            print(f"не в реестре: {sid} (с {t0})")
        for sid in unaudited:
            print(f"без разбора: {sid}")
        return 0
    if a.start:
        start(objs, rules, [s for s in signals if not s.startswith("сессия без разбора")])
        if errors:
            print(f"\nОшибок dev/: {len(errors)} — python scripts/dev/dev-check.py")
        return 0
    print(f"dev/: объектов {len(objs)}, правил {len(rules)}; ошибок {len(errors)}, сигналов {len(signals)}")
    for e in errors:
        print(f"ОШИБКА  {e}")
    for s in signals:
        print(f"сигнал  {s}")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
