# Фрагмент А · edits · 2026-09-27-a1

## Правки карточек

| П | Карточка | KB-n (слитые) | Правки: related · aliases · questions · description | Проверено (grep) | Приоритет |
|---|---|---|---|---|---|
| П-1 | `glossary/term-084-single-writer-control.md` (TERM-084) | KB-27, KB-33, KB-45(rev), KB-48 | related += `pat-132-microkernel-architecture`, `ant-037-can-execute-without-may-execute`, `pat-161-separate-general-and-special-purpose-code` (KB-27); += `term-009-event-sourcing` (KB-33); += `ant-069-common-coupling` (KB-45, обратная связь); += `pat-044-human-in-the-loop-accountability`, `dec-031-governance-mechanism` (KB-48); questions += «как не дать системе поменять собственные правила проверки» (KB-27); отдельно (KB-48) — пересмотреть весь список `related` (сейчас только 3 записи на тему governance, см. П-1) | `glossary/term-084-single-writer-control.md:9#2d5d16` related = `term-071-controlled-self-improvement, term-081-promotion, term-121-durable-memory` — ни одного из добавляемых нет | P1 |
| П-2 | `patterns/pat-132-microkernel-architecture.md` (PAT-132) | KB-27(rev), KB-28(rev), KB-47, KB-70(rev) | related += `term-084-single-writer-control` (KB-27, обратная); += `ant-109-configuration-parameter-overuse` (KB-28, обратная); += `ant-110-special-general-mixture`, `dec-055-general-vs-special-purpose-module` (KB-47); += `pat-195-radical-immutability` (KB-70, обратная) | `patterns/pat-132-microkernel-architecture.md:11#d66b83` — ни term-084, ни ant-109, ни ant-110, ни dec-055, ни pat-195 в списке нет | P1 |
| П-3 | `glossary/term-119-chunking.md` (TERM-119) | KB-63, KB-68, KB-89 | related += `term-201-recall` (KB-63); += `term-126-reranking` (KB-68, вместе с pat-030 — см. П-19); += `term-188-evaluation` (KB-89) | `glossary/term-119-chunking.md:9#57decb` related = `term-019-rag, term-127-semantic-search, term-125-prompt-compression, term-337-compaction` — ни term-201, ни term-126, ни term-188 нет | P1 |
| П-4 | `patterns/pat-019-idempotency-under-nondeterminism.md` (PAT-019) | KB-16, KB-17(rev) | questions += «повтор записи не должен задваивать эффект» (KB-16); related += `term-009-event-sourcing` (KB-17, обратная связь) | `patterns/pat-019-idempotency-under-nondeterminism.md:12#cacaea` related = без term-009; questions в файле сейчас нет (поле отсутствует — вставить) | P2 |
| П-5 | `glossary/term-009-event-sourcing.md` (TERM-009) | KB-17, KB-33(rev) | related += `pat-019-idempotency-under-nondeterminism` (KB-17); += `term-084-single-writer-control` (KB-33, обратная — см. П-1) | `glossary/term-009-event-sourcing.md:9#f59f02` related — есть `pat-097-recoverable-agent-runs`, нет `pat-019` и `term-084` | P2 |
| П-6 | `antipatterns/ant-069-common-coupling.md` (ANT-069) | KB-45, KB-82(rev) | related += `term-084-single-writer-control` (KB-45); += `pat-131-pipeline-architecture` (KB-82, обратная — см. П-20) | `antipatterns/ant-069-common-coupling.md:13#4678c6` related — 15 записей, в т.ч. `ant-107-pass-through-variable`, но нет term-084 и pat-131 | P2 |
| П-7 | `patterns/pat-106-evaluate-the-system.md` (PAT-106) | KB-46(rev), KB-88(rev) | related += `pat-193-deconstructed-versioning` (KB-46, обратная); += `term-192-golden-set` (KB-88, обратная — см. П-33) | `patterns/pat-106-evaluate-the-system.md:12#458b85` related — есть term-188, term-181, dec-023 и др., нет pat-193 и term-192 | P2 |
| П-8 | `glossary/term-171-provenance.md` (TERM-171) | KB-49(rev), KB-88 | related += `term-216-hallucination` (KB-49, обратная); += `term-192-golden-set` (KB-88) | `glossary/term-171-provenance.md:9#1359c9` related — 8 записей (pat-052, pat-020, pat-101, term-123, term-133, term-149, term-168, term-205), ни term-216, ни term-192 нет | P2 |
| П-9 | `glossary/term-126-reranking.md` (TERM-126) | KB-59, KB-68(rev) | related += `pat-047-pre-retrieval-access-control` (KB-59); += `pat-030-embeddings-vector-search`, `term-119-chunking` (KB-68, обратная — см. П-3, П-19) | `glossary/term-126-reranking.md:9#42e16b` related = `term-127, term-019, term-020, term-201, term-021` — ни pat-047, ни pat-030, ни term-119 нет | P2 |
| П-10 | `patterns/pat-047-pre-retrieval-access-control.md` (PAT-047) | KB-59(rev), KB-98 | related += `term-126-reranking` (KB-59, обратная); += `pat-039-reasoning-trace-capture` (KB-98, обратная — см. П-59) | `patterns/pat-047-pre-retrieval-access-control.md:12#936804` related — 11 записей, в т.ч. term-127-semantic-search, но term-126 и pat-039 нет | P2 |
| П-11 | `glossary/term-194-held-out-set.md` (TERM-194) | KB-60, KB-90 | related += `term-178-abstention` (KB-60); aliases += «test set», «тестовый набор» (KB-60, KB-90 — дубль); questions += «порог отбора подбирают на одном наборе, а проверяют на другом — как не спутать» (KB-60, формулировка по смыслу строки реестра) | `glossary/term-194-held-out-set.md:4#2f926e` aliases = `holdout set, отложенная выборка, holdout` — «test set»/«тестовый набор» нет; `:9` related = `term-192, term-185, term-202, pat-107` — term-178 нет; поля questions нет | P2 |
| П-12 | `glossary/term-182-calibration.md` (TERM-182) | KB-61(rev), KB-71(rev) | related += `dec-023-model-selection` (KB-61, обратная); += `term-027-llm-as-judge` (KB-71, обратная — см. П-51) | `glossary/term-182-calibration.md:9#bcddc6` related = `pat-051-trust-calibration, term-180-accuracy, term-178-abstention` — ни dec-023, ни term-027 нет | P2 |
| П-13 | `patterns/pat-030-embeddings-vector-search.md` (PAT-030) | KB-68, KB-74 | related += `term-126-reranking` (KB-68, вместе с term-119 — см. П-3, П-9); §«Когда не применять» доп. пункт: смешанный случай — детерминированный ключ как предфильтр кандидатов перед векторным поиском (KB-74) | `patterns/pat-030-embeddings-vector-search.md:12#ce0521` related — term-127 есть, term-126 нет; `:48-51` «Когда не применять» — только 2 пункта (прямой lookup; медиа не поддерживается моделью), смешанного случая нет | P2 |
| П-14 | `patterns/pat-131-pipeline-architecture.md` (PAT-131) | KB-70(rev), KB-82 | related += `pat-195-radical-immutability` (KB-70, обратная); += `ant-107-pass-through-variable`, `ant-069-common-coupling` (KB-82) | `patterns/pat-131-pipeline-architecture.md:11#3615a0` related — 11 записей об архитектурных стилях, ни pat-195, ни ant-107, ни ant-069 нет | P2 |
| П-15 | `glossary/term-124-prompt-caching.md` (TERM-124) | KB-71(rev), KB-83 | related += `term-027-llm-as-judge` (KB-71, обратная); += `term-197-nondeterminism` (KB-83, обратная — см. П-55) | `glossary/term-124-prompt-caching.md:9#998fac` related = `term-125, term-219, term-218, term-088, term-089, term-091, pat-045` — ни term-027, ни term-197 нет | P2 |
| П-16 | `glossary/term-195-independent-verification.md` (TERM-195) | KB-8 | related += `ant-038-self-improvement-without-frozen-evals`, `dec-026-review-assignment` | `glossary/term-195-independent-verification.md:9#2f0721` related — 11 записей, ни ant-038, ни dec-026 нет | P3 |
| П-17 | `antipatterns/ant-038-self-improvement-without-frozen-evals.md` (ANT-038) | KB-8 (обратная) | related += `term-195-independent-verification` | `antipatterns/ant-038-self-improvement-without-frozen-evals.md:12#c0c8f6` related — 9 записей, term-195 нет | P3 |
| П-18 | `decisions/dec-026-review-assignment.md` (DEC-026) | KB-8 (обратная) | related += `term-195-independent-verification` | `decisions/dec-026-review-assignment.md:12#f548b4` related — 8 записей, term-195 нет | P3 |
| П-19 | `antipatterns/ant-098-data-swamp.md` (ANT-098) | KB-9 | aliases += «schema-on-read», «схема при чтении» | `antipatterns/ant-098-data-swamp.md:4#4966b0` aliases = `Data Swamp, озеро данных без схемы, data lake without schema` — schema-on-read нет | P3 |
| П-20 | `patterns/pat-017-agent-message-envelope.md` (PAT-017) | KB-10 | questions += «одна форма записи для разных видов данных» (CR-2); отдельно (не обязательно, решает maintainer) — рассмотреть добавление домена `architecture` к текущему `messaging, agents` | `patterns/pat-017-agent-message-envelope.md:6#27daea` domain = `[messaging, agents]`; поля questions нет | P3 |
| П-21 | `patterns/pat-051-trust-calibration.md` (PAT-051) | KB-11 | description и aliases уточнить «доверие пользователя к AI-интерфейсу» — сейчас общая формулировка «доверять AI-системе», без явного «пользователь vs вычисляемое доверие» | `patterns/pat-051-trust-calibration.md:9#10bf6e` description = «Проектировать так, чтобы пользователь доверял AI-системе ровно настолько...» — слово «пользователь» уже есть, но алиасы («Calibrated trust», «Слоистая прозрачность») перехватывают более общие запросы; `:4` aliases без пометки «доверие пользователя» | P3 |
| П-22 | `patterns/pat-146-value-object.md` (PAT-146) | KB-18 | related += `pat-052-data-provenance`; §Trade-offs доп. пункт — при дедупликации по значению теряется происхождение (provenance) второго источника | `patterns/pat-146-value-object.md:11#10c07b` related — 8 записей, pat-052 нет; `:43` §Trade-offs без упоминания provenance | P3 |
| П-23 | `patterns/pat-052-data-provenance.md` (PAT-052) | KB-18 (обратная) | related += `pat-146-value-object` | `patterns/pat-052-data-provenance.md:11#acee77` related — 14 записей (в т.ч. term-171-provenance), pat-146 нет | P3 |
| П-24 | `glossary/term-175-tool-poisoning.md` (TERM-175) | KB-26 | related += `term-151-ai-supply-chain`, `term-137-mcp-gateway`, `pat-101-context-as-supply-chain`; questions += «закрепление версий инструментов» | не перечитывал файл повторно (адрес дан в реестре: r1 Q-07 K-1, R-1, grep `^related:` — 0 совпадений с этими тремя ID) | P3 |
| П-25 | `glossary/term-151-ai-supply-chain.md` (TERM-151) | KB-26 (обратная) | related += `term-175-tool-poisoning` | `glossary/term-151-ai-supply-chain.md:9#4ac68c` related = `pat-101-context-as-supply-chain, term-141-mcp-server, term-149-ai-ready-data` — term-175 нет | P3 |
| П-26 | `glossary/term-137-mcp-gateway.md` (TERM-137) | KB-26 (обратная) | related += `term-175-tool-poisoning` | `glossary/term-137-mcp-gateway.md:9#7ed031` related = `term-141, term-025, term-143, pat-063, pat-046, term-022` — term-175 нет | P3 |
| П-27 | `patterns/pat-101-context-as-supply-chain.md` (PAT-101) | KB-26 (обратная) | related += `term-175-tool-poisoning` | `patterns/pat-101-context-as-supply-chain.md:12#82878d` related — 14 записей, term-175 нет | P3 |
| П-28 | `antipatterns/ant-037-can-execute-without-may-execute.md` (ANT-037) | KB-27 (обратная) | related += `term-084-single-writer-control` | `antipatterns/ant-037-can-execute-without-may-execute.md:12#b883e3` related — 13 записей, term-084 нет | P3 |
| П-29 | `patterns/pat-161-separate-general-and-special-purpose-code.md` (PAT-161) | KB-27 (обратная) | related += `term-084-single-writer-control` | `patterns/pat-161-separate-general-and-special-purpose-code.md:11#846683` related — 10 записей, term-084 нет | P3 |
| П-30 | `antipatterns/ant-109-configuration-parameter-overuse.md` (ANT-109) | KB-28 | questions += «когда поведение, вынесенное в данные, становится языком»; related += `pat-132-microkernel-architecture` | `antipatterns/ant-109-configuration-parameter-overuse.md:11#a8e1d8` related = `pat-163, dec-037, ant-104, term-407, pat-175` — pat-132 нет; поля questions нет | P3 |
| П-31 | `glossary/term-243-checkpoint.md` (TERM-243) | KB-34 | description/раздел «Отличать от» — карточка уже разводит «чекпойнт обучения» и «чекпойнт восстановления агента» (:22-24), но `pat-097-recoverable-agent-runs` всё равно ссылается на неё (:9) как на точку продолжения прогона; развилка для maintainer: либо добавить в TERM-243 второе явное значение «контрольная точка проекции/прогона», либо завести отдельный термин и снять `related` у pat-097 | `glossary/term-243-checkpoint.md:7#e6f5cf` description — только «состояние модели в точке обучения»; `:22-24` «Отличать от» говорит, что чекпойнт восстановления агента — другое понятие, но `patterns/pat-097-recoverable-agent-runs.md:12#cbaf09` всё равно ссылается на term-243-checkpoint | P3 |
| П-32 | `patterns/pat-193-deconstructed-versioning.md` (PAT-193) | KB-46 | related += `pat-106-evaluate-the-system` | `patterns/pat-193-deconstructed-versioning.md:12#fb7a8b` related — 7 записей об API-версионировании, pat-106 нет | P3 |
| П-33 | `glossary/term-192-golden-set.md` (TERM-192) | KB-88 | related += `term-171-provenance`, `pat-106-evaluate-the-system` | `glossary/term-192-golden-set.md:9#df2de7` related = `term-194-held-out-set, term-181-benchmark` — ни term-171, ни pat-106 нет | P3 |
| П-34 | `antipatterns/ant-110-special-general-mixture.md` (ANT-110) | KB-47 (обратная) | related += `pat-132-microkernel-architecture` | `antipatterns/ant-110-special-general-mixture.md:11#7d59b4` related — 10 записей, pat-132 нет | P3 |
| П-35 | `decisions/dec-055-general-vs-special-purpose-module.md` (DEC-055) | KB-47 (обратная) | related += `pat-132-microkernel-architecture` | `decisions/dec-055-general-vs-special-purpose-module.md:11#5c162e` related — 19 записей, pat-132 нет | P3 |
| П-36 | `patterns/pat-044-human-in-the-loop-accountability.md` (PAT-044) | KB-48 (обратная) | related += `term-084-single-writer-control` | `patterns/pat-044-human-in-the-loop-accountability.md:13#140967` related — 22 записи, term-084 нет | P3 |
| П-37 | `decisions/dec-031-governance-mechanism.md` (DEC-031) | KB-48 (обратная) | related += `term-084-single-writer-control` | `decisions/dec-031-governance-mechanism.md:12#eb02f2` related — 9 записей, term-084 нет | P3 |
| П-38 | `glossary/term-216-hallucination.md` (TERM-216) | KB-49 | related += `ant-011-tests-derived-from-code`, `term-171-provenance` | `glossary/term-216-hallucination.md:9#bd46c3` related = `ant-036-fail-plausible-success, term-204-sycophancy` — ни ant-011, ни term-171 нет | P3 |
| П-39 | `antipatterns/ant-011-tests-derived-from-code.md` (ANT-011) | KB-49 (обратная) | related += `term-216-hallucination` | `antipatterns/ant-011-tests-derived-from-code.md:11#93e6f2` related — 11 записей (в т.ч. term-195, term-202, term-331), term-216 нет | P3 |
| П-40 | `glossary/term-127-semantic-search.md` (TERM-127) | KB-58 | aliases += «hybrid retrieval», «гибридное извлечение», «гибридный поиск» | `glossary/term-127-semantic-search.md:4#b0136e` aliases = только «Семантический поиск»; `:24` тело — «Гибридное извлечение объединяет лексических и плотных кандидатов…» — фраза есть, алиаса нет | P3 |
| П-41 | `glossary/term-178-abstention.md` (TERM-178) | KB-60 | related += `term-194-held-out-set` | `glossary/term-178-abstention.md:9#1af344` related = `pat-044, term-182, term-193, pat-110, ant-036, term-027` — term-194 нет | P3 |
| П-42 | `decisions/dec-023-model-selection.md` (DEC-023) | KB-61 | related += `term-182-calibration` | `decisions/dec-023-model-selection.md:12#052b35` related — 8 записей, term-182 нет | P3 |
| П-43 | `glossary/term-231-structured-output.md` (TERM-231) | KB-62 | related += `ant-036-fail-plausible-success` | `glossary/term-231-structured-output.md:9#cd2730` related = `term-213, term-230, term-225, pat-028` — ant-036 нет | P3 |
| П-44 | `antipatterns/ant-036-fail-plausible-success.md` (ANT-036) | KB-62 (обратная) | related += `term-231-structured-output` | `antipatterns/ant-036-fail-plausible-success.md:13#072374` related — 13 записей, term-231 нет | P3 |
| П-45 | `glossary/term-201-recall.md` (TERM-201) | KB-63 (обратная) | related += `term-119-chunking` | `glossary/term-201-recall.md:9#50f3e2` related = `term-200, term-190, term-189, term-126, term-180, term-184` — term-119 нет | P3 |
| П-46 | `patterns/pat-038-structured-decision-record.md` (PAT-038) | KB-64 | related += `term-170-post-hoc-explanation` | `patterns/pat-038-structured-decision-record.md:13#3f7b74` related — 18 записей, term-170 нет | P3 |
| П-47 | `glossary/term-170-post-hoc-explanation.md` (TERM-170) | KB-64 (обратная) | related += `pat-038-structured-decision-record` | `glossary/term-170-post-hoc-explanation.md:9#d7edfe` related = `term-162-explainability, term-165-interpretability` — pat-038 нет | P3 |
| П-48 | `glossary/term-121-durable-memory.md` (TERM-121) | KB-69 | related += `term-157-context-poisoning`, `term-158-data-poisoning` | `glossary/term-121-durable-memory.md:10#9f0d39` related — 7 записей (в т.ч. term-084-single-writer-control), ни term-157, ни term-158 нет | P3 |
| П-49 | `glossary/term-157-context-poisoning.md` (TERM-157) | KB-69 (обратная) | related += `term-121-durable-memory` | `glossary/term-157-context-poisoning.md:9#46c6b2` related = `pat-101, term-120, pat-029, term-024` — term-121 нет | P3 |
| П-50 | `glossary/term-158-data-poisoning.md` (TERM-158) | KB-69 (обратная) | related += `term-121-durable-memory` | `glossary/term-158-data-poisoning.md:9#346e04` related = `term-286-training-data` — term-121 нет | P3 |
| П-51 | `patterns/pat-195-radical-immutability.md` (PAT-195) | KB-70 | related += `pat-131-pipeline-architecture`, `pat-132-microkernel-architecture` | `patterns/pat-195-radical-immutability.md:12#9945ff` related — 6 записей о деплое/версионировании, ни pat-131, ни pat-132 нет | P3 |
| П-52 | `glossary/term-027-llm-as-judge.md` (TERM-027) | KB-71 | related += `term-182-calibration`, `term-124-prompt-caching` | `glossary/term-027-llm-as-judge.md:9#e3707c` related — 12 записей (term-025-guardrails, term-195-independent-verification и др.), ни term-182, ни term-124 нет | P3 |
| П-53 | `glossary/term-025-guardrails.md` (TERM-025) | KB-75 | related += `pat-095-invariants-explained-and-enforced`; questions += «как ограничить и проверить предел» | `glossary/term-025-guardrails.md:9#199e3e` related = `pat-031, term-027, ant-004, pat-046, ant-015, term-137, term-206, term-169, term-161, term-232, term-166` — pat-095 нет; поля questions нет | P3 |
| П-54 | `patterns/pat-095-invariants-explained-and-enforced.md` (PAT-095) | KB-75 (обратная) | related += `term-025-guardrails` | `patterns/pat-095-invariants-explained-and-enforced.md:12#08b873` related — 10 записей, term-025 нет | P3 |
| П-55 | `antipatterns/ant-107-pass-through-variable.md` (ANT-107) | KB-82 (обратная) | related += `pat-131-pipeline-architecture` | `antipatterns/ant-107-pass-through-variable.md:11#54216c` related — 9 записей (в т.ч. ant-069-common-coupling), pat-131 нет | P3 |
| П-56 | `glossary/term-197-nondeterminism.md` (TERM-197) | KB-83 | related += `term-124-prompt-caching` | `glossary/term-197-nondeterminism.md:9#c26ba4` related = `pat-019, term-188, term-229, pat-106, term-181` — term-124 нет | P3 |
| П-57 | `glossary/term-188-evaluation.md` (TERM-188) | KB-89 (обратная) | related += `term-119-chunking` | `glossary/term-188-evaluation.md:9#042c8b` related — 18 записей об оценке, term-119 нет | P3 |
| П-58 | `glossary/term-206-verification-gate.md` (TERM-206) | KB-91 | aliases += «regression gate», «регрессионный барьер» | `glossary/term-206-verification-gate.md:4#42ba4c` aliases = `quality gate, promotion gate, gate проверки` — «regression gate»/«регрессионный барьер» нет | P3 |
| П-59 | `patterns/pat-039-reasoning-trace-capture.md` (PAT-039) | KB-98 | related += `pat-047-pre-retrieval-access-control` | `patterns/pat-039-reasoning-trace-capture.md:13#c280a1` related — 17 записей об observability, pat-047 нет | P3 |
| П-60 | `glossary/term-205-trace.md` (TERM-205) | KB-98 | aliases += «secret», «секрет» — тело уже упоминает секреты в трассе, но узкие запросы карточку не находят | `glossary/term-205-trace.md:4#c12970` aliases = `execution trace, трасса, трасса выполнения` — «secret»/«секрет» нет; `:34` тело — «могут содержать секреты, персональные данные и проприетарный материал» | P3 |
| П-61 | `glossary/term-005-hexagonal-onion-clean.md` (TERM-005) | KB-97 | description/тело: карточка называет способ связывания («внедрение зависимостей или конфигурация при запуске», :17-18), но не называет и не ссылается на конкретное место связывания (composition root); отдельной карточки для этого в базе нет (`grep -rli "composition root\|композиционный корень"` — только docs/research-roadmap.md, не карточка) — правка ждёт новую карточку из KB-97 upstream «+ KB-92» (участок cards, не мой; своим фрагментом её не завожу) | `glossary/term-005-hexagonal-onion-clean.md:9#71a7d5` related — 10 записей об архитектурных стилях, карточки места связывания нет вообще | P3 |

