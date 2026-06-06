// FreeLang v9: Registry Module
// Phase 7: Package Registry Client

import * as http from "http";

export function createRegistryModule() {
  const registryUrl = process.env.REGISTRY_URL || "http://localhost:4873";

  return {
    // registry_publish(name, version, files) → {published: true}
    "registry_publish": (name: string, version: string, files: any): any => {
      try {
        const body = JSON.stringify(files);
        const response = httpRequest("PUT", `${registryUrl}/${name}/${version}`, body);
        return response;
      } catch (err: any) {
        throw new Error(`registry_publish failed: ${err.message}`);
      }
    },

    // registry_search(query) → [{name, latest, description}]
    "registry_search": (query: string): any[] => {
      try {
        const response = httpRequest("GET", `${registryUrl}/search?q=${encodeURIComponent(query)}`, "");
        return typeof response === "string" ? JSON.parse(response) : response;
      } catch (err: any) {
        throw new Error(`registry_search failed: ${err.message}`);
      }
    },

    // registry_info(name) → {name, latest, versions: {}}
    "registry_info": (name: string): any => {
      try {
        const response = httpRequest("GET", `${registryUrl}/${name}`, "");
        return typeof response === "string" ? JSON.parse(response) : response;
      } catch (err: any) {
        throw new Error(`registry_info failed: ${err.message}`);
      }
    },

    // registry_delete(name, version) → {deleted: true}
    "registry_delete": (name: string, version: string): any => {
      try {
        const response = httpRequest("DELETE", `${registryUrl}/${name}/${version}`, "");
        return response;
      } catch (err: any) {
        throw new Error(`registry_delete failed: ${err.message}`);
      }
    },

    // registry_start(port) → {port, running: true}
    "registry_start": (port: number = 4873): any => {
      try {
        // Note: 실제로는 subprocess로 registry-server.fl 실행
        // 여기서는 테스트용 mock 반환
        return { port, running: true, message: "Registry started" };
      } catch (err: any) {
        throw new Error(`registry_start failed: ${err.message}`);
      }
    },
  };
}

// HTTP 헬퍼 (curl 기반)
function httpRequest(method: string, url: string, body: string): any {
  try {
    const { execSync } = require("child_process");
    const cmd = `curl -s -X ${method} ${body ? `-d '${body}'` : ""} "${url}"`;
    const result = execSync(cmd, { encoding: "utf-8" });
    try {
      return JSON.parse(result);
    } catch {
      return result;
    }
  } catch (err: any) {
    throw new Error(`HTTP ${method} ${url} failed: ${err.message}`);
  }
}
