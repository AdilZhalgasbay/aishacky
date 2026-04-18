# AIS Hack 3.0 MVP Test Audit

## Summary
Этот audit фиксирует текущее состояние MVP против ТЗ и показывает, что уже покрыто тестами, что нужно проверять руками и какие риски остаются перед demo.

Статусы:
- `Ready`: сценарий покрыт стабильными автотестами и имеет понятный expected result.
- `Partial`: есть рабочая реализация, но остаются известные риски или нужна ручная проверка.
- `Risk`: сценарий известен как нестабильный или может загрязнять live-data.

## Module 1: Attendance

| Requirement | Endpoint / Scenario | Verification | Status | Known issues | Expected demo result |
| --- | --- | --- | --- | --- | --- |
| Parse dirty attendance messages | `POST /messages/parse-attendance` | Stable pytest + live smoke | Ready | В live-данных уже наблюдались дубли по одной дате и классу | Возвращается JSON с `total_portions`, `total_absent`, `classes` |
| Persist attendance by class/date | `state_store.upsert_attendance_logs` via API | Stable pytest | Partial | В текущем live-прогоне были повторные записи в Supabase | Один класс на одну дату должен обновляться, а не размножаться |
| Attendance dashboard totals | `GET /attendance` | Stable pytest + manual UI | Ready | Зависит от чистоты данных в БД | Директор видит итог по порциям и отсутствующим |
| Send canteen digest | `PATCH /attendance` and scheduler flow | Stable pytest on route + manual checklist | Partial | Доставка зависит от `tg_chat_id` и текущей логики `notifications.py` | Сводка отмечается отправленной и видна директору/столовой |

## Module 1: Incidents

| Requirement | Endpoint / Scenario | Verification | Status | Known issues | Expected demo result |
| --- | --- | --- | --- | --- | --- |
| Detect incident from teacher message | `POST /messages/parse-incident` | Stable pytest + live smoke | Ready | Назначение зависит от словаря assignee и LLM | Создаётся карточка с `type`, `priority`, `assignee` |
| Resolve incident from follow-up message | `POST /messages/parse-resolution` | Stable pytest | Ready | Нужно держать приоритет resolution выше incident | Инцидент закрывается без создания дубликата |
| Manual incident management | `POST /incidents`, `PATCH /incidents` | Stable pytest + manual UI | Ready | Уведомления могут не уходить без chat id | Статус меняется, запись видна в dashboard |

## Module 2: Voice-to-Task

| Requirement | Endpoint / Scenario | Verification | Status | Known issues | Expected demo result |
| --- | --- | --- | --- | --- | --- |
| Parse text command into multiple tasks | `POST /voice/parse-tasks` | Stable pytest + live smoke | Ready | Live writes создают реальные задачи в БД | Возвращается массив задач с исполнителями и сроками |
| Parse audio command into tasks | `POST /voice/parse-tasks-audio` | Stable pytest + manual UI | Partial | Нужна живая проверка микрофона/аудиоформата в браузере | Аудио превращается в те же структурированные задачи |
| Compliance on created tasks | `rag.check_compliance` in voice flow | Stable pytest | Ready | Качество зависит от LLM/RAG контекста | В task сохраняется compliance block |
| Notify assignees | `notify_task_assignee` | Stable pytest on status + manual UI/live | Partial | Без `tg_chat_id` delivery status будет `no_chat_id` | У сотрудника появляется Telegram-notification или корректный status |

## Module 3: Smart Substitution

| Requirement | Endpoint / Scenario | Verification | Status | Known issues | Expected demo result |
| --- | --- | --- | --- | --- | --- |
| Substitute by exact teacher name | `POST /schedule/substitute` with `absent_teacher_name` | Stable pytest | Ready | Запрос нужно отправлять именно с `absent_teacher_name` | Возвращается список замен на день |
| Substitute by natural-language command | `POST /schedule/substitute` with `message` | Stable pytest + manual UI | Partial | Live-распознавание имени зависит от teacher directory | Директор вводит фразу, API находит отсутствующего |
| Reject unknown teacher | `POST /schedule/substitute` | Stable pytest | Ready | Возможны 400/404 в зависимости от payload | Ошибка понятна и пригодна для UI |
| Avoid teacher double-booking | schedule selection logic | Stable pytest | Partial | Не гарантирует полный контроль конфликтов кабинетов в live-расписании | Один и тот же substitute не назначается на один и тот же `period` дважды |
| Notify substitute teacher | `notify_substitution_assignee` | Stable pytest on status + manual UI/live | Partial | Delivery зависит от `tg_chat_id` | Учитель получает сообщение с классом, уроком и причиной |

