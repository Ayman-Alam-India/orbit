import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { IncidentDetailPage } from './pages/IncidentDetail'
import { Incidents } from './pages/Incidents'
import { Services } from './pages/Services'
import { Settings } from './pages/Settings'
import './App.css'

export default function App() {
  return <BrowserRouter>
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/incidents" element={<Incidents />} />
        <Route path="/incidents/:id" element={<IncidentDetailPage />} />
        <Route path="/services" element={<Services />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  </BrowserRouter>
}

