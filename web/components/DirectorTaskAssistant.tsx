'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

type CreatedTask = {
  id: string
  title: string
  description: string | null
  assigned_to_name: string | null
  due_date: string | null
  priority: string
  notified?: boolean
  notification_status?: string
}

type VoiceParseResponse = {
  tasks?: CreatedTask[]
  count?: number
}

const PRIORITY_LABEL: Record<string, string> = {
  urgent: 'Срочно',
  high: 'Высокий',
  medium: 'Средний',
  low: 'Низкий',
}

const NOTIFY_LABEL: Record<string, string> = {
  sent: 'Отправлено',
  failed: 'Ошибка',
  no_chat_id: 'Нет chat_id',
  pending: 'Ожидает',
}

export default function DirectorTaskAssistant({
  onCreated,
}: {
  onCreated?: () => void
}) {
  const router = useRouter()
  const [commandText, setCommandText] = useState('')
  const [loading, setLoading] = useState(false)
  const [recording, setRecording] = useState(false)
  const [preview, setPreview] = useState<CreatedTask[]>([])
  const [error, setError] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  async function handleTextSubmit() {
    if (!commandText.trim()) return
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/voice/parse-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: commandText }),
      })
      if (!response.ok) throw new Error('Не удалось обработать текстовую команду')
      const data = (await response.json()) as VoiceParseResponse
      setPreview(data.tasks || [])
      setCommandText('')
      onCreated?.()
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка обработки команды')
    } finally {
      setLoading(false)
    }
  }

  async function submitAudioBlob(blob: Blob, mimeType: string) {
    setLoading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', new File([blob], 'director-command.webm', { type: mimeType }))
      const response = await fetch('/api/voice/parse-tasks-audio', {
        method: 'POST',
        body: formData,
      })
      if (!response.ok) throw new Error('Не удалось обработать голосовую команду')
      const data = (await response.json()) as VoiceParseResponse
      setPreview(data.tasks || [])
      onCreated?.()
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
      window.alert('Браузер не поддерживает запись с микрофона')
      return
    }

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setError('Не удалось получить доступ к микрофону')
      return
    }
    mediaStreamRef.current = stream
    audioChunksRef.current = []

    const recorder = new MediaRecorder(stream)
    mediaRecorderRef.current = recorder
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunksRef.current.push(event.data)
      }
    }
    recorder.onstop = async () => {
      const mimeType = recorder.mimeType || 'audio/webm'
      const blob = new Blob(audioChunksRef.current, { type: mimeType })
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop())
      mediaStreamRef.current = null
      if (blob.size > 0) {
        await submitAudioBlob(blob, mimeType)
      }
    }
    recorder.start()
    setRecording(true)
  }

  function stopRecording() {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return
    setRecording(false)
    mediaRecorderRef.current.stop()
  }

  return (
    <div className="card" style={{ marginBottom: 20, borderLeft: '4px solid var(--primary)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <h2 className="section-title" style={{ marginBottom: 8 }}>AI-завуч для директора</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0, marginBottom: 12 }}>
            Напишите или надиктуйте поручение вроде: «Айгерим, подготовь актовый зал. Назкен, закажи воду и бейджи до среды».
          </p>
          <textarea
            className="form-input form-textarea"
            style={{ minHeight: 92, marginBottom: 10 }}
            placeholder="Текстовая команда директора..."
            value={commandText}
            onChange={(event) => setCommandText(event.target.value)}
          />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={handleTextSubmit} className="btn btn-primary" disabled={loading || !commandText.trim()}>
              {loading ? <span className="spinner" /> : 'Разобрать текст'}
            </button>
            {!recording ? (
              <button onClick={startRecording} className="btn btn-outline" disabled={loading}>
                Записать с микрофона
              </button>
            ) : (
              <button onClick={stopRecording} className="btn btn-danger" disabled={loading}>
                Остановить запись
              </button>
            )}
          </div>
          {error ? (
            <div style={{ marginTop: 10, fontSize: 12, color: '#DC2626', fontWeight: 600 }}>
              {error}
            </div>
          ) : null}
        </div>

        <div style={{ width: 320, maxWidth: '100%', background: 'var(--bg)', borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
            Последний разбор
          </div>
          {preview.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              После обработки здесь появятся созданные задачи и статус их уведомлений.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {preview.map((task) => (
                <div key={task.id} className="card card-sm" style={{ padding: '10px 12px' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{task.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {task.assigned_to_name || 'Не назначено'}
                    {task.due_date ? ` • до ${new Date(task.due_date).toLocaleDateString('ru-RU')}` : ''}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                    <span className={`badge badge-${task.priority}`}>{PRIORITY_LABEL[task.priority] || task.priority}</span>
                    <span className={`badge badge-${task.notified ? 'completed' : 'pending'}`}>
                      {NOTIFY_LABEL[task.notification_status || 'pending'] || task.notification_status || 'Ожидает'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
