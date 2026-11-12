import { useEffect, useReducer, useRef, useState, type ReactNode } from 'react'
import { Chess } from 'chess.js'
import { Board, cls } from './Board'
import { fmtClock, type Color } from '../lib/game'
import { play } from '../lib/sound'

export function useTitle(title: string) {
  useEffect(() => { document.title = `${title} · Quiet Move` }, [title])
}

export function useChess(initial?: string[]) {
  const ref = useRef<Chess | null>(null)
  if (!ref.current) {
    ref.current = new Chess()
    try { for (const san of initial ?? []) ref.current.move(san) } catch { ref.current.reset() }
  }
  const [, refresh] = useReducer((x: number) => x + 1, 0)
  const chess = ref.current
  return {
    chess,
    fen: chess.fen(),
    refresh,
    move(m: string | { from: string; to: string; promotion?: string }) {
      try { const r = chess.move(m); refresh(); return r } catch { return null }
    },
    reset() { chess.reset(); refresh() },
  }
}

export type Side = { name: string; color: Color; clock?: number; running?: boolean; note?: string }

function Strip({ side, area }: { side: Side; area: string }) {
  return (
    <div className={cls('strip', area)}>
      <span className={cls('disc', side.color)} aria-hidden="true" />
      <span className="strip-name">
        {side.name}
        <span className="meta">{side.color === 'w' ? 'White' : 'Black'}{side.note ? ` · ${side.note}` : ''}</span>
      </span>
      {side.clock !== undefined && (
        <span className={cls('clock', side.running && 'running', side.running && side.clock < 30000 && 'low')} role="timer" aria-label={`${side.name} clock`}>
          {fmtClock(side.clock)}
        </span>
      )}
    </div>
  )
}

type Props = {
  title: string
  chess: Chess
  fen: string
  orientation: Color
  movable?: Color | null
  onMove?: (m: { from: string; to: string; promotion?: string }) => void
  top: Side
  bottom: Side
  /** Before a game exists: show only the board and the panel. */
  idle?: boolean
  /** Read out to screen readers when it changes. */
  announce?: string
  children: ReactNode
}

export function GameLayout({ title, chess, fen, orientation, movable, onMove, top, bottom, idle, announce, children }: Props) {
  useTitle(title)
  const sans = chess.history()
  const rows: string[][] = []
  for (let i = 0; i < sans.length; i += 2) rows.push(sans.slice(i, i + 2))
  const sheet = useRef<HTMLOListElement>(null)
  useEffect(() => { sheet.current?.scrollTo({ top: sheet.current.scrollHeight }) }, [sans.length])

  return (
    <main id="main" tabIndex={-1} className={cls('page game', idle && 'idle')}>
      <div className="game-head">
        <h1>{title}</h1>
      </div>
      {!idle && <Strip side={top} area="strip-top" />}
      <div className="board-wrap">
        <Board chess={chess} fen={fen} orientation={orientation} movable={movable} onMove={onMove ?? (() => {})} />
      </div>
      {!idle && <Strip side={bottom} area="strip-bottom" />}
      <section className="panel" aria-label="Game status and actions">{children}</section>
      {!idle && <section className="moves" aria-labelledby="moves-title">
        <h2 id="moves-title">Moves</h2>
        <ol className="sheet" ref={sheet} tabIndex={0} aria-label="Move list">
          {rows.length === 0 && <li className="sheet-empty">No moves yet. White moves first.</li>}
          {rows.map((r, i) => (
            <li key={i}>
              <span className="n">{i + 1}.</span>
              <span>{r[0]}</span>
              {r[1] && <span>{r[1]}</span>}
            </li>
          ))}
        </ol>
      </section>}
      <p className="sr-only" aria-live="polite">{announce}</p>
    </main>
  )
}

/** Confirmation for an action that cannot be taken back. Opens focused on the safe choice. */
export function ConfirmDialog(p: { open: boolean; title: string; body: string; confirm: string; cancel: string; onConfirm: () => void; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    if (p.open) ref.current?.showModal()
    else ref.current?.close()
  }, [p.open])
  return (
    <dialog ref={ref} className="dialog" aria-labelledby="confirm-title" onClose={p.onClose}>
      <h2 id="confirm-title">{p.title}</h2>
      <p>{p.body}</p>
      <div className="row end">
        <button type="button" className="btn secondary" autoFocus onClick={p.onClose}>{p.cancel}</button>
        <button type="button" className="btn danger" onClick={() => { p.onConfirm(); p.onClose() }}>{p.confirm}</button>
      </div>
    </dialog>
  )
}

export function ErrorNote({ children, detail, action }: { children: ReactNode; detail: string; action?: ReactNode }) {
  const [copied, setCopied] = useState(false)
  useEffect(() => play('error'), [])
  const copy = () =>
    navigator.clipboard
      .writeText(`${detail} | ${location.href} | ${new Date().toISOString()} | ${navigator.userAgent}`)
      .then(() => setCopied(true), () => setCopied(false))
  return (
    <div className="note error" role="alert">
      <p>{children}</p>
      <div className="row">
        {action}
        <button type="button" className="btn quiet" onClick={copy}>{copied ? 'Details copied' : 'Copy error details'}</button>
      </div>
    </div>
  )
}
