'use client'
import { useState, useEffect, useRef } from 'react'

type Teacher = { name: string; handle: string }
type ParsedData = {
  class?: string
  total_portions?: number
  total_absent?: number
  type?: string
  location?: string | null
  priority?: string
  assignee?: string
  description?: string
}

type ChatMessage = {
  id: number
  type: 'teacher' | 'bot'
  sender: string
  text: string
  parsed_type?: string
  parsed_data?: ParsedData | null
  timestamp: Date
}

type TelegramLogEntry = {
  id: string
  sender_name: string
  message_text: string
  parsed_type?: string
  parsed_data?: ParsedData | null
  created_at: string
}

const TEACHERS: Teacher[] = [
  { name: 'Назкен Алибекова', handle: '@nazken_kaz' },
  { name: 'Дамир Жумабеков', handle: '@damir_eng' },
  { name: 'Жанна Есимова', handle: '@zhanna_bio' },
  { name: 'Марат Ибрагимов', handle: '@marat_sport' },
  { name: 'Алия Бекова', handle: '@aliya_art' },
  { name: 'Болат Рахимов', handle: '@bolat_math' },
  { name: 'Серик Касымов', handle: '@serik_hist' },
  { name: 'Айгерим Токова', handle: '@aigerim_phys' },
]

const QUICK_MESSAGES = [
  '1A - 25 детей, 2 болеют с температурой',
  '2B - все 26 присутствуют',
  '3A - 28 здесь, 1 у врача',
  'В кабинете 201 протекает потолок после дождя',
  'Не работает проектор в актовом зале',
  'Сломался замок в кабинете 303',
  '5A - 31 здесь, 1 болеет',
  '6B - 27 присутствует, 2 болеют ОРВИ',
]

const PARSED_TYPE_LABEL: Record<string, string> = {
  attendance: 'Посещаемость',
  incident: 'Инцидент',
  general: 'Общее',
}

