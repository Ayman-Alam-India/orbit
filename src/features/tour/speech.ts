/**
 * Thin wrappers over the browser's free Web Speech APIs. Everything is feature-detected, so the app
 * works (silently) where speech isn't available, including tests.
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

/** Speaks `text`, cancelling anything already speaking. Returns a function that stops it. */
export function speak(text: string, onEnd?: () => void): () => void {
  if (!canSpeak()) {
    onEnd?.()
    return () => {}
  }
  const synth = window.speechSynthesis
  synth.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  const voice = pickVoice()
  if (voice) utterance.voice = voice
  utterance.rate = 1
  utterance.pitch = 1
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
