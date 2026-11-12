import type { Color, Result } from './game'

// shortcut: moves travel peer to peer over Supabase Realtime and each browser checks the other's
// moves with chess.js. Nothing on a server replays a game. Upgrade to a server-side arbiter
// (an Edge Function that validates every move) before adding ratings or a leaderboard.

export type Seat = { id: string; color: Color; kind: 'quick' | 'duel'; recorded: boolean; opp?: string }
export type Saved = { sans: string[]; clock: Record<Color, number>; turnStart: number | null; result: Result | null }

function read<T>(key: string): T | null {
  try { return JSON.parse(sessionStorage.getItem(key) ?? 'null') } catch { return null }
}
function write(key: string, value: unknown) {
  try { sessionStorage.setItem(key, JSON.stringify(value)) } catch { /* private mode: a reload loses the game */ }
}

export const loadSeat = (id: string) => read<Seat>(`qm:seat:${id}`)
export const saveSeat = (s: Seat) => write(`qm:seat:${s.id}`, s)
export const loadState = (id: string) => read<Saved>(`qm:state:${id}`)
export const saveState = (id: string, s: Saved) => write(`qm:state:${id}`, s)
