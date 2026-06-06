// FreeLang v11 — Blog helpers (tags, related posts, search index)
// Zero deps. Operates on arrays of post objects.

interface Post {
  slug: string;
  title: string;
  url?: string;
  date?: string;
  tags?: string[];
  body?: string;   // plain text for search index
  summary?: string;
}

function normalize(s: string): string {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function createBlogModule() {
  return {
    // blog_all_tags [posts] → [tag1, tag2, ...] unique, sorted by count desc
    "blog_all_tags": (posts: Post[]): string[] => {
      const counts = new Map<string, number>();
      for (const p of posts || []) {
        for (const t of p.tags || []) {
          counts.set(t, (counts.get(t) || 0) + 1);
        }
      }
      return [...counts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map((e) => e[0]);
    },

    // blog_posts_by_tag [posts] tag → posts with that tag, newest first
    "blog_posts_by_tag": (posts: Post[], tag: string): Post[] => {
      const filtered = (posts || []).filter((p) => (p.tags || []).includes(tag));
      return filtered.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    },

    // blog_tag_counts [posts] → {tag: count, ...}
    "blog_tag_counts": (posts: Post[]): Record<string, number> => {
      const counts: Record<string, number> = {};
      for (const p of posts || []) {
        for (const t of p.tags || []) {
          counts[t] = (counts[t] || 0) + 1;
        }
      }
      return counts;
    },

    // blog_related [posts] currentSlug limit → posts sharing most tags,
    // excluding the current post, newest as tiebreak.
    "blog_related": (posts: Post[], currentSlug: string, limit: number = 5): Post[] => {
      const current = (posts || []).find((p) => p.slug === currentSlug);
      if (!current) return [];
      const currentTags = new Set(current.tags || []);
      const scored = (posts || [])
        .filter((p) => p.slug !== currentSlug)
        .map((p) => ({
          post: p,
          score: (p.tags || []).filter((t) => currentTags.has(t)).length,
          date: p.date || "",
        }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score || b.date.localeCompare(a.date));
      return scored.slice(0, Math.max(0, limit)).map((x) => x.post);
    },

    // blog_search_index [posts] → [{slug, title, url, body_terms}] compact JSON
    // body_terms: space-joined normalized words, limited to 500 chars.
    "blog_search_index": (posts: Post[]): Array<{ slug: string; title: string; url: string; terms: string }> => {
      return (posts || []).map((p) => ({
        slug: p.slug,
        title: p.title,
        url: p.url || `/blog/${p.slug}`,
        terms: normalize(`${p.title} ${p.summary || ""} ${p.body || ""}`).slice(0, 500),
      }));
    },

    // blog_search [index] query → top matches by term overlap score
    "blog_search": (index: Array<{ slug: string; title: string; url: string; terms: string }>, query: string, limit: number = 10): any[] => {
      const q = normalize(query);
      if (!q) return [];
      const terms = q.split(" ").filter(Boolean);
      const results = (index || [])
        .map((entry) => {
          let score = 0;
          for (const t of terms) {
            if (entry.title.toLowerCase().includes(t)) score += 3;
            if (entry.terms.includes(t)) score += 1;
          }
          return { entry, score };
        })
        .filter((r) => r.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, Math.max(0, limit))
        .map((r) => ({ slug: r.entry.slug, title: r.entry.title, url: r.entry.url, score: r.score }));
      return results;
    },

    // blog_posts_sorted [posts] → newest first
    "blog_posts_sorted": (posts: Post[]): Post[] => {
      return [...(posts || [])].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    },

    // blog_paginate [posts] page per-page → {items, total, page, pages}
    "blog_paginate": (posts: Post[], page: number = 1, perPage: number = 10): any => {
      const all = posts || [];
      const pp = Math.max(1, perPage);
      const pages = Math.max(1, Math.ceil(all.length / pp));
      const p = Math.min(Math.max(1, page), pages);
      const start = (p - 1) * pp;
      return {
        items: all.slice(start, start + pp),
        total: all.length,
        page: p,
        pages,
        perPage: pp,
        hasPrev: p > 1,
        hasNext: p < pages,
      };
    },
  };
}
