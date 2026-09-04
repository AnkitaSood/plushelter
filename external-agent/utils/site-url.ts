/** Normalizes a user- or env-provided URL (adds https when missing). */
export function normalizeSiteUrl(url: string): string {
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    if (/^(localhost|127\.0\.0\.1)(:\d+)?/i.test(trimmed)) {
      return `http://${trimmed}`;
    }
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
