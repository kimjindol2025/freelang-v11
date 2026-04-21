// FreeLang v11: MongoDB Client Driver
// Phase 28: MongoDB Wire Protocol via helper script
// v11에서 mongodb_* 함수를 호출 → execFileSync로 helper 실행
// BSON 로직은 순수 v11 (self/stdlib/mongodb/bson.fl)

import { execFileSync } from "child_process";
import * as path from "path";

/**
 * MongoDB client module for FreeLang v11.
 * 모든 작업은 _mongodb_helper.js를 통해 동기식으로 실행됨.
 * BSON 인코딩/디코딩은 v11에서 처리 (bson.fl).
 */
export function createMongodbModule() {
  const helperPath = path.join(__dirname, "_mongodb_helper.js");

  function callHelper(req: Record<string, any>): any {
    try {
      const json = JSON.stringify(req);
      const result = execFileSync("node", [helperPath, json], {
        timeout: 15000,
        encoding: "utf-8",
      });
      return JSON.parse(result);
    } catch (err: any) {
      return {
        ok: false,
        error: err.message || "Helper execution failed",
      };
    }
  }

  return {
    // mongodb_connect host port → connId or null
    "mongodb_connect": (host: string, port: number = 27017): string | null => {
      const result = callHelper({
        method: "connect",
        host,
        port,
      });

      if (result.ok) {
        // connId = "host:port"
        return `${host}:${port}`;
      }
      return null;
    },

    // mongodb_sendrecv connId hexData → hexResponse or null
    // Wire Protocol 명령 전송 & 응답 수신
    "mongodb_sendrecv": (
      connId: string,
      hexData: string,
      timeout: number = 10000
    ): string | null => {
      const [host, portStr] = connId.split(":");
      const port = parseInt(portStr, 10);

      const result = callHelper({
        method: "sendrecv",
        host,
        port,
        data: hexData,
        timeout,
      });

      if (result.ok && result.data) {
        return result.data;
      }
      return null;
    },

    // mongodb_send connId hexData → boolean
    "mongodb_send": (connId: string, hexData: string): boolean => {
      const [host, portStr] = connId.split(":");
      const port = parseInt(portStr, 10);

      const result = callHelper({
        method: "send",
        host,
        port,
        data: hexData,
      });

      return result.ok === true;
    },

    // mongodb_close connId → boolean
    "mongodb_close": (connId: string): boolean => {
      // TCP 상태가 자동으로 정리되므로 항상 true
      return true;
    },

    // mongodb_is_connected connId → boolean
    "mongodb_is_connected": (connId: string): boolean => {
      const [host, portStr] = connId.split(":");
      const port = parseInt(portStr, 10);

      const result = callHelper({
        method: "connect",
        host,
        port,
        timeout: 1000,
      });

      return result.ok === true;
    },
  };
}
