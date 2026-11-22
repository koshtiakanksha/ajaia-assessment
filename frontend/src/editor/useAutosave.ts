import { useCallback, useEffect, useRef, useState } from 'react'

export type SaveStatus = 'saved' | 'pending' | 'saving' | 'offline' | 'error'

const DEBOUNCE_MS = 800
const RETRY_MS = 4000

/**
 * Google Docs-style autosave: save shortly after the user stops typing,
 * never run two saves at once, and retry automatically if the network fails.
 *
 * `save` should throw an Error whose `retryable` flag is true for transient
 * failures (server unreachable). Other errors (e.g. access revoked) stop
 * retrying and are shown to the user.
 */
export function useAutosave(save: () => Promise<void>) {
  const [status, setStatus] = useState<SaveStatus>('saved')
  const [error, setError] = useState<string | null>(null)
  const saveRef = useRef(save)
  const timer = useRef<number | undefined>(undefined)
  const inFlight = useRef<Promise<boolean> | null>(null)
  const dirty = useRef(false) // changes not yet sent
  const flushRef = useRef<() => Promise<boolean>>(async () => true) // for retries/re-saves

  useEffect(() => {
    saveRef.current = save
  }, [save])

  const flush = useCallback(async (): Promise<boolean> => {
    window.clearTimeout(timer.current)
    if (inFlight.current) await inFlight.current // let the current save finish first
    if (!dirty.current) return true
    dirty.current = false
    setStatus('saving')
    const run = (async () => {
      try {
        await saveRef.current()
        if (!dirty.current) setStatus('saved')
        setError(null)
        return true
      } catch (e) {
        dirty.current = true // keep the changes queued
        const err = e as Error & { retryable?: boolean }
        setError(err.message)
        if (err.retryable) {
          setStatus('offline')
          timer.current = window.setTimeout(() => void flushRef.current(), RETRY_MS)
        } else {
          setStatus('error')
        }
        return false
      } finally {
        inFlight.current = null
      }
    })()
    inFlight.current = run
    const ok = await run
    // More edits arrived while saving: save them too.
    if (ok && dirty.current) return flushRef.current()
    return ok
  }, [])

  useEffect(() => {
    flushRef.current = flush
  }, [flush])

  /** Call on every change. */
  const markDirty = useCallback(() => {
    dirty.current = true
    setStatus((s) => (s === 'saving' ? s : 'pending'))
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => void flush(), DEBOUNCE_MS)
  }, [flush])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const hasUnsavedChanges = status !== 'saved'
  return { status, error, markDirty, flush, hasUnsavedChanges }
}
