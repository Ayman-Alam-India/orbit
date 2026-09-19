import type { OrbitEvent } from '@shared'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import Globe, { type GlobeMethods } from 'react-globe.gl'
import { useMatch, useNavigate } from 'react-router-dom'
import { Color, MeshPhongMaterial, TextureLoader } from 'three'
import { getStaticJson } from '../api/client'
import { useCountries } from '../features/country/useCountry'
import { useAutoEvents, useEvents } from '../features/event/useEvents'
import { useMarkets } from '../features/markets/useMarkets'
import { useImpacts } from '../features/ripple/useImpacts'
import { paths, ROUTE_PATTERNS } from '../routes'
import { useUiStore } from '../state/uiStore'
import { cssVar, severityColor } from '../styles/cssVar'
import { needsRing, pinAltitude, ringColor, ringMaxRadius, tooltipHtml } from './globeStyle'
import { MINI_GLOBE_ALTITUDE, MINI_GLOBE_ROTATE_SPEED } from './miniGlobe'
import { rippleArcs, simulationArcs, type RippleArc } from './rippleArcs'

/** Public-domain NASA imagery (via the globe.gl examples), stored in public/textures so it works offline. */
const TEXTURES = {
  day: '/textures/earth-blue-marble.jpg',
  bump: '/textures/earth-topology.png',
  water: '/textures/earth-water.png',
}

/** Slow idle rotation on the global view, and how long it waits after the user lets go. */
const GLOBAL_ROTATE_SPEED = 0.35
const RESUME_ROTATION_MS = 4000
const TOUR_FLIGHT_MS = 2600

/** One country shape from public/data/countries.geojson (Natural Earth 110m, slimmed to id + name). */
type CountryFeature = {
  type: 'Feature'
  properties: { id: string; name: string }
  geometry: { type: string; coordinates: unknown }
}

type CountryShapes = { type: 'FeatureCollection'; features: CountryFeature[] }

/**
 * Cinematic globe (decision owner: Arham): a realistic Earth (day texture, terrain, shiny oceans, stars)
 * with faint country outlines, orange selection, thin severity-coloured pins,
 * ripple rings on severe events (4-5), hover tooltips, and a slow idle rotation. All colours come from tokens.
 */
