'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Bot, MessageCircle, Mic, X, Send, Minimize2 } from 'lucide-react'

type AgentMessage = {
  id: string
  sender_name: string
  message_text: string
  parsed_type?: string | null
  parsed_data?: {
    route?: string
    source?: string
    payload?: Record<string, unknown>
  } | null
  created_at?: string | null
}

type AgentResponse = {
  route: string
  transcript?: string
  assistant_message?: AgentMessage | null
  result?: Record<string, unknown>
}

export default function DirectorAgentWidget() {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [recording, setRecording] = useState(false)
  const [text, setText] = useState('')
  const [messages, setMessages] = useState<AgentMessage[]>([])
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const hidden = pathname === '/' || pathname === '/whatsapp'

  async function loadHistory() {
    try {
      const response = await fetch('/api/agent/history?limit=80', { cache: 'no-store' })
      if (!response.ok) return
      const data = await response.json()
      setMessages(data.messages || [])
    } catch {
      // noop
    }
  }

  useEffect(() => {
    if (!hidden) {
      loadHistory()
    }
  }, [hidden])

  useEffect(() => {
    if (!open) return
    const node = scrollRef.current
    if (node) {
      node.scrollTop = node.scrollHeight
    }
  }, [messages, open])

  async function sendTextMessage() {
    if (!text.trim() || loading) return
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/agent/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!response.ok) throw new Error('Не удалось обработать сообщение')
      const data = (await response.json()) as AgentResponse
      setText('')
      await loadHistory()
      router.refresh()
      if (data.route === 'rag') {
        setOpen(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка отправки')
    } finally {
      setLoading(false)
    }
  }

  async function uploadAudio(blob: Blob, mimeType: string) {
    setLoading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', new File([blob], 'director-agent.webm', { type: mimeType }))
      const response = await fetch('/api/agent/message-audio', {
        method: 'POST',
        body: formData,
      })
      if (!response.ok) throw new Error('Не удалось обработать голосовое сообщение')
      await response.json()
      await loadHistory()
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка обработки голоса')
    } finally {
      setLoading(false)
    }
  }

  async function startRecording() {
    if (loading || recording) return
    if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('Запись с микрофона не поддерживается')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []
      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onstop = async () => {
        const mimeType = recorder.mimeType || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type: mimeType })
        streamRef.current?.getTracks().forEach((track) => track.stop())
        streamRef.current = null
        if (blob.size > 0) {
          await uploadAudio(blob, mimeType)
        }
      }
      recorder.start()
      setRecording(true)
    } catch {
      setError('Не удалось получить доступ к микрофону')
    }
  }

  function stopRecording() {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return
    setRecording(false)
    mediaRecorderRef.current.stop()
  }

  if (hidden) return null

  return (
    <>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          style={{
            position: 'fixed',
            right: 22,
            bottom: 22,
            width: 64,
            height: 64,
            borderRadius: '50%',
            border: 'none',
            background: 'linear-gradient(135deg, #2563EB, #7C3AED)',
            color: '#fff',
            boxShadow: '0 20px 40px rgba(37,99,235,0.35)',
            zIndex: 120,
            cursor: 'pointer',
          }}
          aria-label="Открыть AI-чат директора"
        >
          <Bot size={28} style={{ marginTop: 2 }} />
        </button>
      ) : (
        <div
          style={{
            position: 'fixed',
            right: 18,
            bottom: 18,
            width: 'min(420px, calc(100vw - 24px))',
            height: 'min(72vh, 680px)',
            background: '#fff',
            border: '1px solid rgba(15,23,42,0.08)',
            borderRadius: 20,
            boxShadow: '0 30px 80px rgba(15,23,42,0.18)',
            zIndex: 120,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              padding: '14px 16px',
              background: 'linear-gradient(135deg, #0F172A, #1D4ED8)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <MessageCircle size={18} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15 }}>AI-чат директора</div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>
                  Задачи, инциденты, замены, приказы №76/110/130
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={() => setOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}
                aria-label="Свернуть чат"
              >
                <Minimize2 size={18} />
              </button>
              <button
                onClick={() => setOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}
                aria-label="Закрыть чат"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div
            ref={scrollRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px 14px',
              background: 'linear-gradient(180deg, #F8FAFC 0%, #EFF6FF 100%)',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            {messages.length === 0 ? (
              <div style={{ color: '#64748B', fontSize: 13, lineHeight: 1.5 }}>
                Напиши или надиктуй сообщение. Я сам пойму, это инцидент, задача, замена учителя или вопрос по приказам.
              </div>
            ) : (
              messages.map((message) => {
                const isUser = message.sender_name === 'Директор'
                return (
                  <div
                    key={message.id}
                    style={{
                      alignSelf: isUser ? 'flex-end' : 'flex-start',
                      maxWidth: '88%',
                      background: isUser ? '#1D4ED8' : '#fff',
                      color: isUser ? '#fff' : '#0F172A',
                      borderRadius: 18,
                      padding: '10px 12px',
                      boxShadow: isUser ? '0 10px 24px rgba(37,99,235,0.18)' : '0 8px 18px rgba(15,23,42,0.06)',
                    }}
                  >
                    <div style={{ fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                      {message.message_text}
                    </div>
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 11,
                        opacity: 0.72,
                        display: 'flex',
                        gap: 8,
                        flexWrap: 'wrap',
                      }}
                    >
                      <span>{isUser ? 'Директор' : 'AI-завуч'}</span>
                      {message.parsed_data?.route ? <span>{message.parsed_data.route}</span> : null}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          <div style={{ padding: 12, borderTop: '1px solid rgba(15,23,42,0.06)', background: '#fff' }}>
            {error ? (
              <div style={{ color: '#DC2626', fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
                {error}
              </div>
            ) : null}
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="Например: Учитель математики Аскар заболел, его сегодня не будет"
                style={{
                  flex: 1,
                  minHeight: 52,
                  maxHeight: 140,
                  resize: 'vertical',
                  borderRadius: 14,
                  border: '1px solid rgba(148,163,184,0.35)',
                  padding: '12px 14px',
                  fontSize: 14,
                  outline: 'none',
                }}
              />
              {!recording ? (
                <button
                  onClick={startRecording}
                  disabled={loading}
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 14,
                    border: '1px solid rgba(37,99,235,0.16)',
                    background: '#EFF6FF',
                    color: '#1D4ED8',
                    cursor: 'pointer',
                  }}
                >
                  <Mic size={18} />
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  disabled={loading}
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 14,
                    border: '1px solid rgba(220,38,38,0.18)',
                    background: '#FEE2E2',
                    color: '#B91C1C',
                    cursor: 'pointer',
                  }}
                >
                  <Mic size={18} />
                </button>
              )}
              <button
                onClick={sendTextMessage}
                disabled={loading || !text.trim()}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  border: 'none',
                  background: loading ? '#94A3B8' : '#2563EB',
                  color: '#fff',
                  cursor: loading ? 'default' : 'pointer',
                }}
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
