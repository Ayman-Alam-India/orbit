import { API_ROUTES, type NewsHeadline } from '@shared'
import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useUiStore } from '../../state/uiStore'
import { renderWithProviders } from '../../test/utils'
import { ArticlePreview } from './ArticlePreview'
import { NewsList } from './NewsList'

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('../../api/client', () => ({ apiGet: api.get, apiPost: api.post }))

const headline: NewsHeadline = {
  id: 'news_gnews_abc',
  title: 'Monsoon floods close Mumbai schools',
  url: 'https://news.google.com/rss/articles/abc',
  sourceId: 'src_google_news',
  publishedAt: '2026-11-03T09:00:00Z',
  countryIds: ['IND'],
  publisher: 'dw.com',
}

beforeEach(() => {
  useUiStore.setState({ articlePreview: undefined })
  api.get.mockReset()
  api.get.mockImplementation(async (path: string) => {
    if (path === API_ROUTES.news('IND')) return [headline]
    if (path === API_ROUTES.newsMedia(headline.id))
      return {
        headlineId: headline.id,
        articleUrl: 'https://www.dw.com/en/floods',
        siteName: 'DW',
        description: 'Schools across Mumbai closed after heavy rain.',
        images: ['https://static.dw.com/image/1.jpg'],
        videos: [{ url: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', kind: 'youtube' }],
        fetchedAt: '2026-11-03T10:00:00Z',
      }
    if (path === API_ROUTES.health) return { status: 'ok', dataMode: 'live', aiProvider: 'mock' }
    return []
  })
})

describe('article preview', () => {
  it("clicking a headline opens the article's photo, video and description in the app", async () => {
    renderWithProviders(
      <>
        <NewsList countryId="IND" />
        <ArticlePreview />
      </>,
    )
    fireEvent.click(await screen.findByRole('link', { name: headline.title }))
    const dialog = await screen.findByRole('dialog', { name: headline.title })
    expect(await screen.findByAltText(`Photo from the article: ${headline.title}`)).toHaveAttribute(
      'src',
      'https://static.dw.com/image/1.jpg',
    )
    expect(screen.getByTitle(`Video: ${headline.title}`)).toHaveAttribute(
      'src',
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    )
    expect(screen.getByText('Schools across Mumbai closed after heavy rain.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Read the full article on DW ↗' })).toHaveAttribute(
      'href',
      'https://www.dw.com/en/floods',
    )

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(dialog).not.toBeInTheDocument()
  })
})