## Module 4: RAG

| Requirement | Endpoint / Scenario | Verification | Status | Known issues | Expected demo result |
| --- | --- | --- | --- | --- | --- |
| Query regulations by director question | `POST /rag/query` | Stable pytest + live smoke | Ready | Ответ зависит от текущего индекса и моделей | Возвращается понятный ответ и sources |
| Map source to order number | source detection in response | Stable pytest | Ready | Keyword mapping нужно поддерживать актуальным | В source виден `doc_number` (`76`, `110`, `130`) |
| Compliance check for actions | `check_compliance()` | Stable pytest | Ready | Ошибки LLM сейчас маскируются fallback-ответом | Возвращается JSON с `compliant`, `citation`, `advice` |

## Dashboard / UX

| Requirement | Route / Scenario | Verification | Status | Known issues | Expected demo result |
| --- | --- | --- | --- | --- | --- |
| Dashboard loads without crashes | `/`, `/health`, dashboard data routes | Stable pytest + build | Ready | Нужна ручная проверка визуальной связности | Директор видит ключевые карточки и navigation |
| Attendance UI flow | `/attendance` | Manual checklist + `npm run build` | Partial | Требует ручной проверки таблиц и CTA | Видны totals, таблица классов, кнопка отправки |
| Incidents and tasks UI flow | `/incidents`, `/tasks` | Manual checklist + build | Partial | Нет browser e2e | Создание и статус отражаются в UI |
| Schedule UI flow | `/schedule` | Manual checklist + build | Partial | Нужна ручная проверка substitutions result card | Команда директора и ручной выбор работают из UI |
| Telegram simulator UI flow | `/telegram` | Manual checklist + build | Partial | Аудиосценарий зависит от браузера и backend proxy | Сообщение отображается и логируется |

## Telegram Integration

| Requirement | Endpoint / Scenario | Verification | Status | Known issues | Expected demo result |
| --- | --- | --- | --- | --- | --- |
| Text simulate flow | `POST /telegram/simulate` | Stable pytest | Ready | Не заменяет реальный webhook от Telegram | Возвращается `bot_reply`, запись уходит в telegram log |
| Audio simulate flow | `POST /telegram/simulate-audio` | Stable pytest + manual UI | Partial | Нужна живая проверка аудиофайлов/микрофона | Аудио транскрибируется и идёт по тому же routing path |
| Message log listing | `GET /telegram/messages` | Stable pytest | Ready | История зависит от live-данных | Директор видит последние сообщения |

## Scheduler 09:00 Flow

| Requirement | Scenario | Verification | Status | Known issues | Expected demo result |
| --- | --- | --- | --- | --- | --- |
| 09:00 attendance digest | scheduler + `/attendance` | Manual/system smoke | Risk | Автосценарий зависит от env flags, timezone и доставки | В 09:00 уходит digest по attendance |
| Telegram-first digest | `send_attendance_digest()` | Route-level stable test + manual smoke | Partial | Ошибка в live-delivery может не проявиться без реальных chat ids | Директор и столовая получают итог по порциям |

## Known Risks To Track
- Live smoke tests могут загрязнять текущие данные, особенно `attendance`, `tasks`, `incidents`, `substitutions`.
- Attendance уже показывал признаки дублей при повторных живых прогонах.
- Для substitutions нужно использовать поле `absent_teacher_name`, а не `absent_teacher`.
- Telegram delivery зависит от наличия `tg_chat_id`; без этого статус может быть технически корректным, но уведомление не дойдёт.
- Полный UX сейчас закрывается manual checklist, а не browser e2e.

