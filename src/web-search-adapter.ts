// FreeLang v9 Phase 9a Advanced: WebSearch API Adapter
// External search data integration with caching support

/**
 * WebSearchResult - Standardized search result format
 */
export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  source: "web" | "api" | "cache";
  relevance?: number; // 0-1
  timestamp?: string; // ISO 8601
}

/**
 * WebSearchOptions - Search configuration
 */
export interface WebSearchOptions {
  limit?: number; // Default: 10
  cache?: boolean; // Enable caching
  timeout?: number; // Milliseconds, default: 5000
}

/**
 * CachedSearchEntry - Internal cache structure
 */
interface CachedSearchEntry {
  results: WebSearchResult[];
  timestamp: number;
  expiresAt: number; // TTL: 24 hours
}

/**
 * WebSearchAdapter - Handles external search API integration
 *
 * Supported methods:
 * - Brave Search API (free, privacy-focused)
 * - Serper API (fast, small free tier)
 * - Local cache fallback (offline mode)
 */
export class WebSearchAdapter {
  private cache: Map<string, CachedSearchEntry>;
  private apiKey?: string;
  private apiProvider: "brave" | "serper" | "mock";
  private cacheTtlMs: number = 24 * 60 * 60 * 1000; // 24 hours

  constructor(apiKey?: string, provider: "brave" | "serper" | "mock" = "mock") {
    this.cache = new Map();
    this.apiKey = apiKey;
    this.apiProvider = provider;
  }

  /**
   * Synchronous search (for integration with sync interpreters)
   * Only uses cached/mock results, no real API calls
   */
  searchSync(query: string, options: WebSearchOptions = {}): WebSearchResult[] {
    const { limit = 10, cache = true } = options;

    // 1. Check cache first
    if (cache) {
      const cached = this.getCachedResult(query);
      if (cached) {
        return cached.map((r) => ({ ...r, source: "cache" as const }));
      }
    }

    // 2. For sync mode, only use mock (real APIs are async)
    const results = this.searchMock(query, limit);

    // 3. Cache results if enabled
    if (cache) {
      this.cacheResult(query, results);
    }

    return results;
  }

  /**
   * Asynchronous search (for async-aware interpreters)
   * Returns cached result or calls API based on provider
   */
  async search(query: string, options: WebSearchOptions = {}): Promise<WebSearchResult[]> {
    const { limit = 10, cache = true, timeout = 5000 } = options;

    // 1. Check cache first
    if (cache) {
      const cached = this.getCachedResult(query);
      if (cached) {
        return cached.map((r) => ({ ...r, source: "cache" as const }));
      }
    }

    // 2. Call API based on provider
    let results: WebSearchResult[];
    try {
      switch (this.apiProvider) {
        case "brave":
          results = await this.searchBrave(query, limit, timeout);
          break;
        case "serper":
          results = await this.searchSerper(query, limit, timeout);
          break;
        case "mock":
        default:
          results = this.searchMock(query, limit);
      }
    } catch (error) {
      // Fallback to mock if API fails
      console.warn(`Search API failed: ${(error as Error).message}, using mock results`);
      results = this.searchMock(query, limit);
    }

    // 3. Cache results if enabled
    if (cache) {
      this.cacheResult(query, results);
    }

    return results;
  }

