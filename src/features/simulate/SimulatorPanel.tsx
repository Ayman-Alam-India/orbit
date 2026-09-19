import type { Scenario, ScenarioRole } from '@shared'
import { useEffect, useState } from 'react'
import { useUiStore } from '../../state/uiStore'
import { Panel, QueryState } from '../../ui'
import { SourceChips } from '../insight/SourceChips'
import styles from './Simulator.module.css'
import { useScenarios, useSimulation } from './useSimulation'

const PRESETS = [10, 30, 60]
const ROLE_LABEL: Record<ScenarioRole, string> = {
  importer: 'Importer',
  exporter: 'Exporter',
  transit: 'Transit',
}

function ScenarioView({ scenarios }: { scenarios: Scenario[] }) {
  const [scenarioId, setScenarioId] = useState(scenarios[0]?.id)
  const scenario = scenarios.find((s) => s.id === scenarioId) ?? scenarios[0]
  const [brentPct, setBrentPct] = useState(scenario?.defaultBrentPct ?? 20)
  // The slider moves freely; the server is asked once the value settles.
  const [settledPct, setSettledPct] = useState(brentPct)
  const result = useSimulation(scenario?.id, settledPct)
  const setSimulation = useUiStore((s) => s.setSimulation)

  useEffect(() => {
    const timer = setTimeout(() => setSettledPct(brentPct), 250)
    return () => clearTimeout(timer)
  }, [brentPct])

  // Tell the globe what to show (chokepoint, affected countries); clear it when leaving.
  useEffect(() => {
    if (!scenario) return
    setSimulation({
      scenarioId: scenario.id,
      title: scenario.title,
      brentPct: settledPct,
      chokepoint: scenario.chokepoint,
      affected: scenario.affected.map((a) => ({ countryId: a.countryId, role: a.role })),
    })
  }, [scenario, settledPct, setSimulation])
  useEffect(() => () => setSimulation(undefined), [setSimulation])

  if (!scenario) return <p className={styles.muted}>No scenarios available.</p>

  const choose = (s: Scenario) => {
    setScenarioId(s.id)
    setBrentPct(s.defaultBrentPct)
  }

  return (
    <>
      <Panel eyebrow="What if…" title={scenario.title} tone="accent">
        <p className={styles.badge}>Simulation, not a forecast</p>
        <div className={styles.segmented} role="radiogroup" aria-label="Scenario">
          {scenarios.map((s) => (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={s.id === scenario.id}
              className={styles.segment}
              onClick={() => choose(s)}
            >
              {s.chokepoint.name}
            </button>
          ))}
        </div>
        <p className={styles.description}>{scenario.description}</p>

        <label className={styles.sliderLabel} htmlFor="brent-shock">
          <span>Oil-price shock you want to test</span>
          <strong>
            {brentPct > 0 ? '+' : ''}
            {brentPct}% Brent
          </strong>
        </label>
        <input
          id="brent-shock"
          className={styles.slider}
          type="range"
          min={-30}
          max={100}
          step={5}
          value={brentPct}
          onChange={(e) => setBrentPct(Number(e.target.value))}
        />
        <div className={styles.presets}>
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              className={styles.preset}
              aria-pressed={brentPct === p}
              onClick={() => setBrentPct(p)}
            >
              +{p}%
            </button>
          ))}
          <span className={styles.muted}>Illustrative shocks, not predictions</span>
        </div>
      </Panel>

      <Panel eyebrow="Knock-on effects">
        <QueryState query={result} label="simulation">
          {(r) => (
            <div className={styles.results} aria-busy={result.isFetching}>
              {r.impacts.map((i) => (
                <div key={i.id} className={styles.result} data-basis={i.basis}>
                  <span className={styles.resultLabel}>{i.label}</span>
                  <strong className={styles.resultValue}>{i.value}</strong>
                  <p className={styles.resultDetail}>{i.detail}</p>
                  <details className={styles.formula}>
                    <summary>
                      {i.basis === 'analysis' ? 'ORBIT analysis' : 'How this is calculated'}
                    </summary>
                    <p>{i.formula}</p>
                    <SourceChips ids={i.sourceIds} />
                  </details>
                </div>
              ))}
              <p className={styles.muted}>
                Brent {r.brent.live ? 'live' : 'snapshot'} price as of {r.brent.asOf.slice(0, 10)}.
              </p>
            </div>
          )}
        </QueryState>
      </Panel>

      <Panel eyebrow="Who is exposed">
        <ul className={styles.affected}>
          {scenario.affected.map((a) => (
            <li key={a.countryId} data-role={a.role}>
              <span className={styles.role}>{ROLE_LABEL[a.role]}</span>
              <strong>{a.countryId}</strong> {a.note}
            </li>
          ))}
        </ul>
        <ul className={styles.facts}>
          {scenario.facts.map((f) => (
            <li key={f.text}>
              {f.text} <SourceChips ids={f.sourceIds} />
            </li>
          ))}
        </ul>
      </Panel>
    </>
  )
}

/**
 * Route /simulate (USP): pick a chokepoint scenario and an oil-price shock; ORBIT shows the knock-on
 * effects with every formula and source, and the globe lights up who is exposed.
 */
export function SimulatorPanel() {
  const scenarios = useScenarios()
  return (
    <QueryState query={scenarios} label="scenarios">
      {(list) => <ScenarioView scenarios={list} />}
    </QueryState>
  )
}
