import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { CountryPanel } from './features/country/CountryPanel'
import { EventPanel } from './features/event/EventPanel'
import { SimulatorPanel } from './features/simulate/SimulatorPanel'
import { GlobalOverview } from './layout/GlobalOverview'
import { NotFound } from './layout/NotFound'
import { OrbitLayout } from './layout/OrbitLayout'
import { ROUTE_PATTERNS } from './routes'

/** All routes are declared here once (owner: Hardik). Features never add routes themselves. */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<OrbitLayout />}>
        <Route path={ROUTE_PATTERNS.global} element={<GlobalOverview />} />
        <Route path={ROUTE_PATTERNS.country} element={<CountryPanel />} />
        <Route path={ROUTE_PATTERNS.event} element={<EventPanel />} />
        <Route path={ROUTE_PATTERNS.simulate} element={<SimulatorPanel />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