export default function TelegramClient() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputText, setInputText] = useState('')
  const [selectedTeacher, setSelectedTeacher] = useState(TEACHERS[0])
  const [loading, setLoading] = useState(false)
  const [dbMessages, setDbMessages] = useState<TelegramLogEntry[]>([])
  const [tab, setTab] = useState<'sim' | 'log'>('sim')
  const chatEndRef = useRef<HTMLDivElement>(null)
  const msgCounter = useRef(0)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    fetchDbMessages()
  }, [])

  async function fetchDbMessages() {
    const res = await fetch('/api/telegram/webhook')
    const data = await res.json()
    setDbMessages(data.messages || [])
  }

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return
    setLoading(true)
    const msgId = ++msgCounter.current

    // Add teacher message immediately
    const teacherMsg: ChatMessage = {
      id: msgId,
      type: 'teacher',
      sender: selectedTeacher.name,
      text,
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, teacherMsg])
    setInputText('')

    try {
      const res = await fetch('/api/telegram/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender_name: selectedTeacher.name, message: text }),
      })
      const data = await res.json()

      const botMsg: ChatMessage = {
        id: msgId + 10000,
        type: 'bot',
        sender: 'Aqbobek Bot',
        text: data.bot_reply || 'Сообщение получено.',
        parsed_type: data.parsed_type,
        parsed_data: data.parsed_data,
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, botMsg])
      fetchDbMessages()
    } catch {
      setMessages(prev => [...prev, {
        id: msgId + 20000, type: 'bot', sender: 'Aqbobek Bot',
        text: 'Ошибка соединения', timestamp: new Date(),
      }])
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(inputText) }
  }

  return (
    <div className="animate-fadein">
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 className="page-title">Telegram Bot симулятор</h1>
            <p className="page-subtitle">Тестирование автоматического разбора сообщений учителей</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="live-dot" />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#16A34A' }}>@aqbobek_bot активен</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
        {(['sim', 'log'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '10px 20px', background: 'none', border: 'none',
            borderBottom: tab === t ? '2px solid var(--primary)' : '2px solid transparent',
            color: tab === t ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: tab === t ? 700 : 500, fontSize: 14, cursor: 'pointer',
          }}>
            {t === 'sim' ? 'Симулятор чата' : `История сообщений (${dbMessages.length})`}
          </button>
        ))}
      </div>

      {tab === 'sim' && (
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16, height: 'calc(100vh - 260px)', minHeight: 450 }}>
          {/* Teachers sidebar */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '14px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
              Учитель-отправитель
            </div>
            {TEACHERS.map(t => (
              <button
                key={t.handle}
                onClick={() => setSelectedTeacher(t)}
                style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1.5px solid',
                  borderColor: selectedTeacher.handle === t.handle ? 'var(--primary)' : 'var(--border)',
                  background: selectedTeacher.handle === t.handle ? 'var(--primary-light)' : 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: selectedTeacher.handle === t.handle ? 'var(--primary)' : 'var(--text)' }}>
                  {t.name.split(' ')[0]}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.handle}</div>
              </button>
            ))}
            <hr className="divider" />
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
              Быстрые сообщения
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {QUICK_MESSAGES.map(msg => (
                <button
                  key={msg}
                  onClick={() => sendMessage(msg)}
                  disabled={loading}
                  style={{
                    padding: '6px 10px',
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    fontSize: 11,
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#EEF2FF')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg)')}
                >
                  {msg.length > 45 ? msg.slice(0, 45) + '...' : msg}
                </button>
              ))}
            </div>
          </div>

          {/* Chat window */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, background: '#2563EB', borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, fontWeight: 700 }}>A</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>Aqbobek School — AI Bot</div>
                <div style={{ fontSize: 11, color: '#16A34A', fontWeight: 600 }}>активен</div>
              </div>
              <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
                Режим: {selectedTeacher.name.split(' ')[0]} ({selectedTeacher.handle})
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 12, background: '#F8FAFC' }}>
              {messages.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                  <p style={{ fontSize: 14, fontWeight: 600 }}>Выберите быстрое сообщение или напишите своё</p>
                  <p style={{ fontSize: 12 }}>Бот разберёт отчёт о посещаемости или создаст инцидент автоматически</p>
                </div>
              )}
              {messages.map(msg => (
                <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.type === 'teacher' ? 'flex-start' : 'flex-end' }} className="animate-fadein">
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3, marginLeft: msg.type === 'teacher' ? 0 : 'auto' }}>
                    {msg.sender} — {msg.timestamp.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className={msg.type === 'teacher' ? 'chat-bubble-teacher' : 'chat-bubble-bot'}>
                    {msg.text}
                  </div>
                  {msg.type === 'bot' && msg.parsed_type && msg.parsed_type !== 'general' && (
                    <div style={{ marginTop: 4, display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--primary)', background: '#dbeafe', padding: '2px 8px', borderRadius: 12 }}>
                        Тип: {PARSED_TYPE_LABEL[msg.parsed_type as string] || msg.parsed_type}
                      </span>
                      {msg.parsed_data?.class && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#15803D', background: '#dcfce7', padding: '2px 8px', borderRadius: 12 }}>
                          Класс {msg.parsed_data.class}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {loading && (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                  <span className="spinner" style={{ width: 14, height: 14 }} />
                  Бот обрабатывает...
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div style={{ padding: 12, borderTop: '1px solid var(--border)', display: 'flex', gap: 8, background: 'var(--card)' }}>
              <input
                className="form-input"
                style={{ flex: 1 }}
                placeholder="Написать как учитель..."
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
              />
              <button onClick={() => sendMessage(inputText)} className="btn btn-primary" disabled={loading || !inputText.trim()}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M15.964.686a.5.5 0 0 0-.65-.65L.767 5.855H.766l-.452.18a.5.5 0 0 0-.082.887l.41.26.001.002 4.995 3.178 3.178 4.995.002.002.26.41a.5.5 0 0 0 .886-.083l6-15z"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'log' && (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Время</th>
                <th>Отправитель</th>
                <th>Сообщение</th>
                <th>Тип</th>
                <th>Данные</th>
              </tr>
            </thead>
            <tbody>
              {dbMessages.map(msg => (
                <tr key={msg.id}>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {new Date(msg.created_at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td style={{ fontSize: 13, fontWeight: 600 }}>{msg.sender_name || '—'}</td>
                  <td style={{ fontSize: 13, maxWidth: 280 }}>{msg.message_text}</td>
                  <td>
                    <span className={`badge badge-${msg.parsed_type === 'attendance' ? 'completed' : msg.parsed_type === 'incident' ? 'high' : 'pending'}`}>
                      {PARSED_TYPE_LABEL[msg.parsed_type as string] || msg.parsed_type || '—'}
                    </span>
                  </td>
                  <td style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 180 }}>
                    {msg.parsed_data ? JSON.stringify(msg.parsed_data).slice(0, 60) : '—'}
                  </td>
                </tr>
              ))}
              {dbMessages.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>
                    Нет сообщений. Отправьте тестовые через симулятор.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
