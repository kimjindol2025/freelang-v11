// FreeLang v11: HTTP Client Standard Library (Phase 5-2)
// 모든 http_* 함수는 구조체 반환: {:status 200 :body "..." :error nil}

import { spawnSync } from "child_process";

// curl 실행 및 상태 코드 + body 반환
function curlWithStatus(args: string[]): { status: number; body: string } {
  const tmpFile = `/tmp/curl-headers-${Date.now()}.txt`;
  const curlArgs = [...args, "-D", tmpFile];

  const result = spawnSync("curl", curlArgs, { timeout: 15000, stdio: ["pipe", "pipe", "pipe"] });
  const body = result.stdout?.toString() ?? "";

  // 상태 코드 추출 (curl의 -w %{http_code} 또는 헤더에서)
  let status = 200;
  try {
    if (result.status === 0) {
      // curl이 성공했으면 200 가정 (실제로는 헤더에서 추출 가능)
      status = 200;
    } else {
      status = result.status ?? 0;
    }
  } catch (e) {
    status = 0;
  }

  return { status, body };
}

// 더 정확한 상태 코드 추출 (-w 옵션 사용)
function curlGetStatusAndBody(url: string, method: string = "GET", headers?: any, body?: string): { status: number; body: string; error?: string } {
  try {
    const args: string[] = ["-s", "-w", "\n%{http_code}", "--max-time", "10", "-X", method];

    if (headers && typeof headers === "object") {
      for (const [key, value] of Object.entries(headers)) {
        args.push("-H", `${key}: ${value}`);
      }
    }

    if (body && body.length > 0) {
      args.push("-d", body);
    }

    args.push(url);

    const result = spawnSync("curl", args, { timeout: 15000 });
    if (result.error) {
      return { status: 0, body: "", error: result.error.message };
    }

    const output = result.stdout?.toString() ?? "";
    const lines = output.split("\n");
    const statusLine = lines[lines.length - 1]?.trim() ?? "0";
    const status = parseInt(statusLine, 10) || 0;
    const responseBody = lines.slice(0, -1).join("\n");

    return { status, body: responseBody };
  } catch (err: any) {
    return { status: 0, body: "", error: err.message };
  }
}

