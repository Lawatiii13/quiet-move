export type BotLevel = { id: string; name: string; about: string; skill: number; go: string }

// Descriptions state the engine settings only: nobody has measured how these play against rated people.
export const BOTS: BotLevel[] = [
  { id: 'beginner', name: 'Beginner', about: 'Stockfish at skill 0 of 20, looking one move ahead.', skill: 0, go: 'depth 1' },
  { id: 'club', name: 'Club player', about: 'Stockfish at skill 8 of 20, thinking 0.3 seconds per move.', skill: 8, go: 'movetime 300' },
  { id: 'engine', name: 'Full engine', about: 'Stockfish at full skill, thinking one second per move.', skill: 20, go: 'movetime 1000' },
]

/** Stockfish in a worker. `move` resolves with a UCI move such as "e2e4" or "e7e8q". */
export function startBot(level: BotLevel) {
  const worker = new Worker(new URL('engine/stockfish-19-lite-single.js', document.baseURI))
  let waiting: { resolve: (m: string) => void; reject: (e: Error) => void } | null = null
  let failed: Error | null = null
  worker.onmessage = e => {
    const m = /^bestmove (\S+)/.exec(String(e.data))
    if (m && waiting) { waiting.resolve(m[1]); waiting = null }
  }
  worker.onerror = () => {
    failed = new Error('engine failed to load')
    waiting?.reject(failed)
    waiting = null
  }
  worker.postMessage('uci')
  worker.postMessage(`setoption name Skill Level value ${level.skill}`)
  return {
    move: (fen: string) =>
      new Promise<string>((resolve, reject) => {
        if (failed) return reject(failed)
        waiting = { resolve, reject }
        worker.postMessage(`position fen ${fen}`)
        worker.postMessage(`go ${level.go}`)
      }),
    stop: () => worker.terminate(),
  }
}
