import { Chess } from 'chess.js'
import { expect, test } from 'vitest'
import { boardResult, fmtClock, outcome, piecesOf, reconcile, type GameRow } from './game'
import { OPERA_GAME } from './opera'

const row = (o: Partial<GameRow>): GameRow => ({
  id: 'g', kind: 'duel', white: 'A', black: 'B', bot: null,
  white_report: null, black_report: null, reported_at: null, created_at: '', ...o,
})
const T = Date.parse('2026-01-01T12:00:00Z')

test('a game between two people counts only when the reports agree', () => {
  expect(outcome(row({ white_report: 'white', black_report: 'white' }), 'A')).toBe('win')
  expect(outcome(row({ white_report: 'white', black_report: 'white' }), 'B')).toBe('loss')
  expect(outcome(row({ white_report: 'draw', black_report: 'draw' }), 'B')).toBe('draw')
  expect(outcome(row({ white_report: 'white', black_report: 'black' }), 'A')).toBe(null)
})

test('a lone report counts only after the grace period and only with two players', () => {
  const lone = { white_report: 'white', reported_at: '2026-01-01T12:00:00Z' }
  expect(outcome(row(lone), 'A', T + 14 * 60e3)).toBe(null)
  expect(outcome(row(lone), 'A', T + 16 * 60e3)).toBe('win')
  expect(outcome(row({ ...lone, black: null }), 'A', T + 16 * 60e3)).toBe(null)
  expect(outcome(row(lone), 'stranger', T + 16 * 60e3)).toBe(null)
})

test('a bot game counts on the player\'s own report', () => {
  expect(outcome(row({ kind: 'bot', white: null, black_report: 'white' }), 'B')).toBe('loss')
})

test('clock text', () => {
  expect(fmtClock(600000)).toBe('10:00')
  expect(fmtClock(59001)).toBe('1:00')
  expect(fmtClock(-5)).toBe('0:00')
})

test('the Opera Game replays legally, ends in mate, and pieces keep their identity', () => {
  const chess = new Chess()
  let pieces = reconcile([], piecesOf(chess))
  const whiteQueen = pieces.find(p => p.type === 'q' && p.color === 'w')!.id
  for (const san of OPERA_GAME) {
    chess.move(san)
    pieces = reconcile(pieces, piecesOf(chess))
    expect(pieces.filter(p => !p.gone).length).toBe(piecesOf(chess).length)
  }
  expect(boardResult(chess)).toEqual({ winner: 'w', reason: 'checkmate' })
  // 16. Qb8+ Nxb8: the queen that started on d1 is the piece captured on b8
  expect(pieces.find(p => p.id === whiteQueen)).toBeUndefined()
  expect(new Set(pieces.map(p => p.id)).size).toBe(pieces.length)
})

test('promotion turns the pawn into the new piece instead of spawning one', () => {
  const chess = new Chess('8/P6k/8/8/8/8/8/K7 w - - 0 1')
  const before = reconcile([], piecesOf(chess))
  const pawn = before.find(p => p.type === 'p')!.id
  chess.move({ from: 'a7', to: 'a8', promotion: 'q' })
  const after = reconcile(before, piecesOf(chess))
  expect(after.find(p => p.id === pawn)).toMatchObject({ type: 'q', square: 'a8' })
})
