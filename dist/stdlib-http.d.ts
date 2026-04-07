/**
 * Create the HTTP client module for FreeLang v9
 * Provides: http_get, http_post, http_put, http_delete, http_status, http_json
 */
export declare function createHttpModule(): {
    http_get: (url: string) => string;
    http_post: (url: string, body: string) => string;
    http_put: (url: string, body: string) => string;
    http_delete: (url: string) => string;
    http_status: (url: string) => number;
    http_json: (url: string) => any;
    http_header: (url: string, header: string) => string;
};
//# sourceMappingURL=stdlib-http.d.ts.map