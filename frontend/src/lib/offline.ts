import { get, set } from 'idb-keyval'
import { api } from './api'
import type { Session } from './types'

// Visits that could not reach the server wait here, then go up when the network is back.
const QUEUE = 'visionlite.queue'

async function readQueue(): Promise<Record<string, Session>> {
  try {
    return (await get(QUEUE)) ?? {}
  } catch {
    return {}
  }
}

export async function queueSession(s: Session): Promise<void> {
  const q = await readQueue()
  q[s.id] = s
  try {
    await set(QUEUE, q)
  } catch {
    /* storage blocked: nothing more we can do */
  }
}

export async function queueSize(): Promise<number> {
  return Object.keys(await readQueue()).length
}

/** Try to save one session now. If it fails, keep it in the queue. Returns true when it reached the server. */
export async function saveOrQueue(s: Session): Promise<boolean> {
  try {
    await api.putSession(s)
    return true
  } catch {
    await queueSession(s)
    return false
  }
}

/** Send everything waiting. Safe to call often. */
export async function flushQueue(): Promise<number> {
  const q = await readQueue()
  const list = Object.values(q)
  if (list.length === 0) return 0
  try {
    const { ids } = await api.sync(list)
    for (const id of ids) delete q[id]
    await set(QUEUE, q)
    return ids.length
  } catch {
    return 0
  }
}

export function startAutoSync(): void {
  window.addEventListener('online', () => void flushQueue())
  void flushQueue()
}
