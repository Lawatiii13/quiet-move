import { useEffect, useReducer, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { Chess } from 'chess.js'
import { ConfirmDialog, ErrorNote, GameLayout, useChess, useTitle } from '../components/GameLayout'
import { START_MS, boardResult, other, reportValue, resultText, type Color, type Result } from '../lib/game'
import { loadSeat, loadState, saveSeat, saveState, type Seat } from '../lib/net'
import { guestName, supabase, useAccount } from '../lib/supabase'
import { confetti } from '../lib/motion'
import { play } from '../lib/sound'

/** Creates a duel for the signed-in player and moves on to its game page, which doubles as the invite link. */
export function NewDuel() {
  useTitle('Duel a friend')
  const { user, loading } = useAccount()
  const navigate = useNavigate()
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!user) return
    let live = true
    const id = crypto.randomUUID()
    supabase
      .from('games')
      .insert({ id, kind: 'duel', [Math.random() < 0.5 ? 'white' : 'black']: user.id })
      .then(({ error }) => {
        if (!live) return
        if (error) setFailed(true)
        else navigate(`/game/${id}`, { replace: true })
      })
    return () => { live = false }
  }, [user, attempt])

  if (!loading && !user) return <Navigate to="/login?next=/duel/new" replace />
  return (
    <main id="main" tabIndex={-1} className="page prose">
      <h1>Duel a friend</h1>
      {failed ? (
        <ErrorNote
          detail="duel insert failed"
          action={<button type="button" className="btn primary" onClick={() => { setFailed(false); setAttempt(a => a + 1) }}>Create the duel again</button>}
        >
          The duel could not be created, so there is no link to send yet. Check your connection and create it again.
        </ErrorNote>
      ) : (
        <p className="status"><span className="busy" aria-hidden="true" />Setting up the board.</p>
      )}
    </main>
  )
}

export default function NetGame() {
  const { id = '' } = useParams()
  const { user, loading } = useAccount()
  const [seat, setSeat] = useState<Seat | 'login' | 'missing' | null>(() => loadSeat(id))

  useEffect(() => {
    if (seat || loading) return
    if (!user) return setSeat('login')
    let live = true
    supabase.rpc('join_game', { game_id: id }).then(({ data, error }) => {
      if (!live) return
      if (error || !data) return setSeat('missing')
      const s: Seat = { id, color: data.white === user.id ? 'w' : 'b', kind: data.kind, recorded: true }
      saveSeat(s)
      setSeat(s)
    })
    return () => { live = false }
  }, [id, user, loading, seat])

  if (seat === 'login') return <Navigate to={`/login?next=/game/${id}`} replace />
  if (seat === 'missing')
    return (
      <main id="main" tabIndex={-1} className="page prose">
        <h1>This game can't be opened</h1>
        <p>The link may be incomplete, or the duel already has two players. Ask your friend for a new link, or start a game of your own.</p>
        <div className="row">
          <Link className="btn primary" to="/duel/new">Duel a friend</Link>
          <Link className="btn secondary" to="/">Go to the lobby</Link>
        </div>
      </main>
    )
  if (!seat)
    return (
      <main id="main" tabIndex={-1} className="page prose" aria-busy="true">
        <h1>Opening the game</h1>
        <p className="status"><span className="busy" aria-hidden="true" />Finding your seat.</p>
      </main>
    )
  return <Room key={seat.id} seat={seat} />
}

type Offer = 'none' | 'sent' | 'received' | 'declined'
type Actions = { move(m: { from: string; to: string; promotion?: string }): void; resign(): void; draw(a: 'offer' | 'accept' | 'decline'): void }

