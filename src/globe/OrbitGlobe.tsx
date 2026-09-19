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
import { MINI_GLOBE_ALTITUDE, MINI_GLOBE_ROTATE_SPEED } from './miniGlobe'

/** One country shape from public/data/countries.geojson (Natural Earth 110m, slimmed to id + name). */
type CountryFeature = {
  type: 'Feature'
  properties: { id: string; name: string }
  geometry: object
}

type CountryShapes = { type: 'FeatureCollection'; features: CountryFeature[] }

/**
 * BASIC GLOBE (owner: Arham). Proves the stack works end to end: country shapes, event markers,
 * click → URL, fly-to on selection. The cinematic look is task ORB-ARH-03 in tasks.json.
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
  // so show the whole globe centred on the country and rotate slowly. Global view: back out, no rotation.
  useEffect(() => {
    const globe = globeRef.current
    if (!globe) return
    const country = countries.data?.find((c) => c.id === selectedCountryId)
    globe.pointOfView(
      country ? { ...country.centroid, altitude: MINI_GLOBE_ALTITUDE } : { altitude: 2.5 },
      1000,
    )
    const controls = globe.controls()
    controls.autoRotate = Boolean(selectedCountryId)
    controls.autoRotateSpeed = MINI_GLOBE_ROTATE_SPEED
  }, [selectedCountryId, countries.data])

  const material = useMemo(() => new MeshPhongMaterial({ color: cssVar('--globe-ocean') }), [])

  return (
    <Globe
      ref={globeRef}
      width={size.width}
      height={size.height}
      backgroundColor={cssVar('--color-bg')}
      globeMaterial={material}
      showAtmosphere
      atmosphereColor={cssVar('--globe-atmosphere')}
      polygonsData={shapes.data?.features ?? []}
      polygonCapColor={(f) => {
        const id = (f as CountryFeature).properties.id
        if (id === selectedCountryId) return cssVar('--globe-land-selected')
        return id === hoveredCountryId ? cssVar('--globe-land-hover') : cssVar('--globe-land')
      }}
      polygonSideColor={() => cssVar('--globe-land-side')}
      polygonStrokeColor={() => cssVar('--globe-border')}
      polygonAltitude={0.006}
      polygonLabel={(f) => (f as CountryFeature).properties.name}
      onPolygonHover={(f) => setHoveredCountry((f as CountryFeature | null)?.properties.id)}
      onPolygonClick={(f) => navigate(paths.country((f as CountryFeature).properties.id))}
      pointsData={events.data ?? []}
      pointLat={(e) => (e as OrbitEvent).location.lat}
      pointLng={(e) => (e as OrbitEvent).location.lng}
      pointColor={(e) => severityColor((e as OrbitEvent).severity)}
      pointAltitude={(e) => 0.02 * (e as OrbitEvent).severity}
      pointRadius={0.35}
      pointLabel={(e) => (e as OrbitEvent).title}
      onPointClick={(p) => {
        const e = p as OrbitEvent
        navigate(paths.event(e.countryIds[0], e.id))
      }}
    />
  )
}
