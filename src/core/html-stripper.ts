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
    const jsonLdRegex = /<script\b[^>]*\btype=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi;
    let match: RegExpExecArray | null;
    while ((match = jsonLdRegex.exec(cleaned)) !== null) {
      jsonLdBlocks.push(match[0]);
    }
  }

  // 3. Remove React SSR boundary comments and general HTML comments FIRST
  // Stripping comments before scripts prevents embedded templates with '-->' from breaking comment pairing
  cleaned = cleaned.replace(/<!--\$[\s\S]*?-->/gi, '');
  cleaned = cleaned.replace(/<!--(?!AGENT:)[\s\S]*?-->/gi, '');

  // 4. Strip all <script> tags (with whitespace-tolerant closing tags)
  if (opts.stripScripts) {
    cleaned = cleaned.replace(/<script(?=[\s>/])[\s\S]*?<\/script\s*>/gi, '');
  }

  // 5. Strip <style> tags (with whitespace-tolerant closing tags) and CSS link tags
  if (opts.stripStyles) {
    cleaned = cleaned.replace(/<style(?=[\s>/])[\s\S]*?<\/style\s*>/gi, '');
    cleaned = cleaned.replace(
      /<link\b[^>]*\brel=["'](?:stylesheet|preload|prefetch|modulepreload)["'][^>]*\/?>/gi,
      ''
    );
  }

  // 6. Strip non-semantic media and embeds (use lookahead (?=[\s>/]) to avoid matching Web Components like <svg-icon>)
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
    const regex = new RegExp(`<${tag}(?=[\\s>/])[\\s\\S]*?<\\/${tag}\\s*>`, 'gi');
    cleaned = cleaned.replace(regex, '');
    const selfClosing = new RegExp(`<${tag}(?=[\\s>/])[^>]*\\/>`, 'gi');
    cleaned = cleaned.replace(selfClosing, '');
  }

  // 7. Strip layout chrome: nav, footer, aside, and header (preserving headings inside header)
  if (opts.stripNav) {
    cleaned = cleaned.replace(/<nav(?=[\s>/])[\s\S]*?<\/nav\s*>/gi, '');
  }
  if (opts.stripFooter) {
    cleaned = cleaned.replace(/<footer(?=[\s>/])[\s\S]*?<\/footer\s*>/gi, '');
  }
  if (opts.stripAside) {
    cleaned = cleaned.replace(/<aside(?=[\s>/])[\s\S]*?<\/aside\s*>/gi, '');
  }
  if (opts.stripHeader) {
    // Preserve any heading tags inside header so hero h1/h2 tags are not dropped on SSR sites
    cleaned = cleaned.replace(
      /<header(?![^>]*\bdata-agent-(?:only|grounding)\b)(?=[\s>/])[^>]*>([\s\S]*?)<\/header\s*>/gi,
      (_, inner) => {
        if (!inner || typeof inner !== 'string') return '';
        const headings = inner.match(/<h[1-6]\b[^>]*>[\s\S]*?<\/h[1-6]\s*>/gi);
        return headings ? headings.join('\n') : '';
      }
    );
  }

  // 8. Strip modals, dialogs, cookie banners, consent notices, and popups
  if (opts.stripModalsAndBanners) {
    // Dialog element
    cleaned = cleaned.replace(/<dialog(?=[\s>/])[\s\S]*?<\/dialog\s*>/gi, '');

    // Dialog and alertdialog roles on div elements (avoid matching across nested <div> tags)
    cleaned = cleaned.replace(
      /<div[^>]*(?:\brole=["'](?:dialog|alertdialog)["']|\baria-modal=["']true["'])[^>]*>(?:(?!<div(?=[\s>/]))[\s\S])*?<\/div\s*>/gi,
      ''
    );

    // Common cookie / banner / modal class and id patterns on div elements
    const bannerPattern = /<div[^>]*(?:id|class)=["'][^"']*\b(?:cookie[-_]?(?:banner|consent|notice|law|modal)?|consent[-_]?(?:banner|modal|popup|bar)?|gdpr[-_]?(?:banner|notice)?|modal[-_]?(?:backdrop|dialog|overlay)?|popup[-_]?(?:overlay|dialog|banner)?)\b[^"']*["'][^>]*>(?:(?!<div(?=[\s>/]))[\s\S])*?<\/div\s*>/gi;
    cleaned = cleaned.replace(bannerPattern, '');
  }

  // 9. Remove visually hidden human elements (aria-hidden="true" or display:none)
  // unless explicitly marked with data-agent-only="true"
  // Uses (?:(?!<\1(?=[\s>/]))[\s\S])*? to prevent slicing nested tags of the same name
  cleaned = cleaned.replace(
    /<([a-zA-Z0-9-]+)(?![^>]*\bdata-agent-(?:only|instruction)\b)[^>]*(?:aria-hidden=["']true["']|\bstyle=["'][^"']*display:\s*none[^"']*["'])[^>]*>(?:(?!<\1(?=[\s>/]))[\s\S])*?<\/\1\s*>/gi,
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