  /**
   * Brave Search API integration
   * https://api.search.brave.com/res/v1/web/search
   */
  private async searchBrave(
    query: string,
    limit: number,
    timeout: number
  ): Promise<WebSearchResult[]> {
    if (!this.apiKey) {
      throw new Error("Brave Search requires API key (BRAVE_SEARCH_KEY)");
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch("https://api.search.brave.com/res/v1/web/search", {
        method: "GET",
        headers: {
          Accept: "application/json",
          "X-Subscription-Token": this.apiKey,
        },
        signal: controller.signal,
      } as RequestInit & { headers: Record<string, string> });

      if (!response.ok) {
        throw new Error(`Brave API error: ${response.status}`);
      }

      const data = (await response.json()) as any;
      const webResults = data.web || [];

      return webResults.slice(0, limit).map((item: any) => ({
        title: item.title,
        url: item.url,
        snippet: item.description,
        source: "api" as const,
        relevance: 0.9,
        timestamp: new Date().toISOString(),
      }));
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Serper API integration
   * https://google.serper.dev/search
   */
  private async searchSerper(
    query: string,
    limit: number,
    timeout: number
  ): Promise<WebSearchResult[]> {
    if (!this.apiKey) {
      throw new Error("Serper requires API key (SERPER_API_KEY)");
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: {
          "X-API-KEY": this.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          q: query,
          num: Math.min(limit, 10),
        }),
        signal: controller.signal,
      } as RequestInit);

      if (!response.ok) {
        throw new Error(`Serper API error: ${response.status}`);
      }

      const data = (await response.json()) as any;
      const results = data.organic || [];

      return results.slice(0, limit).map((item: any) => ({
        title: item.title,
        url: item.link,
        snippet: item.snippet,
        source: "api" as const,
        relevance: 0.85,
        timestamp: new Date().toISOString(),
      }));
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Mock search for testing/offline mode
   */
  private searchMock(query: string, limit: number): WebSearchResult[] {
    // Return realistic mock results based on query
    const mockDatabase: Record<string, WebSearchResult[]> = {
      "ai trends 2026": [
        {
          title: "2026 AI Trends: Multimodal Systems Dominate",
          url: "https://example.com/ai-trends-2026",
          snippet:
            "Multimodal AI systems combining text, image, and audio are becoming the standard...",
          source: "api",
          relevance: 0.95,
        },
        {
          title: "AI Safety & Alignment: Key Focus Areas",
          url: "https://example.com/ai-safety-2026",
          snippet: "As AI systems become more capable, safety and alignment research intensifies...",
          source: "api",
          relevance: 0.88,
        },
        {
          title: "Enterprise AI Adoption Accelerates",
          url: "https://example.com/enterprise-ai-2026",
          snippet: "Companies are deploying AI for productivity gains across departments...",
          source: "api",
          relevance: 0.82,
        },
      ],
      "typescript performance": [
        {
          title: "TypeScript Performance Optimization Guide",
          url: "https://example.com/ts-perf",
          snippet:
            "Learn how to optimize TypeScript compilation and runtime performance...",
          source: "api",
          relevance: 0.92,
        },
        {
          title: "Build Tools: esbuild vs tsc vs swc",
          url: "https://example.com/build-tools-comparison",
          snippet: "Comparing modern TypeScript build tools and their performance characteristics...",
          source: "api",
          relevance: 0.87,
        },
      ],
    };

    // Normalize query for lookup
    const normalizedQuery = query.toLowerCase();
    const results =
      mockDatabase[normalizedQuery] ||
      // Generic fallback
      [
        {
          title: `Results for: ${query}`,
          url: `https://example.com/search?q=${encodeURIComponent(query)}`,
          snippet: `Mock search results for query: "${query}"`,
          source: "api" as const,
          relevance: 0.75,
        },
      ];

    return results.slice(0, limit);
  }

  /**
   * Get cached result if not expired
   */
  getCachedResult(query: string): WebSearchResult[] | null {
    const cached = this.cache.get(query);
    if (!cached) return null;

    // Check if expired
    if (Date.now() > cached.expiresAt) {
      this.cache.delete(query);
      return null;
    }

    return cached.results;
  }

  /**
   * Store search results in cache
   */
  cacheResult(query: string, results: WebSearchResult[]): void {
    const now = Date.now();
    this.cache.set(query, {
      results,
      timestamp: now,
      expiresAt: now + this.cacheTtlMs,
    });
  }

  /**
   * Clear cache for specific query or all
   */
  clearCache(query?: string): void {
    if (query) {
      this.cache.delete(query);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    queries: string[];
    oldestEntry?: { query: string; timestamp: number };
  } {
    const queries = Array.from(this.cache.keys());
    let oldestEntry: { query: string; timestamp: number } | undefined;

    for (const [query, entry] of this.cache.entries()) {
      if (!oldestEntry || entry.timestamp < oldestEntry.timestamp) {
        oldestEntry = { query, timestamp: entry.timestamp };
      }
    }

    return {
      size: this.cache.size,
      queries,
      oldestEntry,
    };
  }
}
