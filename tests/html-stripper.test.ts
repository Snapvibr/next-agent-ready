import { describe, it, expect } from 'vitest';
import {
  stripHtmlBloat,
  createHtmlBloatStripperStream,
} from '../src/core/html-stripper.js';

describe('html-stripper', () => {
  it('strips client-side javascript scripts while preserving application/ld+json', () => {
    const raw = `
      <!DOCTYPE html>
      <html>
        <head>
          <script src="/_next/static/chunks/main-app.js"></script>
          <script>(self.__next_f=self.__next_f||[]).push([0])</script>
          <script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"Acme"}</script>
        </head>
        <body>
          <h1>Main Content</h1>
          <script>console.log('client hydration');</script>
        </body>
      </html>
    `;

    const stripped = stripHtmlBloat(raw);
    expect(stripped).not.toContain('/_next/static/chunks/main-app.js');
    expect(stripped).not.toContain('self.__next_f');
    expect(stripped).not.toContain("console.log('client hydration');");
    expect(stripped).toContain('application/ld+json');
    expect(stripped).toContain('"name":"Acme"');
  });

  it('strips stylesheets and link tags', () => {
    const raw = `
      <head>
        <style>.btn{color:red}body{background:white}</style>
        <link rel="stylesheet" href="/styles.css">
        <link rel="preload" href="/font.woff2">
      </head>
      <body>
        <h1>Title</h1>
      </body>
    `;

    const stripped = stripHtmlBloat(raw);
    expect(stripped).not.toContain('<style>');
    expect(stripped).not.toContain('color:red');
    expect(stripped).not.toContain('rel="stylesheet"');
  });

  it('strips svg, noscript, nav, header, footer, and aside elements', () => {
    const raw = `
      <body>
        <header><div class="logo">Acme</div></header>
        <nav><a href="/">Home</a><a href="/about">About</a></nav>
        <main>
          <h1>Real Article</h1>
          <svg width="24" height="24"><path d="M0 0h24v24H0z"/></svg>
          <noscript><p>Please enable JS</p></noscript>
          <p>Body text here</p>
        </main>
        <aside><p>Sidebar ad</p></aside>
        <footer><p>Copyright 2026</p></footer>
      </body>
    `;

    const stripped = stripHtmlBloat(raw);
    expect(stripped).not.toContain('<nav>');
    expect(stripped).not.toContain('Home');
    expect(stripped).not.toContain('<header>');
    expect(stripped).not.toContain('<footer>');
    expect(stripped).not.toContain('Copyright 2026');
    expect(stripped).not.toContain('<aside>');
    expect(stripped).not.toContain('Sidebar ad');
    expect(stripped).not.toContain('<svg');
    expect(stripped).not.toContain('<noscript');
    expect(stripped).toContain('Real Article');
    expect(stripped).toContain('Body text here');
  });

  it('strips cookie banners, popups, and modal dialogs', () => {
    const raw = `
      <body>
        <div id="cookie-banner" class="cookie-consent-bar">
          <p>We use cookies to track you.</p>
          <button>Accept All</button>
        </div>
        <div role="dialog" aria-modal="true" class="newsletter-modal">
          <p>Subscribe to our newsletter!</p>
        </div>
        <main>
          <h1>Documentation</h1>
          <p>Actual docs content.</p>
        </main>
      </body>
    `;

    const stripped = stripHtmlBloat(raw);
    expect(stripped).not.toContain('cookie-banner');
    expect(stripped).not.toContain('We use cookies');
    expect(stripped).not.toContain('newsletter-modal');
    expect(stripped).not.toContain('Subscribe to our newsletter!');
    expect(stripped).toContain('Documentation');
  });

  it('strips elements marked with data-agent-exclude', () => {
    const raw = `
      <div>
        <div data-agent-exclude="true">
          <p>This is human-only promotional fluff</p>
        </div>
        <p>This is indexable content</p>
      </div>
    `;

    const stripped = stripHtmlBloat(raw);
    expect(stripped).not.toContain('promotional fluff');
    expect(stripped).toContain('indexable content');
  });

  it('preserves elements marked with data-agent-only even if visually hidden', () => {
    const raw = `
      <div>
        <div aria-hidden="true">Hidden decorative icon</div>
        <div data-agent-only="true" style="display: none;">Verified facts for reasoning agents</div>
      </div>
    `;

    const stripped = stripHtmlBloat(raw);
    expect(stripped).not.toContain('Hidden decorative icon');
    expect(stripped).toContain('Verified facts for reasoning agents');
  });

  it('supports streaming stripping with createHtmlBloatStripperStream', async () => {
    const stream = createHtmlBloatStripperStream();
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const readable = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('<html><head><script>alert(1)</script></head>'));
        controller.enqueue(encoder.encode('<body><nav>Menu</nav><h1>Edge Stream</h1></body></html>'));
        controller.close();
      },
    });

    const transformed = readable.pipeThrough(stream);
    const reader = transformed.getReader();
    let result = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      result += decoder.decode(value);
    }

    expect(result).not.toContain('<script>');
    expect(result).not.toContain('<nav>');
    expect(result).toContain('<h1>Edge Stream</h1>');
  });
});
