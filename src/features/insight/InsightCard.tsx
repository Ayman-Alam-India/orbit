import type { InsightSubjectType } from '@shared'
import { Panel, QueryState } from '../../ui'
import { useInsight } from './useInsight'

/** PLACEHOLDER (owner: Affan). Shows the AI explanation for a subject, with its provider and confidence. */
export function InsightCard({
  subjectType,
  subjectId,
}: {
  subjectType: InsightSubjectType
  subjectId: string
}) {
  const query = useInsight(subjectType, subjectId)
  return (
    <Panel eyebrow="ORBIT explains">
      <QueryState query={query} label="insight">
        {(insight) => (
          <>
            <p>{insight.summary}</p>
            <ul>
              {insight.keyPoints.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
            <small>
              {insight.provider} · confidence {insight.confidence} · {insight.sourceIds.length}{' '}
              source(s)
            </small>
          </>
        )}
      </QueryState>
    </Panel>
  )
}
