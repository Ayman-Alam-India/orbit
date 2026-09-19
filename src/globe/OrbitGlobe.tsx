import type { OrbitEvent } from '@shared'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import Globe, { type GlobeMethods } from 'react-globe.gl'
import { useMatch, useNavigate } from 'react-router-dom'
import { MeshPhongMaterial } from 'three'
import { getStaticJson } from '../api/client'
import { useCountries } from '../features/country/useCountry'
import { useEvents } from '../features/event/useEvents'
import { paths, ROUTE_PATTERNS } from '../routes'
import { useUiStore } from '../state/uiStore'
import { cssVar, severityColor } from '../styles/cssVar'
import { needsRing, pinAltitude, ringColor, ringMaxRadius, tooltipHtml } from './globeStyle'
import { MINI_GLOBE_ALTITUDE, MINI_GLOBE_ROTATE_SPEED } from './miniGlobe'

/** Slow idle rotation on the global view, and how long it waits after the user lets go. */
const GLOBAL_ROTATE_SPEED = 0.35
const RESUME_ROTATION_MS = 4000

/** One country shape from public/data/countries.geojson (Natural Earth 110m, slimmed to id + name). */
type CountryFeature = {
  type: 'Feature'
  properties: { id: string; name: string }
  geometry: object
}

type CountryShapes = { type: 'FeatureCollection'; features: CountryFeature[] }

/**
 * Cinematic globe (decision owner: Arham): an orange dark-hologram globe with thin severity-coloured pins,
 * ripple rings on severe events (4-5), hover tooltips, and a slow idle rotation. All colours come from tokens.
 */
export default function OrbitGlobe() {
  const globeRef = useRef<GlobeMethods | undefined>(undefined)
  const navigate = useNavigate()
  const { hoveredCountryId, setHoveredCountry } = useUiStore()
  const selectedCountryId = useMatch(`${ROUTE_PATTERNS.country}/*`)?.params.countryId
  const shapes = useQuery({
    queryKey: ['globe', 'shapes'],
    queryFn: () => getStaticJson<CountryShapes>('/data/countries.geojson'),
    staleTime: Infinity,
  })
  const events = useEvents()
  const countries = useCountries()
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight })

  useEffect(() => {
    const onResize = () => setSize({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Detail views (a country is selected): the layout squeezes the globe into the bottom-left mini globe,
  // so show the whole globe centred on the country. Global view: back out. Each mode has its own rotation speed.
  useEffect(() => {
    const globe = globeRef.current
    if (!globe) return
    const country = countries.data?.find((c) => c.id === selectedCountryId)
    globe.pointOfView(
      country ? { ...country.centroid, altitude: MINI_GLOBE_ALTITUDE } : { altitude: 2.5 },
      1000,
    )
    globe.controls().autoRotateSpeed = selectedCountryId
      ? MINI_GLOBE_ROTATE_SPEED
      : GLOBAL_ROTATE_SPEED
  }, [selectedCountryId, countries.data])

  // Idle auto-rotation: pause while the user drags, resume a few seconds after they let go.
  useEffect(() => {
    const controls = globeRef.current?.controls()
    if (!controls) return
    let timer: ReturnType<typeof setTimeout> | undefined
    controls.autoRotate = true
    const pause = () => {
      clearTimeout(timer)
      controls.autoRotate = false
    }
    const resume = () => {
      timer = setTimeout(() => (controls.autoRotate = true), RESUME_ROTATION_MS)
    }
    controls.addEventListener('start', pause)
    controls.addEventListener('end', resume)
    return () => {
      clearTimeout(timer)
      controls.removeEventListener('start', pause)
      controls.removeEventListener('end', resume)
    }
  }, [])

  const material = useMemo(() => new MeshPhongMaterial({ color: cssVar('--globe-ocean') }), [])
  const severeEvents = useMemo(() => (events.data ?? []).filter(needsRing), [events.data])
  const fadeRing = useMemo(() => ringColor(cssVar('--globe-ring')), [])

  return (
    <Globe
      ref={globeRef}
      width={size.width}
      height={size.height}
      backgroundColor={cssVar('--color-bg')}
      globeMaterial={material}
      showAtmosphere
      atmosphereColor={cssVar('--globe-atmosphere')}
      atmosphereAltitude={0.18}
      polygonsData={shapes.data?.features ?? []}
      polygonCapColor={(f) => {
        const id = (f as CountryFeature).properties.id
        if (id === selectedCountryId) return cssVar('--globe-land-selected')
        return id === hoveredCountryId ? cssVar('--globe-land-hover') : cssVar('--globe-land')
      }}
      polygonSideColor={() => cssVar('--globe-land-side')}
      polygonStrokeColor={() => cssVar('--globe-border')}
      polygonAltitude={0.006}
      polygonLabel={(f) => tooltipHtml((f as CountryFeature).properties.name)}
      onPolygonHover={(f) => setHoveredCountry((f as CountryFeature | null)?.properties.id)}
      onPolygonClick={(f) => navigate(paths.country((f as CountryFeature).properties.id))}
      pointsData={events.data ?? []}
      pointLat={(e) => (e as OrbitEvent).location.lat}
      pointLng={(e) => (e as OrbitEvent).location.lng}
      pointColor={(e) => severityColor((e as OrbitEvent).severity)}
      pointAltitude={(e) => pinAltitude((e as OrbitEvent).severity)}
      pointRadius={0.15}
      pointResolution={12}
      pointLabel={(e) => {
        const event = e as OrbitEvent
        return tooltipHtml(event.title, `Severity ${event.severity}/5`)
      }}
      onPointClick={(p) => {
        const e = p as OrbitEvent
        navigate(paths.event(e.countryIds[0], e.id))
      }}
      ringsData={severeEvents}
      ringLat={(e) => (e as OrbitEvent).location.lat}
      ringLng={(e) => (e as OrbitEvent).location.lng}
      ringColor={() => fadeRing}
      ringMaxRadius={(e) => ringMaxRadius((e as OrbitEvent).severity)}
      ringPropagationSpeed={1.2}
      ringRepeatPeriod={1800}
      ringAltitude={0.002}
    />
  )
}
