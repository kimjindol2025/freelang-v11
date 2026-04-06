/**
 * WebSearchResult - Standardized search result format
 */
export interface WebSearchResult {
    title: string;
    url: string;
    snippet: string;
    source: "web" | "api" | "cache";
    relevance?: number;
    timestamp?: string;
}
/**
 * WebSearchOptions - Search configuration
 */
export interface WebSearchOptions {
    limit?: number;
    cache?: boolean;
    timeout?: number;
}
/**
 * WebSearchAdapter - Handles external search API integration
 *
 * Supported methods:
 * - Brave Search API (free, privacy-focused)
 * - Serper API (fast, small free tier)
 * - Local cache fallback (offline mode)
 */
export declare class WebSearchAdapter {
    private cache;
    private apiKey?;
    private apiProvider;
    private cacheTtlMs;
    constructor(apiKey?: string, provider?: "brave" | "serper" | "mock");
    /**
     * Synchronous search (for integration with sync interpreters)
     * Only uses cached/mock results, no real API calls
     */
    searchSync(query: string, options?: WebSearchOptions): WebSearchResult[];
    /**
     * Asynchronous search (for async-aware interpreters)
     * Returns cached result or calls API based on provider
     */
    search(query: string, options?: WebSearchOptions): Promise<WebSearchResult[]>;
    /**
     * Brave Search API integration
     * https://api.search.brave.com/res/v1/web/search
     */
    private searchBrave;
    /**
     * Serper API integration
     * https://google.serper.dev/search
     */
    private searchSerper;
    /**
     * Mock search for testing/offline mode
     */
    private searchMock;
    /**
     * Get cached result if not expired
     */
    getCachedResult(query: string): WebSearchResult[] | null;
    /**
     * Store search results in cache
     */
    cacheResult(query: string, results: WebSearchResult[]): void;
    /**
     * Clear cache for specific query or all
     */
    clearCache(query?: string): void;
    /**
     * Get cache statistics
     */
    getCacheStats(): {
        size: number;
        queries: string[];
        oldestEntry?: {
            query: string;
            timestamp: number;
        };
    };
}
//# sourceMappingURL=web-search-adapter.d.ts.map