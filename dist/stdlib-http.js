"use strict";
// FreeLang v9: HTTP Client Standard Library
// Phase 12: HTTP operations for AI-native external API access
// Uses curl via execSync — synchronous, AI-friendly
Object.defineProperty(exports, "__esModule", { value: true });
exports.createHttpModule = createHttpModule;
const child_process_1 = require("child_process");
/**
 * Create the HTTP client module for FreeLang v9
 * Provides: http_get, http_post, http_put, http_delete, http_status, http_json
 */
function createHttpModule() {
    return {
        // http_get url -> string (GET request, returns response body)
        "http_get": (url) => {
            try {
                return (0, child_process_1.execSync)(`curl -s --max-time 10 "${url}"`, { encoding: "utf-8" });
            }
            catch (err) {
                throw new Error(`http_get failed for '${url}': ${err.message}`);
            }
        },
        // http_post url body -> string (POST with body, returns response body)
        "http_post": (url, body) => {
            try {
                return (0, child_process_1.execSync)(`curl -s --max-time 10 -X POST -H "Content-Type: application/json" -d '${body.replace(/'/g, "'\\''")}' "${url}"`, { encoding: "utf-8" });
            }
            catch (err) {
                throw new Error(`http_post failed for '${url}': ${err.message}`);
            }
        },
        // http_put url body -> string (PUT with body)
        "http_put": (url, body) => {
            try {
                return (0, child_process_1.execSync)(`curl -s --max-time 10 -X PUT -H "Content-Type: application/json" -d '${body.replace(/'/g, "'\\''")}' "${url}"`, { encoding: "utf-8" });
            }
            catch (err) {
                throw new Error(`http_put failed for '${url}': ${err.message}`);
            }
        },
        // http_delete url -> string (DELETE request)
        "http_delete": (url) => {
            try {
                return (0, child_process_1.execSync)(`curl -s --max-time 10 -X DELETE "${url}"`, { encoding: "utf-8" });
            }
            catch (err) {
                throw new Error(`http_delete failed for '${url}': ${err.message}`);
            }
        },
        // http_status url -> number (HTTP status code only)
        "http_status": (url) => {
            try {
                const out = (0, child_process_1.execSync)(`curl -s -o /dev/null -w "%{http_code}" --max-time 10 "${url}"`, { encoding: "utf-8" });
                return parseInt(out.trim(), 10);
            }
            catch (err) {
                throw new Error(`http_status failed for '${url}': ${err.message}`);
            }
        },
        // http_json url -> object (GET + JSON parse)
        "http_json": (url) => {
            try {
                const body = (0, child_process_1.execSync)(`curl -s --max-time 10 "${url}"`, { encoding: "utf-8" });
                return JSON.parse(body);
            }
            catch (err) {
                throw new Error(`http_json failed for '${url}': ${err.message}`);
            }
        },
        // http_header url header -> string (GET with custom header)
        "http_header": (url, header) => {
            try {
                return (0, child_process_1.execSync)(`curl -s --max-time 10 -H "${header}" "${url}"`, { encoding: "utf-8" });
            }
            catch (err) {
                throw new Error(`http_header failed for '${url}': ${err.message}`);
            }
        },
    };
}
//# sourceMappingURL=stdlib-http.js.map