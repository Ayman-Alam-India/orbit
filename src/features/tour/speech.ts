import { API_ROUTES } from '@shared'

/**
 * Thin wrappers over the browser's free Web Speech APIs. Everything is feature-detected, so the app
 * works (silently) where speech isn't available, including tests. The narrator voice itself comes from
 * the server (POST /api/speech, Gemini TTS) and falls back to the browser's voice.
 */

export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window

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
  utterance.onend = () => {
    if (!stopped) onEnd?.()
  }
  synth.speak(utterance)
  return () => {
    stopped = true
    synth.cancel()
  }
}

/** Narrator clips by text, as object URLs (undefined = no narrator voice, use the browser's). */
const clips = new Map<string, Promise<string | undefined>>()

/** Fetches (and keeps) the narrator's clip for `text`, so it plays instantly later. */
export function prefetchSpeech(text: string): Promise<string | undefined> {
  let clip = clips.get(text)
  if (!clip) {
    clip = fetch(API_ROUTES.speech, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text }),
    })
      .then(async (res) => (res.ok ? URL.createObjectURL(await res.blob()) : undefined))
      .catch(() => undefined)
      .then((url) => {
        if (!url) clips.delete(text) // try again next time (quota may be back)
        return url
      })
    clips.set(text, clip)
  }
  return clip
}

/**
 * Speaks `text` with the narrator's voice (Gemini TTS, cached on the server), or the browser's voice
 * if that isn't available. Calls `onStart` when sound begins and `onEnd` when it finishes.
 * Returns a function that stops it.
 */
export function speak(text: string, onEnd?: () => void, onStart?: () => void): () => void {
  let stopped = false
  let audio: HTMLAudioElement | undefined
  let stopBrowser: (() => void) | undefined
  const fallback = () => {
    if (stopped) return
    onStart?.()
    stopBrowser = browserSpeak(text, onEnd)
  }
  if (canSpeak()) window.speechSynthesis.cancel()
  void prefetchSpeech(text).then((url) => {
    if (stopped) return
    if (!url) return fallback()
    audio = new Audio(url)
    audio.onended = () => {
      if (!stopped) onEnd?.()
    }
    audio.play().then(() => onStart?.(), fallback)
  })
  return () => {
    stopped = true
    audio?.pause()
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
