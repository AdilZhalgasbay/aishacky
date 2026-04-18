'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { QRCodeSVG } from 'qrcode.react'
import {
  Bot, Zap, BookOpen, CalendarDays, Users, AlertTriangle,
  MessageCircle, Sparkles, ArrowRight, CheckCircle2, Shield,
  Brain, Layers, Award, ChevronRight, BarChart3,
  CheckCircle, Loader, WifiOff, Smartphone,
} from 'lucide-react'

const features = [
  {
    icon: Bot, color: '#3B82F6', bg: 'rgba(59,130,246,0.1)',
    title: 'NLP-Парсер чатов',
    desc: 'Учитель пишет в WhatsApp — система мгновенно разбирает посещаемость и инциденты без ручного ввода.',
  },
  {
    icon: Zap, color: '#8B5CF6', bg: 'rgba(139,92,246,0.1)',
    title: 'Голосовые задачи',
    desc: 'Надиктуйте задачу — AI разобьёт на подзадачи, назначит исполнителей и отправит уведомления.',
  },
  {
    icon: CalendarDays, color: '#10B981', bg: 'rgba(16,185,129,0.1)',
    title: 'Smart Замены',
    desc: 'Учитель заболел — за секунды находим свободного замещающего, проверяем конфликты, уведомляем.',
  },
  {
    icon: BookOpen, color: '#F59E0B', bg: 'rgba(245,158,11,0.1)',
    title: 'RAG Приказы',
    desc: 'Задайте вопрос по Приказам МОН РК — получите точный ответ с ссылкой на официальный источник.',
  },
]

const stats = [
  { value: '400+', label: 'учеников',      icon: Users  },
  { value: '20',   label: 'педагогов',     icon: Award  },
  { value: '< 3s', label: 'время ответа AI', icon: Zap   },
  { value: '98%',  label: 'точность NLP',  icon: Brain  },
]

const techStack = [
  { name: 'Llama 3.3-70b', role: 'Главный LLM',  color: '#3B82F6' },
  { name: 'Gemma 3n',      role: 'Voice Parser', color: '#8B5CF6' },
  { name: 'FAISS',         role: 'Vector RAG',   color: '#10B981' },
  { name: 'NVIDIA NIM',    role: 'Embeddings',   color: '#F59E0B' },
  { name: 'Supabase',      role: 'Database',     color: '#EF4444' },
  { name: 'FastAPI',       role: 'Backend API',  color: '#06B6D4' },
]

const modules = [
  { icon: Users,         label: 'Посещаемость', href: '/attendance', color: '#10B981' },
  { icon: AlertTriangle, label: 'Инциденты',    href: '/incidents',  color: '#EF4444' },
  { icon: CalendarDays,  label: 'Расписание',   href: '/schedule',   color: '#3B82F6' },
  { icon: BookOpen,      label: 'RAG Приказы',  href: '/rag',        color: '#F59E0B' },
  { icon: MessageCircle, label: 'WhatsApp',     href: '/whatsapp',   color: '#25D366' },
  { icon: BarChart3,     label: 'Аналитика',    href: '/dashboard',  color: '#06B6D4' },
]

type WAStatus = { isReady: boolean; qr: string | null; error?: string }