## Покрытие

| Вход | Куда |
|---|---|
| KB-8 | П-16, П-17, П-18 |
| KB-9 | П-19 |
| KB-10 | П-20 |
| KB-11 | П-21 |
| KB-12 | не карточка — политика на будущую партию CR-2 (взять формулировки готовых вопросов Q-n из `2026-09-26-decisions-questions.md` для карточек, отмеченных `--used`); не пакет правки, в таблицу не включено |
| KB-16 | П-4 |
| KB-17 | П-4, П-5 |
| KB-18 | П-22, П-23 |
| KB-26 | П-24, П-25, П-26, П-27 |
| KB-27 | П-1, П-2, П-28, П-29 |
| KB-28 | П-2, П-30 |
| KB-33 | П-1, П-5 |
| KB-34 | П-31 |
| KB-45 | П-1, П-6 |
| KB-46 | П-7, П-32 |
| KB-47 | П-2, П-34, П-35 |
| KB-48 | П-1, П-36, П-37 |
| KB-49 | П-38, П-39, П-8 |
| KB-58 | П-40 |
| KB-59 | П-9, П-10 |
| KB-60 | П-11, П-41 |
| KB-61 | П-42, П-12 |
| KB-62 | П-43, П-44 |
| KB-63 | П-3, П-45 |
| KB-64 | П-46, П-47 |
| KB-68 | П-3, П-13, П-9 |
| KB-69 | П-48, П-49, П-50 |
| KB-70 | П-14, П-51, П-2 |
| KB-71 | П-52, П-12, П-15 |
| KB-74 | П-13 |
| KB-75 | П-53, П-54 |
| KB-82 | П-14, П-6, П-55 |
| KB-83 | П-56, П-15 |
| KB-88 | П-33, П-7, П-8 |
| KB-89 | П-3, П-57 |
| KB-90 | П-11 |
| KB-91 | П-58 |
| KB-97 | П-61 |
| KB-98 | П-59, П-60, П-10 |

## Промахи

нет

## Статистика

вход: карточек-правок 39 (KB-8…KB-98, часть 2 реестра) · изменений: 61 (П-1…П-61: 39 прямых + 22 обратные связи `related`, добавленные по правилу симметрии) · развилок: 1 (П-31, TERM-243 — второе значение или отдельный термин) · размер: 25 КБ
