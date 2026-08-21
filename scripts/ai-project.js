"use strict";
const fs = require("fs");
const path = require("path");
const cp = require("child_process");
const crypto = require("crypto");
const os = require("os");

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

function afjDbDeclared(m) {
  const database = m.database || {};
  return Boolean(database && /afj[-_ ]?db/i.test(String(database.type || database.engine || "")));
}
function afjDbRoot(root, m) {
  const configured = m.database || {};
  const value = configured.root || configured.path || process.env.AFJ_DB_ROOT || "/root/lang/afl-db/v2-afj";
  return path.resolve(root, value);
}
function afjDbStep(cli, dbRoot, args, name, predicate, errorCode, suggestion) {
  const command = [process.execPath, cli, ...args].map(value => JSON.stringify(String(value))).join(" ");
  const started = Date.now();
  let result;
  try {
    result = cp.spawnSync(process.execPath, [cli, ...args], { cwd: dbRoot, encoding: "utf8", timeout: 120000, maxBuffer: 1024 * 1024 });
  } catch (error) {
    return { name, status: "FAIL", command, exit_code: null, duration_ms: Date.now() - started, error_code: errorCode, phase: "afj-db", message: error.message, suggestion, evidence: [{ command, status: "FAIL", captured_at: new Date().toISOString() }] };
  }
  const stdout = String(result.stdout || "").trim().slice(-8000);
  const stderr = String(result.stderr || "").trim().slice(-8000);
  let data = null;
  for (const line of stdout.split(/\r?\n/).reverse()) {
    try { data = JSON.parse(line); break; } catch { /* build output is text */ }
  }
  const ok = result.status === 0 && (!predicate || predicate(data, stdout));
  const evidence = { command, status: ok ? "PASS" : "FAIL", exit_code: result.status, duration_ms: Date.now() - started, stdout, stderr, captured_at: new Date().toISOString() };
  return { name, status: ok ? "PASS" : "FAIL", command, exit_code: result.status, duration_ms: evidence.duration_ms, stdout, stderr, data, error_code: ok ? null : errorCode, phase: ok ? null : "afj-db", message: ok ? null : (stderr || stdout || (name + " failed")), suggestion: ok ? null : suggestion, evidence: [evidence] };
}
function afjDbResult(root, m, full) {
  const base = { name: "afj_db", required: true, status: "SKIP", command: null, exit_code: null, duration_ms: 0, reason: "AFJ DB is not declared by this project", evidence: [] };
  if (!afjDbDeclared(m)) return { ...base, required: false, status: "NOT_APPLICABLE" };
  const started = Date.now();
  const dbRoot = afjDbRoot(root, m);
  const cli = path.resolve(dbRoot, "src/cli.js");
  const runId = Date.now() + "-" + process.pid;
  const namespace = fs.mkdtempSync(path.join(os.tmpdir(), "fl-verify-afj-db-"));
  const dbDir = path.join(namespace, "db");
  const replayDir = path.join(namespace, "replay");
  const snapshotPath = path.join(namespace, "snapshot.json");
  const restoreDir = path.join(namespace, "restore");
  const key = "__fl_verify_" + runId;
  const value = { kind: "fl_verify", run_id: runId, value: "BIGWASH-AFJ-VERIFY", number: 12345, flag: true, list: ["afj", "verify"] };
  const stages = {};
  const evidence = [];
  const add = (stage, result) => { stages[stage] = result; evidence.push(...(result.evidence || [])); };
  try {
    if (!fs.existsSync(cli)) {
      add("connect", { name: "afj_db_connect", status: "FAIL", command: "AFJ DB CLI unavailable", exit_code: null, duration_ms: 0, error_code: "FL_AFJ_DB_CONNECT_FAILED", phase: "afj-db", message: "AFJ DB CLI was not found", suggestion: "check database.root and AFJ DB installation", evidence: [{ command: "AFJ DB CLI unavailable", status: "FAIL", captured_at: new Date().toISOString() }] });
    } else {
      add("connect", afjDbStep(cli, dbRoot, ["build"], "afj_db_connect", null, "FL_AFJ_DB_CONNECT_FAILED", "check AFJ DB compiler and runtime"));
    }
    if (stages.connect.status === "PASS") {
      add("write", afjDbStep(cli, dbRoot, ["append", dbDir, key, JSON.stringify(value), String(Date.now())], "afj_db_write", data => Boolean(data && (data.ok === true || data.event_id || data.id || data.seq)), "FL_AFJ_DB_WRITE_FAILED", "inspect AFJ DB append response and test namespace"));
      add("read", afjDbStep(cli, dbRoot, ["read-key", dbDir, key], "afj_db_read", data => Boolean(data && data.ok !== false), "FL_AFJ_DB_READ_FAILED", "inspect AFJ DB read-key response"));
      const readData = stages.read.data;
      const readValue = readData && (readData.value !== undefined ? readData.value : readData.record?.value);
      const equal = stages.read.status === "PASS" && JSON.stringify(readValue) === JSON.stringify(value);
      add("compare", { name: "afj_db_compare", status: equal ? "PASS" : "FAIL", command: "AFJ DB read value comparison", exit_code: equal ? 0 : 1, duration_ms: 0, error_code: equal ? null : "FL_AFJ_DB_VALUE_MISMATCH", phase: equal ? null : "afj-db", message: equal ? null : "AFJ DB value differs from the written value", suggestion: equal ? null : "compare run_id, value, number, flag, and list fields", evidence: [{ command: "AFJ DB read value comparison", status: equal ? "PASS" : "FAIL", run_id: runId, collection: dbDir, expected: value, actual: readValue, captured_at: new Date().toISOString() }] });
      add("verify", afjDbStep(cli, dbRoot, ["verify", dbDir], "afj_db_verify", data => Boolean(data && data.ok === true), "FL_AFJ_DB_VERIFY_FAILED", "inspect AFJ DB hash-chain verification output"));
      if (full && stages.verify.status === "PASS") {
        add("replay", afjDbStep(cli, dbRoot, ["replay", dbDir, replayDir], "afj_db_replay", data => Boolean(data && (data.pass === true || data.ok === true)), "FL_AFJ_DB_REPLAY_FAILED", "inspect AFJ DB replay output"));
        add("snapshot", afjDbStep(cli, dbRoot, ["snapshot", dbDir, snapshotPath], "afj_db_snapshot", data => Boolean(data && (data.ok === true || fs.existsSync(snapshotPath))), "FL_AFJ_DB_SNAPSHOT_FAILED", "inspect AFJ DB snapshot output"));
        if (stages.snapshot.status === "PASS") add("restore", afjDbStep(cli, dbRoot, ["restore", snapshotPath, restoreDir], "afj_db_restore", data => Boolean(data && (data.ok === true || data.pass === true)), "FL_AFJ_DB_RESTORE_FAILED", "inspect AFJ DB restore output"));
      }
    }
  } finally {
    const cleanupStarted = Date.now();
    let cleanupError = null;
    try { fs.rmSync(namespace, { recursive: true, force: true }); } catch (error) { cleanupError = error; }
    const cleanupOk = !cleanupError && !fs.existsSync(namespace);
    add("cleanup", { name: "afj_db_cleanup", status: cleanupOk ? "PASS" : "FAIL", command: "remove temporary namespace " + namespace, exit_code: cleanupOk ? 0 : 1, duration_ms: Date.now() - cleanupStarted, error_code: cleanupOk ? null : "FL_AFJ_DB_CLEANUP_FAILED", phase: cleanupOk ? null : "afj-db", message: cleanupError ? cleanupError.message : null, suggestion: cleanupOk ? null : "remove only the generated fl-verify temporary namespace", evidence: [{ command: "remove temporary namespace " + namespace, status: cleanupOk ? "PASS" : "FAIL", exit_code: cleanupOk ? 0 : 1, captured_at: new Date().toISOString() }] });
  }
  const requiredStages = ["connect", "write", "read", "compare", "verify", "cleanup"].concat(full ? ["replay", "snapshot", "restore"] : []);
  const failed = requiredStages.find(stage => !stages[stage] || stages[stage].status !== "PASS");
  const failedStage = failed ? stages[failed] : null;
  return { name: "afj_db", required: true, status: failed ? "FAIL" : "PASS", command: stages.connect?.command || null, exit_code: failedStage?.exit_code ?? 0, duration_ms: Date.now() - started, reason: failed ? (failed + " failed") : (full ? "AFJ DB smoke and integrity checks passed" : "AFJ DB connect/write/read/compare/verify/cleanup passed"), connect: stages.connect?.status || "FAIL", write: stages.write?.status || "SKIP", read: stages.read?.status || "SKIP", compare: stages.compare?.status || "SKIP", verify: stages.verify?.status || "SKIP", replay: stages.replay?.status || (full ? "FAIL" : "NOT_APPLICABLE"), snapshot: stages.snapshot?.status || (full ? "FAIL" : "NOT_APPLICABLE"), restore: stages.restore?.status || (full ? "FAIL" : "NOT_APPLICABLE"), cleanup: stages.cleanup?.status || "FAIL", run_id: runId, namespace, endpoint: cli, error_code: failedStage?.error_code || null, phase: failedStage?.phase || null, message: failedStage?.message || null, suggestion: failedStage?.suggestion || null, evidence };
}

