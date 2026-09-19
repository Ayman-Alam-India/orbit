/** Human label for the AI provider: makes it obvious in the demo whether a real model answered. */
export const providerLabel = (provider: string) =>
  provider === 'mock' ? 'Offline analysis' : provider === 'google' ? 'Gemini' : provider

const MODEL_LABEL: Record<string, string> = {
  gemini: 'Gemini',
  groq: 'Groq · GPT-OSS',
  rules: 'Rule check',
}

/** Display name of a claim verifier ("gemini" → "Gemini"). */
export const modelLabel = (model: string) => MODEL_LABEL[model] ?? model
