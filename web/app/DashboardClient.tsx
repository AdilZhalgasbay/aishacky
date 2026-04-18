'use client'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import {
  Users, Home, AlertTriangle, ClipboardList, RefreshCw,
  BarChart3, ArrowRight, Utensils, TrendingUp, Clock,
  Mic, BookOpen, MessageCircle, CheckCircle2, XCircle,
  Activity, Zap, ChevronRight, Calendar,
} from 'lucide-react'

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
  urgent: 'Срочно', high: 'Высокий', medium: 'Средний', low: 'Низкий',
}
const statusLabel: Record<string, string> = {
  open: 'Открыт', in_progress: 'В работе', resolved: 'Решён',
  pending: 'Ожидает', completed: 'Завершён', confirmed: 'Подтверждён', cancelled: 'Отменён',
}

const PRIORITY_COLOR: Record<string, string> = {
  urgent: '#8B5CF6', high: '#EF4444', medium: '#F59E0B', low: '#10B981',
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

function PriorityDot({ priority }: { priority: string }) {
  const c = PRIORITY_COLOR[priority] || '#94A3B8'
  return (
    <span style={{
      width: 8, height: 8, borderRadius: '50%', background: c,
      display: 'inline-block', flexShrink: 0,
      boxShadow: `0 0 6px ${c}88`,
    }} />
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    open:        { bg: '#DBEAFE', color: '#1D4ED8' },
    in_progress: { bg: '#FEF3C7', color: '#92400E' },
    resolved:    { bg: '#D1FAE5', color: '#065F46' },
    completed:   { bg: '#D1FAE5', color: '#065F46' },
    confirmed:   { bg: '#D1FAE5', color: '#065F46' },
    pending:     { bg: '#F1F5F9', color: '#475569' },
    cancelled:   { bg: '#FEE2E2', color: '#991B1B' },
  }
  const style = map[status] || { bg: '#F1F5F9', color: '#475569' }
  return (
    <span style={{
      background: style.bg, color: style.color,
      padding: '3px 10px', borderRadius: 20,
      fontSize: 11, fontWeight: 700,
      whiteSpace: 'nowrap',
    }}>
      {statusLabel[status] || status}
    </span>
  )
}

import { getDemoDate } from '@/lib/dateUtils'

export default function DashboardClient() {
  const today = getDemoDate()
  const dateLabel = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })

  const [stats, setStats] = useState({
    totalPresent: 0, totalAbsent: 0,
    openIncidents: 0, pendingTasks: 0,
    subCount: 0, classCount: 0,
  })
  const [recentIncidents, setRecentIncidents] = useState<DashboardIncident[]>([])
  const [recentTasks, setRecentTasks] = useState<DashboardTask[]>([])
  const [recentSubstitutions, setRecentSubstitutions] = useState<DashboardSubstitution[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const [attendance, incidents, tasks, substitutions] = await Promise.all([
        fetchJson(`/attendance?date=${today}`, { classes: [], total_present: 0, total_absent: 0 }),
        fetchJson('/incidents', { incidents: [] }),
        fetchJson('/tasks', { tasks: [] }),
        fetchJson(`/schedule/substitutions?date_from=${today}`, { substitutions: [] }),
      ])

      const attendanceData  = attendance    as { classes: { present_count: number; absent_count: number }[]; total_present: number; total_absent: number }
      const incidentsData   = incidents     as { incidents: DashboardIncident[] }
      const tasksData       = tasks         as { tasks: DashboardTask[] }
      const substitutionsData = substitutions as { substitutions: DashboardSubstitution[] }

      const allIncidents = incidentsData.incidents || []
      const allTasks     = tasksData.tasks || []
      const activeTasks  = allTasks.filter(t => t.status !== 'completed')
      const allSubs      = substitutionsData.substitutions || []

      setStats({
        totalPresent:  attendanceData.total_present || 0,
        totalAbsent:   attendanceData.total_absent  || 0,
        openIncidents: allIncidents.filter(i => i.status === 'open').length,
        pendingTasks:  activeTasks.filter(t => t.status === 'pending').length,
        subCount:      allSubs.length,
        classCount:    (attendanceData.classes || []).length,
      })
      setRecentIncidents(allIncidents.slice(0, 5))
      setRecentTasks(activeTasks.slice(0, 5))
      setRecentSubstitutions(allSubs)
      setLoading(false)
    }
    load()

    const interval = setInterval(load, 30000) // auto-refresh every 30s
    return () => clearInterval(interval)
  }, [today])

  const metricCards = [
    {
      label: 'Присутствуют',
      value: loading ? '—' : stats.totalPresent,
      icon: Users,
      color: '#10B981',
      iconBg: 'rgba(16,185,129,0.12)',
      borderColor: 'rgba(16,185,129,0.2)',
      href: '/attendance',
      trend: '+2',
    },
    {
      label: 'Отсутствуют',
      value: loading ? '—' : stats.totalAbsent,
      icon: Home,
      color: '#F59E0B',
      iconBg: 'rgba(245,158,11,0.12)',
      borderColor: 'rgba(245,158,11,0.2)',
      href: '/attendance',
      trend: null,
    },
    {
      label: 'Инциденты',
      value: loading ? '—' : stats.openIncidents,
      icon: AlertTriangle,
      color: '#EF4444',
      iconBg: 'rgba(239,68,68,0.12)',
      borderColor: 'rgba(239,68,68,0.2)',
      href: '/incidents',
      trend: null,
    },
    {
      label: 'Задачи',
      value: loading ? '—' : stats.pendingTasks,
      icon: ClipboardList,
      color: '#3B82F6',
      iconBg: 'rgba(59,130,246,0.12)',
      borderColor: 'rgba(59,130,246,0.2)',
      href: '/incidents',
      trend: null,
    },
    {
      label: 'Замены',
      value: loading ? '—' : stats.subCount,
      icon: RefreshCw,
      color: '#8B5CF6',
      iconBg: 'rgba(139,92,246,0.12)',
      borderColor: 'rgba(139,92,246,0.2)',
      href: '/schedule',
      trend: null,
    },
  ]

  const quickLinks = [
    { label: 'Telegram бот',  icon: MessageCircle, href: '/telegram',  color: '#8B5CF6' },
    { label: 'Голос задача',  icon: Mic,           href: '/incidents',  color: '#3B82F6' },
    { label: 'Приказы RAG',   icon: BookOpen,      href: '/rag',        color: '#F59E0B' },
    { label: 'Расписание',    icon: Calendar,      href: '/schedule',   color: '#10B981' },
  ]

  return (
    <div style={{ maxWidth: 1360, margin: '0 auto' }}>
      {/* ── Page header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: 'var(--text)', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
            Панель директора
          </h1>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="live-dot" style={{ width: 7, height: 7 }} />
            AI-Завуч «Aqbobek» · {dateLabel}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link href="/attendance" className="btn btn-secondary btn-sm">
            <BarChart3 size={14} /> Посещаемость
          </Link>
          <Link href="/incidents" className="btn btn-secondary btn-sm">
            <AlertTriangle size={14} /> Инциденты
          </Link>
          <Link href="/schedule" className="btn btn-primary btn-sm">
            <RefreshCw size={14} /> Замены
          </Link>
        </div>
      </div>

      {/* ── Dining hall summary banner ── */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(5,150,105,0.04))',
        border: '1px solid rgba(16,185,129,0.2)',
        borderRadius: 'var(--radius)',
        padding: '18px 22px',
        marginBottom: 22,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Utensils size={20} color="#10B981" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <span className="live-dot" />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#047857', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Свод столовой · Автоматически в 09:00
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 20, fontWeight: 900, color: '#065F46' }}>
              {loading ? '—' : stats.totalPresent} порций
              <span style={{ fontWeight: 500, fontSize: 15, color: '#047857', marginLeft: 12 }}>
                · Отсутствуют: {loading ? '—' : stats.totalAbsent} чел.
              </span>
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#059669' }}>
              По {loading ? '—' : stats.classCount} отчётам учителей из Telegram/WhatsApp
            </p>
          </div>
        </div>
        <Link href="/attendance" className="btn btn-sm" style={{ background: '#059669', color: '#fff', flexShrink: 0 }}>
          Детализация <ChevronRight size={13} />
        </Link>
      </div>

      {/* ── Metric cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 22 }}>
        {metricCards.map((card) => {
          const Icon = card.icon
          return (
            <Link
              key={card.label}
              href={card.href}
              style={{ textDecoration: 'none' }}
            >
              <div style={{
                background: '#fff',
                border: `1px solid ${card.borderColor}`,
                borderRadius: 'var(--radius)',
                padding: '18px 18px 16px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: 'var(--shadow-sm)',
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLDivElement
                el.style.transform = 'translateY(-3px)'
                el.style.boxShadow = 'var(--shadow-lg)'
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLDivElement
                el.style.transform = 'translateY(0)'
                el.style.boxShadow = 'var(--shadow-sm)'
              }}>
                <div style={{ width: 40, height: 40, borderRadius: 11, background: card.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  <Icon size={20} color={card.color} />
                </div>
                <div style={{ fontSize: 28, fontWeight: 900, color: card.color, lineHeight: 1, letterSpacing: '-0.02em', marginBottom: 4 }}>
                  {card.value}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{card.label}</div>
              </div>
            </Link>
          )
        })}
      </div>

      {/* ── Main grid 2 columns ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 }}>
        
        {/* Incidents */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div className="section-title">
              <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertTriangle size={16} color="#EF4444" />
              </div>
              Активные инциденты
            </div>
            <Link href="/incidents" style={{ fontSize: 13, color: 'var(--brand-600)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3, textDecoration: 'none' }}>
              Все <ArrowRight size={13} />
            </Link>
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 52, borderRadius: 10 }} />)}
            </div>
          ) : recentIncidents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '28px 20px', color: 'var(--text-muted)' }}>
              <CheckCircle2 size={28} color="#10B981" style={{ marginBottom: 8 }} />
              <div style={{ fontSize: 14, fontWeight: 600 }}>Инцидентов нет</div>
              <div style={{ fontSize: 12, marginTop: 2 }}>Всё в порядке 🎉</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recentIncidents.map(incident => (
                <div key={incident.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 10,
                  background: 'var(--surface-2)', border: '1px solid var(--border)',
                  transition: 'all 0.15s',
                }}>
                  <PriorityDot priority={incident.priority} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {incident.description}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                      {incident.location || '—'}
                    </div>
                  </div>
                  <StatusBadge status={incident.status} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tasks */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div className="section-title">
              <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ClipboardList size={16} color="#3B82F6" />
              </div>
              Активные задачи
            </div>
            <Link href="/incidents" style={{ fontSize: 13, color: 'var(--brand-600)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3, textDecoration: 'none' }}>
              Все <ArrowRight size={13} />
            </Link>
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 52, borderRadius: 10 }} />)}
            </div>
          ) : recentTasks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '28px 20px', color: 'var(--text-muted)' }}>
              <CheckCircle2 size={28} color="#10B981" style={{ marginBottom: 8 }} />
              <div style={{ fontSize: 14, fontWeight: 600 }}>Задач нет</div>
              <div style={{ fontSize: 12, marginTop: 2 }}>Всё выполнено!</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recentTasks.map(task => (
                <div key={task.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 10,
                  background: 'var(--surface-2)', border: '1px solid var(--border)',
                }}>
                  <PriorityDot priority={task.priority} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {task.title}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 1 }}>
                      {task.assigned_to_name ? `→ ${task.assigned_to_name}` : 'Не назначено'}
                      {task.source === 'voice' && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, background: '#EDE9FE', color: '#7C3AED', padding: '1px 6px', borderRadius: 10, fontSize: 10, fontWeight: 700 }}>
                          <Mic size={9} /> voice
                        </span>
                      )}
                    </div>
                  </div>
                  <span style={{
                    background: PRIORITY_COLOR[task.priority] + '20',
                    color: PRIORITY_COLOR[task.priority] || 'var(--text-muted)',
                    padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                  }}>
                    {priorityLabel[task.priority] || task.priority}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Substitutions ── */}
      {!loading && recentSubstitutions.length > 0 && (
        <div className="card" style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div className="section-title">
              <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(139,92,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <RefreshCw size={16} color="#8B5CF6" />
              </div>
              Замены на сегодня
            </div>
            <Link href="/schedule" style={{ fontSize: 13, color: 'var(--brand-600)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3, textDecoration: 'none' }}>
              Управление <ArrowRight size={13} />
            </Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
            {recentSubstitutions.slice(0, 6).map(sub => (
              <div key={sub.id} style={{
                padding: '14px 16px', borderRadius: 12,
                background: 'rgba(139,92,246,0.05)',
                border: '1px solid rgba(139,92,246,0.15)',
              }}>
                <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 6, color: 'var(--text)' }}>
                  {sub.class_name || '—'} · Урок {sub.period}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <XCircle size={13} color="#EF4444" />
                  <span style={{ color: '#EF4444', fontWeight: 600 }}>{sub.original_teacher_name}</span>
                  <span style={{ color: 'var(--text-muted)' }}>→</span>
                  <CheckCircle2 size={13} color="#10B981" />
                  <span style={{ color: '#10B981', fontWeight: 600 }}>{sub.substitute_name}</span>
                </div>
                {sub.subject && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{sub.subject}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Quick links ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {quickLinks.map((q) => {
          const Icon = q.icon
          return (
            <Link key={q.href} href={q.href} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 16px', borderRadius: 12,
              background: '#fff', border: '1px solid var(--border)',
              textDecoration: 'none', color: 'var(--text)',
              fontWeight: 600, fontSize: 13,
              boxShadow: 'var(--shadow-sm)',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLAnchorElement
              el.style.borderColor = q.color + '55'
              el.style.transform = 'translateY(-2px)'
              el.style.boxShadow = 'var(--shadow)'
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLAnchorElement
              el.style.borderColor = 'var(--border)'
              el.style.transform = 'translateY(0)'
              el.style.boxShadow = 'var(--shadow-sm)'
            }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: q.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={18} color={q.color} />
              </div>
              {q.label}
              <ChevronRight size={13} color="var(--text-light)" style={{ marginLeft: 'auto' }} />
            </Link>
          )
        })}
      </div>
    </div>
  )
}
