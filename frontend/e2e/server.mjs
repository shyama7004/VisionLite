// Starts the real backend (serving the built app) on a throwaway data folder, for the e2e tests.
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { existsSync } from 'node:fs'

const root = resolve(import.meta.dirname, '..', '..')
const py = existsSync(join(root, 'backend', '.venv', 'Scripts', 'python.exe'))
  ? join(root, 'backend', '.venv', 'Scripts', 'python.exe')
  : join(root, 'backend', '.venv', 'bin', 'python')

const child = spawn(py, ['-m', 'uvicorn', 'app.main:app', '--port', '8123'], {
  cwd: join(root, 'backend'),
  stdio: 'inherit',
  env: {
    ...process.env,
    DATA_DIR: mkdtempSync(join(tmpdir(), 'visionlite-e2e-')),
    STATIC_DIR: join(root, 'frontend', 'dist'),
    WHISPER_PRELOAD: '0',
  },
})
const stop = () => child.kill()
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
child.on('exit', (c) => process.exit(c ?? 0))