// ── QR Modal ──────────────────────────────────────────────────────────────────
function QRModal({ onClose, onReady }: { onClose: () => void; onReady: () => void }) {
  const [status, setStatus] = useState<WAStatus | null>(null)
  const [slideUp, setSlideUp] = useState(false)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/whatsapp', { cache: 'no-store' })
      const data: WAStatus = await res.json()
      setStatus(data)
      if (data.isReady) {
        // Trigger slide-up animation then navigate
        setSlideUp(true)
        setTimeout(() => onReady(), 600)
      }
    } catch {
      setStatus({ isReady: false, qr: null, error: 'wa-bot недоступен' })
    }
  }, [onReady])

  useEffect(() => {
    fetchStatus()
    const id = setInterval(fetchStatus, 3000)
    return () => clearInterval(id)
  }, [fetchStatus])

  return (
    <>
      {/* Blur overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 300,
          background: 'rgba(10,15,30,0.75)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          animation: 'fadeIn 0.25s ease',
        }}
      />

      {/* Modal card */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 301,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none',
      }}>
        <div style={{
          pointerEvents: 'auto',
          background: 'rgba(16,20,40,0.98)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 24,
          padding: '40px 44px',
          maxWidth: 420,
          width: '90vw',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 20,
          boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(59,130,246,0.15)',
          animation: slideUp ? 'slideUp 0.6s cubic-bezier(0.4,0,0.2,1) forwards' : 'popIn 0.3s cubic-bezier(0.34,1.56,0.64,1)',
        }}>

          {/* Header */}
          <div style={{ textAlign: 'center' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'rgba(37,211,102,0.12)',
              border: '1px solid rgba(37,211,102,0.25)',
              padding: '5px 14px', borderRadius: 20, marginBottom: 14,
            }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#25D366' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#25D366' }}>WhatsApp</span>
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: '#fff' }}>
              Подключение к боту
            </h2>
          </div>

          {/* Content */}
          {!status && (
            <Loader size={36} color="#A78BFA" style={{ animation: 'spin 1s linear infinite' }} />
          )}

          {status?.error && (
            <div style={{ textAlign: 'center' }}>
              <WifiOff size={40} color="#F87171" style={{ marginBottom: 12 }} />
              <p style={{ color: '#F87171', fontWeight: 700, margin: 0 }}>wa-bot недоступен</p>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 6 }}>
                Запустите <code style={{ color: '#A78BFA' }}>bash run.sh</code>
              </p>
            </div>
          )}

          {status && !status.error && status.isReady && (
            <div style={{ textAlign: 'center' }}>
              <CheckCircle size={52} color="#22C55E" style={{ marginBottom: 8 }} />
              <p style={{ color: '#22C55E', fontWeight: 800, fontSize: 17, margin: 0 }}>
                WhatsApp подключён ✅
              </p>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 6 }}>
                Переходим в дашборд...
              </p>
            </div>
          )}

          {status && !status.error && !status.isReady && !status.qr && (
            <div style={{ textAlign: 'center' }}>
              <Loader size={36} color="#FBBF24" style={{ animation: 'spin 1s linear infinite', marginBottom: 10 }} />
              <p style={{ color: '#FBBF24', fontWeight: 700, margin: 0 }}>Инициализация...</p>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 6 }}>QR-код появится автоматически</p>
            </div>
          )}

          {status && !status.error && !status.isReady && status.qr && (
            <>
              <div style={{ textAlign: 'center' }}>
                <Smartphone size={22} color="#A78BFA" style={{ marginBottom: 6 }} />
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, margin: 0 }}>
                  WhatsApp → Связанные устройства → Привязать устройство
                </p>
              </div>
              <div style={{
                padding: 18, background: '#fff', borderRadius: 16,
                boxShadow: '0 0 0 6px rgba(167,139,250,0.15)',
              }}>
                <QRCodeSVG value={status.qr} size={210} level="M" includeMargin={false} />
              </div>
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, textAlign: 'center', margin: 0 }}>
                Обновляется каждые 3 сек
              </p>
            </>
          )}

          {/* Skip / close */}
          <button
            onClick={onClose}
            style={{
              background: 'none', border: '1px solid rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.4)', borderRadius: 10,
              padding: '8px 20px', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}
          >
            Пропустить →
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn  { from { opacity: 0 } to { opacity: 1 } }
        @keyframes popIn   { from { opacity: 0; transform: scale(0.88) translateY(20px) } to { opacity: 1; transform: scale(1) translateY(0) } }
        @keyframes slideUp { from { opacity: 1; transform: translateY(0) } to { opacity: 0; transform: translateY(-120px) } }
        @keyframes spin    { to { transform: rotate(360deg) } }
      `}</style>
    </>
  )
}

// ── Landing Page ──────────────────────────────────────────────────────────────
export default function LandingPage() {
  const router = useRouter()
  const [typed, setTyped] = useState('')
  const [showQR, setShowQR] = useState(false)

  const messages = [
    '1А — 25 детей, 2 болеют',
    'Болат заболел → найти замену',
    'Подготовить актовый зал в пятницу',
    'Сколько часов норма для 3 класса?',
  ]

  useEffect(() => {
    let msgIdx = 0, charIdx = 0, deleting = false
    const iv = setInterval(() => {
      const msg = messages[msgIdx]
      if (!deleting) {
        setTyped(msg.slice(0, charIdx + 1)); charIdx++
        if (charIdx >= msg.length) deleting = true
      } else {
        setTyped(msg.slice(0, charIdx - 1)); charIdx--
        if (charIdx <= 0) { deleting = false; msgIdx = (msgIdx + 1) % messages.length }
      }
    }, 60)
    return () => clearInterval(iv)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [checking, setChecking] = useState(false)

  const openDashboard = async () => {
    setChecking(true)
    try {
      const res = await fetch('/api/whatsapp', { cache: 'no-store' })
      const data: WAStatus = await res.json()
      if (data.isReady) {
        // Already logged in — go directly to dashboard
        router.push('/dashboard')
        return
      }
    } catch {
      // wa-bot unreachable — still show modal so user can see the error
    } finally {
      setChecking(false)
    }
    setShowQR(true)
  }
  const onReady = () => { setShowQR(false); router.push('/dashboard') }
  const skip   = () => { setShowQR(false); router.push('/dashboard') }

  const btnStyle: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    background: 'linear-gradient(135deg, #3B82F6, #7C3AED)',
    color: '#fff', padding: '13px 28px', borderRadius: 12,
    fontSize: 15, fontWeight: 700, textDecoration: 'none',
    boxShadow: '0 4px 24px rgba(59,130,246,0.4)',
    border: 'none', cursor: 'pointer', fontFamily: 'inherit',
    transition: 'all 0.2s',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0A0F1E', fontFamily: "'Figtree', sans-serif", color: '#fff' }}>

      {showQR && <QRModal onClose={skip} onReady={onReady} />}

      {/* ── NAV ── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
        background: 'rgba(10,15,30,0.85)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '0 40px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: 64,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 38, height: 38,
            background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)',
            borderRadius: 11,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(59,130,246,0.4)',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
              <path d="M6 12v5c3 3 9 3 12 0v-5"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.1 }}>Aqbobek AI</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>Director Platform</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', padding: '5px 12px', borderRadius: 20 }}>
            <span style={{ width: 7, height: 7, background: '#10B981', borderRadius: '50%', display: 'inline-block' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#10B981' }}>Live Demo</span>
          </div>
          <button onClick={openDashboard} disabled={checking} style={{
            display: 'flex', alignItems: 'center', gap: 7,
            background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)',
            color: '#fff', padding: '8px 18px', borderRadius: 10,
            fontSize: 14, fontWeight: 700, border: 'none', cursor: checking ? 'wait' : 'pointer',
            boxShadow: '0 2px 12px rgba(59,130,246,0.35)',
            opacity: checking ? 0.7 : 1,
          }}>
            {checking ? '...' : <><span>Открыть дашборд</span> <ArrowRight size={14} /></>}
          </button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{
        minHeight: '100vh',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '100px 40px 80px',
        position: 'relative', overflow: 'hidden', textAlign: 'center',
      }}>
        <div style={{ position: 'absolute', top: '10%', left: '5%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '20%', right: '5%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.10) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)',
          padding: '7px 18px', borderRadius: 20, marginBottom: 28,
          animation: 'fadeUp 0.5s ease forwards',
        }}>
          <Sparkles size={13} color="#60A5FA" />
          <span style={{ fontSize: 13, fontWeight: 700, color: '#60A5FA' }}>AIS Hack 3.0 · EdTech &amp; AI Management</span>
        </div>

        <h1 style={{
          fontSize: 'clamp(36px, 6vw, 76px)', fontWeight: 900,
          lineHeight: 1.05, letterSpacing: '-0.03em', marginBottom: 24,
          animation: 'fadeUp 0.6s ease 0.1s both',
        }}>
          AI-Директор для{' '}
          <span style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            школы будущего
          </span>
        </h1>

        <p style={{
          fontSize: 18, color: 'rgba(255,255,255,0.55)', maxWidth: 580, lineHeight: 1.7,
          marginBottom: 36, fontWeight: 400, animation: 'fadeUp 0.6s ease 0.2s both',
        }}>
          Автоматизируем посещаемость, замены, задачи и документооборот. Директор концентрируется на педагогике — рутину берёт AI.
        </p>

        {/* Typewriter */}
        <div style={{
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 14, padding: '14px 22px', marginBottom: 36, maxWidth: 440, width: '100%',
          display: 'flex', alignItems: 'center', gap: 12, animation: 'fadeUp 0.6s ease 0.3s both',
        }}>
          <MessageCircle size={16} color="#60A5FA" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', fontFamily: 'monospace' }}>
            {typed}<span style={{ borderRight: '2px solid #60A5FA', marginLeft: 1 }} />
          </span>
        </div>

        {/* CTA — single button only */}
        <div style={{ animation: 'fadeUp 0.6s ease 0.4s both' }}>
          <button onClick={openDashboard} style={btnStyle}>
            <Layers size={16} />
            Открыть дашборд
            <ArrowRight size={15} />
          </button>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 40, marginTop: 72, flexWrap: 'wrap', justifyContent: 'center', animation: 'fadeUp 0.6s ease 0.5s both' }}>
          {stats.map((s) => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: '-0.02em', background: 'linear-gradient(135deg, #fff, rgba(255,255,255,0.6))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                {s.value}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 600, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section style={{ padding: '100px 40px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 60 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', padding: '6px 18px', borderRadius: 20, marginBottom: 20 }}>
              <Sparkles size={13} color="#A78BFA" />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#A78BFA' }}>4 ключевых модуля</span>
            </div>
            <h2 style={{ fontSize: 'clamp(28px,4vw,48px)', fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 16 }}>
              Всё, что нужно директору —<br />
              <span style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                в одной платформе
              </span>
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
            {features.map((f) => {
              const Icon = f.icon
              return (
                <div key={f.title} style={{
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 18, padding: 28, backdropFilter: 'blur(10px)',
                  transition: 'all 0.25s ease', cursor: 'default',
                }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLDivElement; el.style.background = 'rgba(255,255,255,0.06)'; el.style.borderColor = f.color + '44'; el.style.transform = 'translateY(-4px)' }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLDivElement; el.style.background = 'rgba(255,255,255,0.03)'; el.style.borderColor = 'rgba(255,255,255,0.08)'; el.style.transform = 'translateY(0)' }}>
                  <div style={{ width: 52, height: 52, borderRadius: 16, background: f.bg, border: `1px solid ${f.color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
                    <Icon size={24} color={f.color} />
                  </div>
                  <h3 style={{ fontSize: 17, fontWeight: 800, marginBottom: 10 }}>{f.title}</h3>
                  <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, margin: 0 }}>{f.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── MODULES GRID ── */}
      <section style={{ padding: '80px 40px', background: 'rgba(255,255,255,0.02)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 50 }}>
            <h2 style={{ fontSize: 36, fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 12 }}>Быстрый доступ</h2>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 16 }}>Перейдите в любой модуль прямо сейчас</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            {modules.map((m) => {
              const Icon = m.icon
              return (
                <a key={m.href} href={m.href} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 14, padding: '20px 22px', textDecoration: 'none', color: '#fff',
                  transition: 'all 0.2s ease', fontWeight: 600, fontSize: 15,
                }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLAnchorElement; el.style.background = 'rgba(255,255,255,0.07)'; el.style.borderColor = m.color + '55'; el.style.transform = 'translateY(-2px)' }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLAnchorElement; el.style.background = 'rgba(255,255,255,0.04)'; el.style.borderColor = 'rgba(255,255,255,0.08)'; el.style.transform = 'translateY(0)' }}>
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: m.color + '20', border: `1px solid ${m.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={20} color={m.color} />
                  </div>
                  <span>{m.label}</span>
                  <ChevronRight size={16} color="rgba(255,255,255,0.3)" style={{ marginLeft: 'auto' }} />
                </a>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── TECH STACK ── */}
      <section style={{ padding: '100px 40px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', padding: '6px 18px', borderRadius: 20, marginBottom: 24 }}>
            <Brain size={13} color="#34D399" />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#34D399' }}>AI Stack</span>
          </div>
          <h2 style={{ fontSize: 36, fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 16 }}>
            Powered by лучшими AI-технологиями
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginTop: 40 }}>
            {techStack.map((t) => (
              <div key={t.name} style={{
                background: 'rgba(255,255,255,0.04)', border: `1px solid ${t.color}33`,
                borderRadius: 12, padding: '14px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 120,
              }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.color, marginBottom: 4 }} />
                <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{t.name}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t.role}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ padding: '80px 40px' }}>
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(139,92,246,0.15))',
            border: '1px solid rgba(59,130,246,0.25)',
            borderRadius: 24, padding: '60px 40px', textAlign: 'center',
            backdropFilter: 'blur(20px)',
          }}>
            <div style={{ width: 70, height: 70, borderRadius: 20, background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', boxShadow: '0 8px 32px rgba(59,130,246,0.4)' }}>
              <Shield size={32} color="white" />
            </div>
            <h2 style={{ fontSize: 36, fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 16 }}>Готовы к демонстрации</h2>
            <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, marginBottom: 32 }}>
              Все модули задеплоены и работают в реальном времени.
            </p>
            <button onClick={openDashboard} style={{ ...btnStyle, padding: '14px 32px', fontSize: 16 }}>
              Открыть дашборд <ArrowRight size={16} />
            </button>
            <div style={{ display: 'flex', gap: 24, justifyContent: 'center', marginTop: 28, flexWrap: 'wrap' }}>
              {['NLP-парсер', 'Voice-to-Task', 'Smart замены', 'RAG-приказы'].map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle2 size={14} color="#10B981" />
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>{f}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '30px 40px', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{ width: 28, height: 28, background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
            </svg>
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>Aqbobek AI Director</span>
        </div>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)' }}>
          AIS Hack 3.0 · EdTech &amp; AI Management · Начальная школа образовательного комплекса «Aqbobek»
        </p>
      </footer>

      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>
    </div>
  )
}
