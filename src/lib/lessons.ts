// The course. Every position and answer here is checked by lessons.test.ts.

export type Step = {
  /** Position in FEN. White is always the learner. */
  fen: string
  text: string
  /** Leave out for a step that is only read. Otherwise the moves (in SAN) that count, or 'mate' for any checkmate. */
  accept?: string[] | 'mate'
  /** Shown after a correct move. */
  right?: string
  /** Shown after any other move. */
  wrong?: string
  /** An arrow drawn on the board, as [from, to]. */
  arrow?: [string, string]
  /** True when the position is meant to be stalemate (checked by the test). */
  stalemate?: boolean
}
export type Lesson = { id: string; title: string; summary: string; steps: Step[] }
export type Chapter = { title: string; lessons: Lesson[] }

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const ITALIAN = 'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4'

export const COURSE: Chapter[] = [
  {
    title: 'The pieces',
    lessons: [
      {
        id: 'board', title: 'The board and the goal', summary: 'How squares are named and what winning means.',
        steps: [
          { fen: START, text: 'Chess is played on 64 squares. The columns are called files and run from a to h. The rows are called ranks and run from 1 to 8. A square is named by its file, then its rank: the white king starts on e1.' },
          { fen: START, text: 'White always moves first. Move the pawn from e2 to e4: select it, then select the square two steps ahead.', accept: ['e4'], right: 'That move is written e4. A move is named after the square the piece lands on.', wrong: 'Find the pawn on e2, in front of the king, and move it two squares forward to e4.', arrow: ['e2', 'e4'] },
          { fen: START, text: 'You win by checkmate: the enemy king is attacked and has no way to escape. The king is never actually captured. The game ends the moment it cannot be saved.' },
        ],
      },
      {
        id: 'rook', title: 'The rook', summary: 'Straight lines along files and ranks.',
        steps: [
          { fen: '4k3/8/8/8/3R4/8/8/4K3 w - - 0 1', text: 'The rook moves in straight lines: any number of squares up, down, left or right. From d4 it reaches every square on the d-file and the fourth rank.' },
          { fen: '4k3/8/8/3p4/8/8/8/3RK3 w - - 0 1', text: 'A piece captures by moving onto the square of an enemy piece. Capture the black pawn with your rook.', accept: ['Rxd5'], right: 'Rxd5. The x in the notation means "captures".', wrong: 'The pawn stands on the same file as your rook. Slide the rook straight up to d5.', arrow: ['d1', 'd5'] },
          { fen: '4k3/8/8/8/8/3P4/8/3RK3 w - - 0 1', text: 'Pieces cannot jump over others. Your own pawn on d3 blocks the file, so the rook can only go sideways. Move the rook to the left along the first rank.', accept: ['Ra1', 'Rb1', 'Rc1'], right: 'Right. Until the pawn moves, the d-file is closed to the rook.', wrong: 'The pawn on d3 is in the way, and the king is on e1. Move the rook left, to c1, b1 or a1.' },
        ],
      },
      {
        id: 'bishop', title: 'The bishop', summary: 'Diagonals, and always the same colour.',
        steps: [
          { fen: '4k3/8/8/8/3B4/8/8/4K3 w - - 0 1', text: 'The bishop moves diagonally, any number of squares. It never leaves the colour it starts on, so each side has one bishop for the light squares and one for the dark squares.' },
          { fen: 'k7/8/6p1/8/8/3B4/8/4K3 w - - 0 1', text: 'Capture the pawn with your bishop.', accept: ['Bxg6'], right: 'Bxg6. Three squares along the diagonal.', wrong: 'Follow the diagonal from d3 through e4 and f5 to g6.', arrow: ['d3', 'g6'] },
        ],
      },
      {
        id: 'queen', title: 'The queen', summary: 'Rook and bishop in one piece.',
        steps: [
          { fen: 'k7/8/8/8/3Q4/8/8/4K3 w - - 0 1', text: 'The queen moves like a rook and like a bishop: straight or diagonal, any number of squares. She is the strongest piece on the board.' },
          { fen: 'k7/8/8/7p/8/8/8/3QK3 w - - 0 1', text: 'Capture the pawn on h5 with a diagonal move.', accept: ['Qxh5'], right: 'Qxh5. That was the bishop half of the queen.', wrong: 'Follow the diagonal from d1 through e2, f3 and g4 to h5.', arrow: ['d1', 'h5'] },
          { fen: 'k7/3p4/8/8/8/8/8/3QK3 w - - 0 1', text: 'Now capture the pawn on d7 with a straight move.', accept: ['Qxd7'], right: 'Qxd7. That was the rook half.', wrong: 'The pawn is on your queen\'s file. Slide straight up to d7.', arrow: ['d1', 'd7'] },
        ],
      },
      {
        id: 'knight', title: 'The knight', summary: 'The L-shaped jump.',
        steps: [
          { fen: 'k7/8/8/8/3N4/8/8/4K3 w - - 0 1', text: 'The knight moves in an L: two squares in one direction, then one square to the side. From the middle of the board it can reach eight squares. It always lands on the opposite colour.' },
          { fen: START, text: 'The knight is the only piece that jumps over others. Bring the knight from g1 out to f3, over your own pawns.', accept: ['Nf3'], right: 'Nf3. N stands for knight, because K is taken by the king.', wrong: 'From g1, go two squares up and one to the left: f3.', arrow: ['g1', 'f3'] },
          { fen: 'k7/8/8/4p3/8/3N4/8/4K3 w - - 0 1', text: 'Capture the pawn with your knight.', accept: ['Nxe5'], right: 'Nxe5. Two up, one across.', wrong: 'From d3, go two squares up and one to the right: e5.', arrow: ['d3', 'e5'] },
        ],
      },
      {
        id: 'king', title: 'The king', summary: 'One square at a time, and never into danger.',
        steps: [
          { fen: '4k3/8/8/8/3K4/8/8/8 w - - 0 1', text: 'The king moves one square in any direction. He is slow, and he is the piece you must protect: lose him and you lose the game.' },
          { fen: '4k3/8/8/8/8/8/r7/4K3 w - - 0 1', text: 'A king may never step onto a square an enemy piece attacks. The black rook guards the whole second rank. Move your king to a safe square.', accept: ['Kd1', 'Kf1'], right: 'Right. Every square on the second rank was off limits.', wrong: 'The second rank belongs to the rook. Stay on the first rank: d1 or f1.' },
          { fen: '4k3/8/8/8/8/8/4p3/4K3 w - - 0 1', text: 'The king can capture too, as long as the piece he takes is not protected. Capture the pawn.', accept: ['Kxe2'], right: 'Kxe2. Nothing guarded the pawn, so the king could take it.', wrong: 'The pawn is right in front of your king. Step onto e2.', arrow: ['e1', 'e2'] },
        ],
      },
      {
        id: 'pawn', title: 'The pawn', summary: 'Forward to move, diagonal to capture.',
        steps: [
          { fen: START, text: 'Pawns move straight forward and never go back. From its starting square a pawn may go one square or two. After that, one square at a time.' },
          { fen: '4k3/8/8/8/8/4P3/8/4K3 w - - 0 1', text: 'This pawn has already left its starting square. Move it forward.', accept: ['e4'], right: 'One square is all it can do now.', wrong: 'Move the pawn one square straight ahead, to e4.', arrow: ['e3', 'e4'] },
          { fen: '4k3/8/8/3p1p2/4P3/8/8/4K3 w - - 0 1', text: 'Pawns are the only pieces that capture differently from how they move: one square diagonally forward. Capture one of the black pawns.', accept: ['exd5', 'exf5'], right: 'A pawn capture is written with the file it came from: e takes.', wrong: 'Capture diagonally: to d5 or to f5.' },
        ],
      },
    ],
  },
  {
    title: 'The special rules',
    lessons: [
      {
        id: 'check', title: 'Check', summary: 'Attacking the king, and the three ways out.',
        steps: [
          { fen: '4k3/8/8/8/8/8/8/R3K3 w - - 0 1', text: 'When a king is attacked, he is in check. Put the black king in check with your rook.', accept: ['Ra8+'], right: 'Ra8+. The plus sign means check.', wrong: 'The black king is on the eighth rank. Put your rook on that rank.', arrow: ['a1', 'a8'] },
          { fen: '4k3/8/8/8/8/8/8/r3K3 w - - 0 1', text: 'Now you are in check, and you must get out of it at once. The first way out: move the king away.', accept: ['Kd2', 'Ke2', 'Kf2'], right: 'Out of the rook\'s line. Way one: move the king.', wrong: 'The rook attacks the whole first rank. Step up to the second rank.' },
          { fen: '4k3/8/8/8/8/8/3R4/r3K3 w - - 0 1', text: 'The second way out: put a piece in between. Block the check with your rook.', accept: ['Rd1'], right: 'The rook takes the hit instead of the king. Way two: block.', wrong: 'Drop your rook from d2 to d1, between the black rook and your king.', arrow: ['d2', 'd1'] },
          { fen: '4k3/8/8/8/3B4/8/8/r3K3 w - - 0 1', text: 'The third way out: capture the piece that gives check. Do it with your bishop.', accept: ['Bxa1'], right: 'No attacker, no check. Way three: capture.', wrong: 'Your bishop on d4 looks down the long diagonal at a1.', arrow: ['d4', 'a1'] },
        ],
      },
      {
        id: 'checkmate', title: 'Checkmate', summary: 'Check with no way out wins the game.',
        steps: [
          { fen: '6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1', text: 'Checkmate is a check that cannot be answered: the king cannot move away, nothing can block, and the attacker cannot be captured. Here the black king is boxed in by his own pawns. Deliver checkmate.', accept: 'mate', right: 'Ra8#. The # means checkmate. This pattern is called the back-rank mate.', wrong: 'That is not mate. Check the king along the eighth rank, where his own pawns leave him no escape.', arrow: ['a1', 'a8'] },
          { fen: '7k/8/5K2/8/8/8/8/6Q1 w - - 0 1', text: 'A queen can mate when her own king protects her. Find the checkmate.', accept: 'mate', right: 'Qg7#. The black king cannot capture the queen, because your king guards her.', wrong: 'That lets the king slip away. Put the queen right next to the black king, on a square your own king protects.', arrow: ['g1', 'g7'] },
          { fen: '7k/R7/8/8/8/8/8/1R2K3 w - - 0 1', text: 'Two rooks mate like a ladder: one holds a rank, the other checks on the next. One rook already holds the seventh rank. Finish the game.', accept: 'mate', right: 'Rb8#. The king had the eighth rank only, and now that is attacked too.', wrong: 'The rook on a7 keeps the king on the last rank. Bring the other rook to that rank.', arrow: ['b1', 'b8'] },
        ],
      },
      {
        id: 'castling', title: 'Castling', summary: 'King to safety and rook into play, in one move.',
        steps: [
          { fen: 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1', text: 'Castling is the only move with two pieces. The king goes two squares towards a rook, and that rook jumps to the other side of him. It is allowed only if neither piece has moved, the squares between them are empty, the king is not in check, and he does not cross or land on an attacked square.' },
          { fen: ITALIAN, text: 'Castle on the king\'s side: move your king two squares to the right, to g1.', accept: ['O-O'], right: 'Written O-O. Your king is tucked behind three pawns and the rook has joined the game.', wrong: 'Select the king on e1 and move him two squares to the right, to g1. The rook follows by itself.', arrow: ['e1', 'g1'] },
          { fen: 'r3kbnr/ppp1pppp/2nq4/3p1b2/3P1B2/2NQ4/PPP1PPPP/R3KBNR w KQkq - 6 5', text: 'You can castle on the queen\'s side as well. Move your king two squares to the left, to c1.', accept: ['O-O-O'], right: 'Written O-O-O, with three circles, because the rook travels three squares.', wrong: 'Select the king on e1 and move him two squares to the left, to c1.', arrow: ['e1', 'c1'] },
        ],
      },
      {
        id: 'en-passant', title: 'En passant', summary: 'The pawn capture that surprises everyone once.',
        steps: [
          { fen: '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2', text: 'Black has just moved a pawn two squares, from d7 to d5, landing beside your pawn. If it had moved only one square, you could have captured it on d6. The rule called en passant ("in passing") lets you capture it there anyway, but only on this very move. Capture en passant.', accept: ['exd6'], right: 'exd6. Your pawn lands on d6 and the black pawn on d5 is removed.', wrong: 'Move your pawn diagonally to d6, the square the black pawn skipped over.', arrow: ['e5', 'd6'] },
        ],
      },
      {
        id: 'promotion', title: 'Promotion', summary: 'A pawn that reaches the far side becomes a new piece.',
        steps: [
          { fen: '8/4P3/8/8/8/8/k7/4K3 w - - 0 1', text: 'A pawn that reaches the last rank must turn into a queen, rook, bishop or knight. Nearly always you take a queen. Push the pawn and choose a queen.', accept: ['e8=Q'], right: 'e8=Q. You may have more than one queen at a time.', wrong: 'Push the pawn to e8 and choose the queen: she is the strongest piece.', arrow: ['e7', 'e8'] },
        ],
      },
      {
        id: 'draws', title: 'Draws and stalemate', summary: 'How a game ends with no winner.',
        steps: [
          { fen: '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1', stalemate: true, text: 'It is Black\'s turn here. The black king is not in check, but every square he could go to is attacked, and Black has no other piece to move. This is stalemate, and the game is a draw. A player far ahead must be careful not to allow it.' },
          { fen: '7k/8/6K1/5Q2/8/8/8/8 w - - 0 1', text: 'One move earlier, with White to play. Moving the queen to f7 would be the stalemate you just saw. Find a checkmate instead.', accept: 'mate', right: 'Checkmate. When you are winning, make sure each move gives check or leaves the king a square.', wrong: 'That does not mate, and Qf7 would even be stalemate. Check the king along the eighth rank.', arrow: ['f5', 'f8'] },
          { fen: '8/8/4k3/8/8/4K3/8/8 w - - 0 1', text: 'Other draws: neither side has enough pieces to mate (two bare kings, as here); the same position comes up three times; fifty moves pass with no capture and no pawn move; or the players simply agree.' },
        ],
      },
    ],
  },
  {
    title: 'Playing well',
    lessons: [
      {
        id: 'values', title: 'What the pieces are worth', summary: 'A scale for deciding which trades are good.',
        steps: [
          { fen: START, text: 'Players count pieces in points: pawn 1, knight 3, bishop 3, rook 5, queen 9. The king has no number, because losing him ends the game. Use the scale before every capture: give less than you get.' },
          { fen: 'k7/8/8/3q4/8/8/7p/3RK2R w - - 0 1', text: 'You can capture a pawn or a queen. Take the one worth more.', accept: ['Rxd5'], right: 'Nine points instead of one.', wrong: 'The pawn is worth 1 point and the queen 9. Capture the queen on d5.', arrow: ['d1', 'd5'] },
          { fen: 'k7/8/2p5/3p4/8/8/8/3RK3 w - - 0 1', text: 'Before you capture, check whether the piece is protected. Here the pawn on d5 is guarded by the pawn on c6. Taking it would cost your rook (5) for a pawn (1).', arrow: ['c6', 'd5'] },
        ],
      },
      {
        id: 'forks', title: 'Forks', summary: 'One piece attacks two things at once.',
        steps: [
          { fen: '4k3/8/8/1q1N4/8/8/8/4K3 w - - 0 1', text: 'A fork is one move that attacks two pieces. Your opponent can save only one. Knights are the best forkers. Find the knight move that checks the king and attacks the queen.', accept: ['Nc7+'], right: 'Nc7+. The king has to move out of check, and then you capture the queen.', wrong: 'Look for the square from which the knight reaches both e8 and b5.', arrow: ['d5', 'c7'] },
          { fen: 'k7/8/8/2r1n3/8/3P4/8/4K3 w - - 0 1', text: 'Even a pawn can fork. Attack the rook and the knight with one pawn move.', accept: ['d4'], right: 'd4. The pawn attacks both c5 and e5, and only one piece can run.', wrong: 'Push the pawn one square, so that it attacks diagonally to both sides.', arrow: ['d3', 'd4'] },
        ],
      },
      {
        id: 'pins', title: 'Pins and skewers', summary: 'Attacks along a line with something behind.',
        steps: [
          { fen: '4k3/8/8/4n3/8/8/8/R4K2 w - - 0 1', text: 'A pin attacks a piece that cannot move, because a more valuable piece stands behind it on the same line. Pin the knight to the black king with your rook.', accept: ['Re1'], right: 'Re1. The knight may not move at all: that would put its own king in check.', wrong: 'Put the rook on the same file as the knight and the king.', arrow: ['a1', 'e1'] },
          { fen: '3q4/8/8/3k4/8/8/8/R3K3 w - - 0 1', text: 'A skewer is a pin turned around: the valuable piece stands in front and must move, uncovering the piece behind it. Skewer the king and the queen.', accept: ['Rd1+'], right: 'Rd1+. The king must leave the file, and the queen behind him falls.', wrong: 'Check the king along the d-file, where the queen stands behind him.', arrow: ['a1', 'd1'] },
        ],
      },
      {
        id: 'opening', title: 'How to start a game', summary: 'Three habits for the first ten moves.',
        steps: [
          { fen: START, text: 'Good openings follow three habits. One: put a pawn in the centre. Two: bring out your knights and bishops. Three: castle early. Start by moving a centre pawn two squares.', accept: ['e4', 'd4'], right: 'A centre pawn takes space and opens lines for your queen and a bishop.', wrong: 'Move the pawn in front of your king or your queen two squares forward.' },
          { fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2', text: 'Black answered in kind. Now bring out a knight, towards the centre.', accept: ['Nf3', 'Nc3'], right: 'Knights belong near the centre, where they reach the most squares.', wrong: 'Bring a knight to f3 or c3. On the edge of the board it would reach only half as many squares.' },
          { fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3', text: 'Next, a bishop. Put it on an active square.', accept: ['Bc4', 'Bb5'], right: 'The bishop is out, and the way is clear for castling.', wrong: 'Bring the bishop from f1 to c4 or b5, where it points at Black\'s side of the board.' },
          { fen: ITALIAN, text: 'Your king\'s knight and bishop are out. Finish the job: castle.', accept: ['O-O'], right: 'Centre pawn, pieces out, king safe. That is a sound opening.', wrong: 'Move the king two squares to the right to castle.', arrow: ['e1', 'g1'] },
        ],
      },
      {
        id: 'mates', title: 'Three checkmates to know', summary: 'Patterns that finish real games.',
        steps: [
          { fen: 'k7/2Q5/1K6/8/8/8/8/8 w - - 0 1', text: 'King and queen against a lone king: drive the king to the edge, bring your own king close, then mate. The hard work is done here. Finish it.', accept: 'mate', right: 'Checkmate. Your king covered the escape squares and the queen gave the last check.', wrong: 'Not mate yet. Give check on a square where the black king can neither capture the queen nor step aside.' },
          { fen: 'k7/8/1K6/8/8/8/8/7R w - - 0 1', text: 'King and rook against a lone king works the same way: the kings face each other at the edge and the rook checks along the last rank.', accept: 'mate', right: 'Rh8#. Your king took away a7 and b7, and the rook took the rest.', wrong: 'Check along the eighth rank, where the black king has no square left.', arrow: ['h1', 'h8'] },
          { fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4', text: 'The scholar\'s mate catches beginners in four moves. The queen and bishop both aim at f7, the square only the black king protects. Black has just missed it. Deliver the mate.', accept: 'mate', right: 'Qxf7#. Remember the pattern, so that nobody plays it against you.', wrong: 'Both your queen and your bishop attack f7. Capture there with the queen.', arrow: ['h5', 'f7'] },
        ],
      },
    ],
  },
]

export const LESSONS = COURSE.flatMap(c => c.lessons)

const KEY = 'qm:lessons-done'
export function lessonsDone(): string[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] }
}
export function markLessonDone(id: string) {
  try { localStorage.setItem(KEY, JSON.stringify([...new Set([...lessonsDone(), id])])) } catch { /* progress lasts for this visit only */ }
}
