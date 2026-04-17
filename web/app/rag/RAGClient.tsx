'use client'
import { useState } from 'react'

interface Doc {
  id: string
  doc_name: string
  doc_number: string
  chunk_index: number
  content: string
  summary: string | null
}

interface Props {
  docs: Doc[]
}

interface RagSource {
  doc_name: string
  doc_number: string
  text?: string
  score?: number
}

interface RagResult {
  answer: string
  sources: RagSource[]
}

const EXAMPLE_QUESTIONS = [
  'Сколько квадратных метров должно быть на одного ученика?',
  'Какую температуру должно быть в классе?',
  'Как долго длится карантин при инфекционном заболевании?',
  'Какая максимальная нагрузка для 3 класса?',
  'Когда должен начинаться первый урок?',
  'Обязательно ли горячее питание для первоклассников?',
]

export default function RAGClient({ docs }: Props) {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<RagResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState<{ query: string; answer: string; sources: RagSource[] }[]>([])
  const [tab, setTab] = useState<'chat' | 'docs'>('chat')

  async function handleQuery() {
    if (!query.trim()) return
    setLoading(true)
    const currentQuery = query
    setQuery('')
    try {
      const res = await fetch('/api/rag/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: currentQuery }),
      })
      const data = await res.json()
      setResult(data)
      setHistory(prev => [{ query: currentQuery, answer: data.answer, sources: data.sources }, ...prev])
    } catch {
      setResult({ answer: 'Ошибка при запросе', sources: [] })
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleQuery() }
  }

  const uniqueDocs = Array.from(new Set(docs.map(d => `${d.doc_name} №${d.doc_number}`))).map(key => {
    const chunks = docs.filter(d => `${d.doc_name} №${d.doc_number}` === key)
    return { key, doc_name: chunks[0].doc_name, doc_number: chunks[0].doc_number, chunks }
  })

  return (
    <div className="animate-fadein">
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 className="page-title">Приказы и нормативные документы</h1>
            <p className="page-subtitle">Задайте вопрос на русском языке — система найдёт ответ в нормативных актах МОН и МЗ РК</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ padding: '6px 14px', background: '#ede9fe', borderRadius: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#7C3AED' }}>RAG</span>
              <span style={{ fontSize: 13, color: '#7C3AED', marginLeft: 4 }}>AI консультант</span>
            </div>
            <div style={{ padding: '6px 14px', background: '#dbeafe', borderRadius: 8 }}>
              <span style={{ fontSize: 13, color: '#1d4ed8', fontWeight: 600 }}>{docs.length} фрагментов в базе</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
        {(['chat', 'docs'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '10px 20px', background: 'none', border: 'none',
            borderBottom: tab === t ? '2px solid var(--primary)' : '2px solid transparent',
            color: tab === t ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: tab === t ? 700 : 500, fontSize: 14, cursor: 'pointer',
          }}>
            {t === 'chat' ? 'AI консультант' : 'База документов'}
          </button>
        ))}
      </div>

      {tab === 'chat' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Query Panel */}
          <div>
            {/* Example Questions */}
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="section-title" style={{ marginBottom: 10 }}>Примеры вопросов</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {EXAMPLE_QUESTIONS.map(q => (
                  <button
                    key={q}
                    onClick={() => setQuery(q)}
                    style={{
                      padding: '6px 12px',
                      background: 'var(--primary-light)',
                      color: 'var(--primary)',
                      border: 'none',
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#bfdbfe')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'var(--primary-light)')}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {/* Input */}
            <div className="card">
              <div className="section-title" style={{ marginBottom: 10 }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="var(--primary)" viewBox="0 0 16 16" style={{ marginRight: 6 }}>
                  <path d="M9.405 1.05c-.413-1.4-2.397-1.4-2.81 0l-.1.34a1.464 1.464 0 0 1-2.105.872l-.31-.17c-1.283-.698-2.686.705-1.987 1.987l.169.311c.446.82.023 1.841-.872 2.105l-.34.1c-1.4.413-1.4 2.397 0 2.81l.34.1a1.464 1.464 0 0 1 .872 2.105l-.17.31c-.698 1.283.705 2.686 1.987 1.987l.311-.169a1.464 1.464 0 0 1 2.105.872l.1.34c.413 1.4 2.397 1.4 2.81 0l.1-.34a1.464 1.464 0 0 1 2.105-.872l.31.17c1.283.698 2.686-.705 1.987-1.987l-.169-.311a1.464 1.464 0 0 1 .872-2.105l.34-.1c1.4-.413 1.4-2.397 0-2.81l-.34-.1a1.464 1.464 0 0 1-.872-2.105l.17-.31c.698-1.283-.705-2.686-1.987-1.987l-.311.169a1.464 1.464 0 0 1-2.105-.872l-.1-.34z"/>
                  <path d="M8 10.93a2.929 2.929 0 1 1 0-5.86 2.929 2.929 0 0 1 0 5.858z"/>
                </svg>
                Ваш вопрос
              </div>
              <textarea
                className="form-input form-textarea"
                style={{ minHeight: 100, marginBottom: 10 }}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Например: Какова норма освещённости рабочих мест в классе?"
              />
              <button onClick={handleQuery} className="btn btn-primary" disabled={loading || !query.trim()} style={{ width: '100%', justifyContent: 'center' }}>
                {loading ? (
                  <><span className="spinner" /> Поиск в документах...</>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M15.964.686a.5.5 0 0 0-.65-.65L.767 5.855H.766l-.452.18a.5.5 0 0 0-.082.887l.41.26.001.002 4.995 3.178 3.178 4.995.002.002.26.41a.5.5 0 0 0 .886-.083l6-15Zm-1.833 1.89L6.637 10.07l-.215-.338a.5.5 0 0 0-.154-.154l-.338-.215 7.494-7.494 1.178-.471-.47 1.178Z"/>
                    </svg>
                    Найти ответ в документах
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Answer Panel */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <div className="section-title">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="var(--primary)" viewBox="0 0 16 16" style={{ marginRight: 6 }}>
                <path d="M1 2.828c.885-.37 2.154-.769 3.388-.893 1.33-.134 2.458.063 3.112.752v9.746c-.935-.53-2.12-.603-3.213-.493-1.18.12-2.37.461-3.287.811V2.828zm7.5-.141c.654-.689 1.782-.886 3.112-.752 1.234.124 2.503.523 3.388.893v9.746c-.917-.35-2.107-.692-3.287-.81-1.094-.111-2.278-.039-3.213.492V2.687z"/>
              </svg>
              Ответ из нормативной базы
            </div>

            {!result && history.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="var(--text-light)" viewBox="0 0 16 16" style={{ marginBottom: 12 }}>
                  <path d="M1 2.828c.885-.37 2.154-.769 3.388-.893 1.33-.134 2.458.063 3.112.752v9.746c-.935-.53-2.12-.603-3.213-.493-1.18.12-2.37.461-3.287.811V2.828zm7.5-.141c.654-.689 1.782-.886 3.112-.752 1.234.124 2.503.523 3.388.893v9.746c-.917-.35-2.107-.692-3.287-.81-1.094-.111-2.278-.039-3.213.492V2.687z"/>
                </svg>
                <p style={{ fontSize: 14, fontWeight: 600 }}>Задайте вопрос по нормативной базе</p>
                <p style={{ fontSize: 12, textAlign: 'center', maxWidth: 260, marginTop: 4 }}>Система найдёт ответ в нормативных актах МОН и МЗ РК</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto', maxHeight: 420 }}>
                {history.map((item, i) => (
                  <div key={i} className={i === 0 ? 'animate-fadein' : ''}>
                    {/* Question */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                      <div className="chat-bubble-bot">{item.query}</div>
                    </div>
                    {/* Answer */}
                    <div style={{ marginBottom: 8 }}>
                      <div className="chat-bubble-teacher" style={{ maxWidth: '85%' }}>{item.answer}</div>
                    </div>
                    {/* Sources */}
                    {item.sources?.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-light)', fontWeight: 600 }}>Источники:</span>
                        {item.sources.map((s, j) => (
                          <span key={j} style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 600, background: '#dbeafe', padding: '2px 8px', borderRadius: 12 }}>
                            {s.doc_name} №{s.doc_number}
                          </span>
                        ))}
                      </div>
                    )}
                    {i < history.length - 1 && <hr className="divider" />}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'docs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {uniqueDocs.map(doc => (
            <div key={doc.key} className="card">
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
                <div style={{ width: 44, height: 44, background: '#ede9fe', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 16, fontWeight: 800, color: '#7C3AED' }}>#{doc.doc_number}</span>
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{doc.doc_name}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Приказ №{doc.doc_number} — {doc.chunks.length} раздел(а)</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {doc.chunks.map((chunk) => (
                  <div key={chunk.id} style={{ padding: '10px 14px', background: 'var(--bg)', borderRadius: 8, borderLeft: '3px solid var(--primary)' }}>
                    {chunk.summary && (
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', marginBottom: 4 }}>{chunk.summary}</div>
                    )}
                    <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>{chunk.content}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {docs.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: 48 }}>
              <p style={{ color: 'var(--text-muted)' }}>Нормативные документы не загружены</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
