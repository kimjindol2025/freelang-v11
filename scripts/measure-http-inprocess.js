#!/usr/bin/env node
/**
 * scripts/measure-http-inprocess.js — 코어 http 콜당 실측 (별도 서버 프로세스)
 *   node scripts/measure-http-inprocess.js
 */
"use strict";

const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { performance } = require("perf_hooks");
const esbuild = require("esbuild");

function buildTempBundle() {
  const out = path.join(os.tmpdir(), `fl-stdlib-http-${process.pid}.cjs`);
  esbuild.buildSync({
    entryPoints: [path.join(__dirname, "..", "src", "stdlib-http.ts")],
    bundle: true,
    platform: "node",
    format: "cjs",
    outfile: out,
  });
  return out;
}

function startChildServer() {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        "-e",
        `require('http').createServer((q,s)=>s.end('ok')).listen(0,'127.0.0.1',function(){process.stdout.write(String(this.address().port))})`,
      ],
      { stdio: ["ignore", "pipe", "pipe"] }
    );
    let out = "";
    const timer = setTimeout(() => reject(new Error("server timeout")), 5000);
    child.stdout.on("data", (d) => {
      out += d.toString();
      const port = parseInt(out.trim(), 10);
      if (port > 0) {
        clearTimeout(timer);
        resolve({ port, child });
      }
    });
    child.on("error", reject);
  });
}

async function main() {
  const bundle = buildTempBundle();
  const { __nodeHttpRequestForTest: nodeHttpRequest } = require(bundle);
  const { port, child } = await startChildServer();
  const url = `http://127.0.0.1:${port}/`;
  for (let i = 0; i < 3; i++) nodeHttpRequest(url, "GET");
  const xs = [];
  for (let i = 0; i < 31; i++) {
    const t0 = performance.now();
    const r = nodeHttpRequest(url, "GET");
    xs.push(performance.now() - t0);
    if (r.status !== 200) {
      console.error("bad status", r);
      process.exit(1);
    }
  }
  xs.sort((a, b) => a - b);
  const median = xs[15];
  console.log(
    JSON.stringify(
      {
        schema: "fl-measure-http-inprocess/1",
        median_ms: Math.round(median * 1000) / 1000,
        min_ms: Math.round(xs[0] * 1000) / 1000,
        max_ms: Math.round(xs[30] * 1000) / 1000,
        n: 31,
        pass: median < 10,
      },
      null,
      2
    )
  );
  child.kill("SIGTERM");
  try {
    fs.unlinkSync(bundle);
  } catch {
    /* ignore */
  }
  process.exit(median < 10 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
