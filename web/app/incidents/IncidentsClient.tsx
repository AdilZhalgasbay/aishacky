'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import DirectorTaskAssistant from '@/components/DirectorTaskAssistant'

interface Incident {
  id: string
  type: string
  location: string | null
  priority: string
  assigned_to_name: string | null
  status: string
  description: string
  notified?: boolean
  notification_status?: string
  created_at: string
}

interface Task {
  id: string
  title: string
  description: string | null
  assigned_to_name: string | null
  due_date: string | null
  priority: string
  status: string
  source: string
  notified?: boolean
  notification_status?: string
  created_at: string
}

interface Props {
  incidents: Incident[]
  tasks: Task[]
  employees: { name: string; id: string }[]
  initialTab?: 'incidents' | 'tasks' | 'kanban'
}

const PRIORITY_LABEL: Record<string, string> = { urgent: 'Срочно', high: 'Высокий', medium: 'Средний', low: 'Низкий' }
const STATUS_LABEL: Record<string, string> = { open: 'Открыт', in_progress: 'В работе', resolved: 'Решён', pending: 'Ожидает', in_progress_task: 'В работе', completed: 'Завершён' }
const TYPE_LABEL: Record<string, string> = { infrastructure: 'Инфраструктура', maintenance: 'Обслуживание', supplies: 'Расходники', medical: 'Медицина', other: 'Другое' }

