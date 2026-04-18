'use client'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import {
  Bot, Zap, BookOpen, CalendarDays, Users, AlertTriangle,
  MessageCircle, Sparkles, ArrowRight, CheckCircle2, Shield,
  TrendingUp, Clock, Star, ChevronRight, Play, Globe,
  BarChart3, Brain, Layers, Award,
} from 'lucide-react'

const features = [
  {
    icon: Bot,
    color: '#3B82F6',
    bg: 'rgba(59,130,246,0.1)',
    title: 'NLP-Парсер чатов',
    desc: 'Учитель пишет в Telegram — система мгновенно разбирает посещаемость и инциденты без ручного ввода.',
  },
  {
    icon: Zap,
    color: '#8B5CF6',
    bg: 'rgba(139,92,246,0.1)',
    title: 'Голосовые задачи',
    desc: 'Надиктуйте задачу — AI разобьёт на подзадачи, назначит исполнителей и отправит уведомления.',
  },
  {
    icon: CalendarDays,
    color: '#10B981',
    bg: 'rgba(16,185,129,0.1)',
    title: 'Smart Замены',
    desc: 'Учитель заболел — за секунды находим свободного замещающего, проверяем конфликты, уведомляем.',
  },
  {
    icon: BookOpen,
    color: '#F59E0B',
    bg: 'rgba(245,158,11,0.1)',
    title: 'RAG Приказы',
    desc: 'Задайте вопрос по Приказам МОН РК — получите точный ответ с ссылкой на официальный источник.',
  },
]

const stats = [
  { value: '400+', label: 'учеников', icon: Users },
  { value: '20',   label: 'педагогов', icon: Award },
  { value: '< 3s', label: 'время ответа AI', icon: Zap },
  { value: '98%',  label: 'точность NLP', icon: Brain },
]

const techStack = [
  { name: 'Llama 3.3-70b', role: 'Главный LLM', color: '#3B82F6' },
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
  { icon: MessageCircle, label: 'Telegram',     href: '/telegram',   color: '#8B5CF6' },
  { icon: BarChart3,     label: 'Аналитика',    href: '/dashboard',  color: '#06B6D4' },
]

function AnimatedNumber({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    let start = 0
    const step = target / 40
    const timer = setInterval(() => {
      start += step
      if (start >= target) { setVal(target); clearInterval(timer) }
      else setVal(Math.floor(start))
    }, 30)
    return () => clearInterval(timer)
  }, [target])
  return <>{val}{suffix}</>
}

