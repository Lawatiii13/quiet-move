import type { Chess } from 'chess.js'

export type Color = 'w' | 'b'
export type Reason = 'checkmate' | 'resign' | 'time' | 'stalemate' | 'repetition' | 'material' | 'fifty' | 'agreed'
export type Result = { winner: Color | null; reason: Reason }

export const START_MS = 10 * 60 * 1000
export const other = (c: Color): Color => (c === 'w' ? 'b' : 'w')
export const colorName = (c: Color) => (c === 'w' ? 'White' : 'Black')

export function fmtClock(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Result the rules of chess give for the current position, or null while play goes on. */
export function boardResult(chess: Chess): Result | null {
  if (chess.isCheckmate()) return { winner: other(chess.turn()), reason: 'checkmate' }
  if (chess.isStalemate()) return { winner: null, reason: 'stalemate' }
  if (chess.isInsufficientMaterial()) return { winner: null, reason: 'material' }
  if (chess.isThreefoldRepetition()) return { winner: null, reason: 'repetition' }
  if (chess.isDraw()) return { winner: null, reason: 'fifty' }
  return null
}

export function resultText({ winner, reason }: Result) {
  const w = winner ? colorName(winner) : ''
  const l = winner ? colorName(other(winner)) : ''
  switch (reason) {
    case 'checkmate': return `Checkmate. ${w} wins.`
    case 'resign': return `${l} resigned. ${w} wins.`
    case 'time': return `${l} ran out of time. ${w} wins.`
    case 'stalemate': return 'Stalemate. The game is a draw.'
    case 'repetition': return 'Draw by threefold repetition.'
    case 'material': return 'Draw. Neither side has enough pieces to mate.'
    case 'fifty': return 'Draw by the fifty-move rule.'
    case 'agreed': return 'Draw agreed.'
  }
}

export const reportValue = (r: Result) => (r.winner === 'w' ? 'white' : r.winner === 'b' ? 'black' : 'draw')

export type GameRow = {
  id: string
  kind: 'duel' | 'quick' | 'bot'
  white: string | null
  black: string | null
  bot: string | null
  white_report: string | null
  black_report: string | null
  reported_at: string | null
  created_at: string
}

const GRACE_MS = 15 * 60 * 1000

/**
 * What a stored game counts as for one player. No server replays the moves, so a game
 * between two people counts only when both report the same result, or when one side
 * reported and the other stayed silent for 15 minutes (longer than any clock can run).
 * Reports that disagree count for nobody.
 */
export function outcome(g: GameRow, me: string, now = Date.now()): 'win' | 'loss' | 'draw' | null {
  const mine = g.white === me ? 'white' : g.black === me ? 'black' : null
  if (!mine) return null
  let r: string | null = null
  if (g.kind === 'bot') r = mine === 'white' ? g.white_report : g.black_report
  else if (!g.white || !g.black) r = null
  else if (g.white_report && g.black_report) r = g.white_report === g.black_report ? g.white_report : null
  else if (g.reported_at && now - Date.parse(g.reported_at) > GRACE_MS) r = g.white_report ?? g.black_report
  if (!r) return null
  return r === 'draw' ? 'draw' : r === mine ? 'win' : 'loss'
}

/** Sounds for one move, in the order they play. */
export function moveSounds(m: { san: string; captured?: string; promotion?: string }) {
  const out: ('move' | 'capture' | 'castle' | 'promote' | 'check')[] = [m.san.startsWith('O-O') ? 'castle' : m.captured ? 'capture' : 'move']
  if (m.promotion) out.push('promote')
  if (/[+#]$/.test(m.san)) out.push('check')
  return out
}

export type Piece = { id: number; type: string; color: Color; square: string; gone?: boolean }
let nextId = 1

/**
 * Carry piece identities from one position to the next, so a piece that moved keeps its
 * DOM node and slides. Captured pieces stay for one more position, flagged `gone`, to fade out.
 */
export function reconcile(prev: Piece[], now: Omit<Piece, 'id'>[]): Piece[] {
  const left = prev.filter(p => !p.gone)
  const out: Piece[] = []
  const moved: Omit<Piece, 'id'>[] = []
  for (const n of now) {
    const i = left.findIndex(p => p.square === n.square && p.type === n.type && p.color === n.color)
    if (i >= 0) out.push(left.splice(i, 1)[0])
    else moved.push(n)
  }
  for (const n of moved) {
    let i = left.findIndex(p => p.type === n.type && p.color === n.color)
    if (i < 0) i = left.findIndex(p => p.type === 'p' && p.color === n.color) // promotion
    out.push(i >= 0 ? { ...left.splice(i, 1)[0], type: n.type, square: n.square } : { id: nextId++, ...n })
  }
  return [...out, ...left.map(p => ({ ...p, gone: true }))]
}

export const piecesOf = (chess: Chess) =>
  chess.board().flat().filter(p => p !== null).map(p => ({ type: p.type as string, color: p.color as Color, square: p.square as string }))
