/**
 * Fast, accurate token counter and compression estimator for next-agent-ready.
 * Zero-dependency heuristic calibrated for LLM BPE tokenizers (OpenAI, Claude, DeepSeek).
 */

import type { TokenCounterResult } from '../types/index.js';

/**
 * Estimates LLM token count for HTML, code, and text content.
 */
export function estimateTokens(text: string): number {
  if (!text || typeof text !== 'string') return 0;
  if (text.length === 0) return 0;

  // Split on word characters, punctuation/symbol clusters, and whitespace
  const chunks = text.match(/\w+|[^\w\s]+|\s+/g);
  if (!chunks) return 0;

  let totalTokens = 0;

  for (const chunk of chunks) {
    if (/^\s+$/.test(chunk)) {
      // Whitespace: standard tokenizers merge small spaces, roughly 1 token per 4 spaces/newlines
      totalTokens += Math.max(1, Math.ceil(chunk.length / 4));
    } else if (chunk.length <= 4) {
      // Short words, common punctuation, single tags
      totalTokens += 1;
    } else {
      // Longer words, URLs, hash strings, code identifiers
      totalTokens += Math.ceil(chunk.length / 3.6);
    }
  }

  return Math.max(1, totalTokens);
}

/**
 * Compares raw HTML vs clean semantic HTML to measure token reduction.
 */
export function calculateTokenCompression(
  rawHtml: string,
  cleanHtml: string
): TokenCounterResult {
  const rawTokens = estimateTokens(rawHtml);
  const cleanTokens = estimateTokens(cleanHtml);
  const savedTokens = Math.max(0, rawTokens - cleanTokens);

  const reductionPercentage =
    rawTokens > 0
      ? Math.round(((rawTokens - cleanTokens) / rawTokens) * 1000) / 10
      : 0;

  return {
    rawTokens,
    cleanTokens,
    savedTokens,
    reductionPercentage: Math.max(0, reductionPercentage),
  };
}
