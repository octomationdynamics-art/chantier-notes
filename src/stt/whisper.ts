export interface WhisperProgress {
  status: string
  file?: string
  progress?: number
  loaded?: number
  total?: number
}

export type ProgressHandler = (p: WhisperProgress) => void

type TranscriberInput = Float32Array | string
type TranscriberOutput = { text: string } | Array<{ text: string }>
type Transcriber = (audio: TranscriberInput, options?: Record<string, unknown>) => Promise<TranscriberOutput>

const MODEL_ID = (import.meta.env.VITE_WHISPER_MODEL as string | undefined) ?? 'Xenova/whisper-base'
const LANGUAGE = (import.meta.env.VITE_WHISPER_LANGUAGE as string | undefined) ?? 'french'

let transcriberPromise: Promise<Transcriber> | null = null
const progressSubscribers = new Set<ProgressHandler>()

function emit(p: WhisperProgress) {
  for (const h of progressSubscribers) {
    try {
      h(p)
    } catch {
      /* ignore */
    }
  }
}

export function subscribeProgress(handler: ProgressHandler): () => void {
  progressSubscribers.add(handler)
  return () => progressSubscribers.delete(handler)
}

async function loadTranscriber(): Promise<Transcriber> {
  if (transcriberPromise) return transcriberPromise
  transcriberPromise = (async () => {
    emit({ status: 'importing library' })
    const mod = await import('@huggingface/transformers')
    emit({ status: 'loading model', file: MODEL_ID })
    const transcriber = (await mod.pipeline('automatic-speech-recognition', MODEL_ID, {
      progress_callback: (p: WhisperProgress) => emit(p),
      dtype: 'q4',
      device: 'wasm',
    })) as unknown as Transcriber
    emit({ status: 'ready' })
    return transcriber
  })().catch((e) => {
    transcriberPromise = null
    throw e
  })
  return transcriberPromise
}

async function decodeAudio(blob: Blob): Promise<Float32Array> {
  const arrayBuffer = await blob.arrayBuffer()
  const AudioCtx =
    (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioCtx) throw new Error('AudioContext non supporté')
  const ctx = new AudioCtx({ sampleRate: 16000 })
  try {
    const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0))
    if (decoded.numberOfChannels === 1) return decoded.getChannelData(0).slice()
    const left = decoded.getChannelData(0)
    const right = decoded.getChannelData(1)
    const mono = new Float32Array(left.length)
    for (let i = 0; i < left.length; i++) mono[i] = (left[i] + right[i]) * 0.5
    return mono
  } finally {
    if (typeof ctx.close === 'function') await ctx.close()
  }
}

export async function transcribeBlob(blob: Blob, onProgress?: ProgressHandler): Promise<string> {
  const unsub = onProgress ? subscribeProgress(onProgress) : undefined
  try {
    const transcriber = await loadTranscriber()
    emit({ status: 'decoding audio' })
    const samples = await decodeAudio(blob)
    emit({ status: 'transcribing' })
    const result = await transcriber(samples, {
      language: LANGUAGE,
      task: 'transcribe',
      chunk_length_s: 30,
      stride_length_s: 5,
      return_timestamps: false,
    })
    emit({ status: 'done' })
    const text = Array.isArray(result)
      ? result.map((r) => r.text).join(' ')
      : result.text
    return text.trim()
  } finally {
    unsub?.()
  }
}
