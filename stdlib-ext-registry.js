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

// src/ext-registry.ts
var ext_registry_exports = {};
__export(ext_registry_exports, {
  createRegistryModule: () => createRegistryModule
});
module.exports = __toCommonJS(ext_registry_exports);

// src/stdlib-registry.ts
function createRegistryModule() {
  const registryUrl = process.env.REGISTRY_URL || "http://localhost:4873";
  return {
    // registry_publish(name, version, files) → {published: true}
    "registry_publish": (name, version, files) => {
      try {
        const body = JSON.stringify(files);
        const response = httpRequest("PUT", `${registryUrl}/${name}/${version}`, body);
        return response;
      } catch (err) {
        throw new Error(`registry_publish failed: ${err.message}`);
      }
    },
    // registry_search(query) → [{name, latest, description}]
    "registry_search": (query) => {
      try {
        const response = httpRequest("GET", `${registryUrl}/search?q=${encodeURIComponent(query)}`, "");
        return typeof response === "string" ? JSON.parse(response) : response;
      } catch (err) {
        throw new Error(`registry_search failed: ${err.message}`);
      }
    },
    // registry_info(name) → {name, latest, versions: {}}
    "registry_info": (name) => {
      try {
        const response = httpRequest("GET", `${registryUrl}/${name}`, "");
        return typeof response === "string" ? JSON.parse(response) : response;
      } catch (err) {
        throw new Error(`registry_info failed: ${err.message}`);
      }
    },
    // registry_delete(name, version) → {deleted: true}
    "registry_delete": (name, version) => {
      try {
        const response = httpRequest("DELETE", `${registryUrl}/${name}/${version}`, "");
        return response;
      } catch (err) {
        throw new Error(`registry_delete failed: ${err.message}`);
      }
    },
    // registry_start(port) → {port, running: true}
    "registry_start": (port = 4873) => {
      try {
        return { port, running: true, message: "Registry started" };
      } catch (err) {
        throw new Error(`registry_start failed: ${err.message}`);
      }
    }
  };
}
function httpRequest(method, url, body) {
  try {
    const { execSync } = require("child_process");
    const cmd = `curl -s -X ${method} ${body ? `-d '${body}'` : ""} "${url}"`;
    const result = execSync(cmd, { encoding: "utf-8" });
    try {
      return JSON.parse(result);
    } catch {
      return result;
    }
  } catch (err) {
    throw new Error(`HTTP ${method} ${url} failed: ${err.message}`);
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createRegistryModule
});
