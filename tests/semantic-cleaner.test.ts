import { describe, it, expect } from 'vitest';
import {
  cleanSemanticHtml,
  cleanUrl,
} from '../src/core/semantic-cleaner.js';

describe('semantic-cleaner', () => {
  describe('cleanUrl', () => {
    it('strips tracking query parameters from urls', () => {
      const dirty = 'https://example.com/pricing?utm_source=twitter&utm_medium=cpc&plan=pro&fbclid=123';
      const clean = cleanUrl(dirty);
      expect(clean).toContain('plan=pro');
      expect(clean).not.toContain('utm_source');
      expect(clean).not.toContain('utm_medium');
      expect(clean).not.toContain('fbclid');
    });

    it('resolves relative urls against baseUrl', () => {
      const clean = cleanUrl('/docs/quickstart', 'https://example.com');
      expect(clean).toBe('https://example.com/docs/quickstart');
    });
  });

  describe('cleanSemanticHtml', () => {
    it('strips utility classes, inline styles, IDs, and framework hydration attributes', () => {
      const raw = `
        <div id="__next" class="min-h-screen bg-slate-900 text-white flex flex-col p-8" data-reactroot="" data-v-app="">
          <h1 class="text-4xl font-extrabold tracking-tight mb-4" id="intro-title" style="color: #3b82f6;">Welcome to Platform</h1>
          <p class="text-base text-gray-300 leading-relaxed" style="margin-top: 10px;">Our edge platform runs globally.</p>
        </div>
      `;

      const clean = cleanSemanticHtml(raw);
      expect(clean).not.toContain('class="');
      expect(clean).not.toContain('style="');
      expect(clean).not.toContain('id="');
      expect(clean).not.toContain('data-reactroot');
      expect(clean).not.toContain('data-v-app');
      expect(clean).toContain('<h1>Welcome to Platform</h1>');
      expect(clean).toContain('<p>Our edge platform runs globally.</p>');
    });

    it('preserves full table trees for pricing and specifications', () => {
      const raw = `
        <table class="w-full text-left border-collapse table-auto">
          <thead class="bg-gray-100">
            <tr>
              <th class="p-3" scope="col">Plan</th>
              <th class="p-3" scope="col">Monthly</th>
              <th class="p-3" scope="col" colspan="2">Features</th>
            </tr>
          </thead>
          <tbody>
            <tr class="border-b">
              <td class="p-3">Starter</td>
              <td class="p-3">$29</td>
              <td class="p-3" colspan="2">10k requests</td>
            </tr>
            <tr class="border-b">
              <td class="p-3">Enterprise</td>
              <td class="p-3">Custom</td>
              <td class="p-3" colspan="2">Dedicated VPC</td>
            </tr>
          </tbody>
        </table>
      `;

      const clean = cleanSemanticHtml(raw);
      expect(clean).toContain('<table>');
      expect(clean).toContain('<thead>');
      expect(clean).toContain('<tbody>');
      expect(clean).toContain('<tr>');
      expect(clean).toContain('<th scope="col">Plan</th>');
      expect(clean).toContain('Features</th>');
      expect(clean).toContain('<td>Starter</td>');
      expect(clean).toContain('<td>$29</td>');
      expect(clean).toContain('<td colspan="2">10k requests</td>');
      expect(clean).not.toContain('class=');
    });

    it('normalizes anchor links and cleans tracking parameters', () => {
      const raw = `
        <p>Check out our <a href="/pricing?utm_source=agent&plan=annual" class="underline text-blue-500" target="_blank">pricing page</a>.</p>
      `;

      const clean = cleanSemanticHtml(raw, { baseUrl: 'https://mysite.com' });
      expect(clean).toContain('<a href="https://mysite.com/pricing?plan=annual">pricing page</a>');
      expect(clean).not.toContain('utm_source');
      expect(clean).not.toContain('target="_blank"');
    });

    it('normalizes b and i tags to strong and em', () => {
      const raw = '<p>This is <b>important</b> and <i>emphasized</i>.</p>';
      const clean = cleanSemanticHtml(raw);
      expect(clean).toContain('<strong>important</strong>');
      expect(clean).toContain('<em>emphasized</em>');
      expect(clean).not.toContain('<b>');
      expect(clean).not.toContain('<i>');
    });

    it('preserves code and pre blocks with proper formatting', () => {
      const raw = '<pre class="bg-gray-800 p-4 rounded"><code class="language-typescript">const x = 42;\nconsole.log(x);</code></pre>';
      const clean = cleanSemanticHtml(raw);
      expect(clean).toContain('<pre><code>const x = 42;\nconsole.log(x);</code></pre>');
    });
  });
});
