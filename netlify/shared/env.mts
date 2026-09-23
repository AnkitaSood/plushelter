/**
 * Robust environment variable resolution for Netlify Functions (Node) and Netlify Edge Functions (Deno).
 * Searches Netlify.env, process.env, Deno.env, Netlify CLI (live retrieval), and local env files
 * across candidate names and case-insensitive patterns.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createRequire } from 'node:module';

declare const Netlify: any;
declare const Deno: any;

export const CANDIDATE_KEY_NAMES = [
  'GEMINI_API_KEY',
  'GOOGLE_API_KEY',
  'GOOGLE_GENAI_API_KEY',
  'GEMINI_KEY',
  'API_KEY',
];

const PLUSHELTER_SITE_ID = 'fe9577fa-4edb-4d17-95eb-f6361f12ca0d';

/**
 * Ensures that .netlify/state.json is properly linked to the plushelter site ID.
 * If siteId was wiped or dropped, this repairs it so netlify dev and netlify CLI
 * can immediately fetch cloud environment variables.
 */
export function ensureNetlifyStateLinked(): void {
  try {
    if (typeof process === 'undefined' || !process.cwd) return;
    const cwd = process.cwd();
    const candidateDirs = [cwd, path.resolve(cwd, '..'), path.resolve(cwd, '../..')];

    for (const dir of candidateDirs) {
      const statePath = path.resolve(dir, '.netlify', 'state.json');
      if (fs.existsSync(statePath)) {
        try {
          const data = JSON.parse(fs.readFileSync(statePath, 'utf8'));
          if (data && !data.siteId) {
            data.siteId = PLUSHELTER_SITE_ID;
            fs.writeFileSync(statePath, JSON.stringify(data, null, '\t') + '\n');
          }
          return;
        } catch {
          // Continue to next dir if parse error
        }
      }
    }
  } catch {
    // Ignore permissions or filesystem errors
  }
}

let cachedCliKey: string | undefined = undefined;
let attemptedCli = false;

/**
 * Directly queries Netlify CLI to fetch the GEMINI_API_KEY from Netlify cloud.
 * Used during local development in Node if Netlify.env has not yet injected the variable.
 */
function tryGetApiKeyFromNetlifyCli(): string | undefined {
  if (attemptedCli) return cachedCliKey;
  attemptedCli = true;

  if (typeof process === 'undefined' || !process.versions?.node || typeof Deno !== 'undefined') {
    return undefined;
  }

  ensureNetlifyStateLinked();

  try {
    const require = createRequire(import.meta.url);
    const { execSync } = require('node:child_process');
    const cwd = process.cwd();
    const output = execSync(
      './node_modules/.bin/netlify env:get GEMINI_API_KEY --context dev',
      {
        cwd,
        encoding: 'utf8',
        timeout: 8000,
        stdio: ['ignore', 'pipe', 'ignore'],
      },
    ).trim();

    if (output && !output.includes(' ') && output.length > 10) {
      cachedCliKey = output;
      if (process.env) {
        process.env.GEMINI_API_KEY = output;
      }
      return output;
    }
  } catch {
    // Ignore
  }
  return undefined;
}

/**
 * Searches local env files (.env.local, .env, .env.development) on disk if running in Node.
 */
function findKeyInLocalEnvFiles(candidateKeys: string[]): string | undefined {
  try {
    if (typeof process === 'undefined' || !process.cwd) {
      return undefined;
    }

    const cwd = process.cwd();
    const candidateDirs = [
      cwd,
      path.resolve(cwd, '..'),
      path.resolve(cwd, '../..'),
    ];
    const candidateFiles = ['.env.local', '.env', '.env.development'];

    for (const dir of candidateDirs) {
      for (const file of candidateFiles) {
        const fullPath = path.resolve(dir, file);
        try {
          if (!fs.existsSync(fullPath)) continue;
          const content = fs.readFileSync(fullPath, 'utf8');
          const lines = content.split(/\r?\n/);
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const eqIdx = trimmed.indexOf('=');
            if (eqIdx <= 0) continue;
            const key = trimmed.slice(0, eqIdx).trim();
            if (candidateKeys.includes(key)) {
              let val = trimmed.slice(eqIdx + 1).trim();
              if (
                (val.startsWith('"') && val.endsWith('"')) ||
                (val.startsWith("'") && val.endsWith("'"))
              ) {
                val = val.slice(1, -1);
              }
              if (val.length > 0) {
                if (typeof process !== 'undefined' && process.env) {
                  process.env[key] = val;
                }
                return val;
              }
            }
          }
        } catch {
          // Ignore read permissions or missing file errors
        }
      }
    }
  } catch {
    // Ignore any unexpected filesystem inspection errors
  }
  return undefined;
}

