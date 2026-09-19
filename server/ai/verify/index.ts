import {
  VerificationReportSchema,
  type Agreement,
  type InsightSubjectType,
  type ModelVerdict,
  type VerificationReport,
} from '@shared'
import { env } from '../../env'
import { readCache, writeCache } from '../../sources/cache'
import { buildContext, generateInsight } from '..'
import { extractClaims } from './claims'
import { geminiVerifier, groqVerifier } from './llm'
import { rulesVerifier } from './rules'
import type { Verifier } from './types'

/** LLM verifiers with a key configured, in display order. The rule-based checker always runs last. */
function configuredVerifiers(): Verifier[] {
  return [
    ...(env.GOOGLE_GENERATIVE_AI_API_KEY ? [geminiVerifier] : []),
    ...(env.GROQ_API_KEY ? [groqVerifier] : []),
    rulesVerifier,
  ]
}

function agreementOf(verdicts: ModelVerdict[]): Agreement {
  if (verdicts.length < 2) return 'single'
  return verdicts.every((v) => v.verdict === verdicts[0].verdict) ? 'agree' : 'disagree'
}

/**
 * Checks every claim of the insight for a subject with all configured verifiers, independently and
 * in parallel. A verifier that fails is listed under `unavailable`. If an LLM fails and an earlier
 * complete report for the same claims is cached, that report is served instead (offline demo).
 */
export async function verifyInsight(
  subjectType: InsightSubjectType,
  subjectId: string,
): Promise<VerificationReport> {
  const context = buildContext(subjectType, subjectId)
  const insight = await generateInsight(subjectType, subjectId)
  const claims = extractClaims(insight)
  const verifiers = configuredVerifiers()
  const cacheKey = `verify-${subjectType}-${subjectId.toLowerCase()}`

  const results = await Promise.allSettled(verifiers.map((v) => v.verify(claims, context)))
  const answered = verifiers
    .map((v, i) => ({ verifier: v, result: results[i] }))
    .filter((x) => x.result.status === 'fulfilled')
  // LLMs without a key are listed too, so the UI can say why only some verifiers answered.
  const notConfigured = [
    ...(env.GOOGLE_GENERATIVE_AI_API_KEY
      ? []
      : [{ model: 'gemini', reason: 'No API key configured' }]),
    ...(env.GROQ_API_KEY ? [] : [{ model: 'groq', reason: 'No API key configured' }]),
  ]
  const failed = verifiers
    .map((v, i) => ({ verifier: v, result: results[i] }))
    .filter((x) => x.result.status === 'rejected')
    .map(({ verifier, result }) => {
      const reason = (result as PromiseRejectedResult).reason
      console.warn(`[ai] ${verifier.name} verification failed:`, reason)
      return {
        model: verifier.name,
        reason: reason instanceof Error ? reason.message : String(reason),
      }
    })

  if (failed.length) {
    const cached = VerificationReportSchema.safeParse(await readCache(cacheKey))
    const sameClaims =
      cached.success && cached.data.claims.map((c) => c.text).join('\n') === claims.join('\n')
    if (sameClaims && cached.data.models.length > 1) {
      console.warn(`[ai] serving cached verification for ${subjectType}/${subjectId}`)
      return cached.data
    }
  }

  const verified = claims.map((text, i) => {
    const verdicts = answered.map(({ verifier, result }) => ({
      model: verifier.name,
      ...(result as PromiseFulfilledResult<Awaited<ReturnType<Verifier['verify']>>>).value[i],
    }))
    return { id: `clm_${i + 1}`, text, verdicts, agreement: agreementOf(verdicts) }
  })
  const compared = verified.filter((c) => c.agreement !== 'single')
  const report = VerificationReportSchema.parse({
    subjectType,
    subjectId,
    insightProvider: insight.provider,
    models: answered.map((a) => a.verifier.name),
    unavailable: [...failed, ...notConfigured],
    claims: verified,
    agreementScore: compared.length
      ? compared.filter((c) => c.agreement === 'agree').length / compared.length
      : 1,
    generatedAt: new Date().toISOString(),
  })
  if (!failed.length && answered.length > 1) {
    await writeCache(cacheKey, report).catch((err) => console.warn('[ai] cache write failed', err))
  }
  return report
}
