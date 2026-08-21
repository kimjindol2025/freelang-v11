"use strict";
const fs = require("fs");
const path = require("path");
const cp = require("child_process");

const IGNORE = new Set([".git", "node_modules", "dist", "build", ".cache", "coverage"]);
const CHECKS = ["project", "syntax", "type", "interpreter", "native", "parity", "afj_db", "api", "front", "browser", "flsc", "evidence"];

function walk(root) {
  const out = [];
  function visit(dir) {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (IGNORE.has(entry.name)) continue;
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile()) out.push(file);
    }
  }
  visit(root);
  return out;
}
function readJson(file) { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return null; } }
function rel(root, file) { return path.relative(root, file).replaceAll(path.sep, "/"); }
function projectManifest(root) {
  for (const name of ["freelang.project.json", ".fl-project.json", "fl.project.json"]) {
    const value = readJson(path.join(root, name));
    if (value) return value;
  }
  return null;
}
function balanced(source) {
  let depth = 0, quote = false, escaped = false;
  for (const c of source) {
    if (quote) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') quote = false;
      continue;
    }
    if (c === '"') { quote = true; continue; }
    if (c === "(") depth++;
    if (c === ")") depth--;
    if (depth < 0) return false;
  }
  return !quote && depth === 0;
}
function effects(source) {
  const result = [];
  if (/db[-_](query|get|find)|collection|afj[-_]db/i.test(source)) result.push("db.read");
  if (/db[-_](exec|insert|update|delete)|append|snapshot/i.test(source)) result.push("db.write");
  if (/fetch!?|http|network|server[-_]req/i.test(source)) result.push("network");
  if (/file[-_](read|write)|read[-_]file|write[-_]file/i.test(source)) result.push(/write/i.test(source) ? "file.write" : "file.read");
  if (/deploy|process|shell|exec/i.test(source)) result.push("dangerous");
  return result.length ? result : ["pure"];
}
function manifest(root) {
  const files = walk(root);
  const configured = projectManifest(root);
  const packageJson = readJson(path.join(root, "package.json")) || {};
  const fl = files.filter(f => f.endsWith(".fl"));
  const front = files.filter(f => f.endsWith(".flx"));
  const routes = front.filter(f => /(^|\/)pages\//.test(rel(root, f))).map(f => {
    const route = rel(root, f).replace(/^pages\//, "").replace(/\.flx$/, "");
    return { path: "/" + (route === "index" ? "" : route), source: rel(root, f), methods: ["GET"].concat(/render_post/.test(fs.readFileSync(f, "utf8")) ? ["POST"] : []) };
  });
  const collections = [];
  for (const file of files.filter(f => /\.(fl|flx|json|sql)$/.test(f))) {
    const source = fs.readFileSync(file, "utf8");
    for (const match of source.matchAll(/(?:collection|collection_name|table)\s*[=:]?\s*["']([A-Za-z_][\w-]*)["']/gi)) {
      if (!collections.some(item => item.name === match[1])) collections.push({ name: match[1], source: rel(root, file) });
    }
  }
  const functions = [];
  for (const file of files.filter(f => /\.(fl|flx)$/.test(f))) {
    fs.readFileSync(file, "utf8").split(/\r?\n/).forEach((line, index) => {
      const match = line.match(/\((?:defn|define)\s+([A-Za-z_][\w!?-]*)\s*(?:\[([^\]]*)\])?/);
      if (match) functions.push({ name: match[1], signature: match[2] ? "(" + match[2].trim() + ")" : null, source: rel(root, file), line: index + 1, effects: effects(line) });
    });
  }
  const tests = files.filter(f => /(^|\/)(test|tests|spec)(\/|[-_.])|\.test\./.test(rel(root, f))).map(f => rel(root, f));
  const generated = {
    project: { name: configured?.project?.name || packageJson.name || path.basename(root), root },
    runtime: configured?.runtime || { language: "FreeLang AFJ", cli: "fl", version: packageJson.version || null },
    backend: configured?.backend || { files: fl.map(f => rel(root, f)) },
    frontend: configured?.frontend || { language: front.length ? "FreeLang Front" : null, files: front.map(f => rel(root, f)) },
    database: configured?.database || { engine: collections.length ? "AFJ DB/declared project database" : null, collections },
    routes: configured?.routes || routes,
    modules: configured?.modules || [...new Set(fl.map(f => rel(root, f).split("/")[0]).filter(Boolean))],
    functions,
    collections: configured?.collections || collections,
    dependencies: configured?.dependencies || packageJson.dependencies || {},
    tests: configured?.tests || { files: tests, commands: packageJson.scripts || {} },
    deploy: configured?.deploy || { files: files.map(f => rel(root, f)).filter(f => /deploy|docker|systemd|ecosystem|compose/i.test(f)) },
    health: { inspect: "available", warnings: [] },
    ai: { manifest: configured ? "loaded" : "generated-from-source", structured_errors: true, effects: true }
  };
  generated.verify = configured?.verify || {};
  return generated;
}
function commandResult(root, name, command, required, reason) {
  const base = { name, required, status: "SKIP", command: command || null, exit_code: null, duration_ms: 0, reason: reason || (command ? "command executed" : "verification command is not configured"), evidence: [] };
  if (!command) return base;
  const started = Date.now();
  let result;
  try { result = cp.spawnSync(command, { cwd: root, shell: true, encoding: "utf8", timeout: 120000, maxBuffer: 1024 * 1024 }); }
  catch (error) {
    return { ...base, status: "FAIL", duration_ms: Date.now() - started, error_code: error.code || "FL_VERIFY_SPAWN_FAILED", message: error.message, evidence: [{ command, status: "FAIL" }] };
  }
  const stdout = (result.stdout || "").trim();
  const stderr = (result.stderr || "").trim();
  const status = result.status === 0 ? "PASS" : "FAIL";
  const evidence = [{ command, status, exit_code: result.status, stdout: stdout.slice(-8000), stderr: stderr.slice(-8000), captured_at: new Date().toISOString() }];
  return { ...base, status, exit_code: result.status, duration_ms: Date.now() - started, stdout: stdout.slice(-8000), stderr: stderr.slice(-8000), error_code: status === "FAIL" ? "FL_VERIFY_COMMAND_FAILED" : null, message: status === "FAIL" ? (stderr || stdout || "verification command failed") : null, evidence };
}
function configuredCommand(m, name) {
  const value = m.verify?.[name + "_command"] || m.verify?.commands?.[name];
  return typeof value === "string" && value.trim() ? value : null;
}
function officialFx2Command(root, m) {
  const script = path.join(root, "tools", "fl-verify.sh");
  const build = path.join(root, "fl-build.sh");
  if (!fs.existsSync(script) || !fs.existsSync(build)) return null;
  const input = m.verify?.input || (fs.existsSync(path.join(root, "spec", "conformance.fl")) ? "spec/conformance.fl" : null);
  return input ? "bash tools/fl-verify.sh official " + JSON.stringify(input) : null;
}
function syntaxFallback(root) {
  const files = walk(root).filter(f => /\.(fl|flx)$/.test(f));
  const errors = files.filter(f => !balanced(fs.readFileSync(f, "utf8"))).map(f => ({
    code: "FL_PARSE_001", phase: "syntax", status: "FAIL", file: rel(root, f), line: 1, column: 1,
    problem: "unbalanced_delimiters", symbol: null, message: "괄호 또는 문자열이 닫히지 않았습니다",
    suggestion: "괄호 쌍과 문자열 종료를 확인하세요"
  }));
  return errors;
}
function inspect(root, args) {
  const data = manifest(root);
  const section = args.find(item => !item.startsWith("--"));
  const value = section && data[section] !== undefined ? data[section] : data;
  if (args.includes("--json")) console.log(JSON.stringify(value, null, 2));
  else if (section) console.log(section + ":\n" + JSON.stringify(value, null, 2));
  else {
    console.log("project: " + data.project.name);
    for (const key of ["runtime", "backend", "frontend", "database", "routes", "modules", "functions", "collections", "dependencies", "tests", "deploy", "health", "ai"]) console.log(key + ": " + JSON.stringify(data[key]));
  }
  return 0;
}
function verify(root, args) {
  const m = manifest(root);
  const full = args.includes("--full");
  const withFlsc = args.includes("--with-flsc");
  const checks = {};
  const errors = [];
  checks.project = { name: "project", required: true, status: "PASS", command: "project manifest discovery", exit_code: 0, duration_ms: 0, reason: "project context loaded", evidence: [{ source: "manifest", project: m.project.name }] };
  const syntaxCommand = configuredCommand(m, "syntax");
  checks.syntax = syntaxCommand ? commandResult(root, "syntax", syntaxCommand, true) : { name: "syntax", required: true, status: "SKIP", command: null, exit_code: null, duration_ms: 0, reason: "no official syntax command configured", evidence: [] };
  if (errors.length) { checks.syntax.status = "FAIL"; checks.syntax.reason = "source delimiter scan found errors"; checks.syntax.evidence = errors; }
  checks.type = commandResult(root, "type", configuredCommand(m, "type"), true);
  const interpreterCommand = configuredCommand(m, "interpreter") || configuredCommand(m, "run");
  checks.interpreter = commandResult(root, "interpreter", interpreterCommand, true);
  const nativeCommand = configuredCommand(m, "native") || officialFx2Command(root, m);
  checks.native = commandResult(root, "native", nativeCommand, true);
  checks.parity = commandResult(root, "parity", configuredCommand(m, "parity"), true);
  const hasFront = Boolean(m.frontend?.files?.length);
  checks.afj_db = full ? commandResult(root, "afj_db", configuredCommand(m, "afj_db") || configuredCommand(m, "db"), Boolean(m.database?.engine)) : { name: "afj_db", required: false, status: "SKIP", command: null, exit_code: null, duration_ms: 0, reason: "use fl verify --full", evidence: [] };
  checks.api = full ? commandResult(root, "api", configuredCommand(m, "api"), Boolean(m.routes?.length)) : { name: "api", required: false, status: "SKIP", command: null, exit_code: null, duration_ms: 0, reason: "use fl verify --full", evidence: [] };
  checks.front = hasFront ? commandResult(root, "front", configuredCommand(m, "front") || (fs.existsSync(path.join(root, "fl-front-build.js")) ? "node fl-front-build.js" : null), true, "FreeLang Front build command is not configured") : { name: "front", required: false, status: "NOT_APPLICABLE", command: null, exit_code: null, duration_ms: 0, reason: "no FreeLang Front sources detected", evidence: [] };
  checks.browser = full ? commandResult(root, "browser", configuredCommand(m, "browser"), hasFront) : { name: "browser", required: false, status: "SKIP", command: null, exit_code: null, duration_ms: 0, reason: "use fl verify --full", evidence: [] };
  checks.flsc = withFlsc ? commandResult(root, "flsc", configuredCommand(m, "flsc") || process.env.FLSC_VERIFY_COMMAND, false) : { name: "flsc", required: false, status: "SKIP", command: null, exit_code: null, duration_ms: 0, reason: "use --with-flsc", evidence: [] };
  checks.evidence = full ? commandResult(root, "evidence", configuredCommand(m, "evidence"), true) : { name: "evidence", required: true, status: "SKIP", command: null, exit_code: null, duration_ms: 0, reason: "use fl verify --full", evidence: [] };
  for (const check of Object.values(checks)) if (check.status === "FAIL") errors.push({ code: check.error_code || ("FL_" + check.name.toUpperCase() + "_FAILED"), phase: check.name, status: "FAIL", file: m.verify?.input || null, line: null, column: null, problem: "verification_command_failed", symbol: null, message: check.message || (check.name + " verification failed"), suggestion: "inspect the captured command, stdout, and stderr in checks." + check.name + ".evidence" });
  const canClaim = Object.values(checks).filter(c => c.required).every(c => c.status === "PASS");
  const result = { project: m.project.name, status: Object.values(checks).some(c => c.status === "FAIL") ? "FAIL" : canClaim ? "PASS" : "INCOMPLETE", can_claim_done: canClaim, checks, errors, options: { full, with_flsc: withFlsc } };
  if (args.includes("--json")) console.log(JSON.stringify(result, null, 2));
  else {
    for (const name of CHECKS) { const check = checks[name]; if (check) console.log(name.toUpperCase().padEnd(14) + check.status); }
    console.log("CAN_CLAIM_DONE=" + canClaim);
    for (const error of errors) console.log(JSON.stringify(error));
  }
  return result.status === "PASS" ? 0 : 1;
}
module.exports = { inspect, verify, manifest, commandResult };