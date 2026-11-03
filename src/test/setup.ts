import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach } from 'vitest'

// findBy*/waitFor give up after 1 s by default. With the whole suite running in parallel (each file
// starting its own API server), a busy laptop can need longer, which showed up as random failures.
configure({ asyncUtilTimeout: 5_000 })

afterEach(() => {
  cleanup()
})
