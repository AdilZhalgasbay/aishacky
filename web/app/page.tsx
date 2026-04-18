'use client'
import Link from 'next/link'
import { memo, useState } from 'react'
import { Bot, Mic, ArrowRight, CheckCircle2, Shield, ChevronDown, Cpu, Database, Brain, FileText, Play } from 'lucide-react'

const STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Figtree:wght@300;400;500;600;700;800;900&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
html{scroll-behavior:smooth;}
body{font-family:'Figtree',sans-serif;background:#08091A;color:#CBD5E1;overflow-x:hidden;}
::selection{background:#6366F1;color:#fff;}

.nav{position:fixed;top:0;left:0;right:0;z-index:100;height:64px;display:flex;align-items:center;justify-content:space-between;padding:0 6vw;background:rgba(8,9,26,0.85);backdrop-filter:blur(20px);border-bottom:1px solid rgba(255,255,255,0.06);}
.nav-logo{display:flex;align-items:center;gap:10px;text-decoration:none;}
.nav-logo-box{width:32px;height:32px;border-radius:9px;background:linear-gradient(135deg,#6366F1,#8B5CF6);display:flex;align-items:center;justify-content:center;}
.nav-logo-text{font-size:15px;font-weight:800;color:#F8FAFC;letter-spacing:-0.02em;}
.nav-links{display:flex;gap:32px;}
.nav-link{font-size:14px;font-weight:500;color:#64748B;text-decoration:none;transition:color .2s;}
.nav-link:hover{color:#F1F5F9;}
.nav-cta{display:flex;align-items:center;gap:6px;background:#6366F1;color:#fff;border-radius:8px;padding:9px 20px;font-size:13px;font-weight:700;text-decoration:none;transition:background .2s,box-shadow .2s;}
.nav-cta:hover{background:#4F46E5;box-shadow:0 0 24px rgba(99,102,241,.5);}

.hero{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:120px 6vw 80px;position:relative;overflow:hidden;}
.hero-glow{position:absolute;top:10%;left:50%;transform:translateX(-50%);width:900px;height:500px;background:radial-gradient(ellipse at center,rgba(99,102,241,.18) 0%,transparent 65%);pointer-events:none;}
.hero-badge{display:inline-flex;align-items:center;gap:8px;background:rgba(99,102,241,.1);border:1px solid rgba(99,102,241,.3);border-radius:999px;padding:6px 16px;font-size:12px;font-weight:700;color:#A5B4FC;letter-spacing:.06em;text-transform:uppercase;margin-bottom:28px;}
.hero-h1{font-size:clamp(42px,7vw,80px);font-weight:900;color:#F8FAFC;line-height:1.05;letter-spacing:-.04em;margin-bottom:22px;}
.hero-h1 span{background:linear-gradient(135deg,#6366F1,#A78BFA,#06B6D4);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
.hero-sub{font-size:clamp(15px,2vw,19px);color:#64748B;line-height:1.75;max-width:560px;margin:0 auto 44px;}
.hero-btns{display:flex;gap:14px;justify-content:center;flex-wrap:wrap;}
.btn-primary{display:flex;align-items:center;gap:8px;background:linear-gradient(135deg,#6366F1,#8B5CF6);color:#fff;border-radius:10px;padding:15px 32px;font-size:15px;font-weight:700;text-decoration:none;box-shadow:0 0 40px rgba(99,102,241,.4);transition:transform .2s,box-shadow .2s;}
.btn-primary:hover{transform:translateY(-2px);box-shadow:0 0 60px rgba(99,102,241,.6);}
.btn-ghost{display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:#CBD5E1;border-radius:10px;padding:15px 32px;font-size:15px;font-weight:600;text-decoration:none;transition:border-color .2s,background .2s;}
.btn-ghost:hover{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.2);}

.stats-bar{display:grid;grid-template-columns:repeat(4,1fr);border-top:1px solid rgba(255,255,255,.07);border-bottom:1px solid rgba(255,255,255,.07);}
.stat{display:flex;flex-direction:column;align-items:center;padding:36px 20px;border-right:1px solid rgba(255,255,255,.07);}
.stat-val{font-size:38px;font-weight:900;color:#F1F5F9;letter-spacing:-.04em;margin-bottom:4px;}
.stat-label{font-size:13px;color:#475569;text-align:center;}

.section{padding:100px 6vw;}
.section-alt{background:rgba(255,255,255,.015);}
.section-label{display:inline-flex;align-items:center;gap:7px;background:rgba(99,102,241,.08);border:1px solid rgba(99,102,241,.2);border-radius:999px;padding:5px 14px;font-size:11.5px;font-weight:700;color:#818CF8;letter-spacing:.07em;text-transform:uppercase;margin-bottom:16px;}
.section-title{font-size:clamp(28px,4vw,46px);font-weight:900;color:#F1F5F9;letter-spacing:-.03em;line-height:1.1;margin-bottom:12px;}
.section-sub{font-size:15px;color:#64748B;line-height:1.7;}

.feature-row{display:grid;grid-template-columns:1fr 1fr;gap:80px;align-items:center;max-width:1140px;margin:0 auto;}
.feature-row.reverse{direction:rtl;}
.feature-row.reverse > *{direction:ltr;}
.feature-text{display:flex;flex-direction:column;gap:4px;}
.feature-num{font-size:11px;font-weight:800;color:#6366F1;letter-spacing:.15em;text-transform:uppercase;margin-bottom:8px;}
.feature-h{font-size:clamp(22px,3vw,34px);font-weight:900;color:#F1F5F9;letter-spacing:-.03em;line-height:1.15;margin-bottom:12px;}
.feature-p{font-size:15px;color:#64748B;line-height:1.75;margin-bottom:20px;}
.feature-list{list-style:none;display:flex;flex-direction:column;gap:9px;}
.feature-list li{display:flex;align-items:flex-start;gap:10px;font-size:14px;color:#94A3B8;line-height:1.55;}
.feature-list li svg{flex-shrink:0;margin-top:2px;}

/* VIDEO PLACEHOLDER */
.video-border{padding:2px;border-radius:20px;background:linear-gradient(135deg,var(--c1),var(--c2),transparent 60%);}
.video-wrap{background:#0D1020;border-radius:18px;aspect-ratio:16/10;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;position:relative;overflow:hidden;}
.video-wrap::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse at center,var(--c1-alpha,rgba(99,102,241,0.06)) 0%,transparent 70%);}
.video-play{width:56px;height:56px;border-radius:50%;background:rgba(255,255,255,0.06);border:1.5px solid rgba(255,255,255,0.12);display:flex;align-items:center;justify-content:center;position:relative;z-index:1;}
.video-label{font-size:13px;font-weight:600;color:#475569;position:relative;z-index:1;text-align:center;}
.video-tag{font-size:11px;color:#334155;position:relative;z-index:1;}

@keyframes float{0%,100%{transform:translate3d(0,0,0);}50%{transform:translate3d(0,-8px,0);}}
@keyframes pulse{0%,100%{opacity:1;}50%{opacity:.4;}}

.faq-item{border-bottom:1px solid rgba(255,255,255,.07);padding:22px 0;}
.faq-q{font-size:15px;font-weight:600;color:#E2E8F0;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:16px;user-select:none;}
.faq-a{font-size:14px;color:#64748B;line-height:1.75;margin-top:12px;}

.tech-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;max-width:1140px;margin:48px auto 0;}
.tech-card{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:18px 20px;display:flex;align-items:center;gap:14px;transition:border-color .2s;}
.tech-card:hover{border-color:rgba(99,102,241,.4);}
.tech-icon{width:38px;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}

.footer{border-top:1px solid rgba(255,255,255,.07);padding:28px 6vw;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;}

@media(max-width:768px){
  .feature-row,.feature-row.reverse{grid-template-columns:1fr;direction:ltr;gap:40px;}
  .stats-bar{grid-template-columns:1fr 1fr;}
  .nav-links{display:none;}
  .tech-grid{grid-template-columns:1fr 1fr;}
}
`

/* ─── Плейсхолдер видео ─── */
function VideoPlaceholder({ label, c1, c2 }: { label: string; c1: string; c2: string }) {
  return (
    <div className="video-border" style={{ ['--c1' as string]: c1, ['--c2' as string]: c2 }}>
      <div className="video-wrap" style={{ ['--c1-alpha' as string]: c1 + '12' }}>
        <div className="video-play">
          <Play size={22} color="#64748B" fill="#64748B" style={{ marginLeft: 2 }} />
        </div>
        <span className="video-label">{label}</span>
        <span className="video-tag">Видео записано в Focusee</span>
      </div>
    </div>
  )
}

/* ─── FAQ (изолирован) ─── */
const FaqSection = memo(function FaqSection() {
  const [open, setOpen] = useState<number | null>(null)
  const items = [
    { q: 'Нужно ли устанавливать новые приложения?', a: 'Нет. Учителя и персонал продолжают использовать WhatsApp как обычно. ИИ читает сообщения групп в фоне. Директор работает через веб-дашборд.' },
    { q: 'Насколько точно работает подбор замены?', a: 'Система читает загруженный Excel-файл расписания и нагрузки напрямую. Она находит свободных педагогов на нужный урок и проверяет соответствие нормам нагрузки по Приказу МОН №130.' },
    { q: 'Какие нормативные документы загружены в систему?', a: 'Приказ МОН РК №76 (квалификационные требования), Приказ №130 (правила расписания, длительность урока, минимальная перемена), Приказ МЗ №110 (санитарные нормы СанПиН).' },
    { q: 'Безопасны ли данные учеников и сотрудников?', a: 'Все данные хранятся в собственном экземпляре Supabase школы. До NVIDIA NIM доходит только текст запроса. Данные об учениках и персонале не покидают инфраструктуру школы.' },
    { q: 'Поддерживает ли система голосовые сообщения директора?', a: 'Да. Виджет директора принимает голосовые записи. Gemma 3n транскрибирует аудио и преобразует речь в структурированные задачи с исполнителями и дедлайнами.' },
  ]
  return (
    <section id="faq" className="section">
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <div className="section-label">FAQ</div>
          <h2 className="section-title" style={{ marginTop: 12 }}>Частые вопросы</h2>
        </div>
        {items.map((f, i) => (
          <div key={i} className="faq-item">
            <div className="faq-q" onClick={() => setOpen(open === i ? null : i)} role="button">
              {f.q}
              <ChevronDown size={16} color="#475569" style={{ transform: open === i ? 'rotate(180deg)' : 'none', transition: 'transform .2s', flexShrink: 0 }} />
            </div>
            {open === i && <p className="faq-a">{f.a}</p>}
          </div>
        ))}
      </div>
    </section>
  )
})

/* ─── Данные фич ─── */
const FEATURES = [
  {
    num: '01', title: 'ИИ-роутер сообщений', reverse: false,
    subtitle: 'Сообщение в WhatsApp становится структурированными данными за 2 секунды',
    desc: 'Учителя и персонал пишут в привычной группе WhatsApp. ИИ читает каждое сообщение и автоматически определяет смысл — замена, посещаемость, инцидент, задача или нормативный вопрос.',
    bullets: ['Классификация намерений: ключевые слова + LLM', 'Обрабатывает текст и голосовые сообщения', 'Не нужны новые приложения — все работают в WhatsApp'],
    videoLabel: 'Демо: роутер сообщений', c1: '#6366F1', c2: '#06B6D4',
  },
  {
    num: '02', title: 'Голос в задачи', reverse: true,
    subtitle: 'Продиктуйте. ИИ сделает всё остальное.',
    desc: 'Директор записывает голосовое сообщение. Gemma 3n транскрибирует и разбивает его на отдельные задачи с исполнителями из базы сотрудников, дедлайнами и приоритетами.',
    bullets: ['Транскрипция аудио через Gemma 3n', 'Извлекает несколько задач из одного сообщения', 'Автоматические уведомления исполнителям в WhatsApp'],
    videoLabel: 'Демо: голос → задача', c1: '#8B5CF6', c2: '#EC4899',
  },
  {
    num: '03', title: 'Умная замена', reverse: false,
    subtitle: 'Отсутствующий учитель заменён менее чем за 5 секунд',
    desc: 'Система сопоставляет расписание в реальном времени с Excel-файлами нагрузки, чтобы найти оптимального заменителя. Проверяет конфликты уроков, лимиты нагрузки и автоматически уведомляет все стороны.',
    bullets: ['Проверяет Excel-расписание в реальном времени', 'Валидирует нормы нагрузки педагога', 'Одно нажатие для утверждения директором'],
    videoLabel: 'Демо: умная замена', c1: '#06B6D4', c2: '#6366F1',
  },
  {
    num: '04', title: 'Сбор посещаемости', reverse: true,
    subtitle: 'Общешкольная посещаемость из сырых сообщений WhatsApp',
    desc: 'Учителя пишут простые сообщения: «1А: 24 присутствует, 1 отсутствует». NLP-парсер извлекает числа, агрегирует итоги и обновляет счёт питания — без форм и Excel.',
    bullets: ['Парсит любой формат сообщения о посещаемости', 'Общешкольные итоги в реальном времени', 'Автоматический подсчёт порций питания'],
    videoLabel: 'Демо: сбор посещаемости', c1: '#10B981', c2: '#06B6D4',
  },
  {
    num: '05', title: 'Трекинг инцидентов', reverse: false,
    subtitle: 'Сообщите о проблеме — смотрите как она назначается',
    desc: '«Сломался проектор в 304 кабинете» — создаёт отслеживаемый тикет, назначает ответственный отдел, выставляет приоритет и отправляет уведомление в WhatsApp.',
    bullets: ['Определяет 20+ категорий инцидентов из речи', 'Автоматически назначает ответственный отдел', 'Статус отслеживается до разрешения'],
    videoLabel: 'Демо: трекинг инцидентов', c1: '#EF4444', c2: '#F59E0B',
  },
  {
    num: '06', title: 'RAG по нормативам', reverse: true,
    subtitle: 'Задайте вопрос о приказах МОН — получите ответ со ссылкой',
    desc: 'Поисковый движок по Приказам МОН РК №76, №110 и №130. Каждый ответ основан на извлечённых фрагментах документов — без галлюцинаций, с верифицируемой цитатой.',
    bullets: ['Приказы №76 (квалификации), №130 (расписание), №110 (СанПиН)', 'FAISS-индекс для семантического поиска', 'Проверка соответствия перед утверждением'],
    videoLabel: 'Демо: RAG по нормативам', c1: '#F59E0B', c2: '#EF4444',
  },
]

const TECH = [
  { name: 'Llama 3.1 Nemotron', role: 'Основная LLM', icon: Brain, color: '#6366F1' },
  { name: 'Gemma 3n', role: 'Голос / Аудио', icon: Mic, color: '#8B5CF6' },
  { name: 'FAISS + RAG', role: 'Поиск по документам', icon: FileText, color: '#10B981' },
  { name: 'NVIDIA NIM', role: 'Inference API', icon: Cpu, color: '#06B6D4' },
  { name: 'Supabase', role: 'База данных', icon: Database, color: '#F59E0B' },
  { name: 'FastAPI', role: 'Серверная часть', icon: Bot, color: '#EF4444' },
]

/* ─── СТРАНИЦА ─── */
export default function LandingPage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: STYLE }} />

      {/* Навигация */}
      <nav className="nav">
        <Link href="/" className="nav-logo">
          <div className="nav-logo-box"><Bot size={16} color="#fff" /></div>
          <span className="nav-logo-text">Aqbobek <span style={{ color: '#818CF8' }}>AI</span></span>
        </Link>
        <div className="nav-links">
          <a href="#features" className="nav-link">Возможности</a>
          <a href="#tech" className="nav-link">Технологии</a>
          <a href="#faq" className="nav-link">FAQ</a>
        </div>
        <Link href="/dashboard" className="nav-cta">
          Открыть дашборд <ArrowRight size={14} />
        </Link>
      </nav>

      {/* Герой */}
      <section className="hero">
        <div className="hero-glow" />
        <div className="hero-badge">
          <Bot size={12} /> AIS Hack 3.0 — EdTech &amp; AI Management
        </div>
        <h1 className="hero-h1">
          Ваша школа,<br /><span>управляется ИИ</span>
        </h1>
        <p className="hero-sub">
          Один ИИ-агент управляет посещаемостью, заменами, инцидентами, делегированием задач и проверкой нормативов — всё запускается из сообщения в WhatsApp.
        </p>
        <div className="hero-btns">
          <Link href="/dashboard" className="btn-primary">
            Открыть дашборд <ArrowRight size={15} />
          </Link>
          <a href="#features" className="btn-ghost">
            Как это работает
          </a>
        </div>
      </section>

      {/* Статистика */}
      <div className="stats-bar">
        {[
          { val: '400+', label: 'Учеников под наблюдением' },
          { val: '20',   label: 'Педагогов и сотрудников' },
          { val: '<3 с', label: 'Время ответа ИИ' },
          { val: '3',    label: 'Приказа МОН проиндексировано' },
        ].map(({ val, label }) => (
          <div key={label} className="stat">
            <span className="stat-val">{val}</span>
            <span className="stat-label">{label}</span>
          </div>
        ))}
      </div>

      {/* Возможности */}
      <section id="features" className="section">
        <div style={{ textAlign: 'center', marginBottom: 80 }}>
          <div className="section-label"><Bot size={12} /> Возможности</div>
          <h2 className="section-title" style={{ maxWidth: 600, margin: '12px auto 10px' }}>
            Трансформируйте управление школой с этими инструментами
          </h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 120 }}>
          {FEATURES.map(({ num, title, subtitle, desc, bullets, videoLabel, c1, c2, reverse }) => (
            <div key={num} className={`feature-row${reverse ? ' reverse' : ''}`}>
              <div className="feature-text">
                <div className="feature-num">Модуль {num}</div>
                <h3 className="feature-h">{title}</h3>
                <p style={{ fontSize: 13, color: '#6366F1', fontWeight: 600, marginBottom: 8 }}>{subtitle}</p>
                <p className="feature-p">{desc}</p>
                <ul className="feature-list">
                  {bullets.map(b => (
                    <li key={b}><CheckCircle2 size={14} color="#6366F1" />{b}</li>
                  ))}
                </ul>
              </div>
              <VideoPlaceholder label={videoLabel} c1={c1} c2={c2} />
            </div>
          ))}
        </div>
      </section>

      {/* Технологии */}
      <section id="tech" className="section section-alt" style={{ borderTop: '1px solid rgba(255,255,255,.07)' }}>
        <div style={{ maxWidth: 1140, margin: '0 auto', textAlign: 'center' }}>
          <div className="section-label"><Cpu size={12} /> ИИ-модели и стек</div>
          <h2 className="section-title" style={{ marginTop: 12, marginBottom: 10 }}>Работает на передовых моделях</h2>
          <p className="section-sub" style={{ maxWidth: 480, margin: '0 auto' }}>
            Весь инференс проходит через NVIDIA NIM API — быстро, надёжно, менее 3 секунд.
          </p>
          <div className="tech-grid">
            {TECH.map(({ name, role, icon: Icon, color }) => (
              <div key={name} className="tech-card">
                <div className="tech-icon" style={{ background: color + '18' }}>
                  <Icon size={18} color={color} />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#F1F5F9' }}>{name}</div>
                  <div style={{ fontSize: 12, color: '#475569' }}>{role}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 40, padding: '22px 28px', borderRadius: 14, background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', display: 'flex', gap: 14, alignItems: 'flex-start', textAlign: 'left' }}>
            <Shield size={20} color="#6366F1" style={{ marginTop: 2, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#C7D2FE', marginBottom: 4 }}>Архитектура на основе нормативов</div>
              <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.7 }}>
                Каждая задача и замена автоматически проверяется на соответствие Приказам МОН РК №76, №110 и №130 через RAG-пайплайн до утверждения директором.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <FaqSection />

      {/* CTA */}
      <section className="section section-alt" style={{ borderTop: '1px solid rgba(255,255,255,.07)', textAlign: 'center' }}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <div style={{ width: 60, height: 60, borderRadius: 16, background: 'linear-gradient(135deg,#6366F1,#8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', boxShadow: '0 0 40px rgba(99,102,241,.5)' }}>
            <Bot size={28} color="#fff" />
          </div>
          <h2 className="section-title">Познакомьтесь с вашим ИИ-директором</h2>
          <p className="section-sub" style={{ margin: '12px auto 36px', maxWidth: 420 }}>
            Дашборд уже работает. Откройте его, запишите голосовое сообщение и смотрите, как система делает всё остальное.
          </p>
          <Link href="/dashboard" className="btn-primary" style={{ display: 'inline-flex', justifyContent: 'center' }}>
            Открыть дашборд <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* Футер */}
      <footer className="footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 24, height: 24, borderRadius: 6, background: '#6366F1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Bot size={13} color="#fff" />
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>Aqbobek AI Director</span>
        </div>
        <span style={{ fontSize: 12, color: '#334155' }}>AIS Hack 3.0 — Трек EdTech &amp; AI Management</span>
        <div style={{ display: 'flex', gap: 20 }}>
          <a href="#features" style={{ fontSize: 12, color: '#334155', textDecoration: 'none' }}>Возможности</a>
          <a href="#tech" style={{ fontSize: 12, color: '#334155', textDecoration: 'none' }}>Технологии</a>
          <a href="#faq" style={{ fontSize: 12, color: '#334155', textDecoration: 'none' }}>FAQ</a>
        </div>
      </footer>
    </>
  )
}
