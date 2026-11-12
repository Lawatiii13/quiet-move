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

## Train

The Train tab has two parts.

- **Lessons** (`src/lib/lessons.ts`): 18 short lessons in three chapters, from naming the squares to basic checkmates. Each step is a position with a text, and most ask for a move on the board. `src/lib/lessons.test.ts` checks every position and answer with chess.js: the positions are legal, the accepted moves exist, and the mates are mates. Finished lessons are remembered in the browser, so no account is needed.
- **Coach** (`/train/coach`): a bot game in which a second, full-strength Stockfish searches every position 12 half-moves deep. Each of your moves gets a grade from how much winning chance it gave away: best (up to 1 point of 100), good (under 5), inaccuracy (under 10), mistake (under 20), blunder (20 or more). The cut-offs are this site's own choice. The coach also offers a hint, a take-back, and an evaluation bar. Coach games are not saved to stats.

## Study tools on every board

- **Your own marks:** right-click a square to ring it, right-drag to draw an arrow. Doing the same again removes it, and a left click or a move clears them all. Marks are private: the opponent never sees them. This needs a mouse.
- **Looking back:** every move in the move list is a button that puts that position on the board. "Previous move" and "Next move" step through the game, and so do the left and right arrow keys when the list has focus.
- **Flip the board** turns it around.
- **Review the game** appears after a bot game. The coach then grades every move you made, and selecting a move shows its grade on the board.

## Motion and sound

Motion is full by default: pieces are dealt onto the board, moves land with a bounce, captures burst, a win throws confetti, and pages, tables and forms animate in. Sounds are synthesised in `src/lib/sound.ts` with Web Audio, so there are no audio files.

A visitor whose device asks for reduced motion starts in calm mode, where nothing slides, bounces or loops. The footer has switches for motion and sound, and each choice is remembered in the browser.

## Before going live

1. In the Supabase dashboard, under Authentication, set the Site URL to the address the site is served from. Confirmation emails link to that address, and the default is `http://localhost:3000`.
2. Supabase's built-in email sender allows only a few emails per hour. Connect your own SMTP provider before real people sign up.

## Not built

Password reset, ratings, puzzles, review of games against people, arrows on touch screens, chat, spectating, rematch, hover sounds, and time controls other than 10 minutes each. Bot games have no clock.

## Licences

- Chess pieces (`public/pieces.svg`): Cburnett and Rfc1394 via Wikimedia Commons, CC BY-SA 3.0, as packaged by cm-chessboard.
- Stockfish (`public/engine/`): GPL-3.0. The licence text is in `public/engine/Copying.txt` and the source is at the stockfish.js link above. If you distribute a changed engine build, the GPL asks you to publish its source.
