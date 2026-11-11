import { useEffect, useRef, useState } from 'react'
import { useStore } from '../state/store'
import { Shell } from '../components/Shell'
import { focalFromCard, saveFocal } from '../lib/distance'

// One time camera calibration (staff only). Hold a bank card at exactly 400 mm from the phone,
// freeze the picture, tap the two side edges of the card. This gives the focal length in pixels.
export function CameraCal() {
  const go = useStore((s) => s.go)
  const video = useRef<HTMLVideoElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [frozen, setFrozen] = useState(false)
  const [pts, setPts] = useState<number[][]>([])
  const [msg, setMsg] = useState('')
  const stream = useRef<MediaStream | null>(null)

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user', width: 1280, height: 720 }, audio: false })
      .then((s) => {
        stream.current = s
        if (video.current) {
          video.current.srcObject = s
          void video.current.play()
        }
      })
      .catch(() => setMsg('Camera not available.'))
    return () => stream.current?.getTracks().forEach((x) => x.stop())
  }, [])

  const freeze = () => {
    const v = video.current!
    const c = canvas.current!
    c.width = v.videoWidth
    c.height = v.videoHeight
    c.getContext('2d')!.drawImage(v, 0, 0)
    setFrozen(true)
  }

  const tap = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const c = canvas.current!
    const r = c.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * c.width
    const y = ((e.clientY - r.top) / r.height) * c.height
    if (pts.length < 2) setPts([...pts, [x, y]])
  }

  const save = () => {
    const c = canvas.current!
    const px = Math.abs(pts[0][0] - pts[1][0])
    const f = focalFromCard(px)
    saveFocal(f, c.width)
    setMsg(`Saved. Focal length ${Math.round(f)} px. Accuracy is about plus or minus 15 percent.`)
  }

  return (
    <Shell title="Camera calibration" onBack={() => go('welcome')}>
      <p>Hold a bank card at exactly 400 mm (use a ruler) from the phone, facing the camera. Press Freeze. Tap the left and right edge of the card.</p>
      <video ref={video} muted playsInline style={{ width: '100%', display: frozen ? 'none' : 'block' }} />
      <canvas ref={canvas} onClick={tap} data-testid="cal-canvas" style={{ width: '100%', display: frozen ? 'block' : 'none' }} />
      {!frozen ? (
        <button className="primary big" onClick={freeze}>Freeze</button>
      ) : (
        <div className="row">
          <button className="ghost" onClick={() => { setFrozen(false); setPts([]) }}>Retry</button>
          <button className="primary" disabled={pts.length < 2} onClick={save}>Save</button>
        </div>
      )}
      {msg && <div className="banner info">{msg}</div>}
    </Shell>
  )
}
