import { Chess } from 'chess.js'
import { expect, test } from 'vitest'
import { gradeMove, material, winPct } from './game'
import { LESSONS } from './lessons'

const bare = (san: string) => san.replace(/[+#]/g, '')

test('every lesson step is a legal position with answers that do what the text says', () => {
  expect(new Set(LESSONS.map(l => l.id)).size).toBe(LESSONS.length)
  for (const lesson of LESSONS) {
    for (const [i, step] of lesson.steps.entries()) {
      const where = `${lesson.id} step ${i + 1}`
      const chess = new Chess(step.fen) // throws on an illegal position
      const legal = chess.moves()
      if (step.stalemate) expect(chess.isStalemate(), where).toBe(true)
      if (step.arrow) expect(step.arrow.every(s => /^[a-h][1-8]$/.test(s)), where).toBe(true)
      if (!step.accept) continue
      expect(chess.turn(), where).toBe(lesson.side ?? 'w')
      expect(step.right && step.wrong, where).toBeTruthy()
      if (step.accept === 'mate') {
        const mates = legal.filter(m => m.endsWith('#'))
        expect(mates.length, where).toBeGreaterThan(0)
        // the arrow, when given, must point at one of the mates
        if (step.arrow) expect(chess.moves({ verbose: true }).some(m => m.from === step.arrow![0] && m.to === step.arrow![1] && m.san.endsWith('#')), where).toBe(true)
      } else {
        for (const san of step.accept) expect(legal, `${where}: ${san}`).toContain(san)
        if (step.arrow) expect(chess.moves({ verbose: true }).some(m => m.from === step.arrow![0] && m.to === step.arrow![1] && step.accept!.includes(m.san)), where).toBe(true)
      }
    }
  }
})

test('claims made in the lesson texts hold on the board', () => {
  const after = (fen: string, san: string) => { const c = new Chess(fen); c.move(san); return c }
  const step = (id: string, n: number) => LESSONS.find(l => l.id === id)!.steps[n]
  expect(after(step('draws', 1).fen, 'Qf7').isStalemate()).toBe(true)                 // "Qf7 would be stalemate"
  expect(after(step('forks', 0).fen, 'Nc7+').moves().every(m => bare(m).startsWith('K'))).toBe(true) // king must move
  expect(after(step('pins', 0).fen, 'Re1').moves().some(m => m.startsWith('N'))).toBe(false) // pinned knight cannot move
  expect(after(step('values', 2).fen, 'Rxd5').moves()).toContain('cxd5')              // the pawn is guarded
  expect(new Chess(step('draws', 2).fen).isInsufficientMaterial()).toBe(true)
})

test('win chance and move grades', () => {
  expect(winPct({ cp: 0 })).toBe(50)
  expect(winPct({ cp: 300 })).toBeGreaterThan(70)
  expect(winPct({ mate: 3 })).toBe(100)
  expect(winPct({ mate: -1 })).toBe(0)
  expect(winPct({ mate: 0 })).toBe(0) // the side to move is already mated
  expect(gradeMove(60, 40, true)).toBe('best')
  expect(gradeMove(60, 59.5, false)).toBe('best')
  expect(gradeMove(60, 57, false)).toBe('good')
  expect(gradeMove(60, 53, false)).toBe('inaccuracy')
  expect(gradeMove(60, 45, false)).toBe('mistake')
  expect(gradeMove(60, 30, false)).toBe('blunder')
})

test('material count', () => {
  expect(material(new Chess())).toEqual({ w: { taken: [], lead: 0 }, b: { taken: [], lead: 0 } })
  const m = material(new Chess('rnb1kbnr/pppppppp/8/8/8/8/PPPPPPP1/RNBQKBNR w KQkq - 0 1')) // black queen and one white pawn gone
  expect(m.w).toEqual({ taken: ['q'], lead: 8 })
  expect(m.b).toEqual({ taken: ['p'], lead: -8 })
})
