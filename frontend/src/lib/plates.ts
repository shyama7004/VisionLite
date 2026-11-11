import { makeRng, type Rng } from './rng'

// Our own colour plates. A bold seven segment digit is the hidden mask.
// No fonts and no copied test plates.

export interface Dot {
  x: number
  y: number
  r: number
  inDigit: boolean
  color: string
}
export interface Plate {
  size: number
  digit: number
  control: boolean
  dots: Dot[]
}

type Seg = [number, number, number, number] // x, y, w, h in a 0..1 box
const T = 0.15 // segment thickness
const L = 0.25, R = 0.75, TOP = 0.12, MID = 0.5 - T / 2, BOT = 0.88 - T
const SEG: Record<string, Seg> = {
  a: [L, TOP, R - L, T],
  g: [L, MID, R - L, T],
  d: [L, BOT, R - L, T],
  f: [L, TOP, T, MID + T - TOP],
  b: [R - T, TOP, T, MID + T - TOP],
  e: [L, MID, T, BOT + T - MID],
  c: [R - T, MID, T, BOT + T - MID],
}
const DIGITS: Record<number, string> = {
  0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc',
  5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg',
}

/** Is the point (u, v) in the 0..1 box inside the digit? */
export function inDigitMask(digit: number, u: number, v: number): boolean {
  return DIGITS[digit].split('').some((s) => {
    const [x, y, w, h] = SEG[s]
    return u >= x && u <= x + w && v >= y && v <= y + h
  })
}

const hsl = (h: number, s: number, l: number) => `hsl(${h.toFixed(0)} ${s.toFixed(0)}% ${l.toFixed(1)}%)`
// Lightness changes by up to 15 percent so brightness alone does not show the digit.
const jitter = (rng: Rng, l: number) => l * (1 + (rng() * 2 - 1) * 0.15)

function pickColor(rng: Rng, inside: boolean, control: boolean): string {
  if (control) {
    // Strong contrast: blue digit on grey dots.
    return inside ? hsl(215, 70, jitter(rng, 45)) : hsl(0, 0, jitter(rng, 62))
  }
  // Hard for red/green colour difference: oranges and reds against olive and yellow greens.
  return inside
    ? hsl(8 + rng() * 25, 70 + rng() * 10, jitter(rng, 52))
    : hsl(65 + rng() * 30, 45 + rng() * 15, jitter(rng, 50))
}

/** Dart throwing: random dots that do not overlap and stay inside the circle. */
export function generatePlate(seed: number, digit: number, control: boolean, size = 320): Plate {
  const rng = makeRng(seed)
  const R0 = size / 2
  const dots: Dot[] = []
  for (let i = 0; i < 9000 && dots.length < 900; i++) {
    const r = size * (0.012 + rng() * 0.02)
    const ang = rng() * Math.PI * 2
    const d = Math.sqrt(rng()) * (R0 - r - 1)
    const x = R0 + Math.cos(ang) * d
    const y = R0 + Math.sin(ang) * d
    if (dots.some((o) => Math.hypot(o.x - x, o.y - y) < o.r + r + 1)) continue
    const inside = inDigitMask(digit, x / size, y / size)
    dots.push({ x, y, r, inDigit: inside, color: pickColor(rng, inside, control) })
  }
  return { size, digit, control, dots }
}

export function drawPlate(ctx: CanvasRenderingContext2D, p: Plate): void {
  ctx.clearRect(0, 0, p.size, p.size)
  for (const d of p.dots) {
    ctx.beginPath()
    ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2)
    ctx.fillStyle = d.color
    ctx.fill()
  }
}

/** Digits for 6 plates: all different, never 0 or 1. Plate 1 is the control. */
export function plateDigits(seed: number): number[] {
  const rng = makeRng(seed)
  const pool = [2, 3, 4, 5, 6, 7, 8, 9]
  const out: number[] = []
  while (out.length < 6) {
    const d = pool[Math.floor(rng() * pool.length)]
    if (!out.includes(d)) out.push(d)
  }
  return out
}

export interface ColorScore {
  plates_shown: number
  plates_correct: number
  flag: boolean
  invalid: boolean
}

/** answers[i] is the digit tapped for plate i (null = "I see nothing"). Plate 0 is the control. */
export function scoreColor(digits: number[], answers: (number | null)[], controlOk = answers[0] === digits[0]): ColorScore {
  if (!controlOk) return { plates_shown: answers.length, plates_correct: 0, flag: false, invalid: true }
  let wrong = 0
  let correct = 0
  for (let i = 1; i < answers.length; i++) {
    if (answers[i] === digits[i]) correct++
    else wrong++
  }
  return { plates_shown: answers.length, plates_correct: correct + 1, flag: wrong >= 2, invalid: false }
}