export default function OrbitGlobe() {
  const globeRef = useRef<GlobeMethods | undefined>(undefined)
  const navigate = useNavigate()
  const { hoveredCountryId, setHoveredCountry, simulation, tourFocus } = useUiStore()
  const selectedCountryId = useMatch(`${ROUTE_PATTERNS.country}/*`)?.params.countryId
  const shapes = useQuery({
    queryKey: ['globe', 'shapes'],
    queryFn: () => getStaticJson<CountryShapes>('/data/countries.geojson'),
    staleTime: Infinity,
  })
  const events = useEvents()
  const autoEvents = useAutoEvents()
  const countries = useCountries()
  const impacts = useImpacts()
  const markets = useMarkets()
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
    // Guided tour: a slow, cinematic flight to each stop, with rotation paused.
    if (tourFocus) {
      globe.controls().autoRotate = false
      globe.pointOfView(tourFocus, TOUR_FLIGHT_MS)
      return
    }
    // What-if simulator: hold the camera on the scenario's chokepoint.
    if (simulation) {
      globe.pointOfView({ ...simulation.chokepoint.location, altitude: 1.9 }, 1500)
      globe.controls().autoRotate = false
      return
    }
    globe.controls().autoRotate = true
    const country = countries.data?.find((c) => c.id === selectedCountryId)
    globe.pointOfView(
      country ? { ...country.centroid, altitude: MINI_GLOBE_ALTITUDE } : { altitude: 2.5 },
      1000,
    )
    globe.controls().autoRotateSpeed = selectedCountryId
      ? MINI_GLOBE_ROTATE_SPEED
      : GLOBAL_ROTATE_SPEED
  }, [selectedCountryId, countries.data, simulation, tourFocus])

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
      timer = setTimeout(() => {
        if (!useUiStore.getState().tourFocus) controls.autoRotate = true
      }, RESUME_ROTATION_MS)
    }
    controls.addEventListener('start', pause)
    controls.addEventListener('end', resume)
    return () => {
      clearTimeout(timer)
      controls.removeEventListener('start', pause)
      controls.removeEventListener('end', resume)
    }
  }, [])

  // Realistic Earth: NASA Blue Marble day texture + terrain bump (via props below) + shiny oceans.
  const material = useMemo(() => new MeshPhongMaterial({ shininess: 14 }), [])
  useEffect(() => {
    new TextureLoader().load(TEXTURES.water, (texture) => {
      material.specularMap = texture
      material.specular = new Color(cssVar('--globe-specular'))
      material.needsUpdate = true
    })
  }, [material])
  // Curated events and the ones ORBIT detected itself share the globe; the styling below tells them apart.
  const allEvents = useMemo(
    () => [...(events.data ?? []), ...(autoEvents.data ?? [])],
    [events.data, autoEvents.data],
  )
  const severeEvents = useMemo(() => (events.data ?? []).filter(needsRing), [events.data])
  // Ripple effects: animated arcs from each event to the countries it affects.
  const arcs = useMemo(
    () =>
      simulation
        ? simulationArcs(
            simulation.chokepoint.location,
            simulation.affected,
            shapes.data?.features ?? [],
          )
        : rippleArcs(
            impacts.data ?? [],
            events.data ?? [],
            countries.data ?? [],
            markets.data ?? [],
            selectedCountryId,
          ),
    [
      impacts.data,
      events.data,
      countries.data,
      markets.data,
      selectedCountryId,
      simulation,
      shapes.data,
    ],
  )
  const fadeRing = useMemo(() => ringColor(cssVar('--globe-ring')), [])

  return (
    <Globe
      ref={globeRef}
      width={size.width}
      height={size.height}
      backgroundColor="rgba(0, 0, 0, 0)"
      globeMaterial={material}
      globeImageUrl={TEXTURES.day}
      bumpImageUrl={TEXTURES.bump}
      showAtmosphere
      atmosphereColor={cssVar('--globe-atmosphere')}
      atmosphereAltitude={0.16}
      polygonsData={shapes.data?.features ?? []}
      polygonCapColor={(f) => {
        const id = (f as CountryFeature).properties.id
        const role = simulation?.affected.find((a) => a.countryId === id)?.role
        if (role) return cssVar(`--sim-${role}`)
        if (id === tourFocus?.countryId) return cssVar('--globe-land-selected')
        if (id === selectedCountryId) return cssVar('--globe-land-selected')
        return id === hoveredCountryId ? cssVar('--globe-land-hover') : cssVar('--globe-land')
      }}
      polygonSideColor={() => cssVar('--globe-land-side')}
      polygonStrokeColor={() => cssVar('--globe-border')}
      polygonAltitude={0.006}
      polygonLabel={(f) => tooltipHtml((f as CountryFeature).properties.name)}
      onPolygonHover={(f) => setHoveredCountry((f as CountryFeature | null)?.properties.id)}
      onPolygonClick={(f) => navigate(paths.country((f as CountryFeature).properties.id))}
      pointsData={allEvents}
      pointLat={(e) => (e as OrbitEvent).location.lat}
      pointLng={(e) => (e as OrbitEvent).location.lng}
      pointColor={(e) =>
        (e as OrbitEvent).origin === 'auto'
          ? cssVar('--origin-auto')
          : severityColor((e as OrbitEvent).severity)
      }
      pointAltitude={(e) => pinAltitude((e as OrbitEvent).severity)}
      pointRadius={0.15}
      pointResolution={12}
      pointLabel={(e) => {
        const event = e as OrbitEvent
        const note =
          event.origin === 'auto' ? 'Auto-detected · unverified' : `Severity ${event.severity}/5`
        return tooltipHtml(event.title, note)
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
      arcsData={arcs}
      arcColor={(a: object) => {
        const color = cssVar(`--channel-${(a as RippleArc).channel}` as `--${string}`)
        return [`${color}00`, color, color]
      }}
      arcStroke={(a) => 0.25 + 0.2 * (a as RippleArc).strength}
      arcAltitudeAutoScale={0.45}
      arcDashLength={0.35}
      arcDashGap={0.15}
      arcDashInitialGap={() => Math.random()}
      arcDashAnimateTime={2600}
      arcLabel={(a) => tooltipHtml((a as RippleArc).label, 'Ripple effect')}
    />
  )
}
