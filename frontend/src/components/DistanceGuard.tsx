import { useEffect, useRef, useState, type ReactNode } from 'react'
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'
import { useT } from '../i18n'
import { useStore } from '../state/store'
import { irisDiameterPx, isTurned, loadFocal, distanceMm, median, statusFor } from '../lib/distance'

type Status = 'loading' | 'ok' | 'close' | 'far' | 'noface' | 'turn' | 'failed'

const FPS_MS = 80 // about 12 frames a second, easy on cheap phones
const FAIL_AFTER_MS = 10000 // no face for 10 s: let staff measure with a tape
const NOFACE_AFTER_MS = 1000

/**
 * Wraps a test. The camera measures how far the customer stands. The video stays in
 * memory, is never recorded and never sent anywhere. `children(ok)` tells the test
 * whether the distance is right, so it can hide the chart when it is not.
 */
export function DistanceGuard(props: { testName: string; targetMm: number; children: (ok: boolean) => ReactNode }) {
  const t = useT()
  const logDistance = useStore((s) => s.logDistance)
  const videoRef = useRef<HTMLVideoElement>(null)
  const samples = useRef<number[]>([])
  const [status, setStatus] = useState<Status>('loading')
  const [mm, setMm] = useState<number | null>(null)
  const [tape, setTape] = useState(false)
  const [tapeTicked, setTapeTicked] = useState(false)
  const tapeRef = useRef(false)
  const statusRef = useRef<Status>('loading')

  useEffect(() => {
    let stopped = false
    let stream: MediaStream | null = null
    let landmarker: FaceLandmarker | null = null
    let timer: number | undefined
    let lastFace = performance.now()
    samples.current = []

    const set = (s: Status) => {
      statusRef.current = s
      setStatus(s)
    }

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 1280, height: 720 }, audio: false })
        if (stopped) return stream.getTracks().forEach((tr) => tr.stop())
        const video = videoRef.current!
        video.srcObject = stream
        await video.play()
        const fileset = await FilesetResolver.forVisionTasks('/mediapipe/wasm')
        const make = (delegate: 'GPU' | 'CPU') =>
          FaceLandmarker.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: '/models/face_landmarker.task', delegate },
            runningMode: 'VIDEO',
            numFaces: 1,
          })
        try {
          landmarker = await make('GPU')
        } catch {
          landmarker = await make('CPU')
        }
        if (stopped) return
        lastFace = performance.now()
        timer = window.setInterval(tick, FPS_MS)
      } catch {
        if (!stopped) set('failed')
      }
    }

    function tick() {
      const video = videoRef.current
      if (!video || !landmarker || video.readyState < 2) return
      const now = performance.now()
      const res = landmarker.detectForVideo(video, now)
      const lm = res.faceLandmarks?.[0]
      const iris = lm ? irisDiameterPx(lm, video.videoWidth, video.videoHeight) : null
      if (!lm || iris === null) {
        const gone = now - lastFace
        if (gone > FAIL_AFTER_MS) set('failed')
        else if (gone > NOFACE_AFTER_MS) set('noface')
        return
      }
      lastFace = now
      if (isTurned(lm)) return set('turn')
      const d = distanceMm(iris, loadFocal(video.videoWidth))
      samples.current.push(d)
      if (samples.current.length > 10) samples.current.shift()
      const med = median(samples.current)
      setMm(med)
      set(statusFor(med, props.targetMm))
    }

    void start()
    // Never get stuck: if the camera or model is not ready in 10 s, staff can use a tape instead.
    const loadTimer = window.setTimeout(() => {
      if (statusRef.current === 'loading') set('failed')
    }, FAIL_AFTER_MS)
    return () => {
      window.clearTimeout(loadTimer)
      stopped = true
      window.clearInterval(timer)
      landmarker?.close()
      // Stop every track so the camera light goes off.
      stream?.getTracks().forEach((tr) => tr.stop())
      const m = samples.current.length ? Math.round(median(samples.current)) : null
      logDistance({
        test: props.testName,
        median_mm: m,
        within_range: tapeRef.current || (m !== null && statusFor(m, props.targetMm) === 'ok'),
        source: tapeRef.current ? 'tape' : 'camera',
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.targetMm, props.testName])

  const failed = status === 'failed'
  const ok = tape || status === 'ok'
  const msg: Record<Status, string> = {
    loading: t('dist_wait'),
    ok: t('dist_ok'),
    close: t('dist_close'),
    far: t('dist_far'),
    noface: t('dist_noface'),
    turn: t('dist_turn'),
    failed: t('dist_cam_fail'),
  }
  const arrow = status === 'close' ? '↓' : status === 'far' ? '↑' : ''

  return (
    <div className="guard">
      <div className={`guard-bar ${ok ? 'good' : 'bad'}`} data-testid="guard-status" data-status={tape ? 'tape' : status}>
        <video ref={videoRef} className="guard-video" muted playsInline />
        <span className="guard-msg">
          {tape ? t('dist_tape') : `${arrow} ${msg[status]}`}
          {!tape && mm !== null && status !== 'failed' ? ` (${Math.round(mm / 10)} cm)` : ''}
        </span>
        <span className="guard-target">
          {t('dist_target')} {Math.round(props.targetMm / 10)} cm
        </span>
      </div>
      {failed && !tape && (
        <label className="check tape-check">
          <input
            type="checkbox"
            checked={tapeTicked}
            onChange={(e) => {
              setTapeTicked(e.target.checked)
              tapeRef.current = e.target.checked
              setTape(e.target.checked)
            }}
          />
          {t('dist_tape')}
        </label>
      )}
      <p className="small muted">{t('dist_acc')}</p>
      {props.children(ok)}
    </div>
  )
}
