import type { AskAnswer } from '@shared'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useUiStore } from '../../state/uiStore'
import { Button, ErrorState, Loader, Panel } from '../../ui'
import { providerLabel } from '../insight/providerLabel'
import { SourceChips } from '../insight/SourceChips'
import { canSpeak, recognitionCtor, speak, unlockAudio } from '../tour/speech'
import styles from './AskPanel.module.css'
import { useAsk } from './useAsk'
import { useAskContext } from './useAskContext'

type Turn = {
  id: number
  question: string
  contextLabel: string
  answer?: AskAnswer
  error?: unknown
}

/**
 * Ask ORBIT (decision owner: Affan): a chat in the right-hand drawer. Each question is sent with
 * what the user is looking at (world, country or event). The history lasts for the session.
 */
export function AskPanel() {
  const setAskOpen = useUiStore((s) => s.setAskOpen)
  const context = useAskContext()
  const ask = useAsk()
  const [question, setQuestion] = useState('')
  const [turns, setTurns] = useState<Turn[]>([])
  const threadRef = useRef<HTMLDivElement>(null)
  const [listening, setListening] = useState(false)
  const [speakingId, setSpeakingId] = useState<number>()
  const [voiceReady, setVoiceReady] = useState(false)
  const stopSpeaking = useRef<() => void>(undefined)
  const Recognition = recognitionCtor()

  // Stop reading aloud when the panel goes away.
  useEffect(() => () => stopSpeaking.current?.(), [])

  // Keep the newest answer in view. Scroll only the thread itself: scrollIntoView would also
  // scroll the page towards the (possibly off-screen) drawer and shift the whole layout.
  useEffect(() => {
    const thread = threadRef.current
    if (thread) thread.scrollTop = thread.scrollHeight
  }, [turns])

  const send = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || ask.isPending) return
    const id = Date.now()
    setTurns((t) => [...t, { id, question: trimmed, contextLabel: context.label }])
    setQuestion('')
    try {
      const answer = await ask.mutateAsync({ question: trimmed, context: context.request })
      setTurns((t) => t.map((turn) => (turn.id === id ? { ...turn, answer } : turn)))
    } catch (error) {
      setTurns((t) => t.map((turn) => (turn.id === id ? { ...turn, error } : turn)))
    }
  }

  // Voice input (Chrome/Edge): words appear in the box as you speak, and the question is sent when you stop.
  const listen = () => {
    if (!Recognition || listening) return
    const recognition = new Recognition()
    recognition.lang = 'en-US'
    recognition.interimResults = true
    recognition.continuous = false
    let heard = ''
    recognition.onresult = (e) => {
      heard = Array.from(e.results, (r) => r[0].transcript).join('')
      setQuestion(heard)
    }
    recognition.onend = () => {
      setListening(false)
      if (heard.trim()) void send(heard)
    }
    recognition.onerror = () => setListening(false)
    setListening(true)
    recognition.start()
  }

  const readAloud = (turn: Turn) => {
    stopSpeaking.current?.()
    if (speakingId === turn.id) return setSpeakingId(undefined)
    unlockAudio()
    setSpeakingId(turn.id)
    setVoiceReady(false)
    stopSpeaking.current = speak(
      turn.answer?.answer ?? '',
      () => setSpeakingId(undefined),
      () => setVoiceReady(true),
    )
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    void send(question)
  }

  return (
    <Panel
      eyebrow="Ask ORBIT"
      tone="accent"
      actions={
        <Button
          iconOnly
          variant="ghost"
          size="sm"
          aria-label="Close Ask ORBIT"
          onClick={() => setAskOpen(false)}
        >
          ✕
        </Button>
      }
    >
      <p className={styles.context}>
        Looking at <strong>{context.label}</strong> — ask about this, or anything else ORBIT tracks.
      </p>

      <div ref={threadRef} className={styles.thread} aria-live="polite">
        {turns.length === 0 && (
          <div className={styles.suggestions}>
            {context.suggestions.map((s) => (
              <button key={s} type="button" className={styles.suggestion} onClick={() => send(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
        {turns.map((turn) => (
          <div key={turn.id} className={styles.turn}>
            <p className={styles.question}>{turn.question}</p>
            {turn.answer ? (
              <div className={styles.answer}>
                <p>{turn.answer.answer}</p>
                <div className={styles.answerMeta}>
                  <SourceChips ids={turn.answer.sourceIds} />
                  {canSpeak() && (
                    <button
                      type="button"
                      className={styles.listen}
                      aria-pressed={speakingId === turn.id}
                      onClick={() => readAloud(turn)}
                    >
                      {speakingId !== turn.id
                        ? '🔊 Listen'
                        : voiceReady
                          ? '◼ Stop'
                          : 'Preparing voice…'}
                    </button>
                  )}
                  <span className={styles.provider}>{providerLabel(turn.answer.provider)}</span>
                </div>
              </div>
            ) : turn.error ? (
              <ErrorState title="ORBIT could not answer" error={turn.error} />
            ) : (
              <Loader label="Thinking" />
            )}
          </div>
        ))}
      </div>

      <form onSubmit={submit} className={styles.form}>
        <label className="sr-only" htmlFor="ask-question">
          Question
        </label>
        <input
          id="ask-question"
          className={styles.input}
          value={question}
          maxLength={500}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={listening ? 'Listening…' : `Ask about ${context.label}…`}
        />
        {Recognition && (
          <Button
            iconOnly
            variant="ghost"
            aria-label={listening ? 'Listening' : 'Ask by voice'}
            aria-pressed={listening}
            className={listening ? styles.micOn : undefined}
            onClick={listen}
          >
            🎙
          </Button>
        )}
        <Button type="submit" variant="accent" disabled={!question.trim() || ask.isPending}>
          Ask
        </Button>
      </form>
    </Panel>
  )
}
