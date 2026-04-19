'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  AlertTriangle,
  CalendarDays,
  BookOpen,
  UserCircle,
  Sparkles,
} from 'lucide-react'

const nav = [
  { href: '/dashboard',   label: 'Дашборд',       icon: LayoutDashboard },
  { href: '/attendance',  label: 'Посещаемость',   icon: Users           },
  { href: '/incidents',   label: 'Инциденты',      icon: AlertTriangle   },
  { href: '/schedule',    label: 'Расписание',     icon: CalendarDays    },
  { href: '/rag',         label: 'Приказы и RAG',  icon: BookOpen        },
  { href: '/employees',   label: 'Сотрудники',     icon: UserCircle      },
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



      {/* Footer */}
      <div className="sidebar-footer">
        <div className="sidebar-footer-text">Начальная школа «Aqbobek»</div>
        <div className="sidebar-footer-text" style={{ marginTop: 2 }}>AIS Hack 3.0 · EdTech & AI</div>
      </div>
    </aside>
  )
}