export function getGeminiApiKey(): string | undefined {
  // 1. Check Netlify.env (Netlify's official env API)
  if (typeof Netlify !== 'undefined' && Netlify.env) {
    for (const name of CANDIDATE_KEY_NAMES) {
      try {
        const val = Netlify.env.get(name);
        if (val && typeof val === 'string' && val.trim().length > 0) {
          return val.trim();
        }
      } catch { /* ignore */ }
    }

    try {
      if (typeof Netlify.env.toObject === 'function') {
        const obj = Netlify.env.toObject();
        for (const [k, v] of Object.entries(obj)) {
          if (/^(gemini|google.*)api.*key$/i.test(k) && typeof v === 'string' && v.trim().length > 0) {
            return v.trim();
          }
        }
      }
    } catch { /* ignore */ }
  }

  // 2. Check process.env (Node.js runtime in Netlify Functions)
  if (typeof process !== 'undefined' && process.env) {
    for (const name of CANDIDATE_KEY_NAMES) {
      const val = process.env[name];
      if (val && typeof val === 'string' && val.trim().length > 0) {
        return val.trim();
      }
    }

    for (const [k, v] of Object.entries(process.env)) {
      if (/^(gemini|google.*)api.*key$/i.test(k) && typeof v === 'string' && v.trim().length > 0) {
        return v.trim();
      }
    }
  }

  // 3. Check Deno.env (Deno runtime in Netlify Edge Functions)
  if (typeof Deno !== 'undefined' && Deno.env) {
    for (const name of CANDIDATE_KEY_NAMES) {
      try {
        const val = Deno.env.get(name);
        if (val && typeof val === 'string' && val.trim().length > 0) {
          return val.trim();
        }
      } catch { /* ignore */ }
    }
  }

  // 4. Live fetch from Netlify CLI if in Node local development
  const cliVal = tryGetApiKeyFromNetlifyCli();
  if (cliVal) {
    return cliVal;
  }

  // 5. Check local env files on disk (.env.local, .env)
  const localVal = findKeyInLocalEnvFiles(CANDIDATE_KEY_NAMES);
  if (localVal) {
    return localVal;
  }

  return undefined;
}

export function getGeminiModel(defaultModel = 'gemini-3.1-flash-lite'): string {
  const modelCandidateNames = ['GEMINI_TEST_MODEL', 'GEMINI_MODEL'];

  for (const name of modelCandidateNames) {
    if (typeof Netlify !== 'undefined' && Netlify.env) {
      try {
        const val = Netlify.env.get(name);
        if (val) return val;
      } catch { /* ignore */ }
    }
    if (typeof process !== 'undefined' && process.env) {
      const val = process.env[name];
      if (val) return val;
    }
    if (typeof Deno !== 'undefined' && Deno.env) {
      try {
        const val = Deno.env.get(name);
        if (val) return val;
      } catch { /* ignore */ }
    }
  }

  const localModel = findKeyInLocalEnvFiles(modelCandidateNames);
  if (localModel) {
    return localModel;
  }

  return defaultModel;
}

export function logAvailableEnvKeys(source: string): void {
  const ntlKeys = typeof Netlify !== 'undefined' && Netlify.env?.toObject
    ? Object.keys(Netlify.env.toObject())
    : [];
  const procKeys = typeof process !== 'undefined' && process.env
    ? Object.keys(process.env).filter((k) => /key|api|gemini|google|netlify|demo/i.test(k))
    : [];

  console.warn(
    `[${source}] GEMINI_API_KEY is not configured in Netlify.env or process.env.\n` +
    `  - Netlify.env keys: ${ntlKeys.length ? ntlKeys.join(', ') : '(none)'}\n` +
    `  - process.env matched keys: ${procKeys.length ? procKeys.join(', ') : '(none)'}\n` +
    `  TIP: Site link status: ensure .netlify/state.json has siteId: "${PLUSHELTER_SITE_ID}".`
  );
}

export function createApiKeyMissingResponse(source: string): Response {
  logAvailableEnvKeys(source);
  return new Response(
    JSON.stringify({
      error: {
        code: 'API_KEY_NOT_CONFIGURED',
        message:
          'GEMINI_API_KEY is not configured in Netlify environment variables. ' +
          'Please ensure the Netlify CLI is linked to your site ("plushelter") and restart netlify dev.',
      },
    }),
    {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    },
  );
}
