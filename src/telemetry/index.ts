/**
 * Non-blocking telemetry dispatcher for next-agent-ready.
 * Dispatches crawler analytics to SnapVibr, Axiom, or custom sinks.
 */

import type { AgentTelemetryEvent, TelemetryConfig } from '../types/index.js';

const SNAPVIBR_DEFAULT_ENDPOINT = 'https://api.snapvibr.com/v1/telemetry/crawlers';

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

      // 2. Dispatch to SnapVibr
      if (config.snapvibrApiKey) {
        const url = config.endpoint || SNAPVIBR_DEFAULT_ENDPOINT;
        await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.snapvibrApiKey}`,
            'X-SnapVibr-Client': 'next-agent-ready/1.0.0',
          },
          body: JSON.stringify(event),
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