function normalizeOutput(value) {
  return String(value || "").trim().split(/\r?\n/).map(line => {
    if (line.trim() === "nil") return "null";
    try {
      const parsed = JSON.parse(line);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return JSON.stringify(Object.fromEntries(Object.entries(parsed).sort(([a], [b]) => a.localeCompare(b))));
      return JSON.stringify(parsed);
    } catch { return line.trim(); }
  }).filter(Boolean).join("\n");
}
function parityResult(root, m) {
  const config = m.verify?.parity;
  const base = { name: "parity", required: true, status: "SKIP", command: null, exit_code: null, duration_ms: 0, reason: "parity cases are not configured", cases: 0, passed: 0, failed: 0, evidence: [] };
  if (!config || !Array.isArray(config.cases) || !config.cases.length) return base;
  const started = Date.now(), results = [];
  for (let i = 0; i < config.cases.length; i++) {
    const item = config.cases[i], source = path.resolve(root, item.source), out = path.join("/tmp", "fl-parity-" + process.pid + "-" + i);
    const interpreter = (item.interpreter_command || config.interpreter_command || "node /root/lang/freelang-v11/bootstrap.js run {source}").replaceAll("{source}", JSON.stringify(source)).replaceAll("{out}", JSON.stringify(out));
    const native = (item.native_command || config.native_command || "").replaceAll("{source}", JSON.stringify(source)).replaceAll("{out}", JSON.stringify(out));
    const ir = cp.spawnSync(interpreter, { cwd: root, shell: true, encoding: "utf8", timeout: 120000, maxBuffer: 1024 * 1024 });
    const nr = native ? cp.spawnSync(native, { cwd: root, shell: true, encoding: "utf8", timeout: 120000, maxBuffer: 1024 * 1024 }) : { status: null, stdout: "", stderr: "native command not configured" };
    const iout = (ir.stdout || "").trim(), nout = (nr.stdout || "").trim(), equal = ir.status === 0 && nr.status === 0 && normalizeOutput(iout) === normalizeOutput(nout);
    results.push({ name: item.name || path.basename(source), source: rel(root, source), status: equal ? "PASS" : "FAIL", interpreter: iout, native: nout, interpreter_exit_code: ir.status, native_exit_code: nr.status, interpreter_command: interpreter, native_command: native, stderr: ((ir.stderr || "") + (nr.stderr || "")).trim().slice(-8000) });
  }
  const failed = results.filter(item => item.status === "FAIL");
  return { name: "parity", required: true, status: failed.length ? "FAIL" : "PASS", command: "configured parity cases", exit_code: failed.length ? 1 : 0, duration_ms: Date.now() - started, reason: failed.length ? "interpreter/native results differ" : "all configured parity cases passed", cases: results.length, passed: results.length - failed.length, failed: failed.length, case: failed[0]?.name || null, error_code: failed.length ? "FL_RUNTIME_PARITY_MISMATCH" : null, evidence: results };
}
function sha256File(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"); }
function aflEvidenceResult(root, m, checks) {
  const dir = path.resolve(root, m.verify?.evidence_dir || ".fl-verify/evidence");
  fs.mkdirSync(dir, { recursive: true });
  const execution = path.join(dir, "freelang-verify-execution.json");
  fs.writeFileSync(execution, JSON.stringify({ project: m.project.name, generated_at: new Date().toISOString(), checks }, null, 2) + "\n");
  const evidenceId = "verify-execution";
  const gates = ["project", "syntax", "type", "interpreter", "native", "parity"].concat(checks.afj_db?.required ? ["afj_db"] : []).map(name => ({ gate_id: name, gate_type: name === "project" ? "schema" : name === "parity" ? "integrity" : "test", status: "pass", command: checks[name].command || "project manifest discovery", exit_code: checks[name].exit_code === null ? 0 : checks[name].exit_code, evidence_refs: ["evidence://" + evidenceId] }));
  const claim = path.join(dir, "freelang.done-claim.json");
  const document = { done_claim_version: "1.0.0", claim_id: "claim-" + m.project.name + "-verify", contract_id: "contract-" + m.project.name + "-verify", project: m.project.name, work_item: "language-core-runtime-parity", source: { repository: root, changed_paths: [m.verify?.input || "project"], source_state: "dirty-working-tree", working_tree_hash: sha256File(execution) }, target_truth: { runtime: "freelang-v11-fx2", entrypoint: m.verify?.input || "configured parity cases", environment_hash: sha256File(execution) }, gates, evidence: [{ evidence_id: evidenceId, evidence_type: "execution_log", path: execution, sha256: sha256File(execution) }], trace_refs: [], repairs: [], done_claim_pass: true, patch_scope: { changed_paths: [m.verify?.input || "project"] } };
  fs.writeFileSync(claim, JSON.stringify(document, null, 2) + "\n");
  const command = (m.verify?.evidence_validator || "node /root/lang/AFL-Core-2/src/validate-done-claim.js {claim}").replace("{claim}", JSON.stringify(claim));
  const result = commandResult(root, "evidence", command, true, "AFL-Core done-claim validator");
  return { ...result, evidence: [...result.evidence, { evidence_id: evidenceId, evidence_type: "execution_log", path: execution, sha256: sha256File(execution) }, { evidence_id: "done-claim", evidence_type: "done_claim_report", path: claim, sha256: sha256File(claim) }] };
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
  checks.parity = parityResult(root, m);
  const hasFront = Boolean(m.frontend?.files?.length);
  checks.afj_db = afjDbResult(root, m, full);
  checks.api = full ? commandResult(root, "api", configuredCommand(m, "api"), Boolean(m.routes?.length)) : { name: "api", required: false, status: "SKIP", command: null, exit_code: null, duration_ms: 0, reason: "use fl verify --full", evidence: [] };
  checks.front = hasFront ? commandResult(root, "front", configuredCommand(m, "front") || (fs.existsSync(path.join(root, "fl-front-build.js")) ? "node fl-front-build.js" : null), true, "FreeLang Front build command is not configured") : { name: "front", required: false, status: "NOT_APPLICABLE", command: null, exit_code: null, duration_ms: 0, reason: "no FreeLang Front sources detected", evidence: [] };
  checks.browser = full ? commandResult(root, "browser", configuredCommand(m, "browser"), hasFront) : { name: "browser", required: false, status: "SKIP", command: null, exit_code: null, duration_ms: 0, reason: "use fl verify --full", evidence: [] };
  checks.flsc = withFlsc ? commandResult(root, "flsc", configuredCommand(m, "flsc") || process.env.FLSC_VERIFY_COMMAND, false) : { name: "flsc", required: false, status: "SKIP", command: null, exit_code: null, duration_ms: 0, reason: "use --with-flsc", evidence: [] };
  const requiredCore = ["project", "syntax", "type", "interpreter", "native", "parity"];
  if (checks.afj_db.required) requiredCore.push("afj_db");
  const coreReady = requiredCore.every(name => checks[name].status === "PASS");
  checks.evidence = configuredCommand(m, "evidence") ? commandResult(root, "evidence", configuredCommand(m, "evidence"), true) : coreReady ? aflEvidenceResult(root, m, checks) : { name: "evidence", required: true, status: "SKIP", command: null, exit_code: null, duration_ms: 0, reason: full ? "core checks must pass before AFL-Core evidence validation" : "use fl verify --full", evidence: [] };
  for (const check of Object.values(checks)) if (check.status === "FAIL") errors.push({ code: check.error_code || ("FL_" + check.name.toUpperCase() + "_FAILED"), phase: check.phase || check.name, status: "FAIL", file: m.verify?.input || null, line: null, column: null, problem: check.name === "afj_db" ? "afj_db_verification_failed" : "verification_command_failed", symbol: null, message: check.message || (check.name + " verification failed"), suggestion: check.suggestion || ("inspect the captured command, stdout, and stderr in checks." + check.name + ".evidence"), endpoint: check.endpoint || null });
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
module.exports = { inspect, verify, manifest, commandResult, afjDbResult, afjDbStep };