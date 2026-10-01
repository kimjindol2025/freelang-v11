import { spawn } from "child_process";
import * as fs from "fs";
import * as net from "net";
import * as os from "os";
import * as path from "path";
import * as esbuild from "esbuild";
import { lex } from "../lexer";
import { parse } from "../parser";
import { JSCodegen } from "../codegen-js";

test("generated FreeLang HTTP callbacks use the shared host with UTF-8 and Origin checks", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "freelang-codegen-http-"));
  const listener = net.createServer();
  let child: ReturnType<typeof spawn> | null = null;
  try {
    esbuild.buildSync({
      entryPoints: [path.join(__dirname, "../generated-http-host.ts")],
      outfile: path.join(directory, "generated-http-host.cjs"),
      bundle: true, platform: "node", format: "cjs", target: "node20", logLevel: "silent",
    });
    await new Promise<void>(resolve => listener.listen(0, "127.0.0.1", resolve));
    const address = listener.address();
    if (!address || typeof address === "string") throw new Error("no test port");
    const port = address.port;
    await new Promise<void>(resolve => listener.close(() => resolve()));
    const source = `(defn echo-http [request] {:context "HTTP callback" :returns "HTTP response"}
  {"status" 200 "contentType" "application/json; charset=utf-8"
   "body" (json-stringify {"got" (get request "body")})})
(server-post "/mcp" "echo-http")
(server-start {"port" ${port} "host" "127.0.0.1" "rawBody" true
               "rejectUnknownOrigins" true "allowedOrigins" ["https://trusted.example"]
               "accessLog" "stderr"})`;
    const generated = new JSCodegen().generate(parse(lex(source)));
    const serverFile = path.join(directory, "server.js");
    fs.writeFileSync(serverFile, generated);
    child = spawn(process.execPath, [serverFile], {
      env: { ...process.env, FREELANG_V11_ROOT: directory }, stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    child.stderr?.on("data", chunk => { stderr += chunk; });
    let response: Response | null = null;
    for (let attempt = 0; attempt < 50; attempt++) {
      if (child.exitCode !== null) throw new Error(`generated server exited: ${stderr}`);
      try {
        response = await fetch(`http://127.0.0.1:${port}/mcp`, {
          method: "POST", headers: { Origin: "https://trusted.example" }, body: "한글",
        });
        break;
      } catch { await new Promise(resolve => setTimeout(resolve, 100)); }
    }
    if (!response) throw new Error(`generated server did not listen: ${stderr}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ got: "한글" });
    const rejected = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: "POST", headers: { Origin: "https://untrusted.example" }, body: "blocked",
    });
    expect(rejected.status).toBe(403);
  } finally {
    if (listener.listening) await new Promise<void>(resolve => listener.close(() => resolve()));
    if (child && child.exitCode === null) {
      child.kill("SIGTERM");
      await new Promise(resolve => child!.once("exit", resolve));
    }
    fs.rmSync(directory, { recursive: true, force: true });
  }
}, 20000);
