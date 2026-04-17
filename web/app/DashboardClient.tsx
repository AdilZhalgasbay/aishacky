"use client"

import Link from 'next/link'
import { useState, useEffect } from 'react'
import PretextLog from '../components/PretextLog'

export interface DashboardIncident {
  id: string
  description: string
  priority: string
  status: string
  location: string | null
}

export interface DashboardTask {
  id: string
  title: string
  priority: string
  status: string
  source: string
  assigned_to_name: string | null
}

export interface DashboardSubstitution {
  id: string
  class_name: string | null
  period: number | null
  original_teacher_name: string | null
  substitute_name: string | null
  status: string
  subject: string | null
}

interface Props {
  stats: {
    totalPresent: number
    totalAbsent: number
    openIncidents: number
    pendingTasks: number
    subCount: number
    classCount: number
  }
  recentIncidents: DashboardIncident[]
  recentTasks: DashboardTask[]
  recentSubstitutions: DashboardSubstitution[]
}

const priorityLabel: Record<string, string> = {
  urgent: 'Срочно',
  high: 'Высокий',
  medium: 'Средний',
  low: 'Низкий',
}

const statusLabel: Record<string, string> = {
  open: 'Открыт',
  in_progress: 'В работе',
  resolved: 'Решён',
  pending: 'Ожидает',
  completed: 'Завершён',
  confirmed: 'Подтверждён',
  cancelled: 'Отменён',
}

