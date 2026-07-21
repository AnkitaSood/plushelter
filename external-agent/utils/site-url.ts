/** Normalizes a user- or env-provided URL (adds https when missing). */
export function normalizeSiteUrl(url: string): string {
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

/**
 * Resolves the target page URL.
 * Priority: explicit argument → WEBMCP_URL env.
 */
export function resolveSiteUrl(explicitUrl?: string): string {
  if (explicitUrl?.trim()) {
    return normalizeSiteUrl(explicitUrl);
  }

  const fromEnv = process.env['WEBMCP_URL']?.trim();
  if (fromEnv) {
    return normalizeSiteUrl(fromEnv);
  }

  throw new Error(
    'WEBMCP_URL is not set. Set it in the environment or pass a url argument to the tool.',
  );
}
