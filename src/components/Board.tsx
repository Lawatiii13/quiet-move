import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
import type { Chess, Square } from 'chess.js'
import { GRADES, type Color, type Grade, type Piece, moveSounds, piecesOf, reconcile } from '../lib/game'
import { play } from '../lib/sound'

const FILES = 'abcdefgh'
const NAMES: Record<string, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' }
export const cls = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ')

export function PieceArt({ color, type }: { color: string; type: string }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true">
      <use href={`${import.meta.env.BASE_URL}pieces.svg#${color}${type}`} />
    </svg>
  )
}

function Arrow({ from, to }: { from: number[]; to: number[] }) {
  const dx = to[0] - from[0], dy = to[1] - from[1], len = Math.hypot(dx, dy) || 1
  // stop short of the centre so the head lands inside the square
  const x2 = to[0] + 0.5 - (dx / len) * 0.3, y2 = to[1] + 0.5 - (dy / len) * 0.3
  return (
    <svg key={`${from}${to}`} className="arrow" viewBox="0 0 8 8">
      <defs><marker id="arrow-head" markerWidth="3" markerHeight="3" refX="1.4" refY="1.5" orient="auto"><path d="M0,0 L3,1.5 L0,3 Z" /></marker></defs>
      <line x1={from[0] + 0.5} y1={from[1] + 0.5} x2={x2} y2={y2} markerEnd="url(#arrow-head)" />
    </svg>
  )
}

const xy = (sq: string, o: Color) => {
  const f = FILES.indexOf(sq[0]), r = Number(sq[1]) - 1
  return o === 'w' ? [f, 7 - r] : [7 - f, r]
}
const squareAt = (x: number, y: number, o: Color) => (o === 'w' ? FILES[x] + (8 - y) : FILES[7 - x] + (y + 1))

type Props = {
  chess: Chess
  fen: string
  orientation: Color
  /** Colour the person at this screen plays. Leave out `onMove` for a board that only shows a game. */
  movable?: Color | null
  onMove?: (m: { from: string; to: string; promotion?: string }) => void
  label?: string
  /** Set false for a board that plays by itself, so it stays quiet. */
  sound?: boolean
  /** A verdict on a move: tints its two squares and pins a glyph to the corner of the landing square. */
  badge?: { from: string; to: string; grade: Grade; glyph?: string } | null
  /** An arrow from one square to another. */
  arrow?: [string, string] | null
}

