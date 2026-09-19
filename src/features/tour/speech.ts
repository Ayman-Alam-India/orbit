import { API_ROUTES } from '@shared'

/**
 * Thin wrappers over the browser's free Web Speech APIs. Everything is feature-detected, so the app
 * works (silently) where speech isn't available, including tests. The narrator voice itself comes from
 * the server (POST /api/speech, Gemini TTS) and falls back to the browser's voice.
 */

export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window

/** POST /api/speech rejects text longer than this. */
const MAX_SPEECH_CHARS = 1500
/** Don't leave Listen / the tour hanging if Gemini is slow or the proxy drops the request. */
const TTS_WAIT_MS = 5_000
const TTS_FETCH_MS = 20_000

/** Prefer a natural-sounding English voice (Edge's "Online (Natural)" voices, Google voices). */
function pickVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.startsWith('en'))
  return (
    voices.find((v) => /natural/i.test(v.name)) ??
    voices.find((v) => /google/i.test(v.name)) ??
    voices.find((v) => v.lang === 'en-US') ??
    voices[0]
  )
}

/** The browser's own voice: the fallback when the narrator voice (Gemini, via the server) isn't available. */
function browserSpeak(text: string, onEnd?: () => void): () => void {
  if (!canSpeak()) {
    onEnd?.()
    return () => {}
  }
  const synth = window.speechSynthesis
  synth.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  const voice = pickVoice()
  if (voice) utterance.voice = voice
  let stopped = false
  const finish = () => {
    if (!stopped) onEnd?.()
  }
  utterance.onend = finish
  utterance.onerror = finish
  // Chrome silently drops speak() straight after cancel(), so give it a moment.
  const timer = setTimeout(() => {
    synth.resume?.()
    synth.speak(utterance)
  }, 120)
  return () => {
    stopped = true
    clearTimeout(timer)
    synth.cancel()
  }
}

type AudioContextCtor = new () => AudioContext

let audioCtx: AudioContext | undefined
let unlocked = false

function AudioContextClass(): AudioContextCtor | undefined {
  if (typeof window === 'undefined') return undefined
  const w = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor }
  return w.AudioContext ?? w.webkitAudioContext
}

function getAudioContext(): AudioContext | undefined {
  const AC = AudioContextClass()
  if (!AC) return undefined
  try {
    audioCtx ??= new AC()
    return audioCtx
  } catch {
    return undefined
  }
}

/**
 * Call from a click handler (Tour, Play, Listen) so later narration is allowed to play.
 * An AudioContext stays unlocked after resume(); a reused <audio> element does not (so clip 2+
 * and Listen-after-fetch were silent, and Listen stayed on "Preparing voice…").
 */
export function unlockAudio() {
  const ctx = getAudioContext()
  if (!ctx) return
  if (ctx.state === 'suspended') void ctx.resume()
  if (unlocked) return
  try {
    const buf = ctx.createBuffer(1, 1, ctx.sampleRate)
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.connect(ctx.destination)
    src.start(0)
    unlocked = true
  } catch {
    // No Web Audio (e.g. tests): narration falls back to the browser voice.
  }
}

/** Narrator clips by text, as object URLs (undefined = no narrator voice, use the browser's). */
const clips = new Map<string, Promise<string | undefined>>()

/** Fetches (and keeps) the narrator's clip for `text`, so it plays instantly later. */
export function prefetchSpeech(text: string): Promise<string | undefined> {
  const key = text.slice(0, MAX_SPEECH_CHARS)
  let clip = clips.get(key)
  if (!clip) {
    const load = () =>
      fetch(API_ROUTES.speech, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: key }),
        signal: AbortSignal.timeout(TTS_FETCH_MS),
      }).then(async (res) => (res.ok ? URL.createObjectURL(await res.blob()) : undefined))
    // One retry: a dropped connection shouldn't cost a stop its voice.
    clip = load()
      .catch(() => load())
      .catch(() => undefined)
      .then((url) => {
        if (!url) clips.delete(key) // try again next time (quota may be back)
        return url
      })
    clips.set(key, clip)
  }
  return clip
}

function playClip(
  ctx: AudioContext,
  url: string,
  onEnd: () => void,
): { started: Promise<void>; stop: () => void } {
  let source: AudioBufferSourceNode | undefined
  let ignoreEnd = false
  const started = (async () => {
    if (ctx.state === 'suspended') await ctx.resume()
    const bytes = await fetch(url).then((res) => res.arrayBuffer())
    const buffer = await ctx.decodeAudioData(bytes.slice(0))
    if (ignoreEnd) return
    source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(ctx.destination)
    source.onended = () => {
      if (!ignoreEnd) onEnd()
    }
    source.start()
  })()
  return {
    started,
    stop: () => {
      ignoreEnd = true
      try {
        source?.stop()
      } catch {
        // Already finished.
      }
    },
  }
}

/**
 * Speaks `text` with the narrator's voice (Gemini TTS, cached on the server), or the browser's voice
 * if that isn't available. Calls `onStart` when sound begins and `onEnd` when it finishes.
 * Returns a function that stops it.
 */
export function speak(text: string, onEnd?: () => void, onStart?: () => void): () => void {
  let stopped = false
  let started = false
  let stopClip: (() => void) | undefined
  let stopBrowser: (() => void) | undefined

  const finish = () => {
    if (!stopped) onEnd?.()
  }
  const fallback = () => {
    if (stopped || started) return
    started = true
    clearTimeout(giveUp)
    onStart?.()
    stopBrowser = browserSpeak(text, finish)
  }

  unlockAudio()
  const ctx = getAudioContext()
  const giveUp = setTimeout(fallback, TTS_WAIT_MS)

  void prefetchSpeech(text).then(async (url) => {
    if (stopped || started) return
    if (!url || !ctx) return fallback()
    try {
      const clip = playClip(ctx, url, finish)
      stopClip = clip.stop
      await clip.started
      if (stopped || started) {
        clip.stop()
        return
      }
      started = true
      clearTimeout(giveUp)
      onStart?.()
    } catch {
      fallback()
    }
  })

  return () => {
    stopped = true
    clearTimeout(giveUp)
    stopClip?.()
    stopBrowser?.()
  }
}

type RecognitionCtor = new () => {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
  start: () => void
  stop: () => void
}

/** Chrome/Edge speech-to-text, if available. */
export function recognitionCtor(): RecognitionCtor | undefined {
  if (typeof window === 'undefined') return undefined
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}
