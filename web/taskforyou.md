1. Dashboard
Make 4 screens/blocks:

Attendance summary
Incidents/tasks
Schedule substitutions
Orders/RAG assistant

2. Telegram bot

Authorize teachers by mock roles
Receive messages
Send to the principal/canteen manager
Send tasks to teachers
Send substitution notifications

3. Database/schema
Make tables:

employees
classes
schedules
attendance_logs
incidents
tasks
substitutions
regulations_docs/chunks

4. Front-back integration

Forms
Tables
Status updates
Beautiful demo flow

5. UX/pitch polish

Clear buttons
Large cards
Minimum complex screens
Demo scenario
The best way to divide an MVP
You're building an API and intelligence

At least the following endpoints:

POST /messages/parse-attendance
POST /messages/parse-incident
POST /voice/parse-tasks
POST /schedule/substitute
POST /rag/query


dashboard 
Telegram bot
tables and cards
mock data + API wiring





so it will easy to untegrate apis and so on that will do my mate.
his task that he will do. DONT do this tasks:
1. NLP-парсер чатов

принять сырые сообщения от Telegram-бота
вытащить:
класс
присутствуют
отсутствуют
причина, если есть
собрать итог по школе
вернуть JSON для дашборда и столовой

Пример результата:

{
  "date": "2026-04-17",
  "total_portions": 180,
  "total_absent": 5,
  "classes": [
    {"class": "1A", "present": 25, "absent": 2}
  ]
}

2. Incident extraction

если в сообщении есть проблема типа:
сломалась парта
нет мела
течет кран
классифицировать как incident
выделить:
тип
место
приоритет
кому назначить

3. Voice-to-task

взять текст с микрофона
разбить на отдельные задачи
выделить:
исполнитель
дедлайн
описание
приоритет

4. Smart substitution engine

вход: “Аскар заболел”
найти его уроки на сегодня
подобрать замену по:
предмету
свободному окну
квалификации
вернуть список замен

5. RAG / compliance helper

загрузить приказы 76/110/130
сделать:
поиск по фрагментам
“переведи на человеческий”
“проверь, не нарушает ли распоряжение приказ”
Мэйт