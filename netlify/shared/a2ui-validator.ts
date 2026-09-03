/**
 * Server-side validation and security sanitization for A2UI v0.9 messages.
 * Prevents malformed or malicious generative UI payloads from reaching the client.
 */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const MAX_MESSAGES_PER_SNAPSHOT = 50;
const MAX_COMPONENTS_PER_SURFACE = 100;
const MAX_TREE_DEPTH = 10;
const ALLOWED_PROTOCOLS = /^((https?|data):|\/)/i;

/**
 * Validates a list of A2UI v0.9 messages according to the protocol schema
 * and shelter security constraints.
 */
export function validateA2uiMessages(messages: unknown[]): ValidationResult {
  const errors: string[] = [];

  if (!Array.isArray(messages)) {
    return { valid: false, errors: ['Messages payload must be an array'] };
  }

  if (messages.length === 0) {
    return { valid: false, errors: ['Messages array cannot be empty'] };
  }

  if (messages.length > MAX_MESSAGES_PER_SNAPSHOT) {
    return {
      valid: false,
      errors: [`Exceeded maximum message count (${MAX_MESSAGES_PER_SNAPSHOT})`],
    };
  }

  let totalComponents = 0;

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i] as Record<string, unknown>;
    if (!msg || typeof msg !== 'object') {
      errors.push(`Message at index ${i} is not an object`);
      continue;
    }

    if (msg['version'] !== 'v0.9' && msg['version'] !== 'v0.9.1') {
      errors.push(`Message at index ${i} has invalid version: ${msg['version']}`);
    }

    const hasCreateSurface = 'createSurface' in msg;
    const hasUpdateComponents = 'updateComponents' in msg;
    const hasUpdateDataModel = 'updateDataModel' in msg;
    const hasDeleteSurface = 'deleteSurface' in msg;

    const operationCount = [
      hasCreateSurface,
      hasUpdateComponents,
      hasUpdateDataModel,
      hasDeleteSurface,
    ].filter(Boolean).length;

    if (operationCount !== 1) {
      errors.push(
        `Message at index ${i} must have exactly one operation type (found ${operationCount})`,
      );
      continue;
    }

    if (hasCreateSurface) {
      const cs = msg['createSurface'] as Record<string, unknown>;
      if (!cs || typeof cs !== 'object') {
        errors.push(`createSurface at index ${i} must be an object`);
      } else {
        if (!cs['surfaceId'] || typeof cs['surfaceId'] !== 'string') {
          errors.push(`createSurface at index ${i} missing valid surfaceId`);
        }
        if (!cs['catalogId'] || typeof cs['catalogId'] !== 'string') {
          errors.push(`createSurface at index ${i} missing valid catalogId`);
        }
      }
    }

    if (hasUpdateComponents) {
      const uc = msg['updateComponents'] as Record<string, unknown>;
      if (!uc || typeof uc !== 'object') {
        errors.push(`updateComponents at index ${i} must be an object`);
      } else {
        if (!uc['surfaceId'] || typeof uc['surfaceId'] !== 'string') {
          errors.push(`updateComponents at index ${i} missing valid surfaceId`);
        }
        if (!Array.isArray(uc['components'])) {
          errors.push(`updateComponents at index ${i} components must be an array`);
        } else {
          totalComponents += uc['components'].length;
          if (totalComponents > MAX_COMPONENTS_PER_SURFACE) {
            errors.push(
              `Exceeded maximum component count (${MAX_COMPONENTS_PER_SURFACE}) on surface`,
            );
            break;
          }

          let hasRoot = false;
          for (let j = 0; j < uc['components'].length; j++) {
            const comp = uc['components'][j] as Record<string, unknown>;
            if (!comp || typeof comp !== 'object') {
              errors.push(`Component at [${i}].components[${j}] must be an object`);
              continue;
            }
            if (!comp['component'] || typeof comp['component'] !== 'string') {
              errors.push(`Component at [${i}].components[${j}] missing component name`);
            }
            if (comp['id'] === 'root') {
              hasRoot = true;
            }

            // Security check on properties for unsafe URLs / script injection
            checkComponentProperties(comp, `[${i}].components[${j}]`, 1, errors);
          }
        }
      }
    }

    if (hasUpdateDataModel) {
      const ud = msg['updateDataModel'] as Record<string, unknown>;
      if (!ud || typeof ud !== 'object') {
        errors.push(`updateDataModel at index ${i} must be an object`);
      } else {
        if (!ud['surfaceId'] || typeof ud['surfaceId'] !== 'string') {
          errors.push(`updateDataModel at index ${i} missing valid surfaceId`);
        }
      }
    }

    if (hasDeleteSurface) {
      const ds = msg['deleteSurface'] as Record<string, unknown>;
      if (!ds || typeof ds !== 'object') {
        errors.push(`deleteSurface at index ${i} must be an object`);
      } else {
        if (!ds['surfaceId'] || typeof ds['surfaceId'] !== 'string') {
          errors.push(`deleteSurface at index ${i} missing valid surfaceId`);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function checkComponentProperties(
  obj: Record<string, unknown>,
  path: string,
  depth: number,
  errors: string[],
): void {
  if (depth > MAX_TREE_DEPTH) {
    errors.push(`Component tree depth exceeded maximum (${MAX_TREE_DEPTH}) at ${path}`);
    return;
  }

  for (const [key, val] of Object.entries(obj)) {
    if (typeof val === 'string') {
      // Check for forbidden URL sinks
      if ((key === 'src' || key === 'url' || key === 'href') && val.trim()) {
        if (!ALLOWED_PROTOCOLS.test(val.trim())) {
          errors.push(`Prohibited URL scheme at ${path}.${key}: "${val}"`);
        }
      }

      // Check for dangerous script patterns
      if (/<script\b/i.test(val) || /javascript:/i.test(val)) {
        errors.push(`Potential script injection detected at ${path}.${key}`);
      }
    } else if (val && typeof val === 'object' && !Array.isArray(val)) {
      checkComponentProperties(val as Record<string, unknown>, `${path}.${key}`, depth + 1, errors);
    }
  }
}
