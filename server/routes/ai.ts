import { AskRequestSchema, InsightSubjectTypeSchema } from '@shared'
import { Router } from 'express'
import { z } from 'zod'
import { askOrbit, generateInsight } from '../ai'
import { speech } from '../ai/tts'
import { verifyInsight } from '../ai/verify'
import { ok, parseInput } from '../http'

/**
 * AI routes: /api/insights/:subjectType/:subjectId, /api/verify/:subjectType/:subjectId, POST /api/ask
 * and POST /api/speech (narration audio).
 */
export const aiRouter = Router()

aiRouter.get('/insights/:subjectType/:subjectId', async (req, res) => {
  const subjectType = parseInput(InsightSubjectTypeSchema, req.params.subjectType)
  ok(res, await generateInsight(subjectType, req.params.subjectId))
})

aiRouter.post('/ask', async (req, res) => {
  const request = parseInput(AskRequestSchema, req.body)
  ok(res, await askOrbit(request))
})

aiRouter.get('/verify/:subjectType/:subjectId', async (req, res) => {
  const subjectType = parseInput(InsightSubjectTypeSchema, req.params.subjectType)
  ok(res, await verifyInsight(subjectType, req.params.subjectId))
})

const SpeechRequestSchema = z.object({ text: z.string().trim().min(1).max(1500) })

aiRouter.post('/speech', async (req, res) => {
  const { text } = parseInput(SpeechRequestSchema, req.body)
  const wav = await speech(text)
  res.type('audio/wav').set('Cache-Control', 'public, max-age=86400').send(wav)
})
