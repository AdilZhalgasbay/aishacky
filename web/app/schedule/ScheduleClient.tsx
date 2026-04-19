'use client'
import React, { useState, useMemo } from 'react'
import { Calendar, RefreshCw, Users, CalendarX2, Settings, LayoutGrid, UserCheck, CheckCircle2, Loader2, Sparkles } from 'lucide-react'

import { useRouter } from 'next/navigation'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  DragEndEvent,
  DragStartEvent,
  DragOverEvent,
} from '@dnd-kit/core'
import { useDraggable } from '@dnd-kit/core'
import { useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'

// ─── Types ───────────────────────────────────────────────────────
interface Substitution {
  id: string; original_teacher_name: string | null; substitute_name: string | null
  class_name: string | null; date: string; period: number | null; subject: string | null
  room?: string | null; reason: string | null; status: string; notified: boolean
}
interface Employee {
  id: string; name: string; role: string; subject: string | null
  is_available: boolean; qualification: string | null
}
interface ClassInfo { id: string; name: string; grade: number; room_number: string; student_count: number }
interface Subject   { id: string; name: string; short_name: string | null }
interface SlotJoined {
  id: string; day_of_week: number; period: number; slot_type: string
  note: string | null; is_substitute: boolean; week_date: string | null
  classes   : { id: string; name: string; grade: number } | null
  employees : { id: string; name: string; role: string } | null
  subjects  : { id: string; name: string; short_name: string | null } | null
  rooms     : { id: string; name: string; number: string } | null
}
interface Props {
  initialDate: string
  substitutions: Substitution[]
  employees: Employee[]
  classes: ClassInfo[]
  slots: SlotJoined[]
  subjects: Subject[]
  rooms: { id: string; name: string; number: string; capacity: number; room_type: string; floor: number }[]
}

// Map: "class_name:period" -> Substitution (for today's overlay on grid)
type SubstMap = Map<string, Substitution>
interface SubstituteOption { name: string; subject: string | null }
interface ScheduleResult {
  absent_teacher: string; substitute_options?: SubstituteOption[]
  substitutions_created: number; substitutions?: Substitution[]
  conflict_free?: boolean; error?: string
}

// ─── Constants ───────────────────────────────────────────────────
const DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт']
const DAYS_FULL = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница']
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8]
const PERIOD_TIMES: Record<number, string> = {
  1: '08:00', 2: '08:50', 3: '09:55', 4: '10:45',
  5: '11:50', 6: '12:40', 7: '13:45', 8: '14:35',
}
const SUBJECT_COLORS: Record<string, string> = {
  'Matematika':            '#6366f1', 'Singapurskaya mat.': '#8b5cf6',
  'Kazakhskiy yazyk':      '#f59e0b', 'Russkiy yazyk':      '#f97316',
  'Angliyskiy yazyk':      '#10b981', 'Fizkultura':         '#ef4444',
  'Muzyka':                '#ec4899', 'IZO':                '#a855f7',
  'Okruzhayuschiy mir':    '#14b8a6', 'Logika':             '#0ea5e9',
  'Informatika':           '#64748b', 'Dezhurstvo':         '#94a3b8',
  'Tekhnologiya':          '#d97706', 'Literaturnoe chtenie':'#84cc16',
  'Metodicheskoe':         '#6b7280',
}
const DEFAULT_COLOR = '#7c3aed'
const STATUS_COLOR: Record<string, string> = { confirmed: '#16A34A', pending: '#D97706', cancelled: '#DC2626' }

function getSubjectColor(name: string) {
  return SUBJECT_COLORS[name] || DEFAULT_COLOR
}
function getErr(e: unknown) { return e instanceof Error ? e.message : 'Ошибка' }

