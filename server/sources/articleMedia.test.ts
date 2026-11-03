// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { parseArticlePage } from './articleMedia'

const page = (head: string, body = '') => `<html><head>${head}</head><body>${body}</body></html>`

describe('article previews', () => {
  it("reads the article's photo, site name and description from its preview tags", () => {
    const media = parseArticlePage(
      page(
        '<meta property="og:site_name" content="DW"/>' +
          '<meta property="og:description" content="Floods hit &amp; schools close."/>' +
          '<meta property="og:image" content="/image/70681333_6.jpg"/>' +
          '<meta name="twitter:image" content="https://static.dw.com/logo-share.png"/>',
      ),
      'https://www.dw.com/en/story',
    )
    expect(media).toEqual({
      siteName: 'DW',
      description: 'Floods hit & schools close.',
      // Relative URLs become absolute; logos are not photos.
      images: ['https://www.dw.com/image/70681333_6.jpg'],
      videos: [],
    })
  })

  it('turns YouTube embeds into privacy-friendly players and keeps video files', () => {
    const media = parseArticlePage(
      page(
        '<meta property="og:video" content="https://cdn.example.org/clip.mp4"/>',
        '<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0"></iframe><iframe src="https://ads.example.org/x"></iframe>',
      ),
      'https://example.org/a',
    )
    expect(media.videos).toEqual([
      { url: 'https://cdn.example.org/clip.mp4', kind: 'file' },
      { url: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', kind: 'youtube' },
    ])
  })

  it('ignores anything that is not an http(s) address', () => {
    const media = parseArticlePage(
      page('<meta property="og:image" content="javascript:alert(1)"/>'),
      'https://example.org/',
    )
    expect(media.images).toEqual([])
  })
})
