#!/usr/bin/env python3
"""Версии документов: прежняя версия изменённого файла — в arhived/<имя>_vN.md его папки (dev/README.md «Версии»).

    python scripts/dev/snapshot.py            снимки для файлов, изменённых относительно HEAD (перед коммитом)
    python scripts/dev/snapshot.py --check    сверка: version во frontmatter = 1 + число снимков (код 1 при расхождении)
    python scripts/dev/snapshot.py --list     файлы с версией > 1
    python scripts/dev/snapshot.py --repair   недостающие снимки — из истории git (правка закоммичена без снимка)

Охват — SCOPE; openspec/ и .warrant/ версионирует WARRANT. Снимок — содержимое файла в HEAD; один снимок на коммит,
повторный запуск ничего не меняет. Удалённый файл — последний снимок остаётся в arhived/. У объекта dev/ поле
`version` (ревизия, как id@n в LATTICE) поднимается само.
"""
import argparse
import glob
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SCOPE = ("dev/", "design/")
ARCHIVE = "arhived"
BASELINE = "4dd6bbe"  # коммит базовой линии v1 (IDEA-007): правки до него снимков не требуют
VERSION_RE = re.compile(r"^version: (\d+)$", re.M)


def git(*args):
    return subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True, encoding="utf-8").stdout


def in_scope(path):
    return path.endswith(".md") and path.startswith(SCOPE) and f"/{ARCHIVE}/" not in path and path != "dev/INDEX.md" and not path.startswith("dev/templates/")  # INDEX генерируется; шаблоны — скелеты, их version — заглушка


def snapshots(path):
    folder, name = os.path.split(path)
    stem = name[:-3]
    found = glob.glob(os.path.join(ROOT, folder, ARCHIVE, f"{stem}_v*.md"))
    nums = sorted(int(m.group(1)) for f in found if (m := re.search(r"_v(\d+)\.md$", f)))
    return nums


def snap_path(path, n):
    folder, name = os.path.split(path)
    return os.path.join(ROOT, folder, ARCHIVE, f"{name[:-3]}_v{n}.md")


def read(path):
    with open(os.path.join(ROOT, path), encoding="utf-8") as fh:
        return fh.read()


def write(full, text):
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(text)


def changed():
    """Отслеживаемые файлы в охвате, отличающиеся от HEAD: (путь, удалён ли)."""
    out = []
    for line in git("status", "--porcelain", "--untracked-files=no").splitlines():
        code, path = line[:2], line[3:].strip().strip('"')
        if " -> " in path:
            old, path = path.split(" -> ")
            if in_scope(old):
                out.append((old, True))
        if in_scope(path) and code.strip():
            out.append((path, "D" in code))
    return out


def snapshot():
    made = []
    for path, deleted in changed():
        head = git("show", f"HEAD:{path}")
        if not head:
            continue
        nums = snapshots(path)
        if nums and open(snap_path(path, nums[-1]), encoding="utf-8").read() == head:
            continue
        n = (nums[-1] + 1) if nums else 1
        m = VERSION_RE.search(head)
        if m:
            n = int(m.group(1))
        write(snap_path(path, n), head)
        made.append(f"{path} → {ARCHIVE}/{os.path.basename(snap_path(path, n))}")
        if not deleted:
            text = read(path)
            if VERSION_RE.search(text):
                write(os.path.join(ROOT, path), VERSION_RE.sub(f"version: {n + 1}", text, count=1))
    return made


def repair():
    """Снимки из git: версия k — содержимое файла до k-го коммита, менявшего его после базовой линии."""
    fixed = []
    for full in glob.glob(os.path.join(ROOT, "**", "*.md"), recursive=True):
        path = os.path.relpath(full, ROOT).replace(os.sep, "/")
        if not in_scope(path):
            continue
        edits = git("log", "--no-merges", "--diff-filter=M", "--reverse", "--format=%h", f"{BASELINE}..HEAD", "--",
                    path).split()
        if len(edits) <= len(snapshots(path)):
            continue
        for k, sha in enumerate(edits, start=1):
            write(snap_path(path, k), git("show", f"{sha}^:{path}"))
        n = len(edits)
        text = read(path)
        if VERSION_RE.search(text):
            # подъём version — сам правка: версия из HEAD — ещё один снимок, чтобы после коммита правок = снимков
            n += 1
            write(snap_path(path, n), git("show", f"HEAD:{path}"))
            write(full, VERSION_RE.sub(f"version: {n + 1}", text, count=1))
        fixed.append(f"{path}: снимки v1…v{n} из git, version {n + 1}")
    return fixed


def check():
    errors = []
    pending = {p for p, _ in changed()}
    for full in glob.glob(os.path.join(ROOT, "**", "*.md"), recursive=True):
        path = os.path.relpath(full, ROOT).replace(os.sep, "/")
        if not in_scope(path):
            continue
        nums = snapshots(path)
        edits = git("log", "--no-merges", "--diff-filter=M", "--format=%h", f"{BASELINE}..HEAD", "--", path).split()
        if len(edits) > len(nums):
            errors.append(f"{path}: правок после базовой линии {len(edits)}, снимков {len(nums)} — коммит без snapshot.py")
        if path in pending:
            head = git("show", f"HEAD:{path}")
            last = open(snap_path(path, nums[-1]), encoding="utf-8").read() if nums else None
            if head and last != head:
                errors.append(f"{path}: изменён, снимка прежней версии нет — python scripts/dev/snapshot.py")
        if nums and nums != list(range(1, len(nums) + 1)):
            errors.append(f"{path}: снимки не подряд {nums}")
        m = VERSION_RE.search(read(path))
        if m and int(m.group(1)) != len(nums) + 1:
            errors.append(f"{path}: version {m.group(1)}, снимков {len(nums)} — нужен snapshot.py")
    return errors


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--repair", action="store_true")
    a = ap.parse_args()
    sys.stdout.reconfigure(encoding="utf-8")
    if a.repair:
        for line in repair():
            print(line)
        return 0
    if a.check:
        errors = check()
        for e in errors:
            print(f"ОШИБКА  {e}")
        print(f"версии: ошибок {len(errors)}")
        return 1 if errors else 0
    if a.list:
        for full in sorted(glob.glob(os.path.join(ROOT, "**", "*.md"), recursive=True)):
            path = os.path.relpath(full, ROOT).replace(os.sep, "/")
            if in_scope(path) and snapshots(path):
                print(f"{path}: v{len(snapshots(path)) + 1} (снимки {', '.join(f'v{n}' for n in snapshots(path))})")
        return 0
    made = snapshot()
    for line in made:
        print(line)
    print(f"снимков: {len(made)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
