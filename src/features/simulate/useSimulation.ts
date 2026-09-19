import { API_ROUTES, type Scenario, type SimulationResult } from '@shared'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { apiGet } from '../../api/client'

export const simulationKeys = {
  scenarios: ['simulation', 'scenarios'] as const,
  result: (scenarioId: string, brentPct: number) => ['simulation', scenarioId, brentPct] as const,
}

export const useScenarios = () =>
  useQuery({
    queryKey: simulationKeys.scenarios,
    queryFn: () => apiGet<Scenario[]>(API_ROUTES.scenarios),
    staleTime: Infinity,
  })

/** Runs the what-if arithmetic on the server. Keeps the previous result on screen while the slider moves. */
export const useSimulation = (scenarioId: string | undefined, brentPct: number) =>
  useQuery({
    queryKey: simulationKeys.result(scenarioId ?? '', brentPct),
    queryFn: () => apiGet<SimulationResult>(API_ROUTES.simulate(scenarioId ?? '', brentPct)),
    enabled: Boolean(scenarioId),
    placeholderData: keepPreviousData,
  })
