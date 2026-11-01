/**
 * Non-blocking telemetry dispatcher for next-agent-ready.
 * Dispatches crawler analytics to SnapVibr AI Visibility, Axiom, or custom sinks.
 */

import type { AgentTelemetryEvent, TelemetryConfig } from '../types/index.js';

export const SNAPVIBR_DEFAULT_ENDPOINT = 'https://ingest.snapvibr.com/api/v1/ai-visibility/telemetry';

/**
 * Resolves the SnapVibr telemetry ingest URL respecting custom endpoints and environment variables.
 */
export function resolveTelemetryEndpoint(customEndpoint?: string): string {
  if (customEndpoint) return customEndpoint;
  if (typeof process !== 'undefined' && process.env?.SNAPVIBR_INGEST_URL) {
    return process.env.SNAPVIBR_INGEST_URL;
  }
  return SNAPVIBR_DEFAULT_ENDPOINT;
}

/**
 * Dispatches a telemetry event non-blockingly to configured destinations.
 */
export function dispatchTelemetry(
  event: AgentTelemetryEvent,
  config?: TelemetryConfig,
  waitUntil?: (promise: Promise<unknown>) => void
): void {
  if (!config) return;
  if (config.enabled === false) return;

  const promise = (async () => {
    try {
      // 1. Invoke custom callback if registered
      if (typeof config.onCrawlerHit === 'function') {
        try {
          await config.onCrawlerHit(event);
        } catch {
          // Swallow callback error so application flow is unaffected
        }
      }

      // 2. Dispatch to SnapVibr AI Visibility Ingestion
      if (config.snapvibrApiKey) {
        const url = resolveTelemetryEndpoint(config.endpoint);
        const snapvibrPayload = {
          domain: event.domain,
          siteId: event.siteId,
          path: event.path,
          bot: event.bot || event.crawler || 'Accept-Header-Client',
          userAgent: event.userAgent,
          status: event.status ?? event.statusCode ?? 200,
          cached: event.cached ?? event.cacheHit ?? false,
          sample: event.sample ?? false,
          durationMs: event.durationMs,
          format: event.format,
          rawBytes: event.rawBytes ?? 0,
          cleanBytes: event.cleanBytes ?? 0,
          htmlBytes: event.htmlBytes ?? (event.format === 'html' ? event.rawBytes : 0),
          markdownBytes: event.markdownBytes ?? (event.format === 'markdown' ? event.cleanBytes : 0),
          rawTokens: event.rawTokens,
          cleanTokens: event.cleanTokens,
          savedTokens: event.savedTokens,
          reductionPercentage: event.reductionPercentage,
        };

        await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-SnapVibr-Key': config.snapvibrApiKey,
            'X-SnapVibr-Client': 'next-agent-ready/1.0.0',
          },
          body: JSON.stringify(snapvibrPayload),
          keepalive: true,
        }).catch(() => {});
      }

      // 3. Dispatch to Axiom
      if (config.axiomToken && config.axiomDataset) {
        const axiomUrl = `https://api.axiom.co/v1/datasets/${config.axiomDataset}/ingest`;
        await fetch(axiomUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.axiomToken}`,
          },
          body: JSON.stringify([event]),
          keepalive: true,
        }).catch(() => {});
      }
    } catch {
      // Never throw from telemetry
    }
  })();

  if (typeof waitUntil === 'function') {
    waitUntil(promise);
  } else {
    // Fire and forget in standard runtime
    promise.catch(() => {});
  }
}
