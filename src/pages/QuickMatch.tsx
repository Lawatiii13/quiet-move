import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ErrorNote, GameLayout, useChess } from '../components/GameLayout'
import { saveSeat, type Seat } from '../lib/net'
import type { Color } from '../lib/game'
import { guestName, supabase, useAccount } from '../lib/supabase'

type Waiting = { id: string; name: string; account: boolean; since: number }

export default function QuickMatch() {
  const { user, name, loading } = useAccount()
  const navigate = useNavigate()
  const game = useChess()
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const myName = name ?? guestName()

  useEffect(() => {
    if (loading) return
    // shortcut: browsers pair themselves through a presence channel. Good for a small site;
    // move pairing to the server once the waiting list is long enough for races to show.
    const me: Waiting = { id: crypto.randomUUID(), name: myName, account: !!user, since: Date.now() }
    const ch = supabase.channel('lobby', { config: { presence: { key: me.id }, broadcast: { self: false } } })
    let done = false
    let offer: { gameId: string; color: Color; recorded: boolean } | null = null
    let timeout: ReturnType<typeof setTimeout> | undefined

    const begin = (seat: Seat) => {
      done = true
      saveSeat(seat)
      navigate(`/game/${seat.id}`, { replace: true })
    }

    // Everyone sorts the waiting list the same way; even positions invite the next one down.
    async function tryPair() {
      if (done || offer) return
      const all = Object.values(ch.presenceState<Waiting>()).map(p => p[0]).sort((a, b) => a.since - b.since || a.id.localeCompare(b.id))
      const i = all.findIndex(p => p.id === me.id)
      const opp = all[i + 1]
      if (i < 0 || i % 2 || !opp) return
      const gameId = crypto.randomUUID()
      const color: Color = Math.random() < 0.5 ? 'w' : 'b'
      offer = { gameId, color, recorded: false }
      if (user && opp.account) {
        const { error } = await supabase.from('games').insert({ id: gameId, kind: 'quick', [color === 'w' ? 'white' : 'black']: user.id })
        offer.recorded = !error
      }
      ch.send({ type: 'broadcast', event: 'invite', payload: { to: opp.id, from: me.id, gameId, color, name: me.name, recorded: offer.recorded } })
      timeout = setTimeout(() => { offer = null; tryPair() }, 4000)
    }

    ch.on('presence', { event: 'sync' }, tryPair)
      .on('broadcast', { event: 'invite' }, async ({ payload: p }) => {
        if (done || offer || p.to !== me.id) return
        done = true
        let recorded = !!p.recorded && !!user
        if (recorded) recorded = !(await supabase.rpc('join_game', { game_id: p.gameId })).error
        await ch.send({ type: 'broadcast', event: 'accept', payload: { to: p.from, gameId: p.gameId, name: me.name, recorded } })
        begin({ id: p.gameId, color: p.color === 'w' ? 'b' : 'w', kind: 'quick', recorded, opp: String(p.name) })
      })
      .on('broadcast', { event: 'accept' }, ({ payload: p }) => {
        if (done || !offer || p.to !== me.id || p.gameId !== offer.gameId) return
        begin({ id: offer.gameId, color: offer.color, kind: 'quick', recorded: offer.recorded && !!p.recorded, opp: String(p.name) })
      })
      .subscribe(status => {
        if (status === 'SUBSCRIBED') { setError(false); ch.track(me) }
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setError(true)
      })

    return () => { done = true; clearTimeout(timeout); supabase.removeChannel(ch) }
  }, [loading, attempt])

  return (
    <GameLayout
      title="Find an opponent"
      chess={game.chess}
      fen={game.fen}
      orientation="w"
      top={{ name: 'Opponent', color: 'b', note: 'not found yet' }}
      bottom={{ name: myName, color: 'w' }}
      idle
      announce={error ? 'Search failed.' : 'Looking for an opponent.'}
    >
      {error ? (
        <ErrorNote
          detail="lobby channel failed"
          action={<button type="button" className="btn primary" onClick={() => setAttempt(a => a + 1)}>Search again</button>}
        >
          The game server can't be reached, so nobody can be paired with you. Check your connection and search again.
        </ErrorNote>
      ) : (
        <>
          <p className="status"><span className="busy" aria-hidden="true" />Looking for an opponent.</p>
          <p className="hint">
            You are paired with the next person who searches. Each side gets 10 minutes.
            Colours are drawn at random.
          </p>
        </>
      )}
      <div className="row">
        <Link className="btn secondary" to="/">Stop searching</Link>
        <Link className="btn quiet" to="/play/bot">Play a bot instead</Link>
      </div>
    </GameLayout>
  )
}
