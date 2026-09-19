/** Human label for the AI provider: makes it obvious in the demo whether a real model answered. */
export const providerLabel = (provider: string) =>
  provider === 'mock' ? 'Offline analysis' : provider === 'google' ? 'Gemini' : provider
