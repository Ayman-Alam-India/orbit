import type { AskRequest } from '@shared'
import { useMatch } from 'react-router-dom'
import { ROUTE_PATTERNS } from '../../routes'
import { useCountries } from '../country/useCountry'
import { useEvent } from '../event/useEvents'

export type AskContext = {
  request: NonNullable<AskRequest['context']>
  /** What ORBIT is looking at, for the context chip, e.g. "India". */
  label: string
  suggestions: string[]
}

/** Works out what the user is looking at from the URL, plus suggested questions for it. */
export function useAskContext(): AskContext {
  const countryMatch = useMatch(`${ROUTE_PATTERNS.country}/*`)
  const eventMatch = useMatch(ROUTE_PATTERNS.event)
  const countryId = countryMatch?.params.countryId
  const eventId = eventMatch?.params.eventId
  const countries = useCountries()
  const event = useEvent(eventId ?? '')
  const countryName = countries.data?.find((c) => c.id === countryId)?.name ?? countryId

  if (eventId) {
    return {
      request: { countryId, eventId },
      label: event.data?.title ?? 'This event',
      suggestions: ['Why does this matter?', 'Who is most affected?', 'What led up to this?'],
    }
  }
  if (countryId) {
    return {
      request: { countryId },
      label: countryName ?? countryId,
      suggestions: [
        `What are the biggest risks in ${countryName}?`,
        'Summarise the latest events',
        'Which health signals should I watch?',
      ],
    }
  }
  return {
    request: {},
    label: 'The whole world',
    suggestions: [
      'Where is the highest risk right now?',
      'What health signals should I know about?',
      "Summarise today's key events",
    ],
  }
}
