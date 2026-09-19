import { useState, type FormEvent } from 'react'
import { useMatch } from 'react-router-dom'
import { ROUTE_PATTERNS } from '../../routes'
import { useUiStore } from '../../state/uiStore'
import { ErrorState, Loader, Panel } from '../../ui'
import { useAsk } from './useAsk'

/** PLACEHOLDER (owner: Affan). "Ask ORBIT": sends the question plus what the user is looking at. */
export function AskPanel() {
  const setAskOpen = useUiStore((s) => s.setAskOpen)
  const [question, setQuestion] = useState('')
  const ask = useAsk()
  const countryMatch = useMatch(`${ROUTE_PATTERNS.country}/*`)
  const eventMatch = useMatch(ROUTE_PATTERNS.event)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    ask.mutate({
      question,
      context: {
        countryId: countryMatch?.params.countryId,
        eventId: eventMatch?.params.eventId,
      },
    })
  }

  return (
    <Panel
      eyebrow="Ask ORBIT"
      actions={
        <button type="button" onClick={() => setAskOpen(false)} aria-label="Close Ask ORBIT">
          ✕
        </button>
      }
    >
      <form onSubmit={submit}>
        <label className="sr-only" htmlFor="ask-question">
          Question
        </label>
        <input
          id="ask-question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="What is happening here?"
        />
        <button type="submit" disabled={!question.trim() || ask.isPending}>
          Ask
        </button>
      </form>
      {ask.isPending && <Loader label="Thinking" />}
      {ask.isError && <ErrorState title="ORBIT could not answer" error={ask.error} />}
      {ask.data && (
        <p>
          {ask.data.answer} <small>({ask.data.provider})</small>
        </p>
      )}
    </Panel>
  )
}
