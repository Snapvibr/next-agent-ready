import { describe, it, expect, vi } from 'vitest';
import { dispatchTelemetry } from '../src/telemetry/index.js';
import type { AgentTelemetryEvent } from '../src/types/index.js';

describe('telemetry', () => {
  const sampleEvent: AgentTelemetryEvent = {
    crawler: 'chatgpt-user',
    path: '/pricing',
    format: 'html',
    rawTokens: 12000,
    cleanTokens: 800,
    savedTokens: 11200,
    reductionPercentage: 93.3,
    durationMs: 4,
    statusCode: 200,
    timestamp: Date.now(),
  };

  it('invokes custom onCrawlerHit callback', async () => {
    let receivedEvent: AgentTelemetryEvent | null = null;
    const onCrawlerHit = vi.fn(async (event: AgentTelemetryEvent) => {
      receivedEvent = event;
    });

    dispatchTelemetry(sampleEvent, { onCrawlerHit });

    // Wait short tick for async promise
    await new Promise((r) => setTimeout(r, 10));

    expect(onCrawlerHit).toHaveBeenCalledOnce();
    expect(receivedEvent).toEqual(sampleEvent);
  });

  it('swallows errors and does not break execution', async () => {
    const errorCallback = vi.fn(() => {
      throw new Error('Callback failure');
    });

    expect(() => {
      dispatchTelemetry(sampleEvent, { onCrawlerHit: errorCallback });
    }).not.toThrow();
  });

  it('uses waitUntil when provided by edge environment', () => {
    const waitUntil = vi.fn();
    dispatchTelemetry(sampleEvent, { snapvibrApiKey: 'sk_test_123' }, waitUntil);
    expect(waitUntil).toHaveBeenCalledOnce();
  });
});
