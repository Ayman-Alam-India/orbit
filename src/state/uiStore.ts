import type { CountryId, LatLng, ScenarioRole } from '@shared'
import { create } from 'zustand'

/** What the globe shows while the what-if simulator is open. */
export type SimulationView = {
  scenarioId: string
  title: string
  brentPct: number
  chokepoint: { name: string; location: LatLng }
  affected: { countryId: CountryId; role: ScenarioRole }[]
}

/** Where the guided tour points the camera, and which country it highlights. */
export type TourFocus = { lat: number; lng: number; altitude: number; countryId?: CountryId }

/**
 * Short-lived UI state shared between the globe and the panels.
 * What is SELECTED lives in the URL (/country/:countryId/event/:eventId), not here.
 * Server data lives in TanStack Query, not here.
 */
type UiState = {
  hoveredCountryId?: CountryId
  askOpen: boolean
  simulation?: SimulationView
  tourActive: boolean
  tourFocus?: TourFocus
  setHoveredCountry: (id?: CountryId) => void
  setAskOpen: (open: boolean) => void
  setSimulation: (simulation?: SimulationView) => void
  setTourActive: (active: boolean) => void
  setTourFocus: (focus?: TourFocus) => void
}

export const useUiStore = create<UiState>()((set) => ({
  hoveredCountryId: undefined,
  askOpen: false,
  simulation: undefined,
  setHoveredCountry: (hoveredCountryId) => set({ hoveredCountryId }),
  setAskOpen: (askOpen) => set({ askOpen }),
  tourActive: false,
  tourFocus: undefined,
  setSimulation: (simulation) => set({ simulation }),
  setTourActive: (tourActive) => set(tourActive ? { tourActive } : { tourActive, tourFocus: undefined }),
  setTourFocus: (tourFocus) => set({ tourFocus }),
}))
