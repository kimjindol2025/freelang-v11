// FreeLang v11 — Feed (RSS / Atom / sitemap / robots.txt / JSON-LD)
// Zero deps. Plain string builders. Consumers pass v11 maps as objects.

function esc(s: any): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

interface FeedItem {
  title: string;
  url: string;
  description?: string;
  date?: string; // ISO 8601
  author?: string;
  content?: string; // full HTML
}

interface FeedMeta {
  title: string;
  url: string;
  description?: string;
  language?: string;
  updated?: string;
  author?: string;
}

export function createFeedModule() {
  return {
    // rss_feed meta items -> <?xml ... <rss>...</rss>
    "rss_feed": (meta: FeedMeta, items: FeedItem[]): string => {
      const lang = meta.language || "en";
      const buildDate = meta.updated || new Date().toUTCString();
      const out: string[] = [];
      out.push(`<?xml version="1.0" encoding="UTF-8"?>`);
      out.push(`<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">`);
      out.push(`<channel>`);
      out.push(`<title>${esc(meta.title)}</title>`);
      out.push(`<link>${esc(meta.url)}</link>`);
      out.push(`<description>${esc(meta.description || "")}</description>`);
      out.push(`<language>${esc(lang)}</language>`);
      out.push(`<lastBuildDate>${esc(buildDate)}</lastBuildDate>`);
      out.push(`<atom:link href="${esc(meta.url.replace(/\/?$/, "/"))}feed.xml" rel="self" type="application/rss+xml"/>`);
      for (const it of items || []) {
        out.push(`<item>`);
        out.push(`<title>${esc(it.title)}</title>`);
        out.push(`<link>${esc(it.url)}</link>`);
        out.push(`<guid isPermaLink="true">${esc(it.url)}</guid>`);
        if (it.date) out.push(`<pubDate>${esc(new Date(it.date).toUTCString())}</pubDate>`);
        if (it.author) out.push(`<author>${esc(it.author)}</author>`);
        if (it.description) out.push(`<description>${esc(it.description)}</description>`);
        if (it.content) out.push(`<content:encoded><![CDATA[${it.content}]]></content:encoded>`);
        out.push(`</item>`);
      }
      out.push(`</channel>`);
      out.push(`</rss>`);
      return out.join("\n");
    },

    // atom_feed meta items -> <?xml ... <feed>...</feed>
    "atom_feed": (meta: FeedMeta, items: FeedItem[]): string => {
      const updated = meta.updated || new Date().toISOString();
      const out: string[] = [];
      out.push(`<?xml version="1.0" encoding="UTF-8"?>`);
      out.push(`<feed xmlns="http://www.w3.org/2005/Atom">`);
      out.push(`<title>${esc(meta.title)}</title>`);
      out.push(`<link href="${esc(meta.url)}"/>`);
      out.push(`<link rel="self" href="${esc(meta.url.replace(/\/?$/, "/"))}atom.xml"/>`);
      out.push(`<id>${esc(meta.url)}</id>`);
      out.push(`<updated>${esc(updated)}</updated>`);
      if (meta.author) out.push(`<author><name>${esc(meta.author)}</name></author>`);
      if (meta.description) out.push(`<subtitle>${esc(meta.description)}</subtitle>`);
      for (const it of items || []) {
        out.push(`<entry>`);
        out.push(`<title>${esc(it.title)}</title>`);
        out.push(`<link href="${esc(it.url)}"/>`);
        out.push(`<id>${esc(it.url)}</id>`);
        if (it.date) out.push(`<updated>${esc(new Date(it.date).toISOString())}</updated>`);
        if (it.author) out.push(`<author><name>${esc(it.author)}</name></author>`);
        if (it.description) out.push(`<summary>${esc(it.description)}</summary>`);
        if (it.content) out.push(`<content type="html"><![CDATA[${it.content}]]></content>`);
        out.push(`</entry>`);
      }
      out.push(`</feed>`);
      return out.join("\n");
    },

    // sitemap_xml baseUrl routes -> <?xml ... <urlset>...
    "sitemap_xml": (baseUrl: string, routes: Array<string | { loc: string; lastmod?: string; priority?: number; changefreq?: string }>): string => {
      const base = baseUrl.replace(/\/$/, "");
      const out: string[] = [];
      out.push(`<?xml version="1.0" encoding="UTF-8"?>`);
      out.push(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`);
      for (const r of routes || []) {
        const path = typeof r === "string" ? r : r.loc;
        out.push(`<url>`);
        out.push(`<loc>${esc(base + (path.startsWith("/") ? path : "/" + path))}</loc>`);
        if (typeof r !== "string") {
          if (r.lastmod) out.push(`<lastmod>${esc(r.lastmod)}</lastmod>`);
          if (r.changefreq) out.push(`<changefreq>${esc(r.changefreq)}</changefreq>`);
          if (typeof r.priority === "number") out.push(`<priority>${r.priority}</priority>`);
        }
        out.push(`</url>`);
      }
      out.push(`</urlset>`);
      return out.join("\n");
    },

    // robots_txt options -> "User-agent: * ..."
    "robots_txt": (opts: { allow?: string[]; disallow?: string[]; sitemap?: string; userAgent?: string }): string => {
      const o = opts || {};
      const ua = o.userAgent || "*";
      const lines: string[] = [`User-agent: ${ua}`];
      for (const a of o.allow || []) lines.push(`Allow: ${a}`);
      for (const d of o.disallow || []) lines.push(`Disallow: ${d}`);
      if ((o.allow || []).length === 0 && (o.disallow || []).length === 0) {
        lines.push("Allow: /");
      }
      if (o.sitemap) lines.push(`Sitemap: ${o.sitemap}`);
      return lines.join("\n") + "\n";
    },

    // jsonld_article article -> <script type="application/ld+json">...</script>
    "jsonld_article": (article: { title: string; url: string; description?: string; image?: string; datePublished?: string; dateModified?: string; author?: string; publisher?: string }): string => {
      const obj: any = {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: article.title,
        url: article.url,
      };
      if (article.description) obj.description = article.description;
      if (article.image) obj.image = article.image;
      if (article.datePublished) obj.datePublished = article.datePublished;
      if (article.dateModified) obj.dateModified = article.dateModified;
      if (article.author) obj.author = { "@type": "Person", name: article.author };
      if (article.publisher) obj.publisher = { "@type": "Organization", name: article.publisher };
      return `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;
    },

    // jsonld_breadcrumb items -> schema.org BreadcrumbList
    "jsonld_breadcrumb": (items: Array<{ name: string; url: string }>): string => {
      const obj = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: (items || []).map((it, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: it.name,
          item: it.url,
        })),
      };
      return `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;
    },

    // jsonld_organization org -> schema.org Organization
    "jsonld_organization": (org: { name: string; url: string; logo?: string; sameAs?: string[] }): string => {
      const obj: any = {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: org.name,
        url: org.url,
      };
      if (org.logo) obj.logo = org.logo;
      if (org.sameAs && org.sameAs.length > 0) obj.sameAs = org.sameAs;
      return `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;
    },
  };
}
