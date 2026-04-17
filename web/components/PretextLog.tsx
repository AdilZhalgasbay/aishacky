'use client'
import React, { useEffect, useRef, useState } from 'react'
import { prepare, layout } from '@chenglou/pretext'

interface LogEntry {
  id: string
  text: string
  timestamp: string
}

export default function PretextLog({ entries }: { entries: LogEntry[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [layoutInfo, setLayoutInfo] = useState<{ height: number; ready: boolean }>({ height: 0, ready: false })

  useEffect(() => {
    if (!containerRef.current || entries.length === 0) return

    const width = containerRef.current.clientWidth - 32 // padding
    const font = '13px "JetBrains Mono", monospace' // matches our mono font
    const lineHeight = 20

    // Combined text for measurement
    const allText = entries.map(e => `[${e.timestamp}] ${e.text}`).join('\n')
    
    // Phase 1: Prepare (Measurement)
    const prepared = prepare(allText, font)
    
    // Phase 2: Layout (Arithmetic)
    const { height } = layout(prepared, width, lineHeight)
    
    setLayoutInfo({ height, ready: true })
  }, [entries])

  return (
    <div 
      className="card card-sm bg-slate-900 border-slate-800 overflow-hidden"
      style={{ minHeight: '120px', position: 'relative' }}
    >
      <div className="flex items-center gap-2 mb-3 border-b border-slate-800 pb-2">
        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
          Hyperscale Agent Logs (Pretext Engine Active)
        </span>
      </div>
      
      <div 
        ref={containerRef}
        className="text-[13px] font-mono text-emerald-400 leading-5"
        style={{ 
          height: layoutInfo.ready ? `${layoutInfo.height}px` : 'auto',
          transition: 'height 0.1s ease-out'
        }}
      >
        {entries.map((entry) => (
          <div key={entry.id} className="whitespace-pre-wrap mb-1">
            <span className="text-emerald-600 opacity-60">[{entry.timestamp}]</span> {entry.text}
          </div>
        ))}
        {entries.length === 0 && (
          <div className="text-slate-600 italic">Waiting for agent activity...</div>
        )}
      </div>
      
      {!layoutInfo.ready && entries.length > 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className="spinner !border-slate-700 !border-t-emerald-500" />
        </div>
      )}
    </div>
  )
}
