import type { ModelVerdict } from '@shared'
import type { AiContext } from '../types'

/** A verdict before the verifier's name is attached. */
export type ClaimJudgement = Omit<ModelVerdict, 'model'>

/** Anything that can check claims against ORBIT's data: an LLM or the rule-based checker. */
export interface Verifier {
  name: string
  /** Returns exactly one judgement per claim, in the same order. */
  verify(claims: string[], context: AiContext): Promise<ClaimJudgement[]>
}