export function Board({ chess, fen, orientation, movable = null, onMove, label, sound = true, badge, arrow }: Props) {
  // Recomputed once per position; see reconcile() for why pieces need stable identities.
  const store = useRef<{ fen: string; pieces: Piece[] }>({ fen: '', pieces: [] })
  if (store.current.fen !== fen) store.current = { fen, pieces: reconcile(store.current.pieces, piecesOf(chess)) }
  const pieces = store.current.pieces

  const [selected, setSelected] = useState<string | null>(null)
  const [cursor, setCursor] = useState(orientation === 'w' ? 'e2' : 'e7')
  const [drag, setDrag] = useState<{ from: string; x: number; y: number; size: number } | null>(null)
  const [promo, setPromo] = useState<{ from: string; to: string } | null>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const promoRef = useRef<HTMLDialogElement>(null)
  const down = useRef<{ from: string; x: number; y: number } | null>(null)

  const canMove = !!onMove && movable !== null && movable === chess.turn() && !chess.isGameOver()
  const last = chess.history({ verbose: true }).at(-1)
  const movesFrom = (sq: string) => (canMove ? chess.moves({ square: sq as Square, verbose: true }) : [])
  const targets = useMemo(() => {
    const m = new Map<string, boolean>() // square -> lands on a piece
    if (selected) for (const mv of movesFrom(selected)) m.set(mv.to, !!mv.captured)
    return m
  }, [selected, fen, canMove])

  useEffect(() => { setSelected(null); setDrag(null); down.current = null }, [fen, canMove])
  useEffect(() => { if (promo) promoRef.current?.showModal() }, [promo])
  // One sound per new move. A reset or a jump of several moves plays only the latest.
  const plies = chess.history().length
  const heard = useRef(plies)
  useEffect(() => {
    if (sound && plies > heard.current && last) moveSounds(last).forEach(play)
    heard.current = plies
  }, [plies])
  useEffect(() => setCursor(orientation === 'w' ? 'e2' : 'e7'), [orientation])

  function commit(from: string, to: string) {
    setSelected(null)
    if (movesFrom(from).some(m => m.to === to && m.promotion)) setPromo({ from, to })
    else onMove?.({ from, to })
  }

  function tap(sq: string) {
    setCursor(sq)
    if (!canMove) return
    if (selected && targets.has(sq)) return commit(selected, sq)
    const p = chess.get(sq as Square)
    const pick = p && p.color === movable && sq !== selected ? sq : null
    if (pick) play('select')
    setSelected(pick)
  }

  function locate(e: PointerEvent) {
    const r = boardRef.current!.getBoundingClientRect()
    const x = e.clientX - r.left, y = e.clientY - r.top, size = r.width / 8
    const inside = x >= 0 && y >= 0 && x < r.width && y < r.height
    return { x, y, size, sq: inside ? squareAt(Math.floor(x / size), Math.floor(y / size), orientation) : null }
  }

  function onPointerDown(e: PointerEvent) {
    if (!canMove || e.button !== 0) return
    const { x, y, sq } = locate(e)
    const p = sq && chess.get(sq as Square)
    down.current = sq && p && p.color === movable ? { from: sq, x, y } : null
  }
  function onPointerMove(e: PointerEvent) {
    const d = down.current
    if (!d) return
    const { x, y, size } = locate(e)
    if (!drag) {
      if (Math.hypot(x - d.x, y - d.y) < 6) return // still a tap
      boardRef.current!.setPointerCapture(e.pointerId)
      setSelected(d.from)
    }
    setDrag({ from: d.from, x, y, size })
  }
  function onPointerUp(e: PointerEvent) {
    const d = down.current
    down.current = null
    if (!d || !drag) return
    setDrag(null)
    const { sq } = locate(e)
    if (sq && sq !== d.from && movesFrom(d.from).some(m => m.to === sq)) commit(d.from, sq)
  }

  function onKeyDown(e: KeyboardEvent, x: number, y: number) {
    if (e.key === 'Escape') return setSelected(null)
    const step: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
    const d = step[e.key]
    if (!d) return
    e.preventDefault()
    const nx = Math.min(7, Math.max(0, x + d[0])), ny = Math.min(7, Math.max(0, y + d[1]))
    const sq = squareAt(nx, ny, orientation)
    setCursor(sq)
    boardRef.current?.querySelector<HTMLElement>(`[data-sq="${sq}"]`)?.focus()
  }

  const at = new Map(pieces.filter(p => !p.gone).map(p => [p.square, p]))
  const checkSq = chess.inCheck() ? pieces.find(p => !p.gone && p.type === 'k' && p.color === chess.turn())?.square : null

  const fxAt = (sq: string) => { const [x, y] = xy(sq, orientation); return { transform: `translate(${x * 100}%, ${y * 100}%)` } }

  const squares = []
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const sq = squareAt(x, y, orientation)
      const p = at.get(sq)
      const className = cls(
        'sq', (x + y) % 2 ? 'dark' : 'light',
        sq === selected && 'sel',
        (sq === last?.from || sq === last?.to) && 'last',
        targets.has(sq) && (targets.get(sq) ? 'capture' : 'target'),
        sq === checkSq && 'check',
        badge && (sq === badge.from || sq === badge.to) && `g-${badge.grade}`,
      )
      const coords = { 'data-file': y === 7 ? sq[0] : undefined, 'data-rank': x === 0 ? sq[1] : undefined }
      if (!onMove) {
        squares.push(<div key={sq} className={className} {...coords} />)
        continue
      }
      const what = p ? `${p.color === 'w' ? 'white' : 'black'} ${NAMES[p.type]}` : 'empty'
      squares.push(
        <button
          key={sq}
          type="button"
          data-sq={sq}
          className={className}
          {...coords}
          tabIndex={sq === cursor ? 0 : -1}
          aria-label={`${sq}, ${what}${targets.has(sq) ? ', legal move' : ''}`}
          aria-pressed={sq === selected}
          aria-disabled={!canMove}
          onClick={() => tap(sq)}
          onKeyDown={e => onKeyDown(e, x, y)}
        />,
      )
    }
  }

  return (
    <div
      ref={boardRef}
      className={cls('board', chess.isCheckmate() && 'mate')}
      role={onMove ? 'group' : 'img'}
      aria-label={label ?? 'Chess board'}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => { down.current = null; setDrag(null) }}
    >
      {squares}
      <div className="pieces" aria-hidden="true">
        {[...pieces].sort((a, b) => a.id - b.id).map(p => {
          const [x, y] = xy(p.square, orientation)
          const dragging = !p.gone && drag?.from === p.square
          const transform = dragging
            ? `translate(${drag.x - drag.size / 2}px, ${drag.y - drag.size / 2}px) scale(1.1)`
            : `translate(${x * 100}%, ${y * 100}%)`
          return (
            <div
              key={p.id}
              className={cls('piece', p.gone && 'gone', dragging && 'dragging', p.square === last?.to && 'moved', !p.gone && p.square === selected && 'picked')}
              style={{ transform, '--i': p.id % 32 } as CSSProperties}
            >
              {/* .pose carries the state motion (landing, lifting, being captured); the art carries the deal-in. */}
              <span className="pose"><PieceArt color={p.color} type={p.type} /></span>
            </div>
          )
        })}
        {last?.captured && <i key={`hit${plies}`} className="fx burst" style={fxAt(last.to)} />}
        {checkSq && <i key={`chk${plies}`} className="fx alarm" style={fxAt(checkSq)} />}
        {badge && <i key={`${badge.to}${badge.grade}${plies}`} className={`mark g-${badge.grade}`} style={fxAt(badge.to)}><b>{badge.glyph ?? GRADES[badge.grade].glyph}</b></i>}
        {arrow && <Arrow from={xy(arrow[0], orientation)} to={xy(arrow[1], orientation)} />}
      </div>
      {onMove && (
        <dialog ref={promoRef} className="dialog" aria-labelledby="promo-title" onClose={() => setPromo(null)}>
          <h2 id="promo-title">Promote the pawn to</h2>
          <div className="promo">
            {promo && ['q', 'r', 'b', 'n'].map(t => (
              <button
                key={t}
                type="button"
                className="btn secondary"
                onClick={() => { onMove({ ...promo, promotion: t }); promoRef.current?.close() }}
              >
                <PieceArt color={movable ?? 'w'} type={t} />
                {NAMES[t][0].toUpperCase() + NAMES[t].slice(1)}
              </button>
            ))}
          </div>
          <button type="button" className="btn quiet" onClick={() => promoRef.current?.close()}>Take the move back</button>
        </dialog>
      )}
    </div>
  )
}