export default function IncidentsClient({ incidents, tasks, employees, initialTab = 'incidents' }: Props) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'incidents' | 'tasks' | 'kanban'>(initialTab)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [loading, setLoading] = useState(false)

  // New incident modal
  const [showIncidentModal, setShowIncidentModal] = useState(false)
  const [incForm, setIncForm] = useState({ type: 'infrastructure', location: '', priority: 'medium', assigned_to_name: '', description: '' })

  // New task modal
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [taskForm, setTaskForm] = useState({ title: '', description: '', assigned_to_name: '', priority: 'medium', source: 'manual', due_date: '' })

  function showToast(msg: string, type: 'success' | 'error' | 'info') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  async function createIncident() {
    if (!incForm.description) return showToast('Введите описание инцидента', 'error')
    setLoading(true)
    try {
      const res = await fetch('/api/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(incForm),
      })
      if (!res.ok) throw new Error()
      showToast('Инцидент создан', 'success')
      setShowIncidentModal(false)
      setIncForm({ type: 'infrastructure', location: '', priority: 'medium', assigned_to_name: '', description: '' })
      router.refresh()
    } catch {
      showToast('Ошибка при создании', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function createTask() {
    if (!taskForm.title) return showToast('Введите название задачи', 'error')
    setLoading(true)
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskForm),
      })
      if (!res.ok) throw new Error()
      showToast('Задача создана', 'success')
      setShowTaskModal(false)
      setTaskForm({ title: '', description: '', assigned_to_name: '', priority: 'medium', source: 'manual', due_date: '' })
      router.refresh()
    } catch {
      showToast('Ошибка при создании', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function updateIncidentStatus(id: string, status: string) {
    await fetch('/api/incidents', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) })
    router.refresh()
  }

  async function updateTaskStatus(id: string, status: string) {
    await fetch('/api/tasks', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) })
    router.refresh()
  }

  const openIncidents = incidents.filter(i => i.status === 'open')
  const inProgressIncidents = incidents.filter(i => i.status === 'in_progress')
  const resolvedIncidents = incidents.filter(i => i.status === 'resolved')

  return (
    <div className="animate-fadein">
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}

      {/* Modals */}
      {showIncidentModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="card" style={{ width: '100%', maxWidth: 520, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <h2 className="section-title">Новый инцидент</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
              <div>
                <label className="form-label">Тип инцидента</label>
                <select className="form-input form-select" value={incForm.type} onChange={e => setIncForm(p => ({ ...p, type: e.target.value }))}>
                  <option value="infrastructure">Инфраструктура</option>
                  <option value="maintenance">Обслуживание</option>
                  <option value="supplies">Расходники</option>
                  <option value="medical">Медицина</option>
                  <option value="other">Другое</option>
                </select>
              </div>
              <div>
                <label className="form-label">Описание</label>
                <textarea className="form-input form-textarea" value={incForm.description} onChange={e => setIncForm(p => ({ ...p, description: e.target.value }))} placeholder="Подробное описание проблемы..." />
              </div>
              <div className="grid-2">
                <div>
                  <label className="form-label">Место</label>
                  <input className="form-input" value={incForm.location} onChange={e => setIncForm(p => ({ ...p, location: e.target.value }))} placeholder="Кабинет 12" />
                </div>
                <div>
                  <label className="form-label">Приоритет</label>
                  <select className="form-input form-select" value={incForm.priority} onChange={e => setIncForm(p => ({ ...p, priority: e.target.value }))}>
                    <option value="low">Низкий</option>
                    <option value="medium">Средний</option>
                    <option value="high">Высокий</option>
                    <option value="urgent">Срочно</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="form-label">Ответственный</label>
                <select className="form-input form-select" value={incForm.assigned_to_name} onChange={e => setIncForm(p => ({ ...p, assigned_to_name: e.target.value }))}>
                  <option value="">Не назначен</option>
                  {employees.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowIncidentModal(false)} className="btn btn-ghost">Отмена</button>
              <button onClick={createIncident} className="btn btn-primary" disabled={loading}>
                {loading ? <span className="spinner" /> : 'Создать инцидент'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showTaskModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="card" style={{ width: '100%', maxWidth: 520, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <h2 className="section-title">Новая задача</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
              <div>
                <label className="form-label">Название задачи</label>
                <input className="form-input" value={taskForm.title} onChange={e => setTaskForm(p => ({ ...p, title: e.target.value }))} placeholder="Подготовить актовый зал" />
              </div>
              <div>
                <label className="form-label">Описание</label>
                <textarea className="form-input form-textarea" value={taskForm.description} onChange={e => setTaskForm(p => ({ ...p, description: e.target.value }))} placeholder="Детали задачи..." />
              </div>
              <div className="grid-2">
                <div>
                  <label className="form-label">Ответственный</label>
                  <select className="form-input form-select" value={taskForm.assigned_to_name} onChange={e => setTaskForm(p => ({ ...p, assigned_to_name: e.target.value }))}>
                    <option value="">Не назначен</option>
                    {employees.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Приоритет</label>
                  <select className="form-input form-select" value={taskForm.priority} onChange={e => setTaskForm(p => ({ ...p, priority: e.target.value }))}>
                    <option value="low">Низкий</option>
                    <option value="medium">Средний</option>
                    <option value="high">Высокий</option>
                  </select>
                </div>
              </div>
              <div className="grid-2">
                <div>
                  <label className="form-label">Срок</label>
                  <input type="date" className="form-input" value={taskForm.due_date} onChange={e => setTaskForm(p => ({ ...p, due_date: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Источник</label>
                  <select className="form-input form-select" value={taskForm.source} onChange={e => setTaskForm(p => ({ ...p, source: e.target.value }))}>
                    <option value="manual">Вручную</option>
                    <option value="voice">Голос</option>
                  </select>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowTaskModal(false)} className="btn btn-ghost">Отмена</button>
              <button onClick={createTask} className="btn btn-primary" disabled={loading}>
                {loading ? <span className="spinner" /> : 'Создать задачу'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 className="page-title">Инциденты и задачи</h1>
            <p className="page-subtitle">Управление проблемами и поручениями школы</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShowTaskModal(true)} className="btn btn-cta btn-sm">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/><path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/></svg>
              Задача
            </button>
            <button onClick={() => setShowIncidentModal(true)} className="btn btn-primary btn-sm">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/><path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/></svg>
              Инцидент
            </button>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        {[
          { label: 'Открытых', val: openIncidents.length, color: '#DC2626', bg: '#fee2e2' },
          { label: 'В работе', val: inProgressIncidents.length, color: '#D97706', bg: '#fef3c7' },
          { label: 'Решено', val: resolvedIncidents.length, color: '#16A34A', bg: '#dcfce7' },
          { label: 'Активных задач', val: tasks.filter(t => t.status !== 'completed').length, color: '#2563EB', bg: '#dbeafe' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      <DirectorTaskAssistant onCreated={() => setActiveTab('tasks')} />

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
        {(['incidents', 'tasks', 'kanban'] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{
            padding: '10px 20px', background: 'none', border: 'none',
            borderBottom: activeTab === t ? '2px solid var(--primary)' : '2px solid transparent',
            color: activeTab === t ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: activeTab === t ? 700 : 500, fontSize: 14, cursor: 'pointer', transition: 'all 0.15s',
          }}>
            {t === 'incidents' ? 'Инциденты' : t === 'tasks' ? 'Задачи' : 'Kanban'}
          </button>
        ))}
      </div>

      {/* Incidents Table */}
      {activeTab === 'incidents' && (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Приоритет</th>
                <th>Описание</th>
                <th>Тип</th>
                <th>Место</th>
                <th>Ответственный</th>
                <th>Уведомление</th>
                <th>Статус</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map(inc => (
                <tr key={inc.id}>
                  <td><span className={`badge badge-${inc.priority}`}>{PRIORITY_LABEL[inc.priority]}</span></td>
                  <td style={{ maxWidth: 220, fontWeight: 600, fontSize: 13 }}>{inc.description}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{TYPE_LABEL[inc.type] || inc.type}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{inc.location || '—'}</td>
                  <td style={{ fontSize: 13 }}>{inc.assigned_to_name || '—'}</td>
                  <td>
                    <span className={`badge badge-${inc.notified ? 'completed' : 'pending'}`}>
                      {inc.notification_status === 'sent' ? 'Отправлено' : inc.notification_status === 'no_chat_id' ? 'Нет chat_id' : 'Ожидает'}
                    </span>
                  </td>
                  <td><span className={`badge badge-${inc.status.replace('_', '-')}`}>{STATUS_LABEL[inc.status]}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {inc.status === 'open' && (
                        <button onClick={() => updateIncidentStatus(inc.id, 'in_progress')} className="btn btn-ghost btn-xs">В работу</button>
                      )}
                      {inc.status !== 'resolved' && (
                        <button onClick={() => updateIncidentStatus(inc.id, 'resolved')} className="btn btn-outline btn-xs">Решить</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tasks Table */}
      {activeTab === 'tasks' && (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Задача</th>
                <th>Ответственный</th>
                <th>Приоритет</th>
                <th>Источник</th>
                <th>Срок</th>
                <th>Уведомление</th>
                <th>Статус</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map(task => (
                <tr key={task.id}>
                  <td style={{ fontWeight: 600, fontSize: 13, maxWidth: 200 }}>{task.title}</td>
                  <td style={{ fontSize: 13 }}>{task.assigned_to_name || '—'}</td>
                  <td><span className={`badge badge-${task.priority}`}>{PRIORITY_LABEL[task.priority]}</span></td>
                  <td><span className={`badge badge-${task.source}`}>{task.source === 'voice' ? 'Голос' : 'Вручную'}</span></td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {task.due_date ? new Date(task.due_date).toLocaleDateString('ru-RU') : '—'}
                  </td>
                  <td>
                    <span className={`badge badge-${task.notified ? 'completed' : 'pending'}`}>
                      {task.notification_status === 'sent' ? 'Отправлено' : task.notification_status === 'no_chat_id' ? 'Нет chat_id' : 'Ожидает'}
                    </span>
                  </td>
                  <td><span className={`badge badge-${task.status.replace('_', '-')}`}>{STATUS_LABEL[task.status] || task.status}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {task.status === 'pending' && (
                        <button onClick={() => updateTaskStatus(task.id, 'in_progress')} className="btn btn-ghost btn-xs">Начать</button>
                      )}
                      {task.status !== 'completed' && (
                        <button onClick={() => updateTaskStatus(task.id, 'completed')} className="btn btn-outline btn-xs">Готово</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Kanban */}
      {activeTab === 'kanban' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {[
            { title: 'К выполнению', statuses: ['open', 'pending'], color: '#94A3B8' },
            { title: 'В работе', statuses: ['in_progress'], color: '#D97706' },
            { title: 'Завершено', statuses: ['resolved', 'completed'], color: '#16A34A' },
          ].map(col => {
            const colIncidents = incidents.filter(i => col.statuses.includes(i.status))
            const colTasks = tasks.filter(t => col.statuses.includes(t.status))
            return (
              <div key={col.title} className="kanban-col">
                <div className="kanban-col-header">
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: col.color }} />
                  {col.title}
                  <span style={{ marginLeft: 'auto', background: col.color, color: '#fff', borderRadius: 12, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>
                    {colIncidents.length + colTasks.length}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {colIncidents.map(i => (
                    <div key={i.id} className="card card-sm" style={{ padding: '10px 12px', cursor: 'default' }}>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, display: 'flex', gap: 6 }}>
                        <span className={`badge badge-${i.priority}`}>{PRIORITY_LABEL[i.priority]}</span>
                        <span style={{ fontSize: 11 }}>{TYPE_LABEL[i.type]}</span>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{i.description}</div>
                      {i.assigned_to_name && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{i.assigned_to_name}</div>}
                    </div>
                  ))}
                  {colTasks.map(t => (
                    <div key={t.id} className="card card-sm" style={{ padding: '10px 12px', cursor: 'default', borderLeft: '3px solid #2563EB' }}>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, display: 'flex', gap: 6 }}>
                        <span className={`badge badge-${t.source}`}>{t.source === 'voice' ? 'Голос' : 'Задача'}</span>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{t.title}</div>
                      {t.assigned_to_name && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{t.assigned_to_name}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
