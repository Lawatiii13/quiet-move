// Every sound is synthesised with Web Audio, so there are no audio files to load or license.

let ctx: AudioContext | null = null
let noise: AudioBuffer | null = null
let muted = false
try { muted = localStorage.getItem('qm:muted') === '1' } catch { /* sound stays on for this visit */ }

export const isMuted = () => muted
export function setMuted(m: boolean) {
  muted = m
  try { localStorage.setItem('qm:muted', m ? '1' : '0') } catch { /* choice lasts for this visit only */ }
}

function audio() {
  // Browsers refuse audio before the first click or key press; asking earlier only logs a warning.
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return null
  ctx ??= new AudioContext()
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

type ToneOpts = { at?: number; type?: OscillatorType; gain?: number; to?: number }
function tone(freq: number, dur: number, { at = 0, type = 'sine', gain = 0.12, to }: ToneOpts = {}) {
  const c = audio()
  if (!c) return
  const t = c.currentTime + at
  const osc = c.createOscillator(), g = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur)
  g.gain.setValueAtTime(gain, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(g).connect(c.destination)
  osc.start(t)
  osc.stop(t + dur)
}

/** A piece set down on wood: a short band of noise for the click, a low sine for the body. */
function knock(at = 0, gain = 0.5, pitch = 1) {
  const c = audio()
  if (!c) return
  if (!noise) {
    noise = c.createBuffer(1, c.sampleRate * 0.1, c.sampleRate)
    const data = noise.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  }
  const t = c.currentTime + at
  const src = c.createBufferSource(), band = c.createBiquadFilter(), g = c.createGain()
  src.buffer = noise
  band.type = 'bandpass'
  band.frequency.value = 900 * pitch
  band.Q.value = 1.2
  g.gain.setValueAtTime(gain, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07)
  src.connect(band).connect(g).connect(c.destination)
  src.start(t)
  src.stop(t + 0.1)
  tone(170 * pitch, 0.09, { at, gain: gain * 0.6 })
}

const run = (notes: number[], step: number, opts: ToneOpts = {}) =>
  notes.forEach((f, i) => tone(f, step * 1.8, { ...opts, at: i * step }))

const SOUNDS = {
  click: () => tone(700, 0.04, { type: 'triangle', gain: 0.05 }),
  select: () => tone(540, 0.05, { type: 'triangle', gain: 0.07 }),
  move: () => knock(),
  capture: () => { knock(0, 0.7, 1.35); knock(0.07, 0.45, 0.8) },
  castle: () => { knock(); knock(0.13, 0.4, 1.1) },
  promote: () => run([523, 659, 784, 1047], 0.07, { type: 'triangle' }),
  check: () => { tone(880, 0.09, { at: 0.05, type: 'square', gain: 0.05 }); tone(1175, 0.16, { at: 0.15, type: 'square', gain: 0.05 }) },
  start: () => run([392, 523, 659], 0.09, { type: 'triangle' }),
  found: () => run([523, 784, 1047], 0.1, { type: 'triangle' }),
  win: () => run([523, 659, 784, 1047, 1319], 0.11, { type: 'triangle', gain: 0.14 }),
  lose: () => run([440, 392, 330, 262], 0.16, { gain: 0.12 }),
  draw: () => run([440, 440], 0.18, { gain: 0.1 }),
  notify: () => run([660, 880], 0.12, { gain: 0.1 }),
  tick: () => tone(1000, 0.03, { type: 'square', gain: 0.04 }),
  error: () => tone(180, 0.2, { type: 'sawtooth', gain: 0.06, to: 110 }),
  success: () => run([659, 988], 0.09, { type: 'triangle' }),
  on: () => tone(440, 0.15, { type: 'triangle', to: 880 }),
  // The coach's verdicts, from brightest to darkest.
  best: () => run([784, 1175], 0.08, { type: 'triangle', gain: 0.13 }),
  good: () => tone(784, 0.12, { type: 'triangle', gain: 0.09 }),
  inaccuracy: () => tone(466, 0.16, { gain: 0.1 }),
  mistake: () => run([415, 330], 0.11, { gain: 0.11 }),
  blunder: () => { tone(220, 0.3, { type: 'sawtooth', gain: 0.07, to: 80 }); knock(0, 0.5, 0.5) },
}
export type SoundName = keyof typeof SOUNDS

export function play(name: SoundName) {
  if (muted) return
  try { SOUNDS[name]() } catch { /* a browser without Web Audio stays silent */ }
}
