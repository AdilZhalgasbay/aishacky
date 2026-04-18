'use client'

interface Employee {
  id: string
  name: string
  role: string
  subject: string | null
  qualification: string | null
  telegram_id: string | null
  is_available: boolean
  phone: string | null
}

interface Props {
  employees: Employee[]
}

const ROLE_LABEL: Record<string, string> = {
  teacher: 'Учитель',
  director: 'Директор',
  zavhoz: 'Завхоз',
  secretary: 'Секретарь',
  methodist: 'Методист',
  it_specialist: 'IT-специалист',
  nurse: 'Медсестра',
  security: 'Охрана',
  canteen_manager: 'Заведующий столовой',
}

const ROLE_COLOR: Record<string, { bg: string; color: string }> = {
  director: { bg: '#dbeafe', color: '#1d4ed8' },
  teacher: { bg: '#dcfce7', color: '#15803D' },
  zavhoz: { bg: '#fef3c7', color: '#D97706' },
  methodist: { bg: '#ede9fe', color: '#7C3AED' },
  it_specialist: { bg: '#e0f2fe', color: '#0369a1' },
  nurse: { bg: '#fee2e2', color: '#DC2626' },
  security: { bg: '#f3f4f6', color: '#374151' },
  secretary: { bg: '#F1F5F9', color: '#475569' },
  canteen_manager: { bg: '#fef3c7', color: '#D97706' },
}

export default function EmployeesClient({ employees }: Props) {
  const grouped: Record<string, Employee[]> = {}
  for (const emp of employees) {
    if (!grouped[emp.role]) grouped[emp.role] = []
    grouped[emp.role].push(emp)
  }

  const roleOrder = ['director', 'methodist', 'teacher', 'zavhoz', 'it_specialist', 'secretary', 'nurse', 'security', 'canteen_manager']

  return (
    <div className="animate-fadein">
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 className="page-title">Сотрудники</h1>
            <p className="page-subtitle">{employees.length} человек в коллективе</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ padding: '6px 14px', background: '#dcfce7', borderRadius: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#15803D' }}>
                {employees.filter(e => e.is_available).length} присутствуют
              </span>
            </div>
            <div style={{ padding: '6px 14px', background: '#fee2e2', borderRadius: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#DC2626' }}>
                {employees.filter(e => !e.is_available).length} отсутствуют
              </span>
            </div>
          </div>
        </div>
      </div>

      {roleOrder.filter(r => grouped[r]?.length > 0).map(role => (
        <div key={role} style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <span style={{
              ...ROLE_COLOR[role],
              padding: '4px 12px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 700,
            }}>
              {ROLE_LABEL[role] || role}
            </span>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{grouped[role].length} чел.</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
            {grouped[role].map(emp => (
              <div key={emp.id} className="card" style={{ display: 'flex', gap: 14, padding: '14px 16px' }}>
                <div style={{
                  width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                  background: ROLE_COLOR[emp.role]?.bg || '#F1F5F9',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, fontWeight: 800,
                  color: ROLE_COLOR[emp.role]?.color || '#475569',
                }}>
                  {emp.name.charAt(0)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 2 }}>{emp.name}</div>
                  {emp.subject && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{emp.subject}</div>}
                  {emp.qualification && (
                    <div style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 600, marginTop: 2 }}>
                      {emp.qualification}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                    {emp.telegram_id && (
                      <span style={{ fontSize: 11, color: '#2563EB', fontWeight: 600 }}>{emp.telegram_id}</span>
                    )}
                    <span style={{
                      fontSize: 11, fontWeight: 700,
                      color: emp.is_available ? '#16A34A' : '#DC2626',
                      background: emp.is_available ? '#dcfce7' : '#fee2e2',
                      padding: '2px 8px', borderRadius: 12,
                    }}>
                      {emp.is_available ? 'Присутствует' : 'Отсутствует'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
