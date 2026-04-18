'use client'

import { useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  Bot, Mic, X, Send, Loader2,
  Users, AlertTriangle, Calendar, BookOpen, UserCheck,
} from 'lucide-react'

/* ── маршруты, которые AI умеет определять ── */
const ROUTES: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  attendance:    { label: 'Посещаемость', icon: Users,          color: '#10B981', bg: 'rgba(16,185,129,0.15)' },
  incidents:     { label: 'Инциденты',   icon: AlertTriangle,   color: '#EF4444', bg: 'rgba(239,68,68,0.15)'  },
  schedule:      { label: 'Расписание',  icon: Calendar,        color: '#6366F1', bg: 'rgba(99,102,241,0.15)' },
  rag:           { label: 'Приказы RAG', icon: BookOpen,        color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
  staff:         { label: 'Сотрудники',  icon: UserCheck,       color: '#8B5CF6', bg: 'rgba(139,92,246,0.15)' },
}

type ResultEntry = {
  id: string
  type: 'user' | 'ai'
  text: string
  route?: string
  loading?: boolean
}

const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000'

export default function DirectorAgentWidget() {
  const pathname = usePathname()
  const router   = useRouter()
  const [open, setOpen]         = useState(false)
  const [loading, setLoading]   = useState(false)
  const [recording, setRecording] = useState(false)
  const [text, setText]         = useState('')
  const [results, setResults]   = useState<ResultEntry[]>([])
  const [error, setError]       = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef        = useRef<MediaStream | null>(null)
  const chunksRef        = useRef<Blob[]>([])
  const inputRef         = useRef<HTMLTextAreaElement>(null)

  const hidden = pathname === '/' || pathname === '/whatsapp'

  /* ── добавить ИИ-ответ ── */
  function addAI(text: string, route?: string) {
    setResults(prev => [...prev, { id: Date.now().toString(), type: 'ai', text, route }])
  }

  /* ── отправить текст ── */
  async function sendText() {
    const msg = text.trim()
    if (!msg || loading) return
    setText('')
    setError(null)
    setResults(prev => [...prev, { id: Date.now().toString(), type: 'user', text: msg }])
    setLoading(true)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 55000)
    try {
      const res = await fetch('/api/agent/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: msg }),
        signal: controller.signal,
      })
      clearTimeout(timer)
      if (!res.ok) throw new Error('Сервер недоступен')
      const data = await res.json()
      addAI(
        data.assistant_message?.message_text || 'Выполнено.',
        data.route,
      )
      // Немедленно обновляем дашборд — не ждём 60-секундный poll
      window.dispatchEvent(new CustomEvent('dashboard-refresh'))
      router.refresh()
    } catch (e) {
      clearTimeout(timer)
      if (e instanceof Error && e.name === 'AbortError') {
        setError('Время ожидания истекло (55 сек). Попробуйте снова.')
      } else {
        setError(e instanceof Error ? e.message : 'Ошибка')
      }
    } finally {
      setLoading(false)
    }
  }

  /* ── загрузить аудио ── */
  async function uploadAudio(blob: Blob, mimeType: string) {
    setLoading(true)
    setError(null)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 55000)
    try {
      const form = new FormData()
      form.append('file', new File([blob], 'voice.webm', { type: mimeType }))
      const res = await fetch('/api/agent/message-audio', { method: 'POST', body: form, signal: controller.signal })
      clearTimeout(timer)
      if (!res.ok) throw new Error('Голосовая обработка не удалась')
      const data = await res.json()
      const transcript = data.transcript
      // Показываем что распознал ИИ (или иконку если транскрипт пустой)
      const userText = transcript
        ? `🎤 ${transcript}`
        : '🎤 (голосовое сообщение)'
      setResults(prev => [...prev, { id: Date.now().toString(), type: 'user', text: userText }])
      const aiText =
        data.assistant_message?.message_text ||
        data.result?.message ||
        'Выполнено.'
      addAI(aiText, data.route)
      window.dispatchEvent(new CustomEvent('dashboard-refresh'))
      router.refresh()
    } catch (e) {
      clearTimeout(timer)
      if (e instanceof Error && e.name === 'AbortError') {
        setError('Время ожидания истекло (55 сек). Попробуйте снова.')
      } else {
        setError(e instanceof Error ? e.message : 'Ошибка голоса')
      }
    } finally {
      setLoading(false)
    }
  }

  /* ── запись ── */
  async function startRecording() {
    if (loading || recording) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []
      const rec = new MediaRecorder(stream)
      mediaRecorderRef.current = rec
      rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      rec.onstop = async () => {
        const mime = rec.mimeType || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type: mime })
        streamRef.current?.getTracks().forEach(t => t.stop())
        if (blob.size > 0) await uploadAudio(blob, mime)
      }
      rec.start()
      setRecording(true)
    } catch {
      setError('Нет доступа к микрофону')
    }
  }

  function stopRecording() {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return
    setRecording(false)
    mediaRecorderRef.current.stop()
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText() }
  }

  if (hidden) return null

  /* ══════ RENDER ══════ */
  return (
    <>
      {/* ── Кнопка-триггер ── */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Открыть AI-ассистент"
          style={{
            position: 'fixed', right: 22, bottom: 22,
            width: 58, height: 58,
            borderRadius: '50%',
            border: 'none',
            background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
            color: '#fff',
            boxShadow: '0 8px 32px rgba(99,102,241,0.45)',
            zIndex: 200,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.08)'
            ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 12px 40px rgba(99,102,241,0.6)'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'
            ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 32px rgba(99,102,241,0.45)'
          }}
        >
          <Bot size={26} />
        </button>
      )}

      {/* ── Панель ── */}
      {open && (
        <div style={{
          position: 'fixed', right: 18, bottom: 18,
          width: 'min(420px, calc(100vw - 24px))',
          height: 'min(68vh, 620px)',
          background: '#0F1123',
          border: '1px solid rgba(99,102,241,0.25)',
          borderRadius: 20,
          boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
          zIndex: 200,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>

          {/* ── Хедер ── */}
          <div style={{
            padding: '12px 16px',
            background: 'linear-gradient(135deg, #1a1b3a, #1e1f42)',
            borderBottom: '1px solid rgba(99,102,241,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 11,
                background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Bot size={18} color="#fff" />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 14, color: '#F1F5F9', lineHeight: 1.2 }}>
                  AI-Директор
                </div>
                <div style={{ fontSize: 11, color: '#64748B', marginTop: 1 }}>
                  Голос или текст — пойму сам
                </div>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Закрыть"
              style={{
                background: 'rgba(255,255,255,0.07)', border: 'none',
                color: '#94A3B8', cursor: 'pointer',
                width: 30, height: 30, borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.13)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
            >
              <X size={16} />
            </button>
          </div>

          {/* ── Быстрые категории ── */}
          <div style={{
            padding: '10px 14px 8px',
            display: 'flex', gap: 6, flexWrap: 'wrap',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
          }}>
            {Object.entries(ROUTES).map(([key, r]) => {
              const Icon = r.icon
              return (
                <button
                  key={key}
                  onClick={() => {
                    setText(r.label + ': ')
                    inputRef.current?.focus()
                  }}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '4px 10px', borderRadius: 20,
                    background: r.bg, border: 'none',
                    color: r.color, fontSize: 11, fontWeight: 700,
                    cursor: 'pointer', fontFamily: 'Figtree, sans-serif',
                  }}
                >
                  <Icon size={11} />
                  {r.label}
                </button>
              )
            })}
          </div>

          {/* ── Лента результатов ── */}
          <div style={{
            flex: 1, overflowY: 'auto',
            padding: '14px',
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            {results.length === 0 && (
              <div style={{
                margin: 'auto',
                textAlign: 'center',
                color: '#475569',
                fontSize: 13,
                lineHeight: 1.6,
                padding: '0 16px',
              }}>
                <Bot size={32} color="#2D2F5A" style={{ marginBottom: 10 }} />
                <div style={{ color: '#64748B', fontWeight: 600, marginBottom: 6 }}>Скажите или напишите</div>
                <div>Я сам определю — Посещаемость, Инцидент, Замена, Приказ или Сотрудник — и выполню.</div>
              </div>
            )}

            {results.map(r => {
              const isUser = r.type === 'user'
              const routeInfo = r.route ? ROUTES[r.route] : null
              const RouteIcon = routeInfo?.icon
              return (
                <div key={r.id} style={{
                  alignSelf: isUser ? 'flex-end' : 'flex-start',
                  maxWidth: '88%',
                }}>
                  {/* маршрут-чип */}
                  {routeInfo && RouteIcon && (
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '2px 8px', borderRadius: 20,
                      background: routeInfo.bg, color: routeInfo.color,
                      fontSize: 10, fontWeight: 800,
                      marginBottom: 4,
                      textTransform: 'uppercase', letterSpacing: '0.04em',
                    }}>
                      <RouteIcon size={9} /> {routeInfo.label}
                    </div>
                  )}
                  <div style={{
                    background: isUser
                      ? 'linear-gradient(135deg, #4F46E5, #6D28D9)'
                      : 'rgba(255,255,255,0.05)',
                    color: isUser ? '#fff' : '#CBD5E1',
                    border: isUser ? 'none' : '1px solid rgba(255,255,255,0.08)',
                    borderRadius: isUser ? '16px 16px 4px 16px' : '4px 16px 16px 16px',
                    padding: '10px 13px',
                    fontSize: 13, lineHeight: 1.55,
                    whiteSpace: 'pre-wrap',
                  }}>
                    {r.text}
                  </div>
                </div>
              )
            })}

            {loading && (
              <div style={{
                alignSelf: 'flex-start',
                display: 'flex', alignItems: 'center', gap: 8,
                color: '#64748B', fontSize: 13,
                padding: '8px 12px',
                background: 'rgba(255,255,255,0.04)',
                borderRadius: '4px 16px 16px 16px',
                border: '1px solid rgba(255,255,255,0.06)',
              }}>
                <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} />
                Обрабатываю...
              </div>
            )}
          </div>

          {/* ── Ввод ── */}
          <div style={{
            padding: '10px 12px',
            borderTop: '1px solid rgba(255,255,255,0.07)',
            background: '#0C0D1E',
          }}>
            {error && (
              <div style={{ color: '#FCA5A5', fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
                {error}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <textarea
                ref={inputRef}
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Напр.: Учитель Аскар заболел, его сегодня не будет"
                rows={2}
                disabled={loading || recording}
                style={{
                  flex: 1,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#F1F5F9',
                  borderRadius: 12,
                  padding: '10px 12px',
                  fontSize: 13,
                  fontFamily: 'Figtree, sans-serif',
                  resize: 'none',
                  outline: 'none',
                  lineHeight: 1.5,
                }}
                onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.5)')}
                onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
              />

              {/* Кнопка микрофона */}
              <button
                onClick={recording ? stopRecording : startRecording}
                disabled={loading}
                aria-label={recording ? 'Остановить запись' : 'Начать запись'}
                style={{
                  width: 44, height: 44, borderRadius: 12, border: 'none',
                  background: recording
                    ? 'linear-gradient(135deg, #EF4444, #DC2626)'
                    : 'rgba(99,102,241,0.15)',
                  color: recording ? '#fff' : '#818CF8',
                  cursor: loading ? 'default' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'all 0.2s',
                  boxShadow: recording ? '0 0 0 3px rgba(239,68,68,0.25)' : 'none',
                }}
              >
                <Mic size={18} />
              </button>

              {/* Кнопка отправки */}
              <button
                onClick={sendText}
                disabled={loading || !text.trim()}
                aria-label="Отправить"
                style={{
                  width: 44, height: 44, borderRadius: 12, border: 'none',
                  background: text.trim() && !loading
                    ? 'linear-gradient(135deg, #6366F1, #4F46E5)'
                    : 'rgba(255,255,255,0.07)',
                  color: text.trim() && !loading ? '#fff' : '#475569',
                  cursor: text.trim() && !loading ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'all 0.15s',
                  boxShadow: text.trim() && !loading
                    ? '0 4px 14px rgba(99,102,241,0.35)'
                    : 'none',
                }}
              >
                <Send size={17} />
              </button>
            </div>
            <div style={{ fontSize: 10, color: '#334155', marginTop: 6, paddingLeft: 2 }}>
              Enter — отправить · Shift+Enter — перенос строки
            </div>
          </div>
        </div>
      )}
    </>
  )
}
