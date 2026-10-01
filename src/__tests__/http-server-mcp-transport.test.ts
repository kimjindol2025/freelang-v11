import * as http from "http";
import { once } from "events";
import { createHttpServerModule, __activeServer } from "../stdlib-http-server";

async function post(port: number, body: Buffer | string, headers: Record<string, string> = {}) {
  return new Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }>((resolve, reject) => {
    const req = http.request({ hostname: "127.0.0.1", port, path: "/mcp", method: "POST", headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => resolve({ status: res.statusCode || 0, headers: res.headers, body: Buffer.concat(chunks).toString("utf8") }));
    });
    req.on("error", reject);
    req.end(body);
  });
}

test("HTTP options reject unknown Origin and preserve raw UTF-8 body for FreeLang", async () => {
  const stdout = jest.spyOn(console, "log").mockImplementation(() => {});
  const stderr = jest.spyOn(console, "error").mockImplementation(() => {});
  const runtime: any = createHttpServerModule((name, args) => {
    expect(name).toBe("mcpHandler");
    return { status: 202, contentType: "application/json", body: { received: args[0].body } };
  });
  runtime.server_post("/mcp", "mcpHandler");
  runtime.server_body_limit(16);
  runtime.server_start({ port: 0, host: "127.0.0.1", rawBody: true,
    rejectUnknownOrigins: true, allowedOrigins: ["https://trusted.example"], accessLog: "stderr" });
  const server = __activeServer.server!;
  try {
    if (!server.listening) await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected TCP address");
    expect(address.address).toBe("127.0.0.1");
    const denied = await post(address.port, "{}", { Origin: "https://untrusted.example" });
    expect(denied.status).toBe(403);
    expect(denied.headers["access-control-allow-origin"]).toBeUndefined();
    const allowed = await post(address.port, "{bad", { Origin: "https://trusted.example", "Content-Type": "application/json" });
    expect(allowed.status).toBe(202);
    expect(allowed.headers["access-control-allow-origin"]).toBe("https://trusted.example");
    expect(JSON.parse(allowed.body)).toEqual({ received: "{bad" });
    expect((await post(address.port, Buffer.from([0xc3, 0x28]))).status).toBe(400);
    expect((await post(address.port, "x".repeat(17))).status).toBe(413);
    expect(stdout).not.toHaveBeenCalled();
    expect(stderr).toHaveBeenCalled();
  } finally {
    runtime.server_stop();
    await once(server, "close");
    stdout.mockRestore();
    stderr.mockRestore();
  }
});
