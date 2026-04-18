# Manual Test Checklist For Demo

## How to use
Перед прогоном:
- Подними FastAPI и web.
- Убедись, что `.env` настроен.
- Если идёшь по живым интеграциям, используй тестовые префиксы вроде `[TEST]`.

## Checklist

| Step | Screen / Endpoint | Test input | Expected result | Pass / Fail | Notes |
| --- | --- | --- | --- | --- | --- |
| 1 | `/` dashboard | Просто открыть страницу | Главный экран грузится, без ошибок в карточках и навигации |  |  |
| 2 | `/attendance` | Открыть overview и parse tabs | Видны totals, таблица классов, кнопка отправки в столовую |  |  |
| 3 | `/telegram` text simulate | `1А - 25 детей, 2 болеют` | Появляется `bot_reply`, запись сохраняется в message log |  |  |
| 4 | `/telegram` incident simulate | `В кабинете 12 сломалась парта` | Создаётся incident, в log видно `parsed_type=incident` |  |  |
| 5 | `/incidents` voice/text assistant | `Айгерим, подготовь актовый зал. Назкен, закажи воду и бейджи.` | Создаются две задачи, видны assignee и notification status |  |  |
| 6 | `/incidents` voice/audio assistant | Записать короткую голосовую команду | Аудио успешно обрабатывается, задачи появляются в preview и tasks list |  |  |
| 7 | `/schedule` manual substitution | Выбрать учителя и нажать найти замену | Возвращается substitution result, нет UI-ошибки, список обновляется |  |  |
| 8 | `/schedule` natural-language substitution | `Учитель математики Аскар заболел, его сегодня не будет` | API находит отсутствующего и предлагает/создаёт замену |  |  |
| 9 | `/rag` | `Какова норма часов для учителя начальных классов?` | Есть ответ и список sources с номером приказа |  |  |
| 10 | `/incidents` and `/tasks` | Открыть табы после создания записей | Новые incidents/tasks отображаются, статусы можно менять |  |  |
| 11 | `/telegram` message history | Переключиться на историю | Последние сообщения видны в обратном хронологическом порядке |  |  |
| 12 | `PATCH /attendance` через UI | Нажать `Отправить в столовую` | Показывается итог по порциям, статус меняется на отправленный |  |  |

## Extra smoke commands

### API health
```bash
curl -s http://127.0.0.1:8000/
curl -s http://127.0.0.1:8000/health
```

### Build smoke
```bash
python3 -m compileall app api
cd web && npm run build
```

### Stable tests
```bash
./scripts/run_test_suite.sh
```

### Live smoke
```bash
LIVE_BASE_URL=http://127.0.0.1:8000 LIVE_SMOKE_WRITE_OK=1 ./scripts/run_test_suite.sh --live
```

