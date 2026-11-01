import { describe, it, expect, vi } from 'vitest';
import { dispatchTelemetry, SNAPVIBR_DEFAULT_ENDPOINT } from '../src/telemetry/index.js';
import type { AgentTelemetryEvent } from '../src/types/index.js';

describe('telemetry', () => {
  const sampleEvent: AgentTelemetryEvent = {
    domain: 'example.com',
    siteId: 'example.com',
    path: '/pricing',
    bot: 'ChatGPT-User',
    userAgent: 'ChatGPT-User/1.0',
    status: 200,
    cached: false,
    sample: false,
    durationMs: 4,
    format: 'html',
    rawBytes: 15400,
    cleanBytes: 1200,
    htmlBytes: 15400,
    markdownBytes: 0,
    rawTokens: 12000,
    cleanTokens: 800,
    savedTokens: 11200,
    reductionPercentage: 93.3,
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

  it('dispatches properly formatted payload to SnapVibr ingest endpoint with X-SnapVibr-Key', async () => {
    let capturedUrl = '';
    let capturedHeaders: Record<string, string> = {};
    let capturedBody: Record<string, unknown> = {};

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      capturedUrl = String(input);
      capturedHeaders = (init?.headers as Record<string, string>) || {};
      capturedBody = JSON.parse(String(init?.body || '{}'));
      return new Response('{}', { status: 200 });
    });

    dispatchTelemetry(sampleEvent, { snapvibrApiKey: 'sv_live_key_999' });
    await new Promise((r) => setTimeout(r, 20));

    expect(capturedUrl).toBe(SNAPVIBR_DEFAULT_ENDPOINT);
    expect(capturedHeaders['X-SnapVibr-Key']).toBe('sv_live_key_999');
    expect(capturedHeaders['Content-Type']).toBe('application/json');

    expect(capturedBody.domain).toBe('example.com');
    expect(capturedBody.siteId).toBe('example.com');
    expect(capturedBody.path).toBe('/pricing');
    expect(capturedBody.bot).toBe('ChatGPT-User');
    expect(capturedBody.userAgent).toBe('ChatGPT-User/1.0');
    expect(capturedBody.status).toBe(200);
    expect(capturedBody.cached).toBe(false);
    expect(capturedBody.sample).toBe(false);
    expect(capturedBody.durationMs).toBe(4);
    expect(capturedBody.format).toBe('html');
    expect(capturedBody.rawBytes).toBe(15400);
    expect(capturedBody.cleanBytes).toBe(1200);
    expect(capturedBody.htmlBytes).toBe(15400);
    expect(capturedBody.markdownBytes).toBe(0);
    expect(capturedBody.rawTokens).toBe(12000);
    expect(capturedBody.cleanTokens).toBe(800);
    expect(capturedBody.savedTokens).toBe(11200);
    expect(capturedBody.reductionPercentage).toBe(93.3);

    fetchSpy.mockRestore();
  });
});
