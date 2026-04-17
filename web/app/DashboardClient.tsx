'use client'
import Link from 'next/link'
import { useState, useEffect } from 'react'

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

const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000'

async function fetchJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${API}${path}`, { cache: 'no-store' })
    if (!res.ok) return fallback
    return await res.json()
  } catch {
    return fallback
  }
}

export default function DashboardClient() {
  const today = new Date().toISOString().split('T')[0]

  const [stats, setStats] = useState({
    totalPresent: 0, totalAbsent: 0,
    openIncidents: 0, pendingTasks: 0,
    subCount: 0, classCount: 0,
  })
  const [recentIncidents, setRecentIncidents] = useState<DashboardIncident[]>([])
  const [recentTasks, setRecentTasks] = useState<DashboardTask[]>([])
  const [recentSubstitutions, setRecentSubstitutions] = useState<DashboardSubstitution[]>([])
  const [loading, setLoading] = useState(true)

  // Fetch all data client-side (non-blocking — page renders immediately)
  useEffect(() => {
    const load = async () => {
      const [attendance, incidents, tasks, substitutions] = await Promise.all([
        fetchJson(`/attendance?date=${today}`, { classes: [], total_present: 0, total_absent: 0 }),
        fetchJson('/incidents', { incidents: [] }),
        fetchJson('/tasks', { tasks: [] }),
        fetchJson(`/schedule/substitutions?date_from=${today}`, { substitutions: [] }),
      ])

      const attendanceData = attendance as { classes: { present_count: number; absent_count: number }[]; total_present: number; total_absent: number }
      const incidentsData = incidents as { incidents: DashboardIncident[] }
      const tasksData = tasks as { tasks: DashboardTask[] }
      const substitutionsData = substitutions as { substitutions: DashboardSubstitution[] }

      const allIncidents = incidentsData.incidents || []
      const allTasks = tasksData.tasks || []
      const activeTasks = allTasks.filter(t => t.status !== 'completed')
      const allSubs = substitutionsData.substitutions || []

      setStats({
        totalPresent: attendanceData.total_present || 0,
        totalAbsent: attendanceData.total_absent || 0,
        openIncidents: allIncidents.filter(i => i.status === 'open').length,
        pendingTasks: activeTasks.filter(t => t.status === 'pending').length,
        subCount: allSubs.length,
        classCount: (attendanceData.classes || []).length,
      })
      setRecentIncidents(allIncidents.slice(0, 5))
      setRecentTasks(activeTasks.slice(0, 5))
      setRecentSubstitutions(allSubs)
      setLoading(false)
    }
    load()
  }, [today])

  const statCards = [
    { label: 'Присутствуют', value: loading ? '...' : stats.totalPresent, icon: '👥', color: 'var(--success)', link: '/attendance' },
    { label: 'Отсутствуют', value: loading ? '...' : stats.totalAbsent, icon: '🏠', color: 'var(--warning)', link: '/attendance' },
    { label: 'Инциденты', value: loading ? '...' : stats.openIncidents, icon: '🚨', color: 'var(--danger)', link: '/incidents' },
    { label: 'Задачи', value: loading ? '...' : stats.pendingTasks, icon: '📋', color: 'var(--primary)', link: '/tasks' },
    { label: 'Замены', value: loading ? '...' : stats.subCount, icon: '🔄', color: 'var(--accent)', link: '/schedule' },
  ]

  return (
    <div className="page-content" style={{ padding: '32px 40px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            🏫 Панель Директора
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 14 }}>
            AI-Завуч «Aqbobek» • {new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link href="/attendance" className="btn btn-primary">📊 Посещаемость</Link>
          <Link href="/incidents" className="btn btn-secondary">🚨 Инциденты</Link>
          <Link href="/schedule" className="btn btn-secondary">📅 Замены</Link>
        </div>
      </div>

      {/* 09:00 Dining Hall Summary */}
      <div className="card shadow-sm animate-fadein" style={{ marginBottom: 24, borderLeft: '4px solid var(--success)', background: '#f0fdf4' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <div className="live-dot" />
              <h2 className="section-title" style={{ margin: 0, fontSize: 14 }}>Свод по столовой (Автоматически в 09:00)</h2>
            </div>
            <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--success)' }}>
              Всего: {loading ? '...' : stats.totalPresent} порций • Отсутствуют: {loading ? '...' : stats.totalAbsent} чел.
            </p>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Данные собраны на основе {loading ? '...' : stats.classCount} отчетов учителей из Telegram/WhatsApp
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
          <Link key={card.label} href={card.link} className="card card-hover" style={{ textDecoration: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: card.color + '22',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, flexShrink: 0,
              }}>{card.icon}</div>
              <div>
                <div style={{ fontSize: 26, fontWeight: 800, color: card.color, lineHeight: 1 }}>{card.value}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{card.label}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Main Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
        {/* Incidents */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 className="section-title">🚨 Активные инциденты</h2>
            <Link href="/incidents" style={{ fontSize: 13, color: 'var(--primary)' }}>Все →</Link>
          </div>
          {loading ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>Загрузка...</div>
          ) : recentIncidents.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>✅ Инцидентов нет</div>
          ) : recentIncidents.map(incident => (
            <div key={incident.id} className="list-item">
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{incident.description}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{incident.location || '—'}</div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <span className={`badge badge-${incident.priority === 'high' ? 'danger' : incident.priority === 'medium' ? 'warning' : 'default'}`}>
                  {priorityLabel[incident.priority] || incident.priority}
                </span>
                <span className="badge badge-default">{statusLabel[incident.status] || incident.status}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Tasks */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 className="section-title">📋 Активные задачи</h2>
            <Link href="/tasks" style={{ fontSize: 13, color: 'var(--primary)' }}>Все →</Link>
          </div>
          {loading ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>Загрузка...</div>
          ) : recentTasks.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>✅ Задач нет</div>
          ) : recentTasks.map(task => (
            <div key={task.id} className="list-item">
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{task.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {task.assigned_to_name ? `→ ${task.assigned_to_name}` : 'Не назначено'}
                  {task.source === 'voice' && ' 🎤'}
                </div>
              </div>
              <span className={`badge badge-${task.priority === 'high' ? 'danger' : task.priority === 'medium' ? 'warning' : 'default'}`}>
                {priorityLabel[task.priority] || task.priority}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Substitutions */}
      {!loading && recentSubstitutions.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 className="section-title">🔄 Замены на сегодня</h2>
            <Link href="/schedule" style={{ fontSize: 13, color: 'var(--primary)' }}>Управление →</Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
            {recentSubstitutions.slice(0, 6).map(sub => (
              <div key={sub.id} className="card" style={{ padding: '12px 16px', background: 'var(--bg-secondary)' }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{sub.class_name || '—'} • Урок {sub.period}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  <span style={{ color: 'var(--danger)' }}>❌ {sub.original_teacher_name}</span>
                  <span> → </span>
                  <span style={{ color: 'var(--success)' }}>✅ {sub.substitute_name}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{sub.subject}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