export default function LandingPage() {
  const [typed, setTyped] = useState('')
  const messages = [
    '1А — 25 детей, 2 болеют',
    'Болат заболел → найти замену',
    'Подготовить актовый зал в пятницу',
    'Сколько часов норма для 3 класса?',
  ]
  useEffect(() => {
    let msgIdx = 0
    let charIdx = 0
    let deleting = false
    const interval = setInterval(() => {
      const msg = messages[msgIdx]
      if (!deleting) {
        setTyped(msg.slice(0, charIdx + 1))
        charIdx++
        if (charIdx >= msg.length) { deleting = true; setTimeout(() => {}, 1200) }
      } else {
        setTyped(msg.slice(0, charIdx - 1))
        charIdx--
        if (charIdx <= 0) { deleting = false; msgIdx = (msgIdx + 1) % messages.length }
      }
    }, 60)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: '#0A0F1E', fontFamily: "'Figtree', sans-serif", color: '#fff' }}>

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
          <Link href="/dashboard" style={{
            display: 'flex', alignItems: 'center', gap: 7,
            background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)',
            color: '#fff', padding: '8px 18px', borderRadius: 10,
            fontSize: 14, fontWeight: 700, textDecoration: 'none',
            boxShadow: '0 2px 12px rgba(59,130,246,0.35)',
            transition: 'all 0.2s ease',
          }}>
            Открыть дашборд <ArrowRight size={14} />
          </Link>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{
        minHeight: '100vh',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '100px 40px 80px',
        position: 'relative',
        overflow: 'hidden',
        textAlign: 'center',
      }}>
        {/* Background glow blobs */}
        <div style={{ position: 'absolute', top: '10%', left: '5%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '20%', right: '5%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.10) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '10%', left: '30%', width: 600, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />

        {/* Badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'rgba(59,130,246,0.15)',
          border: '1px solid rgba(59,130,246,0.3)',
          padding: '7px 18px', borderRadius: 20, marginBottom: 28,
          animation: 'fadeUp 0.5s ease forwards',
        }}>
          <Sparkles size={13} color="#60A5FA" />
          <span style={{ fontSize: 13, fontWeight: 700, color: '#60A5FA' }}>AIS Hack 3.0 · EdTech & AI Management</span>
        </div>

        {/* Title */}
        <h1 style={{
          fontSize: 'clamp(36px, 6vw, 76px)',
          fontWeight: 900,
          lineHeight: 1.05,
          letterSpacing: '-0.03em',
          marginBottom: 24,
          animation: 'fadeUp 0.6s ease 0.1s both',
        }}>
          AI-Директор для{' '}
          <span style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            школы будущего
          </span>
        </h1>

        <p style={{
          fontSize: 18, color: 'rgba(255,255,255,0.55)', maxWidth: 580, lineHeight: 1.7,
          marginBottom: 36, fontWeight: 400,
          animation: 'fadeUp 0.6s ease 0.2s both',
        }}>
          Автоматизируем посещаемость, замены, задачи и документооборот. Директор концентрируется на педагогике — рутину берёт AI.
        </p>

        {/* Typewriter demo */}
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 14,
          padding: '14px 22px',
          marginBottom: 36,
          maxWidth: 440,
          width: '100%',
          display: 'flex', alignItems: 'center', gap: 12,
          animation: 'fadeUp 0.6s ease 0.3s both',
        }}>
          <MessageCircle size={16} color="#60A5FA" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', fontFamily: 'monospace' }}>
            {typed}<span style={{ opacity: Math.sin(Date.now() / 300) > 0 ? 1 : 0, borderRight: '2px solid #60A5FA', marginLeft: 1 }} />
          </span>
        </div>

        {/* CTA */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', animation: 'fadeUp 0.6s ease 0.4s both' }}>
          <Link href="/dashboard" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'linear-gradient(135deg, #3B82F6, #7C3AED)',
            color: '#fff', padding: '13px 28px', borderRadius: 12,
            fontSize: 15, fontWeight: 700, textDecoration: 'none',
            boxShadow: '0 4px 24px rgba(59,130,246,0.4)',
            transition: 'all 0.2s',
          }}>
            <Layers size={16} />
            Открыть дашборд
            <ArrowRight size={15} />
          </Link>
          <Link href="/telegram" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: 'rgba(255,255,255,0.8)',
            padding: '13px 24px', borderRadius: 12,
            fontSize: 15, fontWeight: 600, textDecoration: 'none',
            transition: 'all 0.2s',
          }}>
            <Play size={14} />
            Демо Telegram
          </Link>
        </div>

        {/* Stats row */}
        <div style={{
          display: 'flex', gap: 40, marginTop: 72, flexWrap: 'wrap', justifyContent: 'center',
          animation: 'fadeUp 0.6s ease 0.5s both',
        }}>
          {stats.map((s) => {
            const Icon = s.icon
            return (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: '-0.02em', background: 'linear-gradient(135deg, #fff, rgba(255,255,255,0.6))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                  {s.value}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 600, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {s.label}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section style={{ padding: '100px 40px', position: 'relative' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 60 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', padding: '6px 18px', borderRadius: 20, marginBottom: 20 }}>
              <Sparkles size={13} color="#A78BFA" />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#A78BFA' }}>4 ключевых модуля</span>
            </div>
            <h2 style={{ fontSize: 'clamp(28px,4vw,48px)', fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 16 }}>
              Всё, что нужно директору —
              <br />
              <span style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                в одной платформе
              </span>
            </h2>
            <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.5)', maxWidth: 500, margin: '0 auto', lineHeight: 1.6 }}>
              Каждый модуль закрывает реальную боль начальной школы
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
            {features.map((f, i) => {
              const Icon = f.icon
              return (
                <div key={f.title} style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 18,
                  padding: 28,
                  transition: 'all 0.25s ease',
                  cursor: 'default',
                  animationDelay: `${i * 0.1}s`,
                  backdropFilter: 'blur(10px)',
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLDivElement
                  el.style.background = 'rgba(255,255,255,0.06)'
                  el.style.borderColor = f.color + '44'
                  el.style.transform = 'translateY(-4px)'
                  el.style.boxShadow = `0 20px 40px rgba(0,0,0,0.3), 0 0 0 1px ${f.color}22`
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLDivElement
                  el.style.background = 'rgba(255,255,255,0.03)'
                  el.style.borderColor = 'rgba(255,255,255,0.08)'
                  el.style.transform = 'translateY(0)'
                  el.style.boxShadow = 'none'
                }}>
                  <div style={{ width: 52, height: 52, borderRadius: 16, background: f.bg, border: `1px solid ${f.color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
                    <Icon size={24} color={f.color} />
                  </div>
                  <h3 style={{ fontSize: 17, fontWeight: 800, marginBottom: 10, letterSpacing: '-0.01em' }}>{f.title}</h3>
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
                <Link key={m.href} href={m.href} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 14, padding: '20px 22px',
                  textDecoration: 'none', color: '#fff',
                  transition: 'all 0.2s ease',
                  fontWeight: 600, fontSize: 15,
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLAnchorElement
                  el.style.background = 'rgba(255,255,255,0.07)'
                  el.style.borderColor = m.color + '55'
                  el.style.transform = 'translateY(-2px)'
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLAnchorElement
                  el.style.background = 'rgba(255,255,255,0.04)'
                  el.style.borderColor = 'rgba(255,255,255,0.08)'
                  el.style.transform = 'translateY(0)'
                }}>
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: m.color + '20', border: `1px solid ${m.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={20} color={m.color} />
                  </div>
                  <span>{m.label}</span>
                  <ChevronRight size={16} color="rgba(255,255,255,0.3)" style={{ marginLeft: 'auto' }} />
                </Link>
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
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 16, marginBottom: 48 }}>
            Enterprise-grade LLM инфраструктура для образования
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
            {techStack.map((t) => (
              <div key={t.name} style={{
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${t.color}33`,
                borderRadius: 12,
                padding: '14px 20px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                minWidth: 120,
              }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.color, marginBottom: 4 }} />
                <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{t.name}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t.role}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA SECTION ── */}
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
            <h2 style={{ fontSize: 36, fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 16 }}>
              Готовы к демонстрации
            </h2>
            <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, marginBottom: 32 }}>
              Все 4 модуля задеплоены и работают в реальном времени. Попробуйте прямо сейчас.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/dashboard" style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: 'linear-gradient(135deg, #3B82F6, #7C3AED)',
                color: '#fff', padding: '14px 32px', borderRadius: 12,
                fontSize: 16, fontWeight: 700, textDecoration: 'none',
                boxShadow: '0 4px 24px rgba(59,130,246,0.4)',
              }}>
                Открыть дашборд <ArrowRight size={16} />
              </Link>
            </div>
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
          AIS Hack 3.0 · EdTech & AI Management · Начальная школа образовательного комплекса «Aqbobek»
        </p>
      </footer>
    </div>
  )
}
