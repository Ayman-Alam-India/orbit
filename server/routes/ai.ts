import { AskRequestSchema, InsightSubjectTypeSchema } from '@shared'
import { Router } from 'express'
import { askOrbit, generateInsight } from '../ai'
import { ok, parseInput } from '../http'

/** AI routes: /api/insights/:subjectType/:subjectId and POST /api/ask. */
export const aiRouter = Router()

aiRouter.get('/insights/:subjectType/:subjectId', async (req, res) => {
  const subjectType = parseInput(InsightSubjectTypeSchema, req.params.subjectType)
  ok(res, await generateInsight(subjectType, req.params.subjectId))
})

aiRouter.post('/ask', async (req, res) => {
  const request = parseInput(AskRequestSchema, req.body)
  ok(res, await askOrbit(request))
})
