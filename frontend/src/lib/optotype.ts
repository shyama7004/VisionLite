import rules from '../../../shared/rules.json'
import { makeRng, type Rng } from './rng'

export type Dir = 'up' | 'down' | 'left' | 'right'
export const DIRS: Dir[] = ['up', 'down', 'left', 'right']

export const TEST_DISTANCE_MM = rules.test_distance_mm.chart
export const NEAR_DISTANCE_MM = rules.test_distance_mm.near

// logMAR 1.0 down to 0.0 in steps of 0.1 (eleven lines).
export const CHART_LINES: number[] = Array.from({ length: 11 }, (_, i) => round1(1.0 - i * 0.1))
// Near test starts at 0.8.
export const NEAR_LINES: number[] = CHART_LINES.filter((l) => l <= 0.8)

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/** Height of one symbol in mm: 5 arc minutes at logMAR 0, scaled by 10^logMAR. */
export function heightMm(distanceMm: number, logmar: number): number {
  return distanceMm * 0.0014544 * Math.pow(10, logmar)
}

export function heightPx(distanceMm: number, logmar: number, pxPerMm: number): number {
  return heightMm(distanceMm, logmar) * pxPerMm
}

/**
 * How many symbols fit on one line. Five symbols with a gap of one symbol width
 * need 9 widths. If that is too wide, use 3 (5 widths), then 1.
 */
export function symbolsThatFit(symbolPx: number, screenWidthPx: number): 5 | 3 | 1 {
  const usable = screenWidthPx * 0.92
  if (symbolPx * 9 <= usable) return 5
  if (symbolPx * 5 <= usable) return 3
  return 1
}

/** Pass means at least 60 percent right, rounded up (5 -> 3, 3 -> 2, 1 -> 1). */
export function passNeeded(n: number): number {
  return Math.ceil(0.6 * n)
}

export function snellen(logmar: number): string {
  const key = logmar.toFixed(1) as keyof typeof rules.snellen
  return rules.snellen[key] ?? '6/60+'
}

/** Random directions, never the same direction more than twice in a row. */
export function randomDirs(n: number, rng: Rng): Dir[] {
  const out: Dir[] = []
  while (out.length < n) {
    const d = DIRS[Math.floor(rng() * 4)]
    const k = out.length
    if (k >= 2 && out[k - 1] === d && out[k - 2] === d) continue
    out.push(d)
  }
  return out
}

export interface LineResult {
  logmar: number
  shown: number
  correct: number
  passed: boolean
}

/**
 * Runs one chart or near test. No screen code here, so it is easy to test.
 * Result rule: start at the first line, go down after a pass, stop at the first fail.
 * Result is the smallest passed line. First line fails -> 1.1. All pass -> last line.
 */
export class ChartRun {
  lineIdx = 0
  finished = false
  results: LineResult[] = []
  dirs: Dir[] = []
  answers: (Dir | null)[] = []
  private rng: Rng

  constructor(
    public lines: number[],
    public pxPerMm: number,
    public distanceMm: number,
    public screenWidthPx: number,
    seed: number,
  ) {
    this.rng = makeRng(seed)
    this.startLine()
  }

  get logmar(): number {
    return this.lines[this.lineIdx]
  }
  get symbolPx(): number {
    return heightPx(this.distanceMm, this.logmar, this.pxPerMm)
  }
  get count(): number {
    return symbolsThatFit(this.symbolPx, this.screenWidthPx)
  }

  /** New random directions, used when a line starts or restarts after a distance warning. */
  startLine(): void {
    this.dirs = randomDirs(this.count, this.rng)
    this.answers = []
  }

  /** Answer for the current symbol. null means "cannot tell". Returns true when the line is complete. */
  answer(a: Dir | null): boolean {
    if (this.finished) return false
    this.answers.push(a)
    if (this.answers.length < this.dirs.length) return false
    const correct = this.answers.filter((x, i) => x === this.dirs[i]).length
    const passed = correct >= passNeeded(this.dirs.length)
    this.results.push({ logmar: this.logmar, shown: this.dirs.length, correct, passed })
    if (!passed || this.lineIdx === this.lines.length - 1) {
      this.finished = true
    } else {
      this.lineIdx += 1
      this.startLine()
    }
    return true
  }

  get result(): number {
    const passed = this.results.filter((r) => r.passed)
    if (passed.length === 0) return 1.1
    return Math.min(...passed.map((r) => r.logmar))
  }
}

/**
 * Draws a tumbling E on a 5 by 5 grid. Stroke is one fifth of the height.
 * Arms point in the direction `dir`.
 */
export function drawE(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, dir: Dir): void {
  const u = size / 5
  ctx.save()
  ctx.translate(x + size / 2, y + size / 2)
  const turn = { right: 0, down: 90, left: 180, up: 270 }[dir]
  ctx.rotate((turn * Math.PI) / 180)
  ctx.translate(-size / 2, -size / 2)
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, u, size) // spine on the left, arms point right
  for (const row of [0, 2, 4]) ctx.fillRect(0, row * u, size, u)
  ctx.restore()
}
