"use strict";
// FreeLang v9: HTTP Client Standard Library
// Phase 12: HTTP operations for AI-native external API access
// Uses curl via spawnSync — args as array, no shell injection
Object.defineProperty(exports, "__esModule", { value: true });
exports.createHttpModule = createHttpModule;
const child_process_1 = require("child_process");
function curlRun(args) {
    const result = (0, child_process_1.spawnSync)("curl", args, { timeout: 15000 });
    if (result.error)
        throw new Error(`curl error: ${result.error.message}`);
    if ((result.status ?? 1) !== 0) {
        const stderr = result.stderr?.toString().trim() ?? "";
        throw new Error(`curl exited ${result.status}${stderr ? ": " + stderr : ""}`);
    }
    return result.stdout?.toString() ?? "";
}
function createHttpModule() {
    return {
        // http_get url -> string
        "http_get": (url) => {
            try {
                return curlRun(["-s", "--max-time", "10", url]);
            }
            catch (err) {
                throw new Error(`http_get failed for '${url}': ${err.message}`);
            }
        },
        // http_post url body -> string
        "http_post": (url, body) => {
            try {
                return curlRun(["-s", "--max-time", "10", "-X", "POST",
                    "-H", "Content-Type: application/json", "-d", body, url]);
            }
            catch (err) {
                throw new Error(`http_post failed for '${url}': ${err.message}`);
            }
        },
        // http_put url body -> string
        "http_put": (url, body) => {
            try {
                return curlRun(["-s", "--max-time", "10", "-X", "PUT",
                    "-H", "Content-Type: application/json", "-d", body, url]);
            }
            catch (err) {
                throw new Error(`http_put failed for '${url}': ${err.message}`);
            }
        },
        // http_delete url -> string
        "http_delete": (url) => {
            try {
                return curlRun(["-s", "--max-time", "10", "-X", "DELETE", url]);
            }
            catch (err) {
                throw new Error(`http_delete failed for '${url}': ${err.message}`);
            }
        },
        // http_status url -> number
        "http_status": (url) => {
            try {
                const out = curlRun(["-s", "-o", "/dev/null", "-w", "%{http_code}", "--max-time", "10", url]);
                return parseInt(out.trim(), 10);
            }
            catch (err) {
                throw new Error(`http_status failed for '${url}': ${err.message}`);
            }
        },
        // http_json url -> object
        "http_json": (url) => {
            try {
                const body = curlRun(["-s", "--max-time", "10", url]);
                return JSON.parse(body);
            }
            catch (err) {
                throw new Error(`http_json failed for '${url}': ${err.message}`);
            }
        },
        // http_header url header -> string
        "http_header": (url, header) => {
            try {
                return curlRun(["-s", "--max-time", "10", "-H", header, url]);
            }
            catch (err) {
                throw new Error(`http_header failed for '${url}': ${err.message}`);
            }
        },
    };
}
//# sourceMappingURL=stdlib-http.js.map