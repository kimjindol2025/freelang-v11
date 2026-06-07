var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/stdlib-lazy-registry.ts
var stdlib_lazy_registry_exports = {};
__export(stdlib_lazy_registry_exports, {
  getAvailableModules: () => getAvailableModules,
  isModuleLoaded: () => isModuleLoaded,
  requireModule: () => requireModule
});
module.exports = __toCommonJS(stdlib_lazy_registry_exports);
var BUNDLE_MAP = {
  "http-server": { bundle: "./stdlib-ext-http.js", factory: "createHttpServerModule", needsInterp: true },
  "mariadb": { bundle: "./stdlib-ext-db.js", factory: "createMariadbModule" },
  "mongodb": { bundle: "./stdlib-ext-db.js", factory: "createMongodbModule" },
  "db": { bundle: "./stdlib-ext-db.js", factory: "createDbModule" },
  "orm": { bundle: "./stdlib-ext-db.js", factory: "createOrmModule" },
  "workflow": { bundle: "./stdlib-ext-workflow.js", factory: "createWorkflowModule" },
  "resource": { bundle: "./stdlib-ext-workflow.js", factory: "createResourceModule" },
  "service": { bundle: "./stdlib-ext-workflow.js", factory: "createServiceModule" },
  "ws": { bundle: "./stdlib-ext-ws.js", factory: "createWsModule", needsInterp: true },
  "wsc": { bundle: "./stdlib-ext-ws.js", factory: "createWscModule", needsInterp: true }
};
var MISC_MODULES = {
  "crypto-rsa": "createCryptoRsaModule",
  "totp": "createTotpModule",
  "mail": "createMailModule",
  "webauthn": "createWebauthnModule",
  "queue": "createQueueHelpersModule",
  "async": "createAsyncModule",
  "channel": "createChannelModule",
  "immutable": "createImmutableModule",
  "ai": "createAiNativeModule",
  "compile": "createCompileModule",
  "registry": "createRegistryModule",
  "validation": "createValidationModule",
  "middleware": "createMiddlewareModule",
  "table": "createTableModule",
  "markdown": "createMarkdownModule",
  "blog": "createBlogModule",
  "audit": "createAuditModule"
};
var NOT_AVAILABLE = /* @__PURE__ */ new Set(["oci", "stats", "plot", "feed", "cloud", "matrix"]);
var loaded = /* @__PURE__ */ new Set();
function getAvailableModules() {
  return [...Object.keys(BUNDLE_MAP), ...Object.keys(MISC_MODULES)];
}
function isModuleLoaded(name) {
  return loaded.has(name);
}
function resolveBundlePath(bundleFile) {
  return require("path").resolve(__dirname, bundleFile);
}
function requireModule(name, interp) {
  const normalized = name.replace(/_/g, "-");
  if (loaded.has(normalized)) return true;
  if (NOT_AVAILABLE.has(normalized)) {
    throw new Error(`${normalized} \uBAA8\uB4C8\uC740 \uBCC4\uB3C4 \uD328\uD0A4\uC9C0\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4.`);
  }
  try {
    const entry = BUNDLE_MAP[normalized];
    if (entry) {
      const mod = require(resolveBundlePath(entry.bundle));
      const factory = mod[entry.factory];
      if (!factory) throw new Error(`${entry.factory} not found in ${entry.bundle}`);
      let result;
      if (entry.needsInterp) {
        result = factory(
          (n, a) => interp.callUserFunction(n, a),
          (fn, a) => interp.callFunctionValue(fn, a)
        );
      } else {
        result = factory();
      }
      interp.registerModule(result);
      loaded.add(normalized);
      return true;
    }
    if (MISC_MODULES[normalized]) {
      const mod = require(resolveBundlePath("./stdlib-ext-misc.js"));
      const factory = mod[MISC_MODULES[normalized]];
      if (!factory) throw new Error(`${MISC_MODULES[normalized]} not found in stdlib-ext-misc.js`);
      const result = factory(interp ? (n, a) => interp.callUserFunction(n, a) : () => null);
      interp.registerModule(result);
      loaded.add(normalized);
      return true;
    }
    console.warn(`\u26A0\uFE0F  [FreeLang] require: \uC54C \uC218 \uC5C6\uB294 \uBAA8\uB4C8 "${name}". \uC0AC\uC6A9 \uAC00\uB2A5: ${getAvailableModules().join(", ")}`);
    return false;
  } catch (e) {
    if (e.code === "MODULE_NOT_FOUND") {
      console.warn(`\u26A0\uFE0F  [FreeLang] require "${name}": \uBC88\uB4E4 \uD30C\uC77C \uC5C6\uC74C (${e.message})`);
      return false;
    }
    console.error(`\u274C [FreeLang] require "${name}" \uB85C\uB4DC \uC2E4\uD328:`, e);
    return false;
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  getAvailableModules,
  isModuleLoaded,
  requireModule
});
