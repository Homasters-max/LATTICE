---
id: env
type: dev/guide@1
title: Среда — Windows, Git Bash, инструменты агента
paths: ["**"]
rules:
  - id: RUL-003
    aliases: [R-L0-03]
    text: Edit/Write превращают \uXXXX в символы — литеральный escape писать perl с \x5c
    force: advisory
    status: retired
    source: ISS-014
    owner: human:Homasters-max
    until: ISS-014 verified
    review_by: 2026-10-12
  - id: RUL-004
    aliases: [R-L0-04]
    text: Команду длиннее ~7 тыс. символов (сообщение коммита, тело PR, JSON) — файлом (-F/--body-file/--file), не heredoc
    force: advisory
    status: active
    source: ISS-015
    owner: human:Homasters-max
    until: ISS-015 verified
    review_by: 2026-10-12
  - id: RUL-009
    aliases: [R-L0-09]
    text: Правка с кириллицей в шаблоне — Edit; perl — только ASCII-шаблоны или perl -Mutf8 -CSD
    force: advisory
    status: retired
    source: ISS-017
    owner: human:Homasters-max
    until: ISS-017 verified
    review_by: 2026-10-12
  - id: RUL-055
    text: "git show <ref>:<путь> и другие аргументы вида a/b:c — с MSYS_NO_PATHCONV=1, иначе Git Bash превращает их в пути Windows"
    force: advisory
    status: active
    source: ISS-030
    owner: human:Homasters-max
    until: ISS-030 verified
    review_by: 2026-10-12
  - id: RUL-056
    text: "Код с регулярными выражениями или кавычками — Read функции целиком и одна замена всего блока (Edit/Write); не патчить кусками через heredoc; после смены формы данных — grep всех мест использования"
    force: advisory
    status: retired
    source: ISS-029
    owner: human:Homasters-max
    until: ISS-029 verified
    review_by: 2026-10-12
  - id: RUL-057
    text: 'Правка файла проекта — Edit/Write; функцию с regex или кавычками — Read целиком и одна замена блока, после смены формы данных — grep использований; sed -i и perl -i — только вне проекта; литерал \uXXXX — perl -Mutf8 -CSD с \x5c'
    force: advisory
    status: active
    source: [ISS-014, ISS-017, ISS-028, ISS-029]
    owner: human:Homasters-max
    until: ISS-028 verified (и ISS-014, ISS-017, ISS-029)
    review_by: 2026-10-12
---

# env — Среда — Windows, Git Bash, инструменты агента

Ловушки среды и техники работы агента: Windows 11, Git Bash, инструменты Claude Code — что ломается и как обойти.

## Область

Любая работа в репозитории, **включая субагентов**: промпт субагента несёт эти правила текстом (RUL-013). Python —
`sys.stdout.reconfigure(encoding="utf-8")`; кириллицу в выводе консоли читать по структуре (JSON, поля), не глазами.

## Проверка

По отчётам: ловушки не срабатывают повторно; `until` — по закрытию проблем.