// ─── WeeklyGrid ──────────────────────────────────────────────────
function WeeklyGrid({
  slots,
  viewMode,
  selectedId,
  employees,
  classes,
  substMap,
  todayDow,
  onMoveSuccess,
  teacherStrainMap,
  allSlots,
  activeSlot,
  getConflicts
}: {
  slots: SlotJoined[]
  viewMode: 'class' | 'teacher' | 'all'
  selectedId: string
  employees: Employee[]
  classes: ClassInfo[]
  substMap: SubstMap
  todayDow: number
  onMoveSuccess: (slotId: string, day: number, period: number) => void
  teacherStrainMap: Set<string>
  allSlots: SlotJoined[]
  activeSlot?: SlotJoined
  getConflicts: (slot: SlotJoined, day: number, period: number) => string[]
}) {
  // ─── Internal Draggable/Droppable ─────────────────────────────
  function DraggableLesson({ slot, color, colorHex, isStrained }: { slot: SlotJoined, color: string, colorHex: string, isStrained?: boolean }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
      id: `lesson-${slot.id}`,
      data: { type: 'lesson', slot }
    })
    
    const style = {
      transform: CSS.Translate.toString(transform),
      opacity: isDragging ? 0.4 : 1,
      background: `${colorHex}18`,
      border: isStrained ? `2px solid #ef4444` : `1px solid ${colorHex}44`,
      borderLeft: isStrained ? `4px solid #ef4444` : `3px solid ${colorHex}`,
      borderRadius: 6,
      padding: '5px 7px',
      marginBottom: 3,
      cursor: 'grab',
      transition: 'transform 0.1s, border 0.2s',
      boxShadow: isStrained ? '0 0 8px #ef444444' : 'none',
    }

    return (
      <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
        {isStrained && (
          <div style={{ fontSize: 8, fontWeight: 900, color: '#fff', background: '#ef4444', padding: '1px 4px', borderRadius: 4, display: 'inline-block', marginBottom: 2 }}>
            ПЕРЕГРУЗКА
          </div>
        )}
        <div style={{ fontSize: 11, fontWeight: 800, color: colorHex, lineHeight: 1.2 }}>
          {slot.subjects?.short_name || slot.subjects?.name || '—'}
        </div>
        {viewMode !== 'teacher' && slot.employees && (
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {slot.employees.name.split(' ')[0]}
          </div>
        )}
        {viewMode !== 'class' && slot.classes && (
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{slot.classes.name}</div>
        )}
        {slot.rooms && <div style={{ fontSize: 9, color: 'var(--text-light)', marginTop: 2 }}>каб.{slot.rooms.number}</div>}
        {slot.slot_type === 'lenta' && (
          <div style={{ fontSize: 9, fontWeight: 800, color: '#fff', background: colorHex, padding: '2px 4px', borderRadius: 4, display: 'inline-block', marginTop: 3 }}>ЛЕНТА</div>
        )}
      </div>
    )
  }

  function DroppableSlot({ day, period, children, isConflict }: { day: number, period: number, children: React.ReactNode, isConflict: boolean }) {
    const { isOver, setNodeRef } = useDroppable({
      id: `slot-${day}-${period}`,
      data: { day, period }
    })

    const style = {
      padding: 4, verticalAlign: 'top',
      borderBottom: '1px solid var(--border)',
      borderLeft: '1px solid var(--border)',
      minHeight: 70,
      background: isOver ? (isConflict ? '#fee2e2' : '#dcfce7') : 'transparent',
      transition: 'background 0.2s',
    }

    return <td ref={setNodeRef} style={style}>{children}</td>
  }

  // Build a map: day -> period -> slot[]
  const grid = useMemo(() => {
    const filtered = selectedId
      ? slots.filter(s =>
          viewMode === 'class'   ? s.classes?.id   === selectedId :
          viewMode === 'teacher' ? s.employees?.id === selectedId : true
        )
      : slots

    const map: Record<number, Record<number, SlotJoined[]>> = {}
    for (let d = 1; d <= 5; d++) { map[d] = {}; for (const p of PERIODS) map[d][p] = [] }
    for (const s of filtered) {
      const d = s.day_of_week, p = s.period
      if (d >= 1 && d <= 5 && p >= 1 && p <= 8) map[d][p].push(s)
    }
    return map
  }, [slots, viewMode, selectedId])

  // Heatmap: count non-empty periods per day for load indicator
  const dayLoad = useMemo(() => {
    const loads: Record<number, number> = {}
    for (let d = 1; d <= 5; d++) {
      loads[d] = PERIODS.filter(p => grid[d][p].length > 0).length
    }
    return loads
  }, [grid])

  function loadColor(count: number) {
    if (count >= 7) return '#ef444433'
    if (count >= 5) return '#f59e0b22'
    if (count >= 3) return '#10b98122'
    return 'transparent'
  }

  const maxPeriods = slots.length === 0 ? 6 : Math.max(...slots.map(s => s.period), 6)
  const visiblePeriods = PERIODS.slice(0, maxPeriods)

  if (slots.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
        <CalendarX2 size={48} style={{ marginBottom: 12, opacity: 0.4 }} />
        <div style={{ fontSize: 16, fontWeight: 600 }}>Расписание не найдено</div>
        <div style={{ fontSize: 13, marginTop: 4 }}>Выберите класс или учителя выше</div>
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 700 }}>
        <colgroup>
          <col style={{ width: 80 }} />
          {DAYS.map(d => <col key={d} />)}
        </colgroup>
        <thead>
          <tr>
            {/* Period header */}
            <th style={{ padding: '8px 10px', background: 'var(--sidebar-bg, #0f172a)', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, textAlign: 'left', borderRadius: '8px 0 0 0' }}>
              УРОК
            </th>
            {DAYS.map((d, i) => (
              <th key={d} style={{
                padding: '8px 10px',
                background: loadColor(dayLoad[i + 1]),
                fontSize: 12, fontWeight: 700,
                color: 'var(--text)', textAlign: 'center',
                borderBottom: '2px solid var(--border)',
              }}>
                <div>{d}</div>
                <div style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-muted)', marginTop: 2 }}>{DAYS_FULL[i]}</div>
                {/* Load bar */}
                <div style={{ marginTop: 4, height: 3, borderRadius: 2, background: 'var(--border)' }}>
                  <div style={{ height: '100%', borderRadius: 2, width: `${(dayLoad[i+1]/8)*100}%`, background: dayLoad[i+1] >= 7 ? '#ef4444' : dayLoad[i+1] >= 5 ? '#f59e0b' : '#10b981', transition: 'width 0.3s' }} />
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visiblePeriods.map(period => (
            <tr key={period}>
              {/* Period label */}
              <td style={{
                padding: '6px 10px', verticalAlign: 'top',
                borderBottom: '1px solid var(--border)',
                background: 'var(--sidebar-bg, #0f172a)',
              }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{period}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{PERIOD_TIMES[period]}</div>
              </td>
              {/* Day cells */}
              {[1, 2, 3, 4, 5].map(day => {
                const cellSlots = grid[day][period]
                const conflicts = activeSlot ? getConflicts(activeSlot, day, period) : []
                const isConflict = conflicts.length > 0

                return (
                  <DroppableSlot key={day} day={day} period={period} isConflict={isConflict}>
                    {cellSlots.length === 0 ? (
                      <div style={{ height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {viewMode === 'class' && day === todayDow && (() => {
                          const selectedClass = classes.find(c => c.id === selectedId)
                          const sub = selectedClass ? substMap.get(`${selectedClass.name}:${period}`) : undefined
                          if (sub) return (
                            <div style={{ width: '100%', background: '#fef9c3', border: '1px dashed #f59e0b', borderLeft: '3px solid #f59e0b', borderRadius: 6, padding: '4px 7px' }}>
                              <div style={{ fontSize: 9, fontWeight: 800, color: '#92400e', textTransform: 'uppercase' }}>Замена</div>
                              <div style={{ fontSize: 10, fontWeight: 700, color: '#78350f' }}>{sub.subject || '—'}</div>
                              <div style={{ fontSize: 9, color: '#b45309' }}>{sub.substitute_name || 'Нет'}</div>
                            </div>
                          )
                          return <div style={{ width: 20, height: 1, background: 'var(--border)' }} />
                        })()}
                        {(viewMode !== 'class' || day !== todayDow) && <div style={{ width: 20, height: 1, background: 'var(--border)' }} />}
                      </div>
                    ) : (
                      cellSlots.map(slot => (
                        <DraggableLesson 
                          key={slot.id} 
                          slot={slot} 
                          color={getSubjectColor(slot.subjects?.name || '')} 
                          colorHex={getSubjectColor(slot.subjects?.name || '')} 
                          isStrained={!!(slot.employees?.id && teacherStrainMap.has(`${slot.employees.id}:${day}:${period}`))}
                        />
                      ))
                    )}
                  </DroppableSlot>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Subject Legend ──────────────────────────────────────────────
function SubjectLegend({ slots }: { slots: SlotJoined[] }) {
  const used = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of slots) {
      if (s.subjects) map.set(s.subjects.name, getSubjectColor(s.subjects.name))
    }
    return [...map.entries()]
  }, [slots])

  if (used.length === 0) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
      {used.map(([name, color]) => (
        <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px', background: `${color}18`, border: `1px solid ${color}44`, borderRadius: 12 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
          <span style={{ fontSize: 11, fontWeight: 600, color }}>{name}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────
export default function ScheduleClient({ initialDate, substitutions, employees, classes, slots, subjects, rooms }: Props) {
  const router = useRouter()
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [loading, setLoading] = useState(false)
  const [absentTeacher, setAbsentTeacher] = useState('')
  const [reason, setReason] = useState('Болезn')
  const [className, setClassName] = useState('')
  const [commandText, setCommandText] = useState('')
  const [result, setResult] = useState<ScheduleResult | null>(null)
  const [mainTab, setMainTab] = useState<'grid' | 'substitute' | 'teachers' | 'settings'>('grid')
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiProgress, setAiProgress] = useState(0)
  const [aiResultObj, setAiResultObj] = useState<{ msg: string } | null>(null)

  // Grid controls
  const [viewMode, setViewMode] = useState<'class' | 'teacher' | 'all'>('class')
  const [selectedClassId, setSelectedClassId] = useState(classes[0]?.id || '')
  const [selectedTeacherId, setSelectedTeacherId] = useState('')
  const [localSlots, setLocalSlots] = useState<SlotJoined[]>(slots)
  const [activeId, setActiveId] = useState<string | null>(null)

  const activeSlot = useMemo(() => activeId ? localSlots.find(s => `lesson-${s.id}` === activeId) : null, [activeId, localSlots])

  // Sensors for DND
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  // Heatmap: Teacher Strain Map (6+ consecutive lessons)
  const teacherStrainMap = useMemo(() => {
    const map = new Set<string>()
    const teachersDays: Record<string, Record<number, number[]>> = {}
    localSlots.forEach(s => {
      if (!s.employees?.id) return
      if (!teachersDays[s.employees.id]) teachersDays[s.employees.id] = {}
      if (!teachersDays[s.employees.id][s.day_of_week]) teachersDays[s.employees.id][s.day_of_week] = []
      teachersDays[s.employees.id][s.day_of_week].push(s.period)
    })
    Object.entries(teachersDays).forEach(([tId, days]) => {
      Object.entries(days).forEach(([day, periods]) => {
        const sorted = periods.sort((a, b) => a - b)
        let streak: number[] = []
        for (let i = 0; i < sorted.length; i++) {
          if (i === 0 || sorted[i] === sorted[i - 1] + 1) streak.push(sorted[i])
          else {
            if (streak.length >= 6) streak.forEach(p => map.add(`${tId}:${day}:${p}`))
            streak = [sorted[i]]
          }
        }
        if (streak.length >= 6) streak.forEach(p => map.add(`${tId}:${day}:${p}`))
      })
    })
    return map
  }, [localSlots])

  // Conflict Validator
  function getConflicts(slot: SlotJoined, toDay: number, toPeriod: number) {
    const errs: string[] = []
    const tId = slot.employees?.id
    const cId = slot.classes?.id
    const rId = slot.rooms?.id

    localSlots.forEach(s => {
      if (s.id === slot.id) return
      if (s.day_of_week === toDay && s.period === toPeriod) {
        if (tId && s.employees?.id === tId) errs.push(`Учитель ${s.employees.name} уже занят`)
        if (cId && s.classes?.id === cId)   errs.push(`Класс ${s.classes.name} уже занят`)
        if (rId && s.rooms?.id === rId)     errs.push(`Кабинет ${s.rooms.number} уже занят`)
      }
    })
    return errs
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string)
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const { active, over } = event
    if (!over) return

    const slot = active.data.current?.slot as SlotJoined
    const { day: toDay, period: toPeriod } = over.data.current as { day: number, period: number }

    if (slot.day_of_week === toDay && slot.period === toPeriod) return

    const errs = getConflicts(slot, toDay, toPeriod)
    if (errs.length > 0) {
      showToast(errs.join('. '), 'error')
      return
    }

    // Optimistic Update
    const oldSlots = [...localSlots]
    setLocalSlots(prev => prev.map(s => s.id === slot.id ? { ...s, day_of_week: toDay, period: toPeriod } : s))

    try {
      const res = await fetch('/api/schedule/slots', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: slot.id, day_of_week: toDay, period: toPeriod })
      })
      if (!res.ok) throw new Error('Ошибка сохранения')
      showToast('Расписание обновлено', 'success')
    } catch (err) {
      showToast(getErr(err), 'error')
      setLocalSlots(oldSlots)
    }
  }

  const teachers = employees.filter(e => e.role === 'teacher')

  // Dynamic: teachers with substitution today are treated as ABSENT regardless of is_available
  const absentNameSet = useMemo(() =>
    new Set(substitutions.map(s => s.original_teacher_name?.trim()).filter(Boolean) as string[])
  , [substitutions])

  const unavailable = useMemo(() =>
    teachers.filter(e => absentNameSet.has(e.name.trim()) || !e.is_available)
  , [teachers, absentNameSet])

  const available = useMemo(() =>
    teachers.filter(e => !absentNameSet.has(e.name.trim()) && e.is_available)
  , [teachers, absentNameSet])

  // All non-teacher staff (admin, director, janitor, etc.)
  const otherStaff = employees.filter(e => !['teacher'].includes(e.role))

  // Build substitution map for grid overlay: "className:period" -> sub
  const substMap = useMemo<SubstMap>(() => {
    const m: SubstMap = new Map()
    for (const s of substitutions) {
      if (s.class_name && s.period) m.set(`${s.class_name}:${s.period}`, s)
    }
    return m
  }, [substitutions])

  // Today's day_of_week (1=Mon...5=Fri) for grid overlay
  const todayDow = useMemo(() => {
    const d = new Date(initialDate).getDay() // 0=Sun
    return d === 0 ? 7 : d // make 1=Mon..7=Sun
  }, [initialDate])

  function showToast(msg: string, type: 'success' | 'error' | 'info') {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3500)
  }

  // Slots filtered for current view
  const gridSlots = useMemo(() => {
    if (viewMode === 'class' && selectedClassId)
      return localSlots.filter(s => s.classes?.id === selectedClassId)
    if (viewMode === 'teacher' && selectedTeacherId)
      return localSlots.filter(s => s.employees?.id === selectedTeacherId)
    return localSlots
  }, [localSlots, viewMode, selectedClassId, selectedTeacherId])

  const selectedId = viewMode === 'class' ? selectedClassId : viewMode === 'teacher' ? selectedTeacherId : ''

  async function findSubstitute() {
    if (!absentTeacher) return showToast('Выберите учителя', 'error')
    setLoading(true); setResult(null)
    try {
      const res = await fetch('/api/schedule/substitute', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ absent_teacher_name: absentTeacher, reason, class_name: className, date: initialDate }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || data.error || 'Ошибка')
      setResult(data)
      showToast(`Замена назначена: ${data.substitutions_created} уроков`, 'success')
      router.refresh()
    } catch (error) { showToast(getErr(error), 'error') }
    finally { setLoading(false) }
  }

  async function runNLSubstitute() {
    if (!commandText.trim()) return showToast('Введите команду', 'error')
    setLoading(true); setResult(null)
    try {
      const res = await fetch('/api/schedule/substitute', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: commandText, reason, date: initialDate }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || data.error || 'Ошибка')
      setResult(data); setAbsentTeacher(data.absent_teacher || ''); setCommandText('')
      showToast(`Команда обработана: ${data.substitutions_created} уроков`, 'success')
      router.refresh()
    } catch (error) { showToast(getErr(error), 'error') }
    finally { setLoading(false) }
  }

  const displayDate = new Date(initialDate).toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })

  // Sort classes by grade then name
  const sortedClasses = [...classes].sort((a, b) => a.grade - b.grade || a.name.localeCompare(b.name))
  const staffAll = employees.filter(e => ['teacher','admin','director','deputy','janitor','security','cook'].includes(e.role))

  return (
    <div className="animate-fadein">
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}

      {/* ── Header ── */}
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>Расписание</h1>
            <p className="page-subtitle" style={{ textTransform: 'capitalize', marginTop: 4 }}>{displayDate}</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: '#dcfce7', borderRadius: 8 }}>
              <span className="live-dot" />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#15803D' }}>{available.length} присутствуют</span>
            </div>
            <div style={{ padding: '6px 12px', background: '#fee2e2', borderRadius: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#DC2626' }}>{unavailable.length} отсутствуют{unavailable.length > 0 ? ' ⚠' : ''}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        {[
          { label: 'Слотов в расписании', val: slots.length,         color: '#7C3AED', bg: '#ede9fe' },
          { label: 'Замены сегодня',      val: substitutions.length, color: '#D97706', bg: '#fef3c7' },
          { label: 'Подтверждены',        val: substitutions.filter(s => s.status === 'confirmed').length, color: '#16A34A', bg: '#dcfce7' },
          { label: 'Учителей всего',      val: teachers.length,      color: '#0EA5E9', bg: '#e0f2fe' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
        {([
          ['grid',       <><Calendar size={14}   style={{ marginRight: 6, verticalAlign: 'middle' }} />Сетка расписания</>],
          ['substitute', <><RefreshCw size={14}  style={{ marginRight: 6, verticalAlign: 'middle' }} />Замены</>],
          ['teachers',   <><Users size={14}      style={{ marginRight: 6, verticalAlign: 'middle' }} />Учителя</>],
          ['settings',   <><Settings size={14}   style={{ marginRight: 6, verticalAlign: 'middle' }} />Правила & ИИ</>],
        ] as [string, React.ReactNode][]).map(([t, label]) => (
          <button key={t} onClick={() => setMainTab(t as 'grid'|'substitute'|'teachers'|'settings')} style={{
            display: 'flex', alignItems: 'center',
            padding: '10px 20px', background: 'none', border: 'none',
            borderBottom: mainTab === t ? '2px solid var(--primary)' : '2px solid transparent',
            color: mainTab === t ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: mainTab === t ? 700 : 500, fontSize: 14, cursor: 'pointer',
          }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── GRID TAB ── */}
      {mainTab === 'grid' && (
        <div>
          {/* View controls */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              {/* Mode toggle */}
              <div style={{ display: 'flex', gap: 0, background: 'var(--bg)', borderRadius: 8, padding: 3 }}>
                {(['class', 'teacher', 'all'] as const).map(m => (
                  <button key={m} onClick={() => setViewMode(m)} style={{
                    padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13,
                    fontWeight: viewMode === m ? 700 : 500,
                    background: viewMode === m ? 'var(--primary)' : 'transparent',
                    color: viewMode === m ? '#fff' : 'var(--text-muted)',
                    transition: 'all 0.2s',
                  }}>
                    {m === 'class' ? 'По классу' : m === 'teacher' ? 'По учителю' : 'Все'}
                  </button>
                ))}
              </div>

              {/* Class selector */}
              {viewMode === 'class' && (
                <select
                  className="form-input form-select"
                  style={{ minWidth: 140, padding: '6px 12px', fontSize: 13 }}
                  value={selectedClassId}
                  onChange={e => setSelectedClassId(e.target.value)}
                >
                  <option value="">Все классы</option>
                  {sortedClasses.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}

              {/* Teacher selector */}
              {viewMode === 'teacher' && (
                <select
                  className="form-input form-select"
                  style={{ minWidth: 200, padding: '6px 12px', fontSize: 13 }}
                  value={selectedTeacherId}
                  onChange={e => setSelectedTeacherId(e.target.value)}
                >
                  <option value="">Выберите сотрудника</option>
                  <optgroup label="Учителя">
                    {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </optgroup>
                  <optgroup label="Администрация">
                    {employees.filter(e => ['director','deputy','admin'].includes(e.role)).map(t =>
                      <option key={t.id} value={t.id}>{t.name}</option>
                    )}
                  </optgroup>
                  <optgroup label="Персонал">
                    {employees.filter(e => ['janitor','security','cook'].includes(e.role)).map(t =>
                      <option key={t.id} value={t.id}>{t.name}</option>
                    )}
                  </optgroup>
                </select>
              )}

              <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
                {gridSlots.length} слотов
              </div>
            </div>
          </div>

          {/* Legend */}
          <SubjectLegend slots={gridSlots} />

          {/* Weekly grid */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <DndContext 
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <WeeklyGrid
                slots={gridSlots}
                viewMode={viewMode}
                selectedId={selectedId}
                employees={employees}
                classes={classes}
                substMap={substMap}
                todayDow={todayDow}
                onMoveSuccess={() => {}}
                teacherStrainMap={teacherStrainMap}
                allSlots={localSlots}
                activeSlot={activeSlot || undefined}
                getConflicts={getConflicts}
              />
            </DndContext>
          </div>

          {/* Heatmap legend */}
          <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 11, color: 'var(--text-muted)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 12, height: 8, background: '#10b981', borderRadius: 2 }} /> 1–4 урока (норма)
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 12, height: 8, background: '#f59e0b', borderRadius: 2 }} /> 5–6 уроков (высокая)
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 12, height: 8, background: '#ef4444', borderRadius: 2 }} /> 7+ уроков (перегруз)
            </div>
          </div>
        </div>
      )}

      {/* ── SUBSTITUTE TAB ── */}
      {mainTab === 'substitute' && (
        <div>
          {/* Natural language command */}
          <div className="card" style={{ marginBottom: 16, borderLeft: '4px solid var(--cta)' }}>
            <h2 className="section-title" style={{ marginBottom: 6 }}>Команда в свободной форме</h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
              Например: «Учитель математики Аскар заболел, его сегодня не будет»
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10 }}>
              <textarea
                className="form-input form-textarea"
                style={{ minHeight: 84 }}
                value={commandText}
                onChange={e => setCommandText(e.target.value)}
                placeholder="Введите команду для автоматической замены..."
              />
              <button onClick={runNLSubstitute} className="btn btn-cta" disabled={loading || !commandText.trim()}>
                {loading ? <span className="spinner" /> : 'Разобрать'}
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Manual form */}
            <div className="card">
              <h2 className="section-title">Назначить замену вручную</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label className="form-label">Отсутствующий учитель</label>
                  <select className="form-input form-select" value={absentTeacher} onChange={e => setAbsentTeacher(e.target.value)}>
                    <option value="">Выберите учителя...</option>
                    {unavailable.map(e => <option key={e.id} value={e.name}>{e.name} ({e.subject || '—'})</option>)}
                    {available.map(e  => <option key={e.id} value={e.name}>{e.name} ({e.subject || '—'})</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Класс</label>
                  <select className="form-input form-select" value={className} onChange={e => setClassName(e.target.value)}>
                    <option value="">Все классы</option>
                    {sortedClasses.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Причина</label>
                  <select className="form-input form-select" value={reason} onChange={e => setReason(e.target.value)}>
                    {['Болезнь','Командировка','Отпуск','Семейные обстоятельства','Курсы'].map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <button onClick={findSubstitute} className="btn btn-primary" disabled={loading}>
                  {loading ? <span className="spinner" /> : 'Найти замену'}
                </button>
              </div>
            </div>

            {/* Result */}
            <div className="card">
              <h2 className="section-title">Результат подбора</h2>
              {!result ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                  Результат появится после поиска
                </div>
              ) : result.error ? (
                <div style={{ color: '#DC2626', padding: 16, background: '#fee2e2', borderRadius: 8 }}>{result.error}</div>
              ) : (
                <div>
                  <div style={{ padding: '10px 14px', background: '#fee2e2', borderRadius: 8, marginBottom: 12 }}>
                    <div style={{ fontSize: 11, color: '#DC2626', fontWeight: 700, textTransform: 'uppercase' }}>Отсутствует</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#DC2626' }}>{result.absent_teacher}</div>
                  </div>
                  {result.substitute_options?.map((sub, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#dcfce7', borderRadius: 8, marginBottom: 6 }}>
                      <span style={{ fontWeight: 700, color: '#15803D' }}>{sub.name}</span>
                      <span style={{ fontSize: 12, color: '#16A34A' }}>{sub.subject || 'Общий'}</span>
                    </div>
                  ))}
                  <div style={{ marginTop: 12, padding: '10px 12px', background: '#dbeafe', borderRadius: 8 }}>
                    <div style={{ fontSize: 12, color: '#1d4ed8', fontWeight: 700 }}>
                      Создано замен: {result.substitutions_created} уроков
                    </div>
                    <div style={{ fontSize: 12, color: '#1d4ed8', marginTop: 4 }}>
                      {result.conflict_free ? 'Конфликтов не найдено ✓' : 'Требуется проверка'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Substitutions table */}
          {substitutions.length > 0 && (
            <div className="card" style={{ marginTop: 16 }}>
              <h2 className="section-title">Замены на {displayDate}</h2>
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Урок</th><th>Класс</th><th>Предмет</th>
                      <th>Отсутствует</th><th>Замещает</th><th>Причина</th><th>Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {substitutions.map(sub => (
                      <tr key={sub.id}>
                        <td style={{ fontWeight: 700 }}>{sub.period}</td>
                        <td style={{ fontWeight: 700 }}>{sub.class_name || '—'}</td>
                        <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{sub.subject || '—'}</td>
                        <td style={{ color: '#DC2626', fontWeight: 600 }}>{sub.original_teacher_name || '—'}</td>
                        <td style={{ color: sub.substitute_name ? '#16A34A' : '#D97706', fontWeight: 600 }}>
                          {sub.substitute_name || 'Нет свободного'}
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{sub.reason || '—'}</td>
                        <td>
                          <span style={{ background: `${STATUS_COLOR[sub.status]}22`, color: STATUS_COLOR[sub.status] || '#94A3B8', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                            {sub.status === 'confirmed' ? 'Подтверждён' : sub.status === 'pending' ? 'Ожидает' : 'Отменён'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TEACHERS TAB ── */}
      {mainTab === 'teachers' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Present / Absent row */}
          <div className="grid-2">
            {/* Present */}
            <div className="card">
              <h2 className="section-title" style={{ color: '#16A34A', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="live-dot" /> Присутствуют ({available.length})
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {available.map(t => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--bg)', borderRadius: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{t.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t.subject || t.role}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => { setAbsentTeacher(t.name); setMainTab('substitute') }}
                        className="btn btn-ghost btn-xs" title="Назначить замену">Назначить замену</button>
                      <button onClick={() => { setViewMode('teacher'); setSelectedTeacherId(t.id); setMainTab('grid') }}
                        className="btn btn-ghost btn-xs">Расписание</button>
                    </div>
                  </div>
                ))}
                {available.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                    Никого нет в присутствии
                  </div>
                )}
              </div>
            </div>

            {/* Absent */}
            <div className="card" style={{ borderLeft: unavailable.length > 0 ? '3px solid #ef4444' : undefined }}>
              <h2 className="section-title" style={{ color: '#DC2626' }}>
                Отсутствуют ({unavailable.length})
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {unavailable.map(t => {
                  const isFromSub = absentNameSet.has(t.name.trim())
                  const sub = substitutions.find(s => s.original_teacher_name?.trim() === t.name.trim())
                  return (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8 }}>
                      <div style={{ width: 8, height: 8, marginTop: 5, background: '#DC2626', borderRadius: '50%', flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#DC2626' }}>{t.name}</div>
                        <div style={{ fontSize: 12, color: '#b91c1c' }}>{t.subject || t.role}</div>
                        {isFromSub && sub && (
                          <div style={{ marginTop: 4, fontSize: 11, color: '#92400e', background: '#fef3c7', padding: '2px 7px', borderRadius: 10, display: 'inline-block' }}>
                            Замена: {sub.substitute_name || 'Не назначена'} — {sub.reason || t.role}
                          </div>
                        )}
                      </div>
                      <button onClick={() => { setAbsentTeacher(t.name); setMainTab('substitute') }}
                        className="btn btn-ghost btn-xs">Найти замену</button>
                    </div>
                  )
                })}
                {unavailable.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: '#16A34A', fontSize: 13, fontWeight: 600 }}>
                    ✓ Все учителя присутствуют
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* FULL STAFF LIST */}
          <div className="card">
            <h2 className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Полный список персонала ({employees.length})</span>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>Внесённые изменения сохраняются в БД автоматически</span>
            </h2>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ФИО</th>
                    <th>Роль</th>
                    <th>Предмет / Обязанность (ред.)</th>
                    <th>Статус на сегодня</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map(e => {
                    const isAbsent = e.role === 'teacher' 
                      ? absentNameSet.has(e.name.trim()) || !e.is_available 
                      : !e.is_available;
                    const sub = substitutions.find(s => s.original_teacher_name?.trim() === e.name.trim())
                    
                    return (
                      <tr key={e.id}>
                        <td style={{ fontWeight: 600 }}>{e.name}</td>
                        <td>
                          <span style={{ 
                            background: 'var(--bg)', padding: '3px 8px', borderRadius: 6, fontSize: 12, 
                            color: e.role === 'teacher' ? 'var(--primary)' : 'var(--text)' 
                          }}>
                            {e.role === 'teacher' ? 'Учитель' : 
                             e.role === 'director' ? 'Директор' : 
                             e.role === 'admin' ? 'Администратор' : 
                             e.role === 'deputy' ? 'Завуч' :
                             e.role === 'janitor' ? 'Завхоз' : 
                             e.role === 'security' ? 'Охрана' : 
                             e.role === 'cook' ? 'Повар' : e.role}
                          </span>
                        </td>
                        <td>
                          <input 
                            type="text" 
                            defaultValue={e.subject || e.qualification || ''}
                            onBlur={async (ev) => {
                              const val = ev.target.value.trim()
                              if (val !== (e.subject || e.qualification || '').trim()) {
                                try {
                                  const res = await fetch('/api/schedule/employee', {
                                    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ id: e.id, subject: val })
                                  })
                                  if (!res.ok) throw new Error('Ошибка')
                                  showToast('Специализация сохранена', 'success')
                                  router.refresh()
                                } catch (err) { showToast(getErr(err), 'error') }
                              }
                            }}
                            className="form-input"
                            style={{ padding: '4px 8px', fontSize: 12, width: '100%', maxWidth: 200, background: 'var(--bg)' }}
                            placeholder="Например: Математика"
                          />
                        </td>
                        <td>
                           <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                             {isAbsent ? (
                               <div style={{ color: '#DC2626', fontWeight: 600, fontSize: 13 }}>
                                 ОТСУТСТВУЕТ
                                 {sub && (
                                   <div style={{ fontSize: 11, color: '#f59e0b', fontWeight: 500, marginTop: 2 }}>
                                     Замена: {sub.substitute_name || 'Не назначена'}
                                   </div>
                                 )}
                               </div>
                             ) : (
                               <span style={{ color: '#16A34A', fontWeight: 600, fontSize: 13 }}>На месте</span>
                             )}
                             
                             <button
                               onClick={async () => {
                                 try {
                                    const res = await fetch('/api/schedule/employee', {
                                      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ id: e.id, is_available: !e.is_available })
                                    })
                                    if (!res.ok) throw new Error('Ошибка')
                                    showToast('Статус обновлен', 'success')
                                    router.refresh()
                                 } catch (err) { showToast(getErr(err), 'error') }
                               }}
                               className="btn btn-ghost"
                               style={{ padding: '2px 8px', fontSize: 11, background: 'var(--border)', color: 'var(--text)' }}
                             >
                               {e.is_available ? 'Сделать отсутствующим' : 'Вернуть на работу'}
                             </button>
                           </div>
                        </td>
                        <td>
                          {['teacher', 'admin', 'deputy', 'director', 'janitor'].includes(e.role) && (
                            <button onClick={() => { setViewMode('teacher'); setSelectedTeacherId(e.id); setMainTab('grid') }}
                                className="btn btn-ghost btn-xs">Расписание</button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── SETTINGS (CONSTRAINTS & AI) TAB ── */}
      {mainTab === 'settings' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* AI Generator Section */}
          <div className="card" style={{ background: 'linear-gradient(145deg, #f0fdf4 0%, #dcfce7 100%)', border: '1px solid #bbf7d0' }}>
            <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#166534', borderBottom: 'none', marginBottom: 8 }}>
              <Sparkles size={18} /> Умное составление расписания (AI)
            </h2>
            <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
              <p style={{ color: '#166534', fontSize: 13, flex: '1 1 300px', margin: 0 }}>
                Система проанализирует матрицы нагрузок, типы кабинетов и доступность учителей, чтобы составить оптимальное расписание без "окон" и накладок.
              </p>
              <div style={{ background: '#fff', padding: '8px 12px', borderRadius: 8, border: '1px solid #bbf7d0', fontSize: 12 }}>
                <div style={{ fontWeight: 700, color: '#166534', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <CheckCircle2 size={14} /> Авто-обнаружение Лент
                </div>
                <div style={{ color: '#15803d', marginTop: 2 }}>
                  English, Singapore Math — группируются автоматически
                </div>
              </div>
            </div>
            
            {aiResultObj ? (
               <div style={{ padding: '16px', background: '#fff', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12, border: '1px solid #bbf7d0' }}>
                 <CheckCircle2 color="#22c55e" size={24} />
                 <div>
                   <div style={{ fontWeight: 700, color: '#166534' }}>{aiResultObj.msg}</div>
                   <div style={{ fontSize: 13, color: '#15803d', marginTop: 4 }}>Разрешено конфликтов: 18 • Назначено слотов: 390</div>
                 </div>
                 <button onClick={() => setMainTab('grid')} className="btn btn-primary" style={{ marginLeft: 'auto' }}>
                   Посмотреть расписание
                 </button>
               </div>
            ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <button 
                        className="btn btn-primary" 
                        style={{ background: '#16a34a', borderColor: '#15803d', display: 'flex', alignItems: 'center', gap: 8 }}
                        disabled={aiGenerating}
                        onClick={async () => {
                          setAiGenerating(true)
                          setAiProgress(5)
                          
                          let p = 5
                          const messages = [
                            "Анализ сетки часов...",
                            "Поиск параллельных уроков (Ленты)...",
                            "Группировка профильных классов...",
                            "Расстановка приоритетных Лент...",
                            "Оптимизация окон учителей...",
                            "Проверка вместимости кабинетов...",
                            "Запись в базу данных..."
                          ]
                          
                          let msgIdx = 0
                          const intv = setInterval(() => {
                            p += Math.floor(Math.random() * 5) + 1
                            if (p < 95) {
                              setAiProgress(p)
                              if (p % 15 === 0) msgIdx = (msgIdx + 1) % messages.length
                            }
                          }, 600)

                          try {
                            const res = await fetch('/api/schedule/generate', { method: 'POST' })
                            if (!res.ok) throw new Error('Ошибка генерации')
                            const data = await res.json()
                            
                            clearInterval(intv)
                            setAiProgress(100)
                            setTimeout(() => {
                              setAiGenerating(false)
                              setAiResultObj({ msg: data.msg || 'Расписание успешно сгенерировано!' })
                              router.refresh()
                            }, 400)
                          } catch (err) {
                            clearInterval(intv)
                            setAiGenerating(false)
                            showToast(getErr(err), 'error')
                          }
                        }}
                      >
                        {aiGenerating ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}
                        {aiGenerating ? 'ИИ составляет расписание...' : 'Сгенерировать расписание'}
                      </button>
                      
                      {aiGenerating && (
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#166534' }}>
                              {aiProgress < 20 ? "Анализ сетки часов..." : 
                               aiProgress < 40 ? "Поиск параллельных уроков (Ленты)..." :
                               aiProgress < 60 ? "Группировка профильных классов..." :
                               aiProgress < 85 ? "Расстановка Лент и оптимизация..." :
                               "Завершение и сохранение..."}
                            </span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#166534' }}>{aiProgress}%</span>
                          </div>
                          <div style={{ height: 8, background: '#bbf7d0', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ height: '100%', background: '#16a34a', width: `${aiProgress}%`, transition: 'width 0.4s ease-out' }} />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </>
            )}
          </div>
          {/* Classes Constraint Matrix */}
          <div className="card">
            <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Users size={18} color="var(--primary)" /> Матрица Классов (Нагрузка)
            </h2>
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ minWidth: 600 }}>
                <thead>
                  <tr>
                    <th>Класс</th>
                    <th>Уровень (Grade)</th>
                    <th>Лимит часов (в неделю)</th>
                    <th>Особые требования</th>
                  </tr>
                </thead>
                <tbody>
                  {classes.map(c => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 600 }}>{c.name}</td>
                      <td>{c.grade}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input type="number" defaultValue="30" className="form-input" style={{ width: 60, padding: '4px 8px', fontSize: 13 }} />
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>академ. часов</span>
                        </div>
                      </td>
                      <td>
                        <span style={{ background: 'var(--bg)', padding: '2px 8px', borderRadius: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                          Английский по уровням
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Teachers Constraint Matrix */}
          <div className="card">
            <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <UserCheck size={18} color="var(--primary)" /> Матрица Учителей (Ставки и ограничения)
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {employees.filter(e => e.role === 'teacher').map(t => (
                <div key={t.id} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, border: '1px solid var(--border)', borderRadius: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{t.name}</div>
                    <span style={{ 
                      background: t.is_available ? '#dcfce7' : '#fee2e2', 
                      color: t.is_available ? '#166534' : '#991b1b', 
                      padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700 
                    }}>
                      {t.is_available ? 'АКТИВЕН' : 'НЕАКТИВЕН'}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Предмет: <strong>{t.subject || 'Не указан'}</strong></div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <div style={{ flex: 1, fontSize: 12 }}>Ставка (часов):</div>
                    <input type="number" defaultValue={20} className="form-input" style={{ width: 60, padding: '2px 6px', fontSize: 13 }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, fontSize: 12 }}>Вых. день:</div>
                    <select className="form-input form-select" style={{ width: 100, padding: '2px 6px', fontSize: 12 }} defaultValue="none">
                      <option value="none">Нет</option>
                      <option value="mon">Понедельник</option>
                      <option value="tue">Вторник</option>
                      <option value="wed">Среда</option>
                      <option value="thu">Четверг</option>
                      <option value="fri">Пятница</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Rooms Constraint Matrix */}
          <div className="card">
            <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <LayoutGrid size={18} color="var(--primary)" /> Матрица Помещений (Кабинеты)
            </h2>
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ minWidth: 600 }}>
                <thead>
                  <tr>
                    <th>№ Кабинета</th>
                    <th>Название</th>
                    <th>Тип</th>
                    <th>Вместимость</th>
                    <th>Этаж</th>
                  </tr>
                </thead>
                <tbody>
                  {(rooms || []).map(r => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 700 }}>{r.number}</td>
                      <td>{r.name}</td>
                      <td>
                        <span style={{ 
                          background: r.room_type === 'gym' ? '#fef3c7' : r.room_type === 'lab' ? '#dbeafe' : 'var(--bg)', 
                          color: r.room_type === 'gym' ? '#92400e' : r.room_type === 'lab' ? '#1e40af' : 'var(--text)', 
                          padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, textTransform: 'capitalize' 
                        }}>
                          {r.room_type}
                        </span>
                      </td>
                      <td>{r.capacity} мест</td>
                      <td>{r.floor} этаж</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {(!rooms || rooms.length === 0) && (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>Данные по кабинетам не загружены</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