function Room({ seat }: { seat: Seat }) {
  const { user, name } = useAccount()
  const me = seat.color
  const opp = other(me)
  const myName = name ?? guestName()
  const saved = useRef(loadState(seat.id)).current
  const game = useChess(saved?.sans)
  const chess = game.chess
  // Everything the network handlers read lives in one ref, so they never see a stale render.
  const st = useRef({
    clock: saved?.clock ?? ({ w: START_MS, b: START_MS } as Record<Color, number>),
    turnStart: saved?.turnStart ?? (null as number | null),
    result: saved?.result ?? (null as Result | null),
    offer: 'none' as Offer,
    oppHere: false,
    oppName: seat.opp ?? null,
    down: false,
    saveFailed: false,
  }).current
  const [, render] = useReducer((x: number) => x + 1, 0)
  const act = useRef<Actions | null>(null)
  const [confirm, setConfirm] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const ch = supabase.channel(`game:${seat.id}`, { config: { presence: { key: me }, broadcast: { self: false } } })
    const send = (event: string, payload: object = {}) => { ch.send({ type: 'broadcast', event, payload }) }
    const snapshot = () => ({ sans: chess.history(), clock: st.clock, turnStart: st.turnStart, result: st.result })
    const persist = () => saveState(seat.id, snapshot())

    function finish(r: Result) {
      if (st.result) return
      st.result = r
      st.turnStart = null
      persist()
      render()
      play(r.winner === me ? 'win' : r.winner ? 'lose' : 'draw')
      if (r.winner === me) confetti()
    }
    function afterMove() {
      persist()
      const r = boardResult(chess)
      if (r) finish(r)
      game.refresh()
    }

    ch.on('presence', { event: 'sync' }, () => {
      const o = ch.presenceState<{ name: string }>()[opp]?.[0]
      st.oppHere = !!o
      if (o) {
        st.oppName = String(o.name).slice(0, 24)
        // White's clock starts the first time both players are in the room.
        if (!st.turnStart && !chess.history().length && !st.result) { st.turnStart = Date.now(); play('start') }
        persist()
        send('sync', snapshot())
      }
      render()
    })
      .on('broadcast', { event: 'move' }, ({ payload: p }) => {
        if (st.result) return
        const n = chess.history().length
        if (p.n > n) return send('syncreq')
        if (p.n < n || chess.turn() !== opp) return
        try { chess.move(String(p.san)) } catch { return } // an illegal move from the other side is dropped
        st.clock[opp] = Math.max(0, Math.min(st.clock[opp], Number(p.t) || 0))
        st.turnStart = Date.now()
        if (st.offer !== 'received') st.offer = 'none'
        afterMove()
      })
      .on('broadcast', { event: 'syncreq' }, () => send('sync', snapshot()))
      .on('broadcast', { event: 'sync' }, ({ payload: p }) => {
        // Catch up on moves missed while offline. Only the other side's own moves and clock are taken.
        const mine = chess.history()
        if (!st.result && Array.isArray(p.sans) && p.sans.length > mine.length && mine.every((s, i) => s === p.sans[i])) {
          const check = new Chess()
          try { for (const s of p.sans) check.move(String(s)) } catch { return }
          for (const s of p.sans.slice(mine.length)) chess.move(String(s))
          st.clock[opp] = Math.max(0, Math.min(st.clock[opp], Number(p.clock?.[opp]) || 0))
          st.turnStart = Date.now()
          afterMove()
        }
        // A result is believed only when it goes against the side that sent it.
        if (p.result?.winner === me && ['resign', 'time'].includes(p.result.reason)) finish({ winner: me, reason: p.result.reason })
      })
      .on('broadcast', { event: 'resign' }, () => finish({ winner: me, reason: 'resign' }))
      .on('broadcast', { event: 'flag' }, () => finish({ winner: me, reason: 'time' }))
      .on('broadcast', { event: 'draw' }, ({ payload: p }) => {
        if (st.result) return
        if (p.a === 'offer') { st.offer = 'received'; play('notify') }
        else if (p.a === 'accept' && st.offer === 'sent') return finish({ winner: null, reason: 'agreed' })
        else if (p.a === 'decline' && st.offer === 'sent') st.offer = 'declined'
        render()
      })
      .subscribe(status => {
        if (status === 'SUBSCRIBED') { st.down = false; ch.track({ name: myName }) }
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') st.down = true
        render()
      })

    let ticks = 0
    let lastSecond = 99
    const timer = setInterval(() => {
      if (!st.result && st.turnStart) {
        const turn = chess.turn()
        const left = st.clock[turn] - (Date.now() - st.turnStart)
        // Count the last ten seconds of your own clock out loud.
        const sec = Math.ceil(left / 1000)
        if (turn === me && sec <= 10 && sec > 0 && sec !== lastSecond) play('tick')
        lastSecond = sec
        if (turn === me && left <= 0) {
          st.clock[me] = 0
          send('flag')
          finish({ winner: opp, reason: 'time' })
        } else if (turn === opp && left <= -3000) {
          // The other side should have flagged itself; after 3 seconds of silence, claim it.
          st.clock[opp] = 0
          finish({ winner: me, reason: 'time' })
        }
        // A broadcast can get lost. Resending the whole game every 10 seconds repairs that.
        if (++ticks % 40 === 0) send('sync', snapshot())
      }
      render()
    }, 250)

    act.current = {
      move(m) {
        if (st.result || !st.turnStart || chess.turn() !== me) return
        let mv
        try { mv = chess.move(m) } catch { return }
        const now = Date.now()
        st.clock[me] = Math.max(0, st.clock[me] - (now - st.turnStart))
        st.turnStart = now
        st.offer = 'none'
        send('move', { n: chess.history().length - 1, san: mv.san, t: st.clock[me] })
        afterMove()
      },
      resign() {
        send('resign')
        finish({ winner: opp, reason: 'resign' })
      },
      draw(a) {
        send('draw', { a })
        if (a === 'offer') st.offer = 'sent'
        else if (a === 'decline') st.offer = 'none'
        else return finish({ winner: null, reason: 'agreed' })
        render()
      },
    }
    return () => { clearInterval(timer); supabase.removeChannel(ch) }
  }, [seat.id])

  // Reported from an effect, not from finish(): after a reload the result can be known before the session is.
  const result = st.result
  useEffect(() => {
    if (!result || !seat.recorded || !user) return
    supabase.rpc('report_result', { game_id: seat.id, result: reportValue(result) }).then(({ error }) => {
      st.saveFailed = !!error
      render()
    })
  }, [result, user?.id])

  const started = !!st.turnStart || chess.history().length > 0
  const turn = chess.turn()
  const left = (c: Color) => st.clock[c] - (!st.result && st.turnStart && turn === c ? Date.now() - st.turnStart : 0)
  const oppLabel = st.oppName ?? 'Opponent'
  const link = location.href
  const status = st.result
    ? resultText(st.result)
    : !started
      ? 'Waiting for your opponent.'
      : turn === me ? 'Your move.' : `${oppLabel} to move.`

  return (
    <GameLayout
      title={seat.kind === 'duel' ? `Duel with ${st.oppName ?? 'a friend'}` : `You v. ${oppLabel}`}
      chess={chess}
      fen={game.fen}
      orientation={me}
      movable={started && !st.result ? me : null}
      onMove={m => act.current?.move(m)}
      top={{ name: oppLabel, color: opp, clock: left(opp), running: started && !st.result && turn === opp, note: started && !st.oppHere && !st.result ? 'disconnected' : undefined }}
      bottom={{ name: myName, color: me, clock: left(me), running: started && !st.result && turn === me }}
      announce={[chess.history().at(-1), status].filter(Boolean).join('. ')}
    >
      {st.down && (
        <ErrorNote detail={`game channel down (${seat.id})`}>
          The game server can't be reached, so moves are not getting through. Check your connection: the game reconnects by itself and your clock keeps running.
        </ErrorNote>
      )}

      {!started && seat.kind === 'duel' && (
        <>
          <p className="status"><span className="busy" aria-hidden="true" />Waiting for your friend.</p>
          <label htmlFor="invite">Invite link</label>
          <div className="row tight">
            <input id="invite" readOnly value={link} onFocus={e => e.currentTarget.select()} />
            <button
              type="button"
              className="btn primary"
              onClick={() => navigator.clipboard.writeText(link).then(() => setCopied(true), () => setCopied(false))}
            >
              {copied ? 'Link copied' : 'Copy link'}
            </button>
          </div>
          <p className="hint">Send the link to one friend. They need an account. The game starts when they open it, with 10 minutes each.</p>
        </>
      )}
      {!started && seat.kind === 'quick' && (
        <p className="status"><span className="busy" aria-hidden="true" />Waiting for {oppLabel} to connect.</p>
      )}

      {started && !st.result && (
        <>
          <p className="status">{status}</p>
          {!st.oppHere && <p className="hint">{oppLabel} disconnected. Their clock keeps running, and you win if it runs out.</p>}
          {st.offer === 'received' && (
            <div className="note">
              <p>{oppLabel} offers a draw.</p>
              <div className="row">
                <button type="button" className="btn primary" onClick={() => act.current?.draw('accept')}>Accept draw</button>
                <button type="button" className="btn secondary" onClick={() => act.current?.draw('decline')}>Decline draw</button>
              </div>
            </div>
          )}
          {st.offer === 'sent' && <p className="hint">Draw offered. Waiting for an answer.</p>}
          {st.offer === 'declined' && <p className="hint">Draw declined.</p>}
          <div className="row">
            {st.offer !== 'received' && (
              <button type="button" className="btn secondary" aria-disabled={st.offer === 'sent'} onClick={() => st.offer !== 'sent' && act.current?.draw('offer')}>
                Offer a draw
              </button>
            )}
            <button type="button" className="btn secondary" onClick={() => setConfirm(true)}>Resign</button>
          </div>
        </>
      )}

      {st.result && (
        <div className="result">
          <p className="result-text">{resultText(st.result)}</p>
          {seat.recorded && user && !st.saveFailed && <p className="hint">This game counts on your <Link to="/stats">stats</Link> once both players' results match.</p>}
          {seat.recorded && user && st.saveFailed && <p className="hint">This result could not be saved, so the game will not count on your stats.</p>}
          {!seat.recorded && user && <p className="hint">Games against guests are not kept on your stats.</p>}
          {!user && <p className="hint"><Link to="/signup">Create an account</Link> to keep your results and duel friends.</p>}
          <div className="row">
            <Link className="btn primary" to="/play/quick">Find a new opponent</Link>
            <Link className="btn secondary" to="/">Go to the lobby</Link>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirm}
        title={`Resign the game against ${oppLabel}?`}
        body="The game ends now and counts as a loss."
        confirm="Resign game"
        cancel="Keep playing"
        onConfirm={() => act.current?.resign()}
        onClose={() => setConfirm(false)}
      />
    </GameLayout>
  )
}
