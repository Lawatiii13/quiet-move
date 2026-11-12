export type BotLevel = { id: string; name: string; about: string; skill: number; go: string }

// Descriptions state the engine settings only: nobody has measured how these play against rated people.
export const BOTS: BotLevel[] = [
  { id: 'beginner', name: 'Beginner', about: 'Stockfish at skill 0 of 20, looking one move ahead.', skill: 0, go: 'depth 1' },
  { id: 'club', name: 'Club player', about: 'Stockfish at skill 8 of 20, thinking 0.3 seconds per move.', skill: 8, go: 'movetime 300' },
  { id: 'engine', name: 'Full engine', about: 'Stockfish at full skill, thinking one second per move.', skill: 20, go: 'movetime 1000' },
]

/** Engine score for the side to move: centipawns, or moves until mate (negative = getting mated). */
export type Score = { cp?: number; mate?: number }
export type Reply = { best: string; score: Score | null }

/** Stockfish in a worker. Questions are answered one at a time, in the order asked. */
function engine(setup: string[] = []) {
  const worker = new Worker(new URL('engine/stockfish-19-lite-single.js', document.baseURI))
  let job: { resolve: (r: Reply) => void; reject: (e: Error) => void; score: Score | null } | null = null
  let failed: Error | null = null
  let queue: Promise<unknown> = Promise.resolve()
  worker.onmessage = e => {
    if (!job) return
    const line = String(e.data)
    const s = /^info .*\bscore (cp|mate) (-?\d+)(?! (?:lower|upper)bound)/.exec(line)
    if (s) job.score = s[1] === 'cp' ? { cp: Number(s[2]) } : { mate: Number(s[2]) }
    const m = /^bestmove (\S+)/.exec(line)
    if (m) { job.resolve({ best: m[1], score: job.score }); job = null }
  }
  worker.onerror = () => {
    failed = new Error('engine failed to load')
    job?.reject(failed)
    job = null
  }
  worker.postMessage('uci')
  setup.forEach(s => worker.postMessage(s))
  return {
    ask(fen: string, go: string) {
      const run = () =>
        new Promise<Reply>((resolve, reject) => {
          if (failed) return reject(failed)
          job = { resolve, reject, score: null }
          worker.postMessage(`position fen ${fen}`)
          worker.postMessage(`go ${go}`)
        })
      const answer = queue.then(run, run)
      queue = answer.catch(() => {})
      return answer
    },
    stop: () => worker.terminate(),
  }
}

/** An opponent. `move` resolves with a UCI move such as "e2e4" or "e7e8q". */
export function startBot(level: BotLevel) {
  const e = engine([`setoption name Skill Level value ${level.skill}`])
  return { move: (fen: string) => e.ask(fen, level.go).then(r => r.best), stop: e.stop }
}

/** The coach: full-strength Stockfish searching 12 half-moves deep. */
export function startAnalyst() {
  const e = engine()
  return { analyse: (fen: string) => e.ask(fen, 'depth 12'), stop: e.stop }
}
