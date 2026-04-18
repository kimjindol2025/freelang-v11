// FreeLang v11 — Markdown stdlib (CommonMark subset)
// Zero external deps. Handles headers, emphasis, links, images, lists,
// code blocks, blockquotes, thematic breaks, paragraphs, and frontmatter.
// Not supported (yet): GFM tables, nested lists, inline HTML.

type MdFrontmatter = Record<string, string | number | boolean>;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Parse `--- key: value ... ---` at the very top of the document.
function parseFrontmatter(src: string): { fm: MdFrontmatter; body: string } {
  const fm: MdFrontmatter = {};
  if (!src.startsWith("---\n") && !src.startsWith("---\r\n")) {
    return { fm, body: src };
  }
  const rest = src.replace(/^---\r?\n/, "");
  const match = rest.match(/\n---[ \t]*(\r?\n|$)/);
  const end = match ? rest.indexOf(match[0]) : -1;
  if (end < 0) return { fm, body: src };
  const block = rest.slice(0, end);
  const body = rest.slice(end).replace(/^\n---\r?\n?/, "");
  for (const line of block.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$/);
    if (!m) continue;
    let val: string | number | boolean = m[2].trim();
    if (/^(true|false)$/i.test(String(val))) val = String(val).toLowerCase() === "true";
    else if (/^-?\d+(\.\d+)?$/.test(String(val))) val = Number(val);
    else if ((val as string).startsWith('"') && (val as string).endsWith('"')) {
      val = (val as string).slice(1, -1);
    } else if ((val as string).startsWith("'") && (val as string).endsWith("'")) {
      val = (val as string).slice(1, -1);
    }
    fm[m[1]] = val;
  }
  return { fm, body };
}

// Inline formatting: emphasis, code, links, images.
function renderInline(s: string): string {
  // Pull out inline code first; escape everything inside.
  const codeSlots: string[] = [];
  s = s.replace(/`([^`\n]+)`/g, (_m, code) => {
    codeSlots.push(`<code>${escapeHtml(code)}</code>`);
    return `\x00C${codeSlots.length - 1}\x00`;
  });

  // Escape raw HTML special chars in remaining text; intentional subset —
  // users who want raw HTML should pre-escape or fork the renderer.
  s = escapeHtml(s);

  // Images ![alt](url) — before links so ! is consumed.
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g,
    (_m, alt, url, title) =>
      title
        ? `<img src="${url}" alt="${alt}" title="${title}" loading="lazy" decoding="async">`
        : `<img src="${url}" alt="${alt}" loading="lazy" decoding="async">`
  );

  // Links [text](url)
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g,
    (_m, text, url, title) =>
      title
        ? `<a href="${url}" title="${title}">${text}</a>`
        : `<a href="${url}">${text}</a>`
  );

  // Bold **text**
  s = s.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  // Italic *text* (avoid matching part of ** by using word-boundary-ish)
  s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");

  // Restore code
  s = s.replace(/\x00C(\d+)\x00/g, (_m, i) => codeSlots[Number(i)] || "");
  return s;
}

type Block =
  | { kind: "heading"; level: number; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "code"; lang: string; text: string }
  | { kind: "quote"; lines: string[] }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "hr" };

function tokenize(body: string): Block[] {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const out: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Blank
    if (/^\s*$/.test(line)) { i++; continue; }

    // Code fence ```lang
    const fenceOpen = line.match(/^```\s*([A-Za-z0-9_+-]*)\s*$/);
    if (fenceOpen) {
      const lang = fenceOpen[1] || "";
      i++;
      const codeLines: string[] = [];
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // consume closing fence
      out.push({ kind: "code", lang, text: codeLines.join("\n") });
      continue;
    }

    // Thematic break
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      out.push({ kind: "hr" });
      i++;
      continue;
    }

    // Heading #
    const h = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (h) {
      out.push({ kind: "heading", level: h[1].length, text: h[2] });
      i++;
      continue;
    }

    // Blockquote >
    if (/^>\s?/.test(line)) {
      const quoteLines: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      out.push({ kind: "quote", lines: quoteLines });
      continue;
    }

    // List
    const ulMatch = line.match(/^\s*[-*+]\s+(.+)$/);
    const olMatch = line.match(/^\s*\d+\.\s+(.+)$/);
    if (ulMatch || olMatch) {
      const ordered = !!olMatch;
      const items: string[] = [];
      const re = ordered ? /^\s*\d+\.\s+(.+)$/ : /^\s*[-*+]\s+(.+)$/;
      while (i < lines.length) {
        const m = lines[i].match(re);
        if (!m) break;
        items.push(m[1]);
        i++;
      }
      out.push({ kind: "list", ordered, items });
      continue;
    }

    // Paragraph: accumulate non-empty, non-special lines
    const paraLines: string[] = [line];
    i++;
    while (i < lines.length) {
      const n = lines[i];
      if (/^\s*$/.test(n)) break;
      if (/^#{1,6}\s/.test(n)) break;
      if (/^```/.test(n)) break;
      if (/^>\s?/.test(n)) break;
      if (/^\s*[-*+]\s+/.test(n)) break;
      if (/^\s*\d+\.\s+/.test(n)) break;
      if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(n)) break;
      paraLines.push(n);
      i++;
    }
    out.push({ kind: "paragraph", text: paraLines.join(" ") });
  }
  return out;
}

function renderBlock(b: Block): string {
  switch (b.kind) {
    case "heading":
      return `<h${b.level}>${renderInline(b.text)}</h${b.level}>`;
    case "paragraph":
      return `<p>${renderInline(b.text)}</p>`;
    case "code":
      return b.lang
        ? `<pre><code class="language-${escapeHtml(b.lang)}">${escapeHtml(b.text)}</code></pre>`
        : `<pre><code>${escapeHtml(b.text)}</code></pre>`;
    case "quote": {
      const inner = tokenize(b.lines.join("\n")).map(renderBlock).join("");
      return `<blockquote>${inner}</blockquote>`;
    }
    case "list": {
      const tag = b.ordered ? "ol" : "ul";
      const items = b.items.map((it) => `<li>${renderInline(it)}</li>`).join("");
      return `<${tag}>${items}</${tag}>`;
    }
    case "hr":
      return `<hr>`;
  }
}

export function createMarkdownModule() {
  return {
    // markdown_to_html md -> html string
    "markdown_to_html": (src: string): string => {
      if (typeof src !== "string") return "";
      const { body } = parseFrontmatter(src);
      return tokenize(body).map(renderBlock).join("");
    },

    // markdown_frontmatter md -> { fm: {...}, body: "..." }
    "markdown_frontmatter": (src: string): { fm: MdFrontmatter; body: string } => {
      if (typeof src !== "string") return { fm: {}, body: "" };
      return parseFrontmatter(src);
    },

    // markdown_render_full md -> { fm, html }
    "markdown_render_full": (src: string): { fm: MdFrontmatter; html: string } => {
      if (typeof src !== "string") return { fm: {}, html: "" };
      const { fm, body } = parseFrontmatter(src);
      const html = tokenize(body).map(renderBlock).join("");
      return { fm, html };
    },
  };
}
