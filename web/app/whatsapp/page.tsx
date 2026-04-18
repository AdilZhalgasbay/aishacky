'use client'

import { useEffect, useState, useCallback } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Smartphone, CheckCircle, Loader, WifiOff, RefreshCw } from 'lucide-react'

type WAStatus = { isReady: boolean; qr: string | null; error?: string }

export default function WhatsAppPage() {
  const [status, setStatus] = useState<WAStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/whatsapp', { cache: 'no-store' })
      const data: WAStatus = await res.json()
      setStatus(data)
    } catch {
      setStatus({ isReady: false, qr: null, error: 'Сервис недоступен' })
    } finally {
      setLoading(false)
      setLastChecked(new Date())
    }
  }, [])

  useEffect(() => {
    fetchStatus()
    const id = setInterval(fetchStatus, 3000)
    return () => clearInterval(id)
  }, [fetchStatus])

  return (
    <div style={{ minHeight: '100vh', padding: '40px 48px', background: 'var(--bg-base)' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
          Настройка WhatsApp
        </h1>
        <p style={{ color: 'var(--text-muted)', marginTop: 6, fontSize: 14 }}>
          Подключите WhatsApp для автоматического сбора посещаемости и инцидентов
        </p>
      </div>

      {/* Status card */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 20,
        padding: '36px 40px',
        maxWidth: 520,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 24,
        boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
      }}>
        {loading && (
          <>
            <Loader size={40} color="#A78BFA" style={{ animation: 'spin 1s linear infinite' }} />
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>Проверяем статус...</p>
          </>
        )}

        {!loading && status?.error && (
          <>
            <WifiOff size={48} color="#F87171" />
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: '#F87171', fontWeight: 700, fontSize: 16, margin: 0 }}>wa-bot недоступен</p>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 8 }}>
                Убедитесь, что сервис запущен через <code style={{ color: '#A78BFA' }}>bash run.sh</code>
              </p>
            </div>
          </>
        )}

        {!loading && !status?.error && status?.isReady && (
          <>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(34,197,94,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle size={44} color="#22C55E" />
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: '#22C55E', fontWeight: 800, fontSize: 18, margin: 0 }}>✅ WhatsApp подключён</p>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 8 }}>
                Бот активен и готов получать сообщения из групп
              </p>
            </div>
            <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 12, padding: '12px 20px', width: '100%', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
                📨 Напишите в группу учителей — данные появятся автоматически
              </p>
            </div>
          </>
        )}

        {!loading && !status?.error && !status?.isReady && !status?.qr && (
          <>
            <Loader size={40} color="#FBBF24" style={{ animation: 'spin 1s linear infinite' }} />
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: '#FBBF24', fontWeight: 700, fontSize: 16, margin: 0 }}>Инициализация...</p>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 8 }}>
                WhatsApp запускается, QR-код появится автоматически
              </p>
            </div>
          </>
        )}

        {!loading && !status?.error && !status?.isReady && status?.qr && (
          <>
            <div style={{ textAlign: 'center' }}>
              <Smartphone size={28} color="#A78BFA" style={{ marginBottom: 8 }} />
              <p style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 18, margin: 0 }}>
                Отсканируйте QR-код
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 6 }}>
                Откройте WhatsApp → Связанные устройства → Привязать устройство
              </p>
            </div>

            <div style={{
              padding: 20,
              background: '#fff',
              borderRadius: 16,
              boxShadow: '0 0 0 6px rgba(167,139,250,0.15)',
            }}>
              <QRCodeSVG
                value={status.qr}
                size={220}
                level="M"
                includeMargin={false}
              />
            </div>

            <p style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', margin: 0 }}>
              QR-код обновляется каждые 3 сек. Если истёк — просто подождите новый.
            </p>
          </>
        )}

        {/* Footer refresh info */}
        {lastChecked && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>
            <RefreshCw size={10} />
            Обновляется автоматически · {lastChecked.toLocaleTimeString('ru-RU')}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