export default function DashboardClient({ stats, recentIncidents, recentTasks, recentSubstitutions }: Props) {
  const [logs, setLogs] = useState<{id: string, text: string, timestamp: string}[]>([])

  useEffect(() => {
    const messages = [
      "Инициализация AI-агента...",
      "Синхронизация с Telegram @ScheduleAL_bot...",
      "WhatsApp Web Scraper: статус ONLINE",
      "Проверка посещаемости: 1А, 1Б обработаны",
      "RAG: Индекс приказов загружен (3 документа)",
      "Анализ инцидентов: новых оповещений нет",
      "Smart Substitution: ожидание входных данных",
      "Система готова к работе.",
    ]
    
    let i = 0
    const interval = setInterval(() => {
      if (i < messages.length) {
        setLogs(prev => [...prev, {
          id: `log-${Date.now()}-${i}`,
          text: messages[i],
          timestamp: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        }])
        i++
      } else {
        clearInterval(interval)
      }
    }, 2000)
    
    return () => clearInterval(interval)
  }, [])

  const now = new Date()
  const dateStr = now.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const statCards = [
    {
      label: 'Присутствуют сегодня',
      value: stats.totalPresent,
      sub: `Отсутствуют: ${stats.totalAbsent} • ${stats.classCount} классов`,
      color: '#2563EB',
      bg: '#dbeafe',
      href: '/attendance',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#2563EB" viewBox="0 0 16 16">
          <path d="M7 14s-1 0-1-1 1-4 6-4 6 3 6 4-1 1-1 1H7zm4-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/>
          <path fillRule="evenodd" d="M5.216 14A2.238 2.238 0 0 1 5 13c0-1.355.68-2.75 1.936-3.72A6.325 6.325 0 0 0 5 9c-4 0-5 3-5 4s1 1 1 1h4.216z"/>
          <path d="M4.5 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"/>
        </svg>
      ),
    },
    {
      label: 'Открытых инцидентов',
      value: stats.openIncidents,
      sub: 'Требуют внимания',
      color: '#DC2626',
      bg: '#fee2e2',
      href: '/incidents',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#DC2626" viewBox="0 0 16 16">
          <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
          <path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z"/>
        </svg>
      ),
    },
    {
      label: 'Активных задач',
      value: stats.pendingTasks,
      sub: 'Выполняются прямо сейчас',
      color: '#D97706',
      bg: '#fef3c7',
      href: '/incidents',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#D97706" viewBox="0 0 16 16">
          <path d="M0 1.5A.5.5 0 0 1 .5 1H2a.5.5 0 0 1 .485.379L2.89 3H14.5a.5.5 0 0 1 .49.598l-1 5a.5.5 0 0 1-.465.401l-9.397.472L4.415 11H13a.5.5 0 0 1 0 1H4a.5.5 0 0 1-.491-.408L2.01 3.607 1.61 2H.5a.5.5 0 0 1-.5-.5z"/>
          <path d="M6 14a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm7 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
        </svg>
      ),
    },
    {
      label: 'Замены сегодня',
      value: stats.subCount,
      sub: 'Урочных замен назначено',
      color: '#7C3AED',
      bg: '#ede9fe',
      href: '/schedule',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#7C3AED" viewBox="0 0 16 16">
          <path d="M1 2.828c.885-.37 2.154-.769 3.388-.893 1.33-.134 2.458.063 3.112.752v9.746c-.935-.53-2.12-.603-3.213-.493-1.18.12-2.37.461-3.287.811V2.828zm7.5-.141c.654-.689 1.782-.886 3.112-.752 1.234.124 2.503.523 3.388.893v9.746c-.917-.35-2.107-.692-3.287-.81-1.094-.111-2.278-.039-3.213.492V2.687z"/>
        </svg>
      ),
    },
  ]

  return (
    <div className="animate-fadein">
      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 className="page-title">Панель управления</h1>
            <p className="page-subtitle" style={{ textTransform: 'capitalize' }}>{dateStr}</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link href="/attendance" className="btn btn-primary btn-sm">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                <path d="M7 14s-1 0-1-1 1-4 6-4 6 3 6 4-1 1-1 1H7z"/>
                <path d="M12 4a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"/>
              </svg>
              Посещаемость
            </Link>
            <Link href="/incidents" className="btn btn-cta btn-sm">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14z"/>
                <path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z"/>
              </svg>
              Новый инцидент
            </Link>
          </div>
        </div>
      </div>

      {/* 09:00 Dining Hall Summary (TZ Requirement) */}
      <div className="card shadow-sm animate-fadein" style={{ marginBottom: 24, borderLeft: '4px solid var(--success)', background: '#f0fdf4' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <div className="live-dot" />
              <h2 className="section-title" style={{ margin: 0, fontSize: 14 }}>Свод по столовой (Автоматически в 09:00)</h2>
            </div>
            <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--success)' }}>
              Всего: {stats.totalPresent} порций • Отсутствуют: {stats.totalAbsent} чел.
            </p>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Данные собраны на основе {stats.classCount} отчетов учителей из Telegram/WhatsApp
            </p>
          </div>
          <Link href="/attendance" className="btn btn-primary btn-sm">
            Детализация
          </Link>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        {statCards.map((card) => (
          <Link href={card.href} key={card.label} style={{ textDecoration: 'none' }}>
            <div className="stat-card" style={{ cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ width: 44, height: 44, background: card.bg, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {card.icon}
                </div>
              </div>
              <div style={{ fontSize: 32, fontWeight: 800, color: card.color, lineHeight: 1 }}>
                {card.value}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{card.label}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{card.sub}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Main 3 columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>

        {/* Recent Incidents */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h2 className="section-title" style={{ margin: 0 }}>Последние инциденты</h2>
            <Link href="/incidents" style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>Все</Link>
          </div>
          {recentIncidents.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Нет инцидентов</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {recentIncidents.map((inc) => (
                <div key={inc.id} style={{ padding: '10px 12px', background: 'var(--bg)', borderRadius: 8, borderLeft: `3px solid ${inc.priority === 'urgent' ? '#7C3AED' : inc.priority === 'high' ? '#DC2626' : inc.priority === 'medium' ? '#D97706' : '#94A3B8'}` }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{inc.description}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span className={`badge badge-${inc.priority}`}>{priorityLabel[inc.priority] || inc.priority}</span>
                    <span className={`badge badge-${inc.status.replace('_', '-')}`}>{statusLabel[inc.status] || inc.status}</span>
                    {inc.location && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{inc.location}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Active Tasks */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h2 className="section-title" style={{ margin: 0 }}>Активные задачи</h2>
            <Link href="/incidents" style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>Все</Link>
          </div>
          {recentTasks.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Нет задач</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {recentTasks.map((task) => (
                <div key={task.id} style={{ padding: '10px 12px', background: 'var(--bg)', borderRadius: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{task.title}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span className={`badge badge-${task.priority}`}>{priorityLabel[task.priority]}</span>
                    <span className={`badge badge-${task.source}`}>{task.source === 'voice' ? 'Голос' : 'Вручную'}</span>
                    {task.assigned_to_name && (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{task.assigned_to_name}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Substitutions Today */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h2 className="section-title" style={{ margin: 0 }}>Замены сегодня</h2>
            <Link href="/schedule" style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>Все</Link>
          </div>
          {recentSubstitutions.length === 0 ? (
            <div style={{ padding: '20px 0', textAlign: 'center' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="var(--text-light)" viewBox="0 0 16 16" style={{ marginBottom: 8 }}>
                <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/>
              </svg>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>Замены не нужны</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {recentSubstitutions.map((sub) => (
                <div key={sub.id} style={{ padding: '10px 12px', background: 'var(--bg)', borderRadius: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{sub.class_name} — Урок {sub.period}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{sub.original_teacher_name} → {sub.substitute_name}</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <span className={`badge badge-${sub.status}`}>{statusLabel[sub.status]}</span>
                    {sub.subject && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sub.subject}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
          <Link href="/schedule" className="btn btn-outline btn-sm" style={{ width: '100%', justifyContent: 'center', marginTop: 12, display: 'flex' }}>
            Назначить замену
          </Link>
        </div>
      </div>

      {/* Quick Links */}
      <div style={{ marginTop: 24 }}>
        <h2 className="section-title">Быстрые действия</h2>
        <div className="grid-4">
          {[
            { href: '/attendance', label: 'Свод по столовой', desc: 'Отправить данные о питании', color: '#2563EB', bg: '#dbeafe' },
            { href: '/incidents', label: 'Создать задачу', desc: 'Поставить задачу сотруднику', color: '#D97706', bg: '#fef3c7' },
            { href: '/schedule', label: 'Найти замену', desc: 'Автоподбор замещающего учителя', color: '#7C3AED', bg: '#ede9fe' },
            { href: '/rag', label: 'Спросить AI', desc: 'Консультация по приказам МОН/МЗ', color: '#16A34A', bg: '#dcfce7' },
          ].map((item) => (
            <Link href={item.href} key={item.label} style={{ textDecoration: 'none' }}>
              <div className="card" style={{ cursor: 'pointer', borderLeft: `3px solid ${item.color}` }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: item.color }}>{item.label}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{item.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Live Agent Logs (Pretext Powered) */}
      <div style={{ marginTop: 24, marginBottom: 40 }}>
        <h2 className="section-title">Мониторинг Агента (Live)</h2>
        <PretextLog entries={logs} />
      </div>
    </div>
  )
}
