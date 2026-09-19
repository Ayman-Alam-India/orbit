import type { CountryId } from '@shared'
import { create } from 'zustand'

/**
 * Short-lived UI state shared between the globe and the panels.
 * What is SELECTED lives in the URL (/country/:countryId/event/:eventId), not here.
 * Server data lives in TanStack Query, not here.
 */
type UiState = {
  hoveredCountryId?: CountryId
  askOpen: boolean
  setHoveredCountry: (id?: CountryId) => void
  setAskOpen: (open: boolean) => void
}

export const useUiStore = create<UiState>()((set) => ({
  hoveredCountryId: undefined,
  askOpen: false,
  setHoveredCountry: (hoveredCountryId) => set({ hoveredCountryId }),
  setAskOpen: (askOpen) => set({ askOpen }),
}))
