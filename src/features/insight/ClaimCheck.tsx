import type { Agreement, InsightSubjectType, Verdict, VerificationReport } from '@shared'
import { QueryState } from '../../ui'
import styles from './ClaimCheck.module.css'
import { modelLabel } from './providerLabel'
import { SourceChips } from './SourceChips'
import { useVerification } from './useVerification'

const VERDICT: Record<Verdict, { icon: string; label: string }> = {
  supported: { icon: '✓', label: 'Supported' },
  unsupported: { icon: '?', label: 'Not in data' },
  contradicted: { icon: '✕', label: 'Contradicted' },
}

const AGREEMENT_LABEL: Record<Agreement, string> = {
  agree: 'Agree',
  disagree: 'Disagree',
  single: 'Single check',
}

function Summary({ report }: { report: VerificationReport }) {
  const compared = report.claims.filter((c) => c.agreement !== 'single')
  const agreed = compared.filter((c) => c.agreement === 'agree').length
  return (
    <div className={styles.summary}>
      <div className={styles.scoreLine}>
        <span className={styles.label}>Model agreement</span>
        <strong className={styles.score}>
          {compared.length ? `${agreed} of ${compared.length} claims` : 'Only one verifier ran'}
        </strong>
      </div>
      <div
        className={styles.bar}
        role="img"
        aria-label={`${agreed} of ${compared.length} claims agree`}
      >
        {report.claims.map((c) => (
          <span key={c.id} className={styles.segment} data-agreement={c.agreement} />
        ))}
      </div>
      <div className={styles.models}>
        {report.models.map((m) => (
          <span key={m} className={styles.model} data-state="on">
            {modelLabel(m)}
          </span>
        ))}
        {report.unavailable.map((u) => (
          <span key={u.model} className={styles.model} data-state="off" title={u.reason}>
            {modelLabel(u.model)} · {u.reason === 'No API key configured' ? 'no key' : 'offline'}
          </span>
        ))}
      </div>
    </div>
  )
}

/**
 * Claim-level verification (decision owner: Affan): every claim of the insight, each verifier's
 * verdict side by side, whether they agree, and why.
 */
export function ClaimCheck({
  subjectType,
  subjectId,
}: {
  subjectType: InsightSubjectType
  subjectId: string
}) {
  const query = useVerification(subjectType, subjectId, true)
  return (
    <div className={styles.check}>
      <QueryState query={query} label="verification">
        {(report) => (
          <>
            <Summary report={report} />
            <ol className={styles.claims}>
              {report.claims.map((claim) => (
                <li key={claim.id} className={styles.claim} data-agreement={claim.agreement}>
                  <div className={styles.claimTop}>
                    <p className={styles.text}>{claim.text}</p>
                    <span className={styles.agreement} data-agreement={claim.agreement}>
                      {AGREEMENT_LABEL[claim.agreement]}
                    </span>
                  </div>
                  <div className={styles.verdicts}>
                    {claim.verdicts.map((v) => (
                      <span
                        key={v.model}
                        className={styles.verdict}
                        data-verdict={v.verdict}
                        title={v.reason}
                      >
                        <span aria-hidden>{VERDICT[v.verdict].icon}</span> {modelLabel(v.model)}:{' '}
                        {VERDICT[v.verdict].label}
                      </span>
                    ))}
                  </div>
                  <details className={styles.why}>
                    <summary>Why</summary>
                    <ul>
                      {claim.verdicts.map((v) => (
                        <li key={v.model}>
                          <strong>{modelLabel(v.model)}:</strong> {v.reason}{' '}
                          {v.sourceIds.length > 0 && <SourceChips ids={v.sourceIds} />}
                        </li>
                      ))}
                    </ul>
                  </details>
                </li>
              ))}
            </ol>
          </>
        )}
      </QueryState>
    </div>
  )
}
