'use client'
import React from 'react'
import { 
  Bot, 
  Search, 
  ShieldAlert, 
  Mic2, 
  Zap, 
  ChevronRight,
  Database,
  LineChart,
  MessageSquare
} from 'lucide-react'

interface Agent {
  id: string
  name: string
  role: string
  description: string
  status: 'online' | 'busy' | 'offline'
  icon: React.ElementType
  color: string
  actionLabel: string
  href: string
}

const agents: Agent[] = [
  {
    id: 'director',
    name: 'Aqbobek AI Director',
    role: 'Главный ассистент',
    description: 'Управление школой, отчеты и анализ инцидентов через голос и текст.',
    status: 'online',
    icon: Bot,
    color: '#8B5CF6',
    actionLabel: 'Открыть чат',
    href: '#', // Handled by widget toggle usually
  },
  {
    id: 'attendance',
    name: 'Attendance AI',
    role: 'Аналитик посещаемости',
    description: 'Обработка отчетов учителей из WhatsApp и Telegram. Авто-сводки.',
    status: 'online',
    icon: LineChart,
    color: '#10B981',
    actionLabel: 'Просмотр отчетов',
    href: '/attendance',
  },
  {
    id: 'rag',
    name: 'Knowledge RAG',
    role: 'База знаний',
    description: 'Ответы по приказам МОН РК и внутренним документам школы.',
    status: 'online',
    icon: Database,
    color: '#F59E0B',
    actionLabel: 'Поиск в базе',
    href: '/rag',
  },
  {
    id: 'incidents',
    name: 'Security Agent',
    role: 'Защита и инциденты',
    description: 'Автоматическая классификация и маршрутизация проблемных заявок.',
    status: 'online',
    icon: ShieldAlert,
    color: '#EF4444',
    actionLabel: 'Реестр проблем',
    href: '/incidents',
  }
]

export function AIAgentHub() {
  return (
    <div className="card" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 900, margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Zap size={22} color="#8B5CF6" fill="#8B5CF633" />
            Центр управления ИИ
          </h2>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '13px' }}>
            4 специализированных агента работают параллельно
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
           <div style={{ 
             padding: '4px 12px', 
             borderRadius: '20px', 
             background: '#D1FAE5', 
             color: '#065F46', 
             fontSize: '11px', 
             fontWeight: 700,
             display: 'flex',
             alignItems: 'center',
             gap: '6px'
           }}>
             <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', display: 'block' }} />
             СИСТЕМА АКТИВНА
           </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
        {agents.map((agent) => (
          <div 
            key={agent.id}
            className="glass-card"
            style={{ 
              padding: '20px', 
              borderRadius: '16px',
              border: '1px solid var(--border)',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              cursor: 'pointer',
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              background: '#fff'
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget
              el.style.transform = 'translateY(-5px)'
              el.style.boxShadow = `0 12px 24px -8px ${agent.color}22`
              el.style.borderColor = `${agent.color}44`
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget
              el.style.transform = 'translateY(0)'
              el.style.boxShadow = 'none'
              el.style.borderColor = 'var(--border)'
            }}
          >
            {/* Background decoration */}
            <div style={{ 
              position: 'absolute', 
              top: '-20px', 
              right: '-20px', 
              width: '80px', 
              height: '80px', 
              borderRadius: '50%', 
              background: `${agent.color}08`,
              zIndex: 0
            }} />

            <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', position: 'relative', zIndex: 1 }}>
              <div style={{ 
                width: '48px', 
                height: '48px', 
                borderRadius: '12px', 
                background: `${agent.color}15`, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <agent.icon size={24} color={agent.color} />
              </div>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: 'var(--text)' }}>
                  {agent.name}
                </h3>
                <span style={{ fontSize: '11px', fontWeight: 700, color: agent.color, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                  {agent.role}
                </span>
              </div>
            </div>

            <p style={{ 
              fontSize: '13px', 
              color: 'var(--text-muted)', 
              margin: '0 0 20px', 
              lineHeight: 1.5,
              flex: 1,
              position: 'relative',
              zIndex: 1
            }}>
              {agent.description}
            </p>

            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              position: 'relative',
              zIndex: 1
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="live-dot" style={{ width: 6, height: 6, background: agent.status === 'online' ? '#10B981' : '#94A3B8' }} />
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>
                  {agent.status === 'online' ? 'Активен' : 'Ожидание'}
                </span>
              </div>
              <a 
                href={agent.href}
                style={{ 
                  fontSize: '12px', 
                  fontWeight: 700, 
                  color: agent.color, 
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                {agent.actionLabel} <ChevronRight size={14} />
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
