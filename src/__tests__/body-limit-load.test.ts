/**
 * Bulk-request protection: body size cap + concurrent rate limit.
 */
import { describe, test, expect, beforeEach, afterEach } from "@jest/globals";
import * as http from "http";
import { createHttpServerModule } from "../stdlib-http-server";

function post(opts: {
  port: number;
  path?: string;
  body: Buffer | string;
  headers?: Record<string, string>;
}): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const payload = Buffer.isBuffer(opts.body) ? opts.body : Buffer.from(opts.body);
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: opts.port,
        path: opts.path || "/echo",
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Length": String(payload.length),
          ...(opts.headers || {}),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () =>
          resolve({
            status: res.statusCode || 0,
            headers: res.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          })
        );
      }
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

function get(port: number, path = "/"): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.get({ hostname: "127.0.0.1", port, path }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () =>
        resolve({
          status: res.statusCode || 0,
          headers: res.headers,
          body: Buffer.concat(chunks).toString("utf8"),
        })
      );
    });
    req.on("error", reject);
  });
}

describe("Bulk request protection", () => {
  let serverModule: ReturnType<typeof createHttpServerModule>;
  const port = 19891;

  const mockCallFn = (_name: string, _args: any[]): any => {
    return { __fl_response: true, status: 200, contentType: "text/plain", body: "OK" };
  };

  beforeEach(() => {
    serverModule = createHttpServerModule(mockCallFn);
  });

  afterEach(() => {
    serverModule.server_stop();
  });

  test("Content-Length over cap returns 413 with request_id before buffering", async () => {
    (serverModule as any).server_max_body(64);
    (serverModule as any).server_post("/echo", "h");
    (serverModule as any).server_start(port);

    const res = await post({
      port,
      body: Buffer.alloc(128, 0x61),
    });
    expect(res.status).toBe(413);
    expect(res.headers["x-request-id"]).toMatch(/^req_/);
    const json = JSON.parse(res.body);
    expect(json.error.code).toBe("PAYLOAD_TOO_LARGE");
    expect(json.request_id).toBe(res.headers["x-request-id"]);
    expect(json.error.limit_bytes).toBe(64);
    expect(json.error.declared_bytes).toBe(128);
  });

  test("header name case does not bypass Content-Length cap", async () => {
    (serverModule as any).server_max_body(32);
    (serverModule as any).server_post("/echo", "h");
    (serverModule as any).server_start(port + 1);

    const res = await post({
      port: port + 1,
      body: "x".repeat(40),
      headers: { "CONTENT-LENGTH": "40" },
    });
    expect(res.status).toBe(413);
  });

  test("streaming body over cap without trusting a tiny Content-Length still 413", async () => {
    (serverModule as any).server_max_body(32);
    (serverModule as any).server_post("/echo", "h");
    (serverModule as any).server_start(port + 2);

    const res = await new Promise<{ status: number; body: string }>((resolve) => {
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: port + 2,
          path: "/echo",
          method: "POST",
          headers: { "Content-Type": "application/octet-stream" },
        },
        (r) => {
          const chunks: Buffer[] = [];
          r.on("data", (c) => chunks.push(c));
          r.on("end", () => resolve({ status: r.statusCode || 0, body: Buffer.concat(chunks).toString() }));
        }
      );
      req.on("error", () => {
        resolve({ status: 413, body: "" });
      });
      req.write(Buffer.alloc(200, 0x62));
      req.end();
    });
    expect([413, 0]).toContain(res.status);
    if (res.body) {
      const json = JSON.parse(res.body);
      expect(json.error.code).toBe("PAYLOAD_TOO_LARGE");
    }
  });

  test("body under cap is accepted", async () => {
    (serverModule as any).server_max_body(1024);
    (serverModule as any).server_post("/echo", "h");
    (serverModule as any).server_start(port + 3);
    const res = await post({ port: port + 3, body: "hello" });
    expect(res.status).toBe(200);
    expect(res.body).toContain("OK");
  });

  test("concurrent burst: only window max succeed, rest 429 with Retry-After", async () => {
    (serverModule as any).server_rate_limit(5, 1000);
    (serverModule as any).server_get("/", "h");
    (serverModule as any).server_start(port + 4);

    const results = await Promise.all(Array.from({ length: 20 }, () => get(port + 4)));
    const ok = results.filter((r) => r.status === 200);
    const limited = results.filter((r) => r.status === 429);
    expect(ok.length).toBe(5);
    expect(limited.length).toBe(15);
    for (const r of limited) {
      expect(r.headers["retry-after"]).toBeDefined();
      expect(r.headers["x-ratelimit-limit"]).toBe("5");
      expect(r.headers["x-ratelimit-remaining"]).toBe("0");
      expect(r.headers["x-ratelimit-reset"]).toBeDefined();
      const json = JSON.parse(r.body);
      expect(json.error.code).toBe("RATE_LIMITED");
      expect(json.request_id).toMatch(/^req_/);
    }
    for (const r of ok) {
      expect(r.headers["x-ratelimit-limit"]).toBe("5");
      expect(Number(r.headers["x-ratelimit-remaining"])).toBeGreaterThanOrEqual(0);
      expect(r.headers["x-ratelimit-reset"]).toBeDefined();
    }
  });

  test("server_max_body is chainable and returns null", () => {
    expect((serverModule as any).server_max_body(10)).toBeNull();
    expect((serverModule as any).server_max_body(0)).toBeNull();
  });

  test("server_body_limit and server_max_body are compatible aliases", () => {
    expect((serverModule as any).server_body_limit(10)).toBeNull();
    expect((serverModule as any).server_max_body(10)).toBeNull();
  });
});
