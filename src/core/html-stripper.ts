/**
 * High-performance HTML bloat stripper for next-agent-ready.
 * Strips client JavaScript, styles, SVGs, layout chrome, modals, and hydration markers.
 */

import type { StripperOptions } from '../types/index.js';

/**
 * Strips layout chrome, client-side bundles, styles, and framework bloat from HTML.
 */
export function stripHtmlBloat(html: string, options?: StripperOptions): string {
  if (!html || typeof html !== 'string') return '';

  const opts: StripperOptions = {
    stripNav: true,
    stripHeader: true,
    stripFooter: true,
    stripAside: true,
    stripModalsAndBanners: true,
    stripSvg: true,
    stripStyles: true,
    stripScripts: true,
    preserveJsonLd: true,
    ...options,
  };

  let cleaned = html;

  // 1. Remove elements explicitly marked with data-agent-exclude="true" or "1"
  cleaned = cleaned.replace(
    /<([a-zA-Z0-9-]+)[^>]*\bdata-agent-exclude=["'](?:true|1)["'][^>]*>[\s\S]*?<\/\1>/gi,
    ''
  );
  cleaned = cleaned.replace(
    /<[a-zA-Z0-9-]+[^>]*\bdata-agent-exclude=["'](?:true|1)["'][^>]*\/>/gi,
    ''
  );

  // 2. Preserve application/ld+json before script stripping if requested
  const jsonLdBlocks: string[] = [];
  if (opts.preserveJsonLd) {
    const jsonLdRegex = /<script\b[^>]*\btype=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let match: RegExpExecArray | null;
    while ((match = jsonLdRegex.exec(cleaned)) !== null) {
      jsonLdBlocks.push(match[0]);
    }
  }

  // 3. Strip all <script> tags
  if (opts.stripScripts) {
    cleaned = cleaned.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  }

  // 4. Strip <style> tags and CSS link tags
  if (opts.stripStyles) {
    cleaned = cleaned.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
    cleaned = cleaned.replace(
      /<link\b[^>]*\brel=["'](?:stylesheet|preload|prefetch|modulepreload)["'][^>]*\/?>/gi,
      ''
    );
  }

  // 5. Strip non-semantic media and embeds
  const mediaTags = [
    'noscript',
    'template',
    'canvas',
    'iframe',
    'video',
    'audio',
    'embed',
    'object',
    ...(opts.stripSvg ? ['svg'] : []),
    ...(opts.customRemoveTags ?? []),
  ];

  for (const tag of mediaTags) {
    const regex = new RegExp(`<${tag}\\b[^<]*(?:(?!<\\/${tag}>)<[^<]*)*<\\/${tag}>`, 'gi');
    cleaned = cleaned.replace(regex, '');
    const selfClosing = new RegExp(`<${tag}\\b[^>]*\\/>`, 'gi');
    cleaned = cleaned.replace(selfClosing, '');
  }

  // 6. Strip layout chrome: nav, footer, aside, and optional header
  if (opts.stripNav) {
    cleaned = cleaned.replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '');
  }
  if (opts.stripFooter) {
    cleaned = cleaned.replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '');
  }
  if (opts.stripAside) {
    cleaned = cleaned.replace(/<aside\b[^<]*(?:(?!<\/aside>)<[^<]*)*<\/aside>/gi, '');
  }
  if (opts.stripHeader) {
    // Only strip header if not marked with data-agent-only or data-agent-grounding
    cleaned = cleaned.replace(
      /<header(?![^>]*\bdata-agent-(?:only|grounding)\b)\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi,
      ''
    );
  }

  // 7. Strip modals, dialogs, cookie banners, consent notices, and popups
  if (opts.stripModalsAndBanners) {
    // Dialog and alertdialog roles
    cleaned = cleaned.replace(
      /<([a-zA-Z0-9-]+)[^>]*(?:\brole=["'](?:dialog|alertdialog)["']|\baria-modal=["']true["'])[^>]*>[\s\S]*?<\/\1>/gi,
      ''
    );

    // Common cookie / banner / modal class and id patterns
    const bannerPattern = /<([a-zA-Z0-9-]+)[^>]*(?:id|class)=["'][^"']*\b(?:cookie[-_]?(?:banner|consent|notice|law|modal)?|consent[-_]?(?:banner|modal|popup|bar)?|gdpr[-_]?(?:banner|notice)?|modal[-_]?(?:backdrop|dialog|overlay)?|popup[-_]?(?:overlay|dialog|banner)?)\b[^"']*["'][^>]*>[\s\S]*?<\/\1>/gi;
    cleaned = cleaned.replace(bannerPattern, '');
  }

  // 8. Remove React SSR boundary comments: <!--$--> <!--/$--> <!--$?--> <!--$!-->
  cleaned = cleaned.replace(/<!--\$[\s\S]*?-->/gi, '');

  // 9. Remove HTML comments (except agent instructions if any)
  cleaned = cleaned.replace(/<!--(?!AGENT:)[\s\S]*?-->/gi, '');

  // 10. Remove visually hidden human elements (aria-hidden="true" or display:none)
  // unless explicitly marked with data-agent-only="true"
  cleaned = cleaned.replace(
    /<([a-zA-Z0-9-]+)(?![^>]*\bdata-agent-(?:only|instruction)\b)[^>]*(?:aria-hidden=["']true["']|\bstyle=["'][^"']*display:\s*none[^"']*["'])[^>]*>[\s\S]*?<\/\1>/gi,
    ''
  );

  // 11. Re-insert preserved JSON-LD scripts at the end if they were saved
  if (opts.preserveJsonLd && jsonLdBlocks.length > 0) {
    cleaned = `${cleaned}\n${jsonLdBlocks.join('\n')}`;
  }

  return cleaned;
}

/**
 * Creates a TransformStream for streaming HTML bloat stripping at the edge.
 */
export function createHtmlBloatStripperStream(
  options?: StripperOptions
): TransformStream<Uint8Array, Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';

  return new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true });
    },
    flush(controller) {
      buffer += decoder.decode();
      const stripped = stripHtmlBloat(buffer, options);
      controller.enqueue(encoder.encode(stripped));
    },
  });
}
