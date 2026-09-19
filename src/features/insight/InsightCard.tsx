import type { Confidence, InsightSubjectType } from '@shared'
import { useState } from 'react'
import { Button, Panel, QueryState } from '../../ui'
import { ClaimCheck } from './ClaimCheck'
import styles from './Insight.module.css'
import { providerLabel } from './providerLabel'
import { SourceChips } from './SourceChips'
import { useInsight } from './useInsight'

const CONFIDENCE_LEVEL: Record<Confidence, number> = { low: 1, medium: 2, high: 3 }

/**
 * The AI explanation for the world, a country or an event (decision owner: Affan).
 * Explainable by design: summary, key points, the sources it used, its confidence and which AI produced it.
 */
export function InsightCard({
  subjectType,
  subjectId,
}: {
  subjectType: InsightSubjectType
  subjectId: string
}) {
  const query = useInsight(subjectType, subjectId)
  const [checking, setChecking] = useState(false)
  return (
    <Panel
      eyebrow="ORBIT explains"
      tone="accent"
      actions={
        query.isSuccess && (
          <Button
            variant="accent"
            size="sm"
            aria-expanded={checking}
            onClick={() => setChecking(!checking)}
          >
            {checking ? 'Hide check' : 'Verify claims'}
          </Button>
        )
      }
    >
      <QueryState query={query} label="insight">
        {(insight) => (
          <div className={styles.insight}>
            <p className={styles.summary}>{insight.summary}</p>
            <ul className={styles.points}>
              {insight.keyPoints.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
            <div className={styles.footer}>
              <span className={styles.label}>Sources</span>
              <SourceChips ids={insight.sourceIds} />
            </div>
            <div className={styles.footer}>
              <span className={styles.label}>Confidence</span>
              <span
                className={styles.meter}
                role="img"
                aria-label={`Confidence ${insight.confidence}`}
              >
                {[1, 2, 3].map((level) => (
                  <span
                    key={level}
                    className={styles.bar}
                    data-on={level <= CONFIDENCE_LEVEL[insight.confidence]}
                  />
                ))}
              </span>
              <span className={styles.provider}>{providerLabel(insight.provider)}</span>
            </div>
            {checking && <ClaimCheck subjectType={subjectType} subjectId={subjectId} />}
          </div>
        )}
      </QueryState>
    </Panel>
  )
}
