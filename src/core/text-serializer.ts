/**
 * Lightweight, zero-dependency HTML-to-Markdown converter for next-agent-ready.
 * Converts clean semantic HTML into well-structured Markdown when clients
 * (such as Claude Code) explicitly request text/markdown.
 */

/**
 * Converts a <table> HTML string into a Markdown table.
 */
function convertTableToMarkdown(tableHtml: string): string {
  const rows: string[][] = [];
  const trRegex = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch: RegExpExecArray | null;

  while ((trMatch = trRegex.exec(tableHtml)) !== null) {
    const rowContent = trMatch[1];
    const cells: string[] = [];
    const cellRegex = /<(?:th|td)\b[^>]*>([\s\S]*?)<\/(?:th|td)>/gi;
    let cellMatch: RegExpExecArray | null;

    while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
      // Strip any inner HTML tags and clean up whitespace
      const cleanCell = cellMatch[1].replace(/<[^>]+>/g, '').trim().replace(/\|/g, '\\|');
      cells.push(cleanCell);
    }

    if (cells.length > 0) {
      rows.push(cells);
    }
  }

  if (rows.length === 0) return '';

  // Determine max columns
  const maxCols = Math.max(...rows.map((r) => r.length));
  if (maxCols === 0) return '';

  const mdRows: string[] = [];

  // Header row
  const header = rows[0];
  while (header.length < maxCols) header.push('');
  mdRows.push(`| ${header.join(' | ')} |`);
  mdRows.push(`| ${header.map(() => '---').join(' | ')} |`);

  // Data rows
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    while (row.length < maxCols) row.push('');
    mdRows.push(`| ${row.join(' | ')} |`);
  }

  return `\n\n${mdRows.join('\n')}\n\n`;
}

/**
 * Converts clean semantic HTML to Markdown.
 */
export function convertSemanticHtmlToMarkdown(html: string): string {
  if (!html) return '';

  let md = html;

  // 1. Isolate and convert code blocks (<pre><code>)
  md = md.replace(/<pre\b[^>]*><code\b[^>]*>([\s\S]*?)<\/code><\/pre>/gi, (_, code) => {
    return `\n\n\`\`\`\n${code.trim()}\n\`\`\`\n\n`;
  });
  md = md.replace(/<pre\b[^>]*>([\s\S]*?)<\/pre>/gi, (_, code) => {
    return `\n\n\`\`\`\n${code.trim()}\n\`\`\`\n\n`;
  });

  // 2. Convert tables
  md = md.replace(/<table\b[^>]*>([\s\S]*?)<\/table>/gi, (match) => {
    return convertTableToMarkdown(match);
  });

  // 3. Convert headings
  md = md.replace(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi, '\n\n# $1\n\n');
  md = md.replace(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi, '\n\n## $1\n\n');
  md = md.replace(/<h3\b[^>]*>([\s\S]*?)<\/h3>/gi, '\n\n### $1\n\n');
  md = md.replace(/<h4\b[^>]*>([\s\S]*?)<\/h4>/gi, '\n\n#### $1\n\n');
  md = md.replace(/<h5\b[^>]*>([\s\S]*?)<\/h5>/gi, '\n\n##### $1\n\n');
  md = md.replace(/<h6\b[^>]*>([\s\S]*?)<\/h6>/gi, '\n\n###### $1\n\n');

  // 4. Convert blockquotes
  md = md.replace(/<blockquote\b[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, text) => {
    const lines = text.trim().replace(/<[^>]+>/g, '').split('\n');
    return `\n\n${lines.map((l: string) => `> ${l.trim()}`).join('\n')}\n\n`;
  });

  // 5. Convert lists
  md = md.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_, text) => {
    const cleanText = text.replace(/<p\b[^>]*>([\s\S]*?)<\/p>/gi, '$1').trim();
    return `- ${cleanText}\n`;
  });
  md = md.replace(/<\/?(?:ul|ol)\b[^>]*>/gi, '\n');

  // 6. Convert links and images
  md = md.replace(/<a\b[^>]*\bhref=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');
  md = md.replace(/<img\b[^>]*\bsrc=["']([^"']*)["'][^>]*\balt=["']([^"']*)["'][^>]*\/?>/gi, '![$2]($1)');
  md = md.replace(/<img\b[^>]*\balt=["']([^"']*)["'][^>]*\bsrc=["']([^"']*)["'][^>]*\/?>/gi, '![$1]($2)');

  // 7. Convert formatting
  md = md.replace(/<(?:strong|b)\b[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi, '**$1**');
  md = md.replace(/<(?:em|i)\b[^>]*>([\s\S]*?)<\/(?:em|i)>/gi, '*$1*');
  md = md.replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');

  // 8. Convert paragraphs and line breaks
  md = md.replace(/<p\b[^>]*>([\s\S]*?)<\/p>/gi, '\n\n$1\n\n');
  md = md.replace(/<br\s*\/?>/gi, '\n');
  md = md.replace(/<hr\s*\/?>/gi, '\n\n---\n\n');

  // 9. Strip any residual HTML tags (except within code blocks which were already replaced)
  md = md.replace(/<[^>]+>/g, '');

  // 10. Decode basic HTML entities
  md = md
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // 11. Normalize excessive newlines
  md = md.replace(/\n{3,}/g, '\n\n').trim();

  return md;
}
