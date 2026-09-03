import { describe, it, expect } from 'vitest';
import { validateA2uiMessages } from '../../netlify/shared/a2ui-validator';
import { AgUiEventType, formatAgUiSse, formatLegacySse } from '../../netlify/shared/ag-ui';

describe('Server-Side AG-UI and A2UI Validation', () => {
  it('validates a correct A2UI v0.9 message set', () => {
    const validMessages = [
      {
        version: 'v0.9',
        createSurface: {
          surfaceId: 'srf-test',
          catalogId: 'https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json',
        },
      },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 'srf-test',
          components: [
            {
              id: 'root',
              component: 'Text',
              variant: 'h1',
              text: { path: '/title' },
            },
          ],
        },
      },
      {
        version: 'v0.9',
        updateDataModel: {
          surfaceId: 'srf-test',
          path: '/',
          value: { title: 'Test Title' },
        },
      },
    ];

    const result = validateA2uiMessages(validMessages);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects malformed messages, unsupported versions, and security violations', () => {
    // 1. Invalid version
    const invalidVersion = [
      {
        version: 'v0.7',
        createSurface: { surfaceId: 'srf-test', catalogId: 'basic' },
      },
    ];
    expect(validateA2uiMessages(invalidVersion).valid).toBe(false);

    // 2. Prohibited URL protocol
    const dangerousUrl = [
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 'srf-test',
          components: [
            {
              id: 'root',
              component: 'Image',
              src: 'javascript:alert(1)',
            },
          ],
        },
      },
    ];
    const urlResult = validateA2uiMessages(dangerousUrl);
    expect(urlResult.valid).toBe(false);
    expect(urlResult.errors.some((e: string) => e.includes('Prohibited URL scheme'))).toBe(true);

    // 3. Script injection detection
    const scriptInjection = [
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 'srf-test',
          components: [
            {
              id: 'root',
              component: 'Text',
              text: '<script>doSomethingBad()</script>',
            },
          ],
        },
      },
    ];
    const scriptResult = validateA2uiMessages(scriptInjection);
    expect(scriptResult.valid).toBe(false);
    expect(scriptResult.errors.some((e: string) => e.includes('Potential script injection'))).toBe(true);
  });

  it('formats AG-UI SSE and legacy SSE properly', () => {
    const agUiChunk = formatAgUiSse({
      type: AgUiEventType.RUN_STARTED,
      runId: 'run-123',
      threadId: 'thread-456',
    });

    const agUiText = new TextDecoder().decode(agUiChunk);
    expect(agUiText.startsWith('data: ')).toBe(true);
    expect(agUiText.endsWith('\n\n')).toBe(true);
    const parsedAgUi = JSON.parse(agUiText.slice(6));
    expect(parsedAgUi.type).toBe('RUN_STARTED');
    expect(parsedAgUi.runId).toBe('run-123');

    const legacyChunk = formatLegacySse('token', { token: 'hello ' });
    const legacyText = new TextDecoder().decode(legacyChunk);
    expect(legacyText).toBe('event: token\ndata: {"token":"hello "}\n\n');
  });
});
