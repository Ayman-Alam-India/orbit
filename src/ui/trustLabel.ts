import type { TrustStatus } from '@shared'

/** Icon and word for each trust status, shared by the badge and the globe tooltip. */
export const TRUST_LABEL: Record<TrustStatus, { icon: string; label: string }> = {
  verified: { icon: '✓', label: 'Verified' },
  corroborated: { icon: '◑', label: 'Corroborated' },
  unverified: { icon: '○', label: 'Unverified' },
}
