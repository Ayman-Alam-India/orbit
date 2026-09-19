import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { Route, Routes } from 'react-router-dom'
import { ROUTE_PATTERNS } from '../../routes'
import { withTestApiServer } from '../../test/apiServer'
import { renderWithProviders } from '../../test/utils'
import { AskPanel } from './AskPanel'

withTestApiServer()

// AskPanel reads the current country/event from the URL, so render it under the real route patterns.
const renderAt = (route: string) =>
  renderWithProviders(
    <Routes>
      {Object.values(ROUTE_PATTERNS).map((pattern) => (
        <Route key={pattern} path={pattern} element={<AskPanel />} />
      ))}
    </Routes>,
    { route },
  )

describe('Ask ORBIT', () => {
  it('shows the world context and suggested questions on the global view', () => {
    renderAt('/')
    expect(screen.getByText('The whole world')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Where is the highest risk right now?' }),
    ).toBeInTheDocument()
  })

  it('asks with the country context and shows the answer with its provider', async () => {
    renderAt('/country/BRA')
    expect(await screen.findByText('Brazil')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Question'), 'What is happening?')
    await userEvent.click(screen.getByRole('button', { name: 'Ask' }))
    const answer = await screen.findByText(/Offline analysis for Brazil/)
    expect(answer).toBeInTheDocument()
    expect(screen.getByText('What is happening?')).toBeInTheDocument()
    expect(
      within(answer.closest('div')!.parentElement!).getByText('Offline analysis'),
    ).toBeInTheDocument()
  })

  it('sends a suggested question with one click, using the event context', async () => {
    renderAt('/country/IND/event/hs_ind_dengue_surge')
    expect(await screen.findByText('Dengue cases rise after late monsoon')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Why does this matter?' }))
    expect(
      await screen.findByText(/Offline analysis for Dengue cases rise after late monsoon/),
    ).toBeInTheDocument()
  })

  describe('voice', () => {
    // Only remove the speech fakes: the test API server stubs fetch as a global too.
    const speechGlobals = ['webkitSpeechRecognition', 'SpeechSynthesisUtterance', 'speechSynthesis']
    const fake = (name: string, value: unknown) =>
      Object.defineProperty(window, name, { value, configurable: true, writable: true })
    afterEach(() => speechGlobals.forEach((name) => Reflect.deleteProperty(window, name)))

    it('hides the mic and read-aloud where the browser has no speech support', async () => {
      renderAt('/country/BRA')
      await userEvent.type(screen.getByLabelText('Question'), 'What is happening?')
      await userEvent.click(screen.getByRole('button', { name: 'Ask' }))
      await screen.findByText(/Offline analysis for Brazil/)
      expect(screen.queryByRole('button', { name: 'Ask by voice' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Listen/ })).not.toBeInTheDocument()
    })

    it('turns speech into a question and reads answers aloud', async () => {
      const spoken: string[] = []
      class FakeRecognition {
        lang = ''
        interimResults = false
        continuous = false
        onresult: ((e: unknown) => void) | null = null
        onend: (() => void) | null = null
        onerror: (() => void) | null = null
        start() {
          // Real recognition reports back asynchronously.
          setTimeout(() => {
            this.onresult?.({ results: [[{ transcript: 'What is happening?' }]] })
            this.onend?.()
          })
        }
        stop() {}
      }
      fake('webkitSpeechRecognition', FakeRecognition)
      fake('SpeechSynthesisUtterance', function (this: { text: string }, text: string) {
        this.text = text
      })
      fake('speechSynthesis', {
        getVoices: () => [],
        cancel: () => {},
        speak: (u: { text: string }) => spoken.push(u.text),
      })

      renderAt('/country/BRA')
      expect(await screen.findByText('Brazil')).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'Ask by voice' }))
      const answer = await screen.findByText(/Offline analysis for Brazil/)
      await userEvent.click(screen.getByRole('button', { name: '🔊 Listen' }))
      expect(spoken).toEqual([answer.textContent])
      expect(screen.getByRole('button', { name: '◼ Stop' })).toBeInTheDocument()
    })
  })
})
