import { useEffect, useReducer, useRef, useState, type ReactNode } from 'react'
import { Chess } from 'chess.js'
import { Board, PieceArt, cls } from './Board'
import { GRADES, fmtClock, material, other, type Color, type Grade } from '../lib/game'
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
    undo() { chess.undo(); refresh() },
    load(fen: string) { chess.load(fen); refresh() },
  }
}

export type Side = { name: string; color: Color; clock?: number; running?: boolean; note?: string }

const PIECE_WORD: Record<string, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen' }

function Strip({ side, area, taken, lead }: { side: Side; area: string; taken: string[]; lead: number }) {
  return (
    <div className={cls('strip', area)}>
      <span className={cls('disc', side.color)} aria-hidden="true" />
      <span className="strip-name">
        {side.name}
        <span className="meta">{side.color === 'w' ? 'White' : 'Black'}{side.note ? ` · ${side.note}` : ''}</span>
        {taken.length > 0 && (
          <span className="taken" role="img" aria-label={`Captured: ${taken.map(t => PIECE_WORD[t]).join(', ')}${lead > 0 ? `. Ahead by ${lead}` : ''}`}>
            {taken.map((t, i) => <PieceArt key={i} color={other(side.color)} type={t} />)}
            {lead > 0 && <b>+{lead}</b>}
          </span>
        )}
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
  /** White's winning chance, 0 to 100, drawn as a bar beside the board. */
  evalWhite?: number | null
  /** A grade for each half-move, by its index in the move list. */
  marks?: (Grade | undefined)[]
  badge?: { from: string; to: string; grade: Grade; glyph?: string } | null
  arrow?: [string, string] | null
  /** Read out to screen readers when it changes. */
  announce?: string
  children: ReactNode
}

export function GameLayout({ title, chess, fen, orientation, movable, onMove, top, bottom, idle, evalWhite, marks, badge, arrow, announce, children }: Props) {
  useTitle(title)
  const sans = chess.history()
  const rows: string[][] = []
  for (let i = 0; i < sans.length; i += 2) rows.push(sans.slice(i, i + 2))
  const mat = material(chess)
  const sheet = useRef<HTMLOListElement>(null)
  useEffect(() => { sheet.current?.scrollTo({ top: sheet.current.scrollHeight }) }, [sans.length])

  return (
    <main id="main" tabIndex={-1} className={cls('page game', idle && 'idle')}>
      <div className="game-head">
        <h1>{title}</h1>
      </div>
      {!idle && <Strip side={top} area="strip-top" {...mat[top.color]} />}
      <div className="board-wrap">
        {evalWhite != null && (
          <div className={cls('evalbar', orientation === 'b' && 'flip')} role="img" aria-label={`Engine estimate: White ${Math.round(evalWhite)} in 100`}>
            <i style={{ transform: `scaleY(${evalWhite / 100})` }} />
          </div>
        )}
        <Board chess={chess} fen={fen} orientation={orientation} movable={movable} onMove={onMove ?? (() => {})} badge={badge} arrow={arrow} />
      </div>
      {!idle && <Strip side={bottom} area="strip-bottom" {...mat[bottom.color]} />}
      <section className="panel" aria-label="Game status and actions">{children}</section>
      {!idle && <section className="moves" aria-labelledby="moves-title">
        <h2 id="moves-title">Moves</h2>
        <ol className="sheet" ref={sheet} tabIndex={0} aria-label="Move list">
          {rows.length === 0 && <li className="sheet-empty">No moves yet. White moves first.</li>}
          {rows.map((r, i) => (
            <li key={i}>
              <span className="n">{i + 1}.</span>
              {r.map((san, j) => {
                const g = marks?.[i * 2 + j]
                return <span key={j}>{san}{g && <b className={`chip g-${g}`} title={GRADES[g].label}>{GRADES[g].glyph}<span className="sr-only"> {GRADES[g].label}</span></b>}</span>
              })}
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
