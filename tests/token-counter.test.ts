import { describe, it, expect } from 'vitest';
import {
  estimateTokens,
  calculateTokenCompression,
} from '../src/core/token-counter.js';

describe('token-counter', () => {
  it('estimates zero tokens for empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('estimates tokens for english prose and html markup', () => {
    const text = '<h1>Welcome to our edge platform</h1><p>High performance middleware.</p>';
    const count = estimateTokens(text);
    expect(count).toBeGreaterThan(5);
    expect(count).toBeLessThan(35);
  });

  it('measures significant token reduction when comparing raw vs clean html', () => {
    // Typical Next.js raw page with massive script bundles, SVG sprites, and inline styles
    const rawHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>.a1{display:flex}.b2{color:blue}.c3{margin:10px}/* hundreds of utility classes */</style>
          <script src="/_next/static/chunks/webpack.js"></script>
          <script src="/_next/static/chunks/framework.js"></script>
          <script src="/_next/static/chunks/main.js"></script>
          <script>self.__next_f.push([1,"7:[\"$\",\"$L8\",null,{\"children\":[\"$\",\"main\",null,{\"className\":\"flex min-h-screen\"}]}]"])</script>
        </head>
        <body class="bg-gray-900 text-white font-sans antialiased">
          <header class="sticky top-0 z-50 bg-white shadow"><nav><a>Nav1</a><a>Nav2</a></nav></header>
          <main>
            <h1 class="text-3xl font-bold">Product Title</h1>
            <p class="mt-4 text-gray-500">Essential product content and pricing description.</p>
          </main>
          <svg viewBox="0 0 1000 1000"><path d="M10 10 H 90 V 90 H 10 L 10 10" /></svg>
          <footer>Footer links and copyright</footer>
        </body>
      </html>
    `;

    const cleanHtml = `
      <section class="site-overview">
        <h2>Canonical Brand &amp; Product Grounding</h2>
        <p><strong>Brand:</strong> Acme</p>
      </section>
      <h1>Product Title</h1>
      <p>Essential product content and pricing description.</p>
    `;

    const metrics = calculateTokenCompression(rawHtml, cleanHtml);

    expect(metrics.rawTokens).toBeGreaterThan(metrics.cleanTokens);
    expect(metrics.savedTokens).toBeGreaterThan(0);
    expect(metrics.reductionPercentage).toBeGreaterThan(40);
  });
});
