/**
 * HTTP-INPROCESS-001 — spawnSync 제거 후 콜당 지연·계약 검증
 * 대상 서버는 별도 프로세스 (메인 Atomics.wait 중 같은 프로세스 서버는 수락 불가)
 */
import * as http from "http";
import { spawn } from "child_process";
import { performance } from "perf_hooks";
import { __nodeHttpRequestForTest as nodeHttpRequest } from "../stdlib-http";

function startChildServer(): Promise<{ port: number; kill: () => void }> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        "-e",
        `
const http=require('http');
const s=http.createServer((req,res)=>{
  if(req.method==='POST'){
    let b=''; req.on('data',d=>b+=d); req.on('end',()=>{res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({echo:b}))});
    return;
  }
  res.writeHead(200,{'Content-Type':'text/plain'}); res.end('ok');
});
s.listen(0,'127.0.0.1',()=>{ process.stdout.write(String(s.address().port)); });
`,
      ],
      { stdio: ["ignore", "pipe", "pipe"] }
    );
    let out = "";
    child.stdout!.on("data", (d) => {
      out += d.toString();
      const port = parseInt(out.trim(), 10);
      if (port > 0) {
        resolve({
          port,
          kill: () => {
            try {
              child.kill("SIGTERM");
            } catch {
              /* ignore */
            }
          },
        });
      }
    });
    child.on("error", reject);
    const timer = setTimeout(() => reject(new Error("child server start timeout")), 5000);
    child.stdout!.on("data", () => clearTimeout(timer));
  });
}

describe("http in-process (HTTP-INPROCESS-001)", () => {
  let port = 0;
  let kill: () => void = () => undefined;

  beforeAll(async () => {
    const s = await startChildServer();
    port = s.port;
    kill = s.kill;
  });

  afterAll(() => {
    kill();
  });

  test("GET returns status/body", () => {
    const r = nodeHttpRequest(`http://127.0.0.1:${port}/`, "GET");
    expect(r.error).toBeUndefined();
    expect(r.status).toBe(200);
    expect(r.body).toBe("ok");
  });

  test("POST returns body", () => {
    const r = nodeHttpRequest(
      `http://127.0.0.1:${port}/`,
      "POST",
      { "Content-Type": "application/json" },
      '{"a":1}'
    );
    expect(r.status).toBe(200);
    expect(r.body).toContain("echo");
  });

  test("per-call median under 10ms (n=21, warm 3)", () => {
    const url = `http://127.0.0.1:${port}/`;
    for (let i = 0; i < 3; i++) nodeHttpRequest(url, "GET");
    const xs: number[] = [];
    for (let i = 0; i < 21; i++) {
      const t0 = performance.now();
      const r = nodeHttpRequest(url, "GET");
      xs.push(performance.now() - t0);
      expect(r.status).toBe(200);
    }
    xs.sort((a, b) => a - b);
    const median = xs[10];
    // eslint-disable-next-line no-console
    console.log(`[http-inprocess] median_ms=${median.toFixed(2)} min=${xs[0].toFixed(2)} max=${xs[20].toFixed(2)}`);
    expect(median).toBeLessThan(10);
  });
});
