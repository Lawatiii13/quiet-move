import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ConfirmDialog, ErrorNote, GameLayout, useChess } from '../components/GameLayout'
import { Chess } from 'chess.js'
import { BOTS, startAnalyst, startBot } from '../lib/bot'
import { GRADES, boardResult, gradeMove, other, reportValue, resultText, winPct, type Color, type Grade, type Result } from '../lib/game'
import { guestName, supabase, useAccount } from '../lib/supabase'
import { confetti } from '../lib/motion'
import { play } from '../lib/sound'

const remembered = () => {
  try { return localStorage.getItem('qm:bot') } catch { return null }
}

const TALLY: Record<Grade, [string, string]> = { best: ['best', 'best'], good: ['good', 'good'], inaccuracy: ['inaccuracy', 'inaccuracies'], mistake: ['mistake', 'mistakes'], blunder: ['blunder', 'blunders'] }

/** Winning chance for the side to move in a finished position, or null while the game goes on. */
function finished(fen: string) {
  const c = new Chess(fen)
  return c.isCheckmate() ? 0 : c.isGameOver() ? 50 : null
}

/** A bot game. With `coach`, a second engine grades every move you make and offers hints and take-backs. */
export default function BotGame({ coach = false }: { coach?: boolean }) {
  const { user, name } = useAccount()
  const game = useChess()
  const [botId, setBotId] = useState(() => BOTS.find(b => b.id === remembered())?.id ?? BOTS[0].id)
  const [color, setColor] = useState<Color>('w')
  const [phase, setPhase] = useState<'setup' | 'play'>('setup')
  const [result, setResult] = useState<Result | null>(null)
  const [thinking, setThinking] = useState(false)
  const [engineDown, setEngineDown] = useState(false)
  const [saved, setSaved] = useState<'no' | 'yes' | 'failed'>('no')
  const [confirm, setConfirm] = useState(false)
  const engine = useRef<ReturnType<typeof startBot> | null>(null)
  const analyst = useRef<ReturnType<typeof startAnalyst> | null>(null)
  // What the coach knows about each position it has seen, by FEN: its move, and the mover's winning chance.
  const [seen, setSeen] = useState<Record<string, { best: string; pct: number }>>({})
  const [arrow, setArrow] = useState<[string, string] | null>(null)
  const lastEval = useRef(50)
  const [review, setReview] = useState(false)
  const [coachDown, setCoachDown] = useState(false)
  const learn = (fen: string) =>
    analyst.current?.analyse(fen).then(
      r => { if (r.score) setSeen(s => ({ ...s, [fen]: { best: r.best, pct: winPct(r.score!) } })) },
      () => setCoachDown(true),
    )
  function reloadCoach() {
    analyst.current?.stop()
    analyst.current = startAnalyst()
    setCoachDown(false)
  }
  const level = BOTS.find(b => b.id === botId)!
  const myTurn = game.chess.turn() === color

  useEffect(() => () => { engine.current?.stop(); analyst.current?.stop() }, [])

  function boot() {
    engine.current?.stop()
    engine.current = startBot(level)
    setEngineDown(false)
  }
  function start() {
    try { localStorage.setItem('qm:bot', botId) } catch { /* choice lasts for this visit only */ }
    game.reset()
    setResult(null)
    setSaved('no')
    boot()
    if (coach) analyst.current ??= startAnalyst()
    setSeen({})
    setReview(false)
    setPhase('play')
    play('start')
  }

  async function finish(r: Result) {
    setResult(r)
    setThinking(false)
    play(r.winner === color ? 'win' : r.winner ? 'lose' : 'draw')
    if (r.winner === color) confetti()
    if (!user || coach) return // take-backs make a coach game meaningless as a result
    const id = crypto.randomUUID()
    const { error } = await supabase.from('games').insert({ id, kind: 'bot', bot: level.name, [color === 'w' ? 'white' : 'black']: user.id })
    const failed = error ?? (await supabase.rpc('report_result', { game_id: id, result: reportValue(r) })).error
    setSaved(failed ? 'failed' : 'yes')
  }

  useEffect(() => {
    if (phase !== 'play' || result) return
    const r = boardResult(game.chess)
    if (r) { finish(r); return }
    if (myTurn || engineDown) return
    let live = true
    setThinking(true)
    // The pause lets the player's own piece finish sliding before the reply lands.
    Promise.all([engine.current!.move(game.fen), new Promise(done => setTimeout(done, 500))]).then(
      ([uci]) => {
        if (!live) return
        setThinking(false)
        if (!game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })) setEngineDown(true)
      },
      () => { if (live) { setThinking(false); setEngineDown(true) } },
    )
    return () => { live = false }
  }, [phase, game.fen, result, engineDown])

  // ---- coach ----
  useEffect(() => {
    setArrow(null)
    const fen = game.fen
    if (!coach || phase !== 'play' || coachDown || seen[fen] || game.chess.isGameOver()) return
    // Not cancelled when the position changes: a late answer is still the "before" of the move just played.
    learn(fen)
    // A fast mover can leave a position before the coach has seen it; catch up on the move just played.
    const prev = game.chess.history({ verbose: true }).at(-1)
    if (prev && !seen[prev.before]) learn(prev.before)
  }, [coach, phase, game.fen, coachDown])

  const moves = game.chess.history({ verbose: true })
  const marks = moves.map(m => {
    const before = seen[m.before]
    const after = seen[m.after]?.pct ?? finished(m.after)
    return (coach || review) && m.color === color && before && after !== null ? gradeMove(before.pct, 100 - after, m.lan === before.best) : undefined
  })
  const mine = moves.findLastIndex(m => m.color === color)
  const judged = mine >= 0 ? moves[mine] : null
  const grade: Grade | undefined = marks[mine]
  const here = seen[game.fen]
  if (here) lastEval.current = game.chess.turn() === 'w' ? here.pct : 100 - here.pct
  const san = (fen: string, uci: string) => { try { return new Chess(fen).move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san } catch { return uci } }
  const lost = judged && grade ? Math.round(seen[judged.before].pct - (100 - (seen[judged.after]?.pct ?? finished(judged.after) ?? 50))) : 0
  const counts = (Object.keys(GRADES) as Grade[]).map(g => [g, marks.filter(m => m === g).length] as const)

  useEffect(() => { if (grade) play(grade) }, [judged?.after, grade])

  // Review: after the game, have the coach look at every position it has not seen yet.
  const mineCount = moves.filter(m => m.color === color).length
  const graded = marks.filter(Boolean).length
  useEffect(() => {
    if (!review || coachDown) return
    analyst.current ??= startAnalyst()
    for (const fen of new Set(moves.flatMap(m => [m.before, m.after]))) {
      if (!seen[fen] && finished(fen) === null) learn(fen)
    }
  }, [review, coachDown])

  function takeBack(showBest: boolean) {
    if (!judged) return
    const best = seen[judged.before]?.best
    while (game.chess.history().length > mine) game.undo()
    // setArrow runs after the position effect has cleared the old arrow
    if (showBest && best) setTimeout(() => setArrow([best.slice(0, 2), best.slice(2, 4)]))
  }

  const status = result ? resultText(result) : phase === 'setup' ? '' : myTurn ? 'Your move.' : `${level.name} is thinking.`

  return (
    <GameLayout
      title={phase === 'setup' ? (coach ? 'Play with the coach' : 'Play a bot') : `You v. ${level.name}`}
      evalWhite={coach && phase === 'play' ? lastEval.current : null}
      marks={marks}
      badge={judged && grade ? { from: judged.from, to: judged.to, grade } : null}
      arrow={arrow}
      chess={game.chess}
      fen={game.fen}
      orientation={color}
      movable={phase === 'play' && !result ? color : null}
      onMove={m => game.move(m)}
      top={{ name: level.name, color: other(color), note: 'Bot' }}
      bottom={{ name: name ?? guestName(), color }}
      idle={phase === 'setup'}
      announce={[game.chess.history().at(-1), grade && GRADES[grade].label, status].filter(Boolean).join('. ')}
    >
      {phase === 'setup' && (
        <form onSubmit={e => { e.preventDefault(); start() }}>
          <fieldset>
            <legend>Opponent</legend>
            {BOTS.map(b => (
              <label key={b.id} className="choice">
                <input type="radio" name="bot" checked={botId === b.id} onChange={() => setBotId(b.id)} />
                <span>
                  <strong>{b.name}</strong>
                  <span className="hint">{b.about}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>Your colour</legend>
            <div className="row">
              {(['w', 'b'] as Color[]).map(c => (
                <label key={c} className="choice inline">
                  <input type="radio" name="color" checked={color === c} onChange={() => setColor(c)} />
                  <span>{c === 'w' ? 'White' : 'Black'}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <p className="hint">{coach ? 'The coach is a second engine. It grades each move you make, shows a better one when you ask, and lets you take moves back. Coach games have no clock and are not kept on your stats.' : 'Bot games have no clock.'}</p>
          <button type="submit" className="btn primary">Start game</button>
        </form>
      )}

      {phase === 'play' && !result && (
        <>
          {engineDown ? (
            <ErrorNote
              detail={`bot engine failed (${level.id})`}
              action={<button type="button" className="btn primary" onClick={boot}>Reload the bot</button>}
            >
              The bot stopped responding, so it can't reply. Your position is kept: reload the bot to go on.
            </ErrorNote>
          ) : (
            <p className="status">
              {thinking && <span className="busy" aria-hidden="true" />}
              {status}
            </p>
          )}
          {coachDown && (
            <ErrorNote detail="coach engine failed" action={<button type="button" className="btn primary" onClick={reloadCoach}>Reload the coach</button>}>
              The coach stopped responding, so your moves are not being graded. The game itself is fine: reload the coach to get grades again.
            </ErrorNote>
          )}
          {coach && judged && !coachDown && (
            <div className="note coach" key={judged.after}>
              {grade ? (
                <>
                  <p><b className={`chip g-${grade}`}>{GRADES[grade].glyph}</b> <strong>{GRADES[grade].label}.</strong>{' '}
                    {grade === 'best' ? `${judged.san} is the move the coach would play.`
                      : grade === 'good' ? `${judged.san} is fine. The coach slightly prefers ${san(judged.before, seen[judged.before].best)}.`
                      : `${judged.san} gives away about ${lost} of your 100 points of winning chance. The coach prefers ${san(judged.before, seen[judged.before].best)}.`}
                  </p>
                  <div className="row">
                    <button type="button" className="btn secondary" onClick={() => takeBack(false)}>Take the move back</button>
                    {grade !== 'best' && <button type="button" className="btn secondary" onClick={() => takeBack(true)}>Show the coach's move</button>}
                  </div>
                </>
              ) : (
                <p className="status"><span className="busy" aria-hidden="true" />The coach is checking {judged.san}.</p>
              )}
            </div>
          )}
          {coach && <p className="hint">Engine estimate: White wins {Math.round(lastEval.current)} games in 100 from here.</p>}
          <div className="row">
            {coach && myTurn && here && !arrow && (
              <button type="button" className="btn secondary" onClick={() => setArrow([here.best.slice(0, 2), here.best.slice(2, 4)])}>Show a hint</button>
            )}
            <button type="button" className="btn secondary" onClick={() => setConfirm(true)}>Resign</button>
          </div>
        </>
      )}

      {result && (
        <div className="result">
          <p className="result-text">{resultText(result)}</p>
          {review && coachDown && (
            <ErrorNote detail="coach engine failed during review" action={<button type="button" className="btn primary" onClick={reloadCoach}>Reload the coach</button>}>
              The coach stopped responding, so the review is not finished. Reload the coach to grade the remaining moves.
            </ErrorNote>
          )}
          {review && !coachDown && graded < mineCount && <p className="status"><span className="busy" aria-hidden="true" />The coach has graded {graded} of your {mineCount} moves.</p>}
          {review && graded === mineCount && <p className="hint">Select a move in the list to see it on the board with its grade.</p>}
          {(coach || review) && (
            <p className="tally">
              {counts.map(([g, n]) => <span key={g}><b className={`chip g-${g}`}>{GRADES[g].glyph}</b> {n} {TALLY[g][n === 1 ? 0 : 1]}</span>)}
            </p>
          )}
          {coach && <p className="hint">Coach games are practice and are not kept on your stats.</p>}
          {saved === 'yes' && <p className="hint">Saved to your <Link to="/stats">stats</Link>.</p>}
          {saved === 'failed' && <p className="hint">This result could not be saved to your stats. Your next game will try again.</p>}
          {!user && !coach && <p className="hint"><Link to="/signup">Create an account</Link> to keep your results.</p>}
          <div className="row">
            <button type="button" className="btn primary" onClick={start}>Play again</button>
            {!coach && !review && mineCount > 0 && <button type="button" className="btn secondary" onClick={() => setReview(true)}>Review the game</button>}
            <button type="button" className="btn secondary" onClick={() => { game.reset(); setResult(null); setPhase('setup') }}>Change opponent</button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirm}
        title={`Resign the game against ${level.name}?`}
        body="The game ends now and counts as a loss."
        confirm="Resign game"
        cancel="Keep playing"
        onConfirm={() => finish({ winner: other(color), reason: 'resign' })}
        onClose={() => setConfirm(false)}
      />
    </GameLayout>
  )
}
