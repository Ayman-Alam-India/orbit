import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Button, Panel, SeverityBadge, Tag } from '.'

describe('ui primitives', () => {
  it('Button renders its variant and handles clicks', async () => {
    const onClick = vi.fn()
    render(
      <Button variant="accent" onClick={onClick}>
        Ask ORBIT
      </Button>,
    )
    const button = screen.getByRole('button', { name: 'Ask ORBIT' })
    expect(button).toHaveAttribute('type', 'button')
    expect(button.className).toMatch(/accent/)
    await userEvent.click(button)
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('icon-only Button is named by its aria-label', () => {
    render(
      <Button iconOnly aria-label="Close" variant="ghost" size="sm">
        ✕
      </Button>,
    )
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
  })

  it('Tag is coloured by event kind', () => {
    render(<Tag kind="health">Health</Tag>)
    expect(screen.getByText('Health')).toHaveAttribute('data-kind', 'health')
  })

  it('Panel shows eyebrow, title and the accent tone', () => {
    render(
      <Panel eyebrow="Ask ORBIT" title="Answer" tone="accent">
        body
      </Panel>,
    )
    expect(screen.getByRole('heading', { name: 'Answer' })).toBeInTheDocument()
    expect(screen.getByText('Ask ORBIT').closest('section')?.className).toMatch(/accent/)
  })

  it('SeverityBadge shows label and number', () => {
    render(<SeverityBadge severity={5} />)
    expect(screen.getByText('Critical · 5/5')).toBeInTheDocument()
  })
})
