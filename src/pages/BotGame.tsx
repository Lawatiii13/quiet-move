import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ConfirmDialog, ErrorNote, GameLayout, useChess } from '../components/GameLayout'
import { BOTS, startBot } from '../lib/bot'
import { boardResult, other, reportValue, resultText, type Color, type Result } from '../lib/game'
import { guestName, supabase, useAccount } from '../lib/supabase'
import { confetti } from '../lib/motion'
import { play } from '../lib/sound'

const remembered = () => {
  try { return localStorage.getItem('qm:bot') } catch { return null }
}

export default function BotGame() {
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
  const level = BOTS.find(b => b.id === botId)!
  const myTurn = game.chess.turn() === color

  useEffect(() => () => engine.current?.stop(), [])

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
    setPhase('play')
    play('start')
  }

  async function finish(r: Result) {
    setResult(r)
    setThinking(false)
    play(r.winner === color ? 'win' : r.winner ? 'lose' : 'draw')
    if (r.winner === color) confetti()
    if (!user) return
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

  const status = result ? resultText(result) : phase === 'setup' ? '' : myTurn ? 'Your move.' : `${level.name} is thinking.`

  return (
    <GameLayout
      title={phase === 'setup' ? 'Play a bot' : `You v. ${level.name}`}
      chess={game.chess}
      fen={game.fen}
      orientation={color}
      movable={phase === 'play' && !result ? color : null}
      onMove={m => game.move(m)}
      top={{ name: level.name, color: other(color), note: 'Bot' }}
      bottom={{ name: name ?? guestName(), color }}
      idle={phase === 'setup'}
      announce={[game.chess.history().at(-1), status].filter(Boolean).join('. ')}
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
          <p className="hint">Bot games have no clock.</p>
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
          <div className="row">
            <button type="button" className="btn secondary" onClick={() => setConfirm(true)}>Resign</button>
          </div>
        </>
      )}

      {result && (
        <div className="result">
          <p className="result-text">{resultText(result)}</p>
          {saved === 'yes' && <p className="hint">Saved to your <Link to="/stats">stats</Link>.</p>}
          {saved === 'failed' && <p className="hint">This result could not be saved to your stats. Your next game will try again.</p>}
          {!user && <p className="hint"><Link to="/signup">Create an account</Link> to keep your results.</p>}
          <div className="row">
            <button type="button" className="btn primary" onClick={start}>Play again</button>
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
