'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getDemoDate } from '@/lib/dateUtils'

interface Substitution {
  id: string
  original_teacher_name: string | null
  substitute_name: string | null
  class_name: string | null
  date: string
  period: number | null
  subject: string | null
  room?: string | null
  time?: string | null
  reason: string | null
  status: string
  notified: boolean
  notification_status?: string
}

interface Employee {
  id: string
  name: string
  role: string
  subject: string | null
  is_available: boolean
  qualification: string | null
}

interface ClassInfo {
  id: string
  name: string
  grade: number
  room_number: string
  student_count: number
}

interface Props {
  substitutions: Substitution[]
  employees: Employee[]
  classes: ClassInfo[]
}

interface SubstituteOption {
  name: string
  subject: string | null
}

interface ScheduleResult {
  absent_teacher: string
  substitute_options?: SubstituteOption[]
  substitutions_created: number
  substitutions?: Substitution[]
  conflict_free?: boolean
  error?: string
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Ошибка при поиске замены'
}

export default function ScheduleClient({ substitutions, employees, classes }: Props) {
  const router = useRouter()
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [loading, setLoading] = useState(false)
  const [absentTeacher, setAbsentTeacher] = useState('')
  const [reason, setReason] = useState('Болезнь')
  const [className, setClassName] = useState('')
  const [commandText, setCommandText] = useState('')
  const [result, setResult] = useState<ScheduleResult | null>(null)
  const [tab, setTab] = useState<'today' | 'find' | 'teachers'>('today')

  const teachers = employees.filter(e => e.role === 'teacher')
  const available = teachers.filter(e => e.is_available)
  const unavailable = teachers.filter(e => !e.is_available)

  function showToast(msg: string, type: 'success' | 'error' | 'info') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  async function findSubstitute() {
    if (!absentTeacher) return showToast('Выберите отсутствующего учителя', 'error')
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/schedule/substitute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          absent_teacher_name: absentTeacher,
          reason,
          class_name: className,
          date: getDemoDate(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || data.error || 'Не удалось назначить замену')
      if (data.error) throw new Error(data.error)
      setResult(data)
      showToast(`Замена назначена: ${data.substitutions_created} уроков`, 'success')
      router.refresh()
    } catch (error: unknown) {
      showToast(getErrorMessage(error), 'error')
    } finally {
      setLoading(false)
    }
  }

  async function runNaturalLanguageSubstitute() {
    if (!commandText.trim()) return showToast('Введите текстовую команду директора', 'error')
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/schedule/substitute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: commandText,
          reason,
          class_name: className,
          date: getDemoDate(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || data.error || 'Не удалось разобрать команду')
      setResult(data)
      setAbsentTeacher(data.absent_teacher || '')
      setCommandText('')
      showToast(`Команда обработана: ${data.substitutions_created} уроков`, 'success')
      router.refresh()
    } catch (error: unknown) {
      showToast(getErrorMessage(error), 'error')
    } finally {
      setLoading(false)
    }
  }

  const today = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })
  const STATUS_COLOR: Record<string, string> = { confirmed: '#16A34A', pending: '#D97706', cancelled: '#DC2626' }

  return (
    <div className="animate-fadein">
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}

      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 className="page-title">Расписание и замены</h1>
            <p className="page-subtitle" style={{ textTransform: 'capitalize' }}>{today}</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: '#dcfce7', borderRadius: 8 }}>
              <span className="live-dot" />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#15803D' }}>{available.length} учителей доступны</span>
            </div>
            <div style={{ padding: '6px 12px', background: '#fee2e2', borderRadius: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#DC2626' }}>{unavailable.length} отсутствуют</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        {[
          { label: 'Замены сегодня', val: substitutions.length, color: '#7C3AED', bg: '#ede9fe' },
          { label: 'Подтверждены', val: substitutions.filter(s => s.status === 'confirmed').length, color: '#16A34A', bg: '#dcfce7' },
          { label: 'Ожидают', val: substitutions.filter(s => s.status === 'pending').length, color: '#D97706', bg: '#fef3c7' },
          { label: 'Уведомлены', val: substitutions.filter(s => s.notified).length, color: '#2563EB', bg: '#dbeafe' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 20, borderLeft: '4px solid var(--cta)' }}>
        <h2 className="section-title" style={{ marginBottom: 8 }}>Команда директором в свободной форме</h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 0 }}>
          Например: «Учитель математики Аскар заболел, его сегодня не будет».
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'end' }}>
          <textarea
            className="form-input form-textarea"
            style={{ minHeight: 84 }}
            value={commandText}
            onChange={(e) => setCommandText(e.target.value)}
            placeholder="Введите текстовую команду для автоматической замены..."
          />
          <button onClick={runNaturalLanguageSubstitute} className="btn btn-cta" disabled={loading || !commandText.trim()}>
            {loading ? <span className="spinner" /> : 'Разобрать команду'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
        {(['today', 'find', 'teachers'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '10px 20px', background: 'none', border: 'none',
            borderBottom: tab === t ? '2px solid var(--primary)' : '2px solid transparent',
            color: tab === t ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: tab === t ? 700 : 500, fontSize: 14, cursor: 'pointer',
          }}>
            {t === 'today' ? 'Замены сегодня' : t === 'find' ? 'Найти замену' : 'Учителя'}
          </button>
        ))}
      </div>

      {/* Today's Substitutions */}
      {tab === 'today' && (
        substitutions.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 48 }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="var(--text-light)" viewBox="0 0 16 16" style={{ marginBottom: 12 }}>
              <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/>
            </svg>
            <p style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Замены не требуются</p>
            <p style={{ fontSize: 13, color: 'var(--text-light)' }}>Все учителя присутствуют или замены уже настроены</p>
            <button onClick={() => setTab('find')} className="btn btn-primary" style={{ marginTop: 16 }}>Назначить замену вручную</button>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Урок</th>
                  <th>Класс</th>
                  <th>Предмет</th>
                  <th>Кабинет</th>
                  <th>Отсутствует</th>
                  <th>Замещает</th>
                  <th>Причина</th>
                  <th>Статус</th>
                  <th>Уведомлён</th>
                </tr>
              </thead>
              <tbody>
                {substitutions.map(sub => (
                  <tr key={sub.id}>
                    <td style={{ fontWeight: 700 }}>{sub.period}</td>
                    <td style={{ fontWeight: 700 }}>{sub.class_name || '—'}</td>
                    <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{sub.subject || '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{sub.room || '—'}</td>
                    <td style={{ fontSize: 13, color: '#DC2626', fontWeight: 600 }}>{sub.original_teacher_name || '—'}</td>
                    <td style={{ fontSize: 13, color: sub.substitute_name ? '#16A34A' : '#D97706', fontWeight: 600 }}>
                      {sub.substitute_name || 'Нет свободного учителя'}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{sub.reason || '—'}</td>
                    <td>
                      <span style={{ background: `${STATUS_COLOR[sub.status]}22`, color: STATUS_COLOR[sub.status] || '#94A3B8', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                        {sub.status === 'confirmed' ? 'Подтверждён' : sub.status === 'pending' ? 'Ожидает' : 'Отменён'}
                      </span>
                    </td>
                    <td>
                      {sub.notified ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="#16A34A" viewBox="0 0 16 16">
                          <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/>
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="#94A3B8" viewBox="0 0 16 16">
                          <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
                        </svg>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Find Substitute */}
      {tab === 'find' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="card">
            <h2 className="section-title">Автоматический подбор замены</h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
              Введите фамилию отсутствующего учителя. Система автоматически найдёт доступного замещающего с похожим предметом.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="form-label">Отсутствующий учитель</label>
                <select className="form-input form-select" value={absentTeacher} onChange={e => setAbsentTeacher(e.target.value)}>
                  <option value="">Выберите учителя...</option>
                  {unavailable.map(e => <option key={e.id} value={e.name}>{e.name} ({e.subject || 'без предмета'})</option>)}
                  {available.map(e => <option key={e.id} value={e.name}>{e.name} ({e.subject || 'без предмета'})</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Класс</label>
                <select className="form-input form-select" value={className} onChange={e => setClassName(e.target.value)}>
                  <option value="">Все классы</option>
                  {classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Причина</label>
                <select className="form-input form-select" value={reason} onChange={e => setReason(e.target.value)}>
                  <option value="Болезнь">Болезнь</option>
                  <option value="Командировка">Командировка</option>
                  <option value="Отпуск">Отпуск</option>
                  <option value="Семейные обстоятельства">Семейные обстоятельства</option>
                  <option value="Курсы повышения квалификации">Курсы</option>
                </select>
              </div>
              <button onClick={findSubstitute} className="btn btn-primary" disabled={loading}>
                {loading ? <span className="spinner" /> : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.099zm-5.242 1.656a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11z"/>
                  </svg>
                )}
                {loading ? 'Поиск...' : 'Найти замену'}
              </button>
            </div>
          </div>

          {/* Result */}
          <div className="card">
            <h2 className="section-title">Результат подбора</h2>
            {!result ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                Результат появится после нажатия поиска
              </div>
            ) : result.error ? (
              <div style={{ color: '#DC2626', padding: 16, background: '#fee2e2', borderRadius: 8 }}>{result.error}</div>
            ) : (
              <div>
                <div style={{ padding: '12px 14px', background: '#fee2e2', borderRadius: 8, marginBottom: 12 }}>
                  <div style={{ fontSize: 12, color: '#DC2626', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Отсутствует</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#DC2626' }}>{result.absent_teacher}</div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>
                  Доступные замещающие ({result.substitute_options?.length || 0}):
                </div>
                {result.substitute_options?.map((sub, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#dcfce7', borderRadius: 8, marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, color: '#15803D' }}>{sub.name}</span>
                    <span style={{ fontSize: 12, color: '#16A34A' }}>{sub.subject || 'Общий'}</span>
                  </div>
                ))}
                <div style={{ marginTop: 12, padding: '10px 12px', background: '#dbeafe', borderRadius: 8 }}>
                  <div style={{ fontSize: 12, color: '#1d4ed8', fontWeight: 700 }}>
                    Создано замен: {result.substitutions_created} уроков
                  </div>
                  <div style={{ fontSize: 12, color: '#1d4ed8', marginTop: 4 }}>
                    Проверка конфликтов: {result.conflict_free ? 'конфликтов не найдено' : 'требуется ручная проверка'}
                  </div>
                </div>
                {result.substitutions?.length ? (
                  <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {result.substitutions.map((sub) => (
                      <div key={sub.id} style={{ padding: '9px 12px', background: 'var(--bg)', borderRadius: 8 }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>
                          Урок {sub.period} • {sub.class_name || 'класс не указан'} • {sub.subject || '—'}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                          {sub.substitute_name
                            ? `${sub.substitute_name} • уведомление: ${sub.notification_status === 'sent' ? 'отправлено' : sub.notification_status === 'no_chat_id' ? 'нет chat_id' : 'ожидает'}`
                            : 'Свободный учитель не найден автоматически'}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Teachers list */}
      {tab === 'teachers' && (
        <div className="grid-2">
          <div className="card">
            <h2 className="section-title" style={{ color: '#16A34A' }}>
              Присутствуют ({available.length})
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {available.map(t => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#F8FAFC', borderRadius: 8 }}>
                  <span className="live-dot" />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{t.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t.subject || t.role}</div>
                  </div>
                  {t.qualification && (
                    <span style={{ fontSize: 11, color: '#16A34A', fontWeight: 600, background: '#dcfce7', padding: '2px 8px', borderRadius: 12 }}>
                      {t.qualification.replace('категория', 'кат.')}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <h2 className="section-title" style={{ color: '#DC2626' }}>
              Отсутствуют ({unavailable.length})
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {unavailable.map(t => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#fee2e2', borderRadius: 8 }}>
                  <div style={{ width: 8, height: 8, background: '#DC2626', borderRadius: '50%' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#DC2626' }}>{t.name}</div>
                    <div style={{ fontSize: 12, color: '#b91c1c' }}>{t.subject || t.role}</div>
                  </div>
                  <button onClick={() => { setAbsentTeacher(t.name); setTab('find') }} className="btn btn-ghost btn-xs">
                    Найти замену
                  </button>
                </div>
              ))}
              {unavailable.length === 0 && (
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                  Все учителя присутствуют
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
