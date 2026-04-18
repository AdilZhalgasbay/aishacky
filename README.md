# Aqbobek AI - School Management Platform

Aqbobek AI is an intelligent administration platform developed for the AIS Hack 3.0 hackathon (EdTech & AI Management track). The system automates routine bureaucratic tasks, attendance tracking, schedule substitutions, and maintenance requests using Natural Language Processing (NLP) and Large Language Models (LLMs).

## Core Features

- NLP Attendance Parser: Automatically processes teacher attendance reports from chat messages, aggregates the data, and dispatches summaries to the school administration and canteen.
- Smart Substitution: Reassigns classes when a teacher is absent by checking the schedule for available teachers matching the required subject and time, while preventing schedule and room conflicts.
- Voice-to-Task: Allows the principal to dictate tasks. The system uses multimodal LLMs to parse audio, identify assignees, set deadlines, and automatically manage the task lifecycle.
- Bureaucratic RAG: Provides answers based on official regulations (e.g., educational load limits, sanitary guidelines) while strictly checking schedules and tasks for compliance.

## Technology Stack

- Frontend: Next.js 16 (App Router), React, TypeScript, Tailwind CSS
- Backend: Python, FastAPI
- Database: Supabase (PostgreSQL)
- AI Integration: NVIDIA NIM (Llama 3.3-70b, Gemma 3n), FAISS Vector Database

## Architecture Overview

The system operates via a unified web dashboard and an integrated AI bot simulator. Teachers can interact with the system using natural language (text or voice) via chat. The FastAPI backend processes these inputs using LLMs hooked up to the school internal dataset stored in Supabase, and populates the dashboard for the principal.

## Setup and Installation

### Dependencies & Prerequisites

- Python 3.10+
- Node.js 18+
- Supabase project
- NVIDIA NIM API Key

### Backend Setup (Python)

1. Navigate to the root directory.
2. Create and activate a virtual environment:
   python -m venv .venv
   source .venv/bin/activate  # On Windows, use: .venv\Scripts\activate
3. Install dependencies:
   pip install -r requirements.txt
4. Set up environment variables by copying `.env.example` to `.env` and adding your credentials.
5. Run the ASGI server:
   uvicorn app.main:app --host 0.0.0.0 --port 8000

### Frontend Setup (Next.js)

1. Navigate to the `web` directory.
2. Install dependencies:
   npm install
3. Configure environment variables in `web/.env.local` if required.
4. Run the development server:
   npm run dev
5. To create an optimized production build, run:
   npm run build
   npm start

## License

Proprietary. Developed for the AIS Hack 3.0 Hackathon.
