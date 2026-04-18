'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  AlertTriangle,
  CalendarDays,
  BookOpen,
  MessageCircle,
  UserCircle,
  Bot,
  Sparkles,
  QrCode,
} from 'lucide-react'

const nav = [
  { href: '/dashboard',   label: 'Дашборд',       icon: LayoutDashboard },
  { href: '/attendance',  label: 'Посещаемость',   icon: Users           },
  { href: '/incidents',   label: 'Инциденты',      icon: AlertTriangle   },
  { href: '/schedule',    label: 'Расписание',     icon: CalendarDays    },
  { href: '/rag',         label: 'Приказы и RAG',  icon: BookOpen        },
  { href: '/employees',   label: 'Сотрудники',     icon: UserCircle      },
  { href: '/whatsapp',    label: 'WhatsApp',       icon: QrCode          },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
            <path d="M6 12v5c3 3 9 3 12 0v-5"/>
          </svg>
        </div>
        <div>
          <div className="sidebar-logo-text">Aqbobek AI</div>
          <div className="sidebar-logo-sub">Director Platform</div>
        </div>
      </div>

      {/* Director info */}
      <div className="sidebar-user">
        <div className="sidebar-user-role">Директор</div>
        <div className="sidebar-user-name">Айгуль Сейткали</div>
        <div className="sidebar-user-status">
          <span className="live-dot" />
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>В сети</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        <div className="sidebar-nav-label">Навигация</div>
        {nav.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-nav-item${isActive ? ' active' : ''}`}
            >
              <Icon size={16} strokeWidth={isActive ? 2.5 : 2} style={{ flexShrink: 0 }} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* AI badge */}
      <div style={{ margin: '0 14px 14px', padding: '10px 14px', background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sparkles size={14} color="#A78BFA" />
          <span style={{ fontSize: 12, fontWeight: 700, color: '#A78BFA' }}>AI powered</span>
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 4, lineHeight: 1.4 }}>
          Llama 3.3-70b · Gemma 3n · FAISS RAG
        </div>
      </div>

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="sidebar-footer-text">Начальная школа «Aqbobek»</div>
        <div className="sidebar-footer-text" style={{ marginTop: 2 }}>AIS Hack 3.0 · EdTech & AI</div>
      </div>
    </aside>
  )
}