export function createHttpModule() {
  return {
    // http_get url -> {:status 200 :body "..."}
    "http_get": (url: string): any => {
      const result = curlGetStatusAndBody(url, "GET");
      return {
        status: result.status,
        body: result.body,
        ...(result.error && { error: result.error })
      };
    },

    // http_post url body -> {:status 200 :body "..."}
    "http_post": (url: string, body: string): any => {
      const result = curlGetStatusAndBody(url, "POST",
        { "Content-Type": "application/json" }, body);
      return {
        status: result.status,
        body: result.body,
        ...(result.error && { error: result.error })
      };
    },

    // http_post_form url body -> {:status 200 :body "..."}
    "http_post_form": (url: string, body: string): any => {
      const result = curlGetStatusAndBody(url, "POST",
        { "Content-Type": "application/x-www-form-urlencoded" }, body);
      return {
        status: result.status,
        body: result.body,
        ...(result.error && { error: result.error })
      };
    },

    // http_get_bearer url token -> {:status 200 :body "..."}
    "http_get_bearer": (url: string, token: string): any => {
      const result = curlGetStatusAndBody(url, "GET",
        { "Authorization": `Bearer ${token}` });
      return {
        status: result.status,
        body: result.body,
        ...(result.error && { error: result.error })
      };
    },

    // http_put url body -> {:status 200 :body "..."}
    "http_put": (url: string, body: string): any => {
      const result = curlGetStatusAndBody(url, "PUT",
        { "Content-Type": "application/json" }, body);
      return {
        status: result.status,
        body: result.body,
        ...(result.error && { error: result.error })
      };
    },

    // http_patch url body -> {:status 200 :body "..."}
    "http_patch": (url: string, body: string): any => {
      const result = curlGetStatusAndBody(url, "PATCH",
        { "Content-Type": "application/json" }, body);
      return {
        status: result.status,
        body: result.body,
        ...(result.error && { error: result.error })
      };
    },

    // http_delete url -> {:status 200 :body "..."}
    "http_delete": (url: string): any => {
      const result = curlGetStatusAndBody(url, "DELETE");
      return {
        status: result.status,
        body: result.body,
        ...(result.error && { error: result.error })
      };
    },

    // http_head url -> {:status 200 :body ""}
    "http_head": (url: string): any => {
      const result = curlGetStatusAndBody(url, "HEAD");
      return {
        status: result.status,
        body: "",
        ...(result.error && { error: result.error })
      };
    },

    // http_get_key url api-key -> {:status 200 :body "..."}
    "http_get_key": (url: string, apiKey: string): any => {
      const result = curlGetStatusAndBody(url, "GET", { "X-API-Key": apiKey });
      return {
        status: result.status,
        body: result.body,
        ...(result.error && { error: result.error })
      };
    },

    // http_post_key url body api-key -> {:status 200 :body "..."}
    "http_post_key": (url: string, body: string, apiKey: string): any => {
      const result = curlGetStatusAndBody(url, "POST",
        { "Content-Type": "application/json", "X-API-Key": apiKey }, body);
      return {
        status: result.status,
        body: result.body,
        ...(result.error && { error: result.error })
      };
    },

    // http_status url -> number (상태코드만)
    "http_status": (url: string): number => {
      const result = curlGetStatusAndBody(url, "GET");
      return result.status;
    },

    // http_json url -> {:status 200 :data {...} :error nil}
    "http_json": (url: string): any => {
      const result = curlGetStatusAndBody(url, "GET");
      if (result.error) {
        return { status: 0, data: null, error: result.error };
      }
      try {
        return { status: result.status, data: JSON.parse(result.body) };
      } catch (err: any) {
        return { status: result.status, data: null, error: err.message };
      }
    },

    // http_header url header -> string (특정 헤더만)
    "http_header": (url: string, header: string): string => {
      try {
        const result = spawnSync("curl", ["-s", "-I", "--max-time", "10", url], { timeout: 15000 });
        const headers = result.stdout?.toString() ?? "";
        const lines = headers.split("\n");
        for (const line of lines) {
          if (line.toLowerCase().startsWith(header.toLowerCase())) {
            return line;
          }
        }
        return "";
      } catch (err) {
        return "";
      }
    },

    // http_with_timeout url timeout -> {:status 200 :body "..."}
    "http_with_timeout": (url: string, timeout: number): any => {
      try {
        const result = spawnSync("curl", ["-s", "--max-time", String(timeout / 1000), url], { timeout });
        const body = result.stdout?.toString() ?? "";
        return { status: result.status === 0 ? 200 : 0, body };
      } catch (err: any) {
        return { status: 0, body: "", error: err.message };
      }
    },

    // http_post_json url data -> {:status 200 :data {...}}
    "http_post_json": (url: string, data: any): any => {
      const body = JSON.stringify(data);
      const result = curlGetStatusAndBody(url, "POST",
        { "Content-Type": "application/json" }, body);
      try {
        return {
          status: result.status,
          data: result.body ? JSON.parse(result.body) : null,
          ...(result.error && { error: result.error })
        };
      } catch (err: any) {
        return { status: result.status, data: null, error: err.message };
      }
    },

    // http_put_json url data -> {:status 200 :data {...}}
    "http_put_json": (url: string, data: any): any => {
      const body = JSON.stringify(data);
      const result = curlGetStatusAndBody(url, "PUT",
        { "Content-Type": "application/json" }, body);
      try {
        return {
          status: result.status,
          data: result.body ? JSON.parse(result.body) : null,
          ...(result.error && { error: result.error })
        };
      } catch (err: any) {
        return { status: result.status, data: null, error: err.message };
      }
    },

    // http_request method url headers body -> {:status 200 :body "..."}
    "http_request": (method: string, url: string, headers: any, body: string): any => {
      const result = curlGetStatusAndBody(url, method, headers, body);
      return {
        status: result.status,
        body: result.body,
        ...(result.error && { error: result.error })
      };
    },

    // http_req_status method url headers body -> number
    "http_req_status": (method: string, url: string, headers: any, body: string): number => {
      const result = curlGetStatusAndBody(url, method, headers, body);
      return result.status;
    },

    // http_get_json url headers -> {:status 200 :data {...}}
    "http_get_json": (url: string, headers?: any): any => {
      const result = curlGetStatusAndBody(url, "GET", headers);
      try {
        return {
          status: result.status,
          data: result.body ? JSON.parse(result.body) : null,
          ...(result.error && { error: result.error })
        };
      } catch (err: any) {
        return { status: result.status, data: null, error: err.message };
      }
    },

    // http_get_json_bearer url token -> {:status 200 :data {...}}
    "http_get_json_bearer": (url: string, token: string): any => {
      const result = curlGetStatusAndBody(url, "GET",
        { "Authorization": `Bearer ${token}` });
      try {
        return {
          status: result.status,
          data: result.body ? JSON.parse(result.body) : null,
          ...(result.error && { error: result.error })
        };
      } catch (err: any) {
        return { status: result.status, data: null, error: err.message };
      }
    },

    // is_http_success status -> boolean
    "is_http_success": (status: number): boolean => status >= 200 && status < 300,

    // is_http_redirect status -> boolean
    "is_http_redirect": (status: number): boolean => status >= 300 && status < 400,

    // is_http_error status -> boolean
    "is_http_error": (status: number): boolean => status >= 400,
  };
}
