'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface AttendanceLog {
  id: string
  class_name: string
  date: string
  present_count: number
  absent_count: number
  raw_message: string
  sent_to_canteen: boolean
  created_at: string
}

interface ClassInfo {
  id: string
  name: string
  grade: number
  room_number: string
  student_count: number
}

interface Props {
  attendance: AttendanceLog[]
  classes: ClassInfo[]
}

interface ParsedAttendanceClass {
  class: string
  present: number
  absent: number
}

interface ParsedAttendanceResult {
  total_portions: number
  total_absent: number
  parsed_count: number
  failed_count?: number
  classes?: ParsedAttendanceClass[]
}

export default function AttendanceClient({ attendance, classes }: Props) {
  const router = useRouter()
  const [bulkMessages, setBulkMessages] = useState('')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [result, setResult] = useState<ParsedAttendanceResult | null>(null)
  const [tab, setTab] = useState<'overview' | 'parse'>('overview')

  const today = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })

  const totalPresent = attendance.reduce((s, r) => s + r.present_count, 0)
  const totalAbsent = attendance.reduce((s, r) => s + r.absent_count, 0)
  const sentCount = attendance.filter(r => r.sent_to_canteen).length

  function showToast(msg: string, type: 'success' | 'error' | 'info') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  async function handleParse() {
    if (!bulkMessages.trim()) return showToast('Введите сообщения учителей', 'error')
    setLoading(true)
    try {
      const messages = bulkMessages.split('\n').filter(l => l.trim())
      const res = await fetch('/api/messages/parse-attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages }),
      })
      const data = await res.json()
      setResult(data)
      showToast(`Обработано ${data.parsed_count} сообщений`, 'success')
      router.refresh()
    } catch {
      showToast('Ошибка обработки', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleSendToCanteen() {
    setLoading(true)
    try {
      const res = await fetch('/api/attendance', { method: 'PATCH' })
      const data = await res.json()
      if (data.success) {
        showToast(`Данные столовой отправлены: ${data.total_portions} порций`, 'success')
      } else if (data.reason === 'already_sent') {
        showToast(`Сводка уже была отправлена ранее`, 'info')
      } else {
        showToast('Не удалось отправить сводку', 'error')
      }
      router.refresh()
    } catch {
      showToast('Ошибка при отправке', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="animate-fadein">
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}

      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 className="page-title">Посещаемость</h1>
            <p className="page-subtitle" style={{ textTransform: 'capitalize' }}>{today}</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleSendToCanteen} className="btn btn-primary" disabled={loading || attendance.length === 0}>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm.93-9.412-1 4.705c-.07.34.029.533.304.533.194 0 .487-.07.686-.246l-.088.416c-.287.346-.92.598-1.465.598-.703 0-1.002-.422-.808-1.319l.738-3.468c.064-.293.006-.399-.287-.47l-.451-.081.082-.381 2.29-.287zM8 5.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/>
              </svg>
              Отправить в столовую ({totalPresent} порций)
            </button>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        {[
          { label: 'Присутствуют', val: totalPresent, color: '#16A34A', bg: '#dcfce7' },
          { label: 'Отсутствуют', val: totalAbsent, color: '#DC2626', bg: '#fee2e2' },
          { label: 'Классов подано', val: attendance.length, color: '#2563EB', bg: '#dbeafe' },
          { label: 'Отправлено в столовую', val: sentCount, color: '#D97706', bg: '#fef3c7' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
        {(['overview', 'parse'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '10px 20px',
              background: 'none',
              border: 'none',
              borderBottom: tab === t ? '2px solid var(--primary)' : '2px solid transparent',
              color: tab === t ? 'var(--primary)' : 'var(--text-muted)',
              fontWeight: tab === t ? 700 : 500,
              fontSize: 14,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {t === 'overview' ? 'Таблица классов' : 'Загрузить из чата'}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div>
          {attendance.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 48 }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="var(--text-light)" viewBox="0 0 16 16" style={{ marginBottom: 12 }}>
                <path d="M7 14s-1 0-1-1 1-4 6-4 6 3 6 4-1 1-1 1H7zm4-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/>
              </svg>
              <p style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: 15 }}>Данные на сегодня ещё не поданы</p>
              <p style={{ color: 'var(--text-light)', fontSize: 13, marginTop: 4 }}>
                Перейдите во вкладку &quot;Загрузить из чата&quot; чтобы добавить отчёты учителей
              </p>
              <button onClick={() => setTab('parse')} className="btn btn-primary" style={{ marginTop: 16 }}>
                Загрузить данные
              </button>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Класс</th>
                    <th>Присутствуют</th>
                    <th>Отсутствуют</th>
                    <th>Всего%</th>
                    <th>Столовая</th>
                    <th>Исходное сообщение</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.map((row) => {
                    const total = row.present_count + row.absent_count
                    const pct = total > 0 ? Math.round((row.present_count / total) * 100) : 0
                    return (
                      <tr key={row.id}>
                        <td style={{ fontWeight: 700, color: 'var(--text)' }}>
                          {row.class_name || '—'}
                        </td>
                        <td>
                          <span style={{ color: '#16A34A', fontWeight: 700 }}>{row.present_count}</span>
                        </td>
                        <td>
                          <span style={{ color: row.absent_count > 0 ? '#DC2626' : 'var(--text-muted)', fontWeight: 700 }}>
                            {row.absent_count}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ flex: 1, height: 6, background: '#F1F5F9', borderRadius: 3, maxWidth: 60 }}>
                              <div style={{ width: `${pct}%`, height: '100%', background: pct > 90 ? '#16A34A' : pct > 75 ? '#D97706' : '#DC2626', borderRadius: 3 }} />
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>{pct}%</span>
                          </div>
                        </td>
                        <td>
                          {row.sent_to_canteen ? (
                            <span className="badge badge-resolved">
                              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="currentColor" viewBox="0 0 16 16">
                                <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
                              </svg>
                              Отправлено
                            </span>
                          ) : (
                            <span className="badge badge-pending">Ожидает</span>
                          )}
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 240 }}>
                          <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {row.raw_message || '—'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                  <tr style={{ background: 'var(--card-hover, rgba(255,255,255,0.04))', fontWeight: 700 }}>
                    <td>ИТОГО</td>
                    <td style={{ color: '#16A34A' }}>{totalPresent}</td>
                    <td style={{ color: '#DC2626' }}>{totalAbsent}</td>
                    <td>
                      {totalPresent + totalAbsent > 0
                        ? `${Math.round(totalPresent / (totalPresent + totalAbsent) * 100)}%`
                        : '—'}
                    </td>
                    <td>—</td>
                    <td>—</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'parse' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="card">
            <h2 className="section-title">Вставить сообщения учителей</h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
              Скопируйте сообщения из Telegram-чата классных руководителей — каждое сообщение с новой строки.
            </p>
            <div style={{ marginBottom: 8 }}>
              <label className="form-label">Сообщения (каждое с новой строки)</label>
              <textarea
                className="form-input form-textarea"
                style={{ minHeight: 200, fontFamily: 'Figtree, sans-serif' }}
                value={bulkMessages}
                onChange={e => setBulkMessages(e.target.value)}
                placeholder={`1A - 25 детей, 2 болеют с температурой\n1B - 24 присутствует, 1 на больничном\n2A - все 28 присутствуют\n3A - 28 здесь, 1 у врача`}
              />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleParse} className="btn btn-primary" disabled={loading}>
                {loading ? <span className="spinner" /> : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0zM4.5 7.5a.5.5 0 0 0 0 1h5.793l-2.147 2.146a.5.5 0 0 0 .708.708l3-3a.5.5 0 0 0 0-.708l-3-3a.5.5 0 1 0-.708.708L10.293 7.5H4.5z"/>
                  </svg>
                )}
                {loading ? 'Обработка...' : 'Разобрать и сохранить'}
              </button>
              <button onClick={() => setBulkMessages('')} className="btn btn-ghost" disabled={loading}>
                Очистить
              </button>
            </div>
          </div>

          {/* Result */}
          <div className="card">
            <h2 className="section-title">Результат разбора</h2>
            {!result ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 14, textAlign: 'center', padding: '40px 0' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" fill="var(--text-light)" viewBox="0 0 16 16" style={{ marginBottom: 8 }}>
                  <path d="M9.405 1.05c-.413-1.4-2.397-1.4-2.81 0l-.1.34a1.464 1.464 0 0 1-2.105.872l-.31-.17c-1.283-.698-2.686.705-1.987 1.987l.169.311c.446.82.023 1.841-.872 2.105l-.34.1c-1.4.413-1.4 2.397 0 2.81l.34.1a1.464 1.464 0 0 1 .872 2.105l-.17.31c-.698 1.283.705 2.686 1.987 1.987l.311-.169a1.464 1.464 0 0 1 2.105.872l.1.34c.413 1.4 2.397 1.4 2.81 0l.1-.34a1.464 1.464 0 0 1 2.105-.872l.31.17c1.283.698 2.686-.705 1.987-1.987l-.169-.311a1.464 1.464 0 0 1 .872-2.105l.34-.1c1.4-.413 1.4-2.397 0-2.81l-.34-.1a1.464 1.464 0 0 1-.872-2.105l.17-.31c.698-1.283-.705-2.686-1.987-1.987l-.311.169a1.464 1.464 0 0 1-2.105-.872l-.1-.34zM8 10.93a2.929 2.929 0 1 1 0-5.86 2.929 2.929 0 0 1 0 5.858z"/>
                </svg>
                <p>Результат появится после разбора</p>
              </div>
            ) : (
              <div>
                <div className="grid-2" style={{ marginBottom: 14 }}>
                  <div style={{ background: '#dcfce7', borderRadius: 8, padding: '12px 14px' }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#16A34A' }}>{result.total_portions}</div>
                    <div style={{ fontSize: 12, color: '#15803D', fontWeight: 600 }}>Порций в столовую</div>
                  </div>
                  <div style={{ background: '#fee2e2', borderRadius: 8, padding: '12px 14px' }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#DC2626' }}>{result.total_absent}</div>
                    <div style={{ fontSize: 12, color: '#b91c1c', fontWeight: 600 }}>Отсутствуют</div>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                  Успешно разобрано: <strong>{result.parsed_count}</strong> | Не распознано: <strong>{result.failed_count}</strong>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {result.classes?.map((c, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 10px', background: 'var(--bg)', borderRadius: 7, fontSize: 13 }}>
                      <span style={{ fontWeight: 700 }}>{c.class || '?'}</span>
                      <span style={{ color: '#16A34A', fontWeight: 600 }}>{c.present} присут.</span>
                      <span style={{ color: c.absent > 0 ? '#DC2626' : 'var(--text-muted)' }}>{c.absent} отсут.</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Classes reference */}
      {tab === 'overview' && classes.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h2 className="section-title">Все классы</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {classes.map(cls => {
              const log = attendance.find(a => a.class_name === cls.name)
              return (
                <div key={cls.id} style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: '1.5px solid var(--border)',
                  background: log ? '#dcfce7' : 'var(--card)',
                  fontSize: 13,
                  fontWeight: 700,
                  color: log ? '#15803D' : 'var(--text-muted)',
                }}>
                  {cls.name}
                  <span style={{ fontWeight: 400, marginLeft: 6 }}>каб. {cls.room_number}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
