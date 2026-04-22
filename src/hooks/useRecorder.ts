import { useCallback, useEffect, useRef, useState } from 'react'

export type RecorderStatus = 'idle' | 'recording' | 'paused' | 'stopped'

export interface RecorderResult {
  blob: Blob
  mimeType: string
  durationMs: number
}

function pickMime(): string {
  if (typeof MediaRecorder === 'undefined') return ''
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4;codecs=mp4a.40.2',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ]
  for (const m of candidates) {
    if (MediaRecorder.isTypeSupported(m)) return m
  }
  return ''
}

export function useRecorder() {
  const [status, setStatus] = useState<RecorderStatus>('idle')
  const [elapsedMs, setElapsedMs] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startedAtRef = useRef<number>(0)
  const accumulatedRef = useRef<number>(0)
  const tickRef = useRef<number | null>(null)
  const resolveRef = useRef<((r: RecorderResult) => void) | null>(null)
  const rejectRef = useRef<((e: Error) => void) | null>(null)

  const stopTick = useCallback(() => {
    if (tickRef.current !== null) {
      window.clearInterval(tickRef.current)
      tickRef.current = null
    }
  }, [])

  const startTick = useCallback(() => {
    stopTick()
    tickRef.current = window.setInterval(() => {
      const live = Date.now() - startedAtRef.current
      setElapsedMs(accumulatedRef.current + live)
    }, 250)
  }, [stopTick])

  const cleanup = useCallback(() => {
    stopTick()
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop()
      streamRef.current = null
    }
    recorderRef.current = null
    chunksRef.current = []
  }, [stopTick])

  const start = useCallback(async () => {
    setError(null)
    if (status === 'recording' || status === 'paused') return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
      streamRef.current = stream
      const mime = pickMime()
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
      recorderRef.current = rec
      chunksRef.current = []
      accumulatedRef.current = 0
      setElapsedMs(0)

      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
      }
      rec.onerror = (ev) => {
        const err = (ev as unknown as { error?: Error }).error ?? new Error('MediaRecorder error')
        setError(err.message)
        rejectRef.current?.(err)
        resolveRef.current = null
        rejectRef.current = null
        cleanup()
        setStatus('idle')
      }
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || mime || 'audio/webm' })
        const result: RecorderResult = {
          blob,
          mimeType: blob.type,
          durationMs: accumulatedRef.current + (rec.state === 'inactive' && startedAtRef.current ? 0 : 0),
        }
        resolveRef.current?.(result)
        resolveRef.current = null
        rejectRef.current = null
        cleanup()
        setStatus('stopped')
      }

      rec.start(1000)
      startedAtRef.current = Date.now()
      startTick()
      setStatus('recording')
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e))
      setError(err.message)
      cleanup()
      setStatus('idle')
    }
  }, [cleanup, startTick, status])

  const pause = useCallback(() => {
    const rec = recorderRef.current
    if (!rec || rec.state !== 'recording') return
    accumulatedRef.current += Date.now() - startedAtRef.current
    rec.pause()
    stopTick()
    setStatus('paused')
  }, [stopTick])

  const resume = useCallback(() => {
    const rec = recorderRef.current
    if (!rec || rec.state !== 'paused') return
    startedAtRef.current = Date.now()
    rec.resume()
    startTick()
    setStatus('recording')
  }, [startTick])

  const stop = useCallback((): Promise<RecorderResult> => {
    return new Promise((resolve, reject) => {
      const rec = recorderRef.current
      if (!rec) {
        reject(new Error('Aucun enregistrement en cours'))
        return
      }
      if (rec.state === 'recording') {
        accumulatedRef.current += Date.now() - startedAtRef.current
      }
      resolveRef.current = resolve
      rejectRef.current = reject
      stopTick()
      try {
        rec.stop()
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)))
      }
    })
  }, [stopTick])

  const cancel = useCallback(() => {
    const rec = recorderRef.current
    if (rec && rec.state !== 'inactive') {
      try {
        rec.stop()
      } catch {
        /* ignore */
      }
    }
    cleanup()
    setStatus('idle')
    setElapsedMs(0)
  }, [cleanup])

  useEffect(() => {
    return () => {
      cleanup()
    }
  }, [cleanup])

  return { status, elapsedMs, error, start, pause, resume, stop, cancel }
}
