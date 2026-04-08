/**
 * Parses comma-separated API keys from GOOGLE_GENERATIVE_AI_API_KEY.
 * Returns the list of trimmed, non-empty keys.
 */
export function getGoogleApiKeys(): string[] {
  const raw = process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? '';
  const keys = raw
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
  return keys;
}

/** Pick a random key from the list for load distribution. */
export function getRandomGoogleApiKey(): string {
  const keys = getGoogleApiKeys();
  if (keys.length === 0) {
    throw new Error(
      'GOOGLE_GENERATIVE_AI_API_KEY must be set (comma-separated for multiple keys)',
    );
  }
  return keys[Math.floor(Math.random() * keys.length)];
}
