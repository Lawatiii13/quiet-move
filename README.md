# Quiet Move

A chess site. Anyone can play three bots or get paired with whoever else is searching. People with an account can also duel a friend by link and see their wins, draws and losses.

## Run it

```bash
npm install
```

```bash
npm run dev
```

`npm test` runs the unit tests. `npm run build` type-checks and writes the static site to `dist/`, which any static host can serve.

## How it works

| Part | Where | Notes |
| --- | --- | --- |
| Rules of chess | [chess.js](https://github.com/jhlywa/chess.js) | Every move is checked in the browser, including the other player's. |
| Bots | `public/engine/` | Stockfish 19 (lite, single-threaded) from [stockfish.js](https://github.com/nmrugg/stockfish.js) v19.0.1, run in a web worker at three skill settings. |
| Accounts | Supabase Auth | Email and password. A database trigger creates the public profile. |
| Live games | Supabase Realtime | Moves, clocks, draw offers and resignations travel between the two browsers on a channel named after the game id. |
| Stats | `games` table | One row per game that can count. See below. |

The database schema is in `supabase/migrations/`. The Supabase URL and publishable key are in `src/lib/supabase.ts`; both are meant to be public.

### How a result gets counted

No server replays the moves. Each player's browser reports the result it saw, and a game between two people counts only when both reports agree. If one player reports and the other stays silent for 15 minutes, the lone report counts. If the reports differ, the game counts for nobody. Bot games count on the player's own report.

This is enough for personal win and loss totals. It is not enough for ratings or a leaderboard: add a server-side arbiter (an Edge Function that validates each move) before building those.

## Before going live

1. In the Supabase dashboard, under Authentication, set the Site URL to the address the site is served from. Confirmation emails link to that address, and the default is `http://localhost:3000`.
2. Supabase's built-in email sender allows only a few emails per hour. Connect your own SMTP provider before real people sign up.

## Not built

Password reset, ratings, chat, spectating, rematch, game review, sound, and time controls other than 10 minutes each. Bot games have no clock.

## Licences

- Chess pieces (`public/pieces.svg`): Cburnett and Rfc1394 via Wikimedia Commons, CC BY-SA 3.0, as packaged by cm-chessboard.
- Stockfish (`public/engine/`): GPL-3.0. The licence text is in `public/engine/Copying.txt` and the source is at the stockfish.js link above. If you distribute a changed engine build, the GPL asks you to publish its source.
