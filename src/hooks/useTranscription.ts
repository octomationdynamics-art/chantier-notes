import { useCallback, useEffect, useRef, useState } from 'react'
import { config } from '../config'

type SpeechRecognitionEventLike = {
  resultIndex: number
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>
}

type SpeechRecognitionErrorEventLike = { error: string; message?: string }

interface SpeechRecognitionLike extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onresult: ((e: SpeechRecognitionEventLike) => void) | null
  onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null
  onend: (() => void) | null
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function getCtor(): SpeechRecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function isSpeechRecognitionSupported(): boolean {
  return getCtor() !== null
}

export function useTranscription() {
  const [finalText, setFinalText] = useState('')
  const [interimText, setInterimText] = useState('')
  const [active, setActive] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const recRef = useRef<SpeechRecognitionLike | null>(null)
  const wantActiveRef = useRef(false)

  const buildRecognizer = useCallback(() => {
    const Ctor = getCtor()
    if (!Ctor) return null
    const rec = new Ctor()
    rec.lang = config.speechLang
    rec.continuous = true
    rec.interimResults = true
    rec.maxAlternatives = 1

    rec.onresult = (e) => {
      let interim = ''
      let finalChunk = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i]
        const transcript = result[0].transcript
        if (result.isFinal) finalChunk += transcript
        else interim += transcript
      }
      if (finalChunk) {
        setFinalText((prev) => {
          const next = prev ? `${prev} ${finalChunk.trim()}` : finalChunk.trim()
          return next
        })
      }
      setInterimText(interim)
    }

    rec.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return
      setError(e.message || e.error)
    }

    rec.onend = () => {
      if (wantActiveRef.current) {
        try {
          rec.start()
        } catch {
          setActive(false)
        }
      } else {
        setActive(false)
        setInterimText('')
      }
    }

    return rec
  }, [])

  const start = useCallback(() => {
    if (active) return
    setError(null)
    setFinalText('')
    setInterimText('')
    const rec = buildRecognizer()
    if (!rec) {
      setError("La reconnaissance vocale n'est pas supportée par ce navigateur.")
      return
    }
    recRef.current = rec
    wantActiveRef.current = true
    try {
      rec.start()
      setActive(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      wantActiveRef.current = false
    }
  }, [active, buildRecognizer])

  const pause = useCallback(() => {
    wantActiveRef.current = false
    const rec = recRef.current
    if (rec) {
      try {
        rec.stop()
      } catch {
        /* ignore */
      }
    }
  }, [])

  const resume = useCallback(() => {
    if (active) return
    const rec = buildRecognizer()
    if (!rec) {
      setError("La reconnaissance vocale n'est pas supportée par ce navigateur.")
      return
    }
    recRef.current = rec
    wantActiveRef.current = true
    try {
      rec.start()
      setActive(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [active, buildRecognizer])

  const stop = useCallback((): string => {
    wantActiveRef.current = false
    const rec = recRef.current
    if (rec) {
      try {
        rec.stop()
      } catch {
        /* ignore */
      }
    }
    const interimTrim = interimText.trim()
    if (interimTrim && !finalText.includes(interimTrim)) {
      const merged = finalText ? `${finalText} ${interimTrim}` : interimTrim
      return merged
    }
    return finalText
  }, [finalText, interimText])

  const reset = useCallback(() => {
    wantActiveRef.current = false
    const rec = recRef.current
    if (rec) {
      try {
        rec.abort()
      } catch {
        /* ignore */
      }
    }
    recRef.current = null
    setFinalText('')
    setInterimText('')
    setActive(false)
    setError(null)
  }, [])

  useEffect(() => {
    return () => {
      wantActiveRef.current = false
      const rec = recRef.current
      if (rec) {
        try {
          rec.abort()
        } catch {
          /* ignore */
        }
      }
    }
  }, [])

  return {
    supported: isSpeechRecognitionSupported(),
    active,
    finalText,
    interimText,
    error,
    start,
    pause,
    resume,
    stop,
    reset,
  }
}
