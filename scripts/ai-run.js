#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { spawnSync } = require("child_process");

const REPO = path.resolve(__dirname, "..");
const BOOTSTRAP = path.join(REPO, "bootstrap.js");
const DEFAULT_VERIFIER = path.join(__dirname, "ai-run-verifier.js");
const MAX_SOURCE_BYTES = 256 * 1024;
const MAX_OUTPUT_BYTES = 4 * 1024 * 1024;

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", { mode: 0o600 });
}

function isoNow() {
  return new Date().toISOString();
}

function parseArgs(argv) {
  const options = { inputPath: null, expectedStdout: undefined, generateOnly: false, model: null, goalParts: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--input" && argv[i + 1]) options.inputPath = argv[++i];
    else if ((arg === "--expect" || arg === "--expect-stdout") && argv[i + 1] !== undefined) options.expectedStdout = argv[++i];
    else if (arg === "--model" && argv[i + 1]) options.model = argv[++i];
    else if (arg === "--generate-only") options.generateOnly = true;
    else options.goalParts.push(arg);
  }
  return options;
}

function readGoal(options) {
  let goal = options.goalParts.join(" ").trim();
  let expected = options.expectedStdout;
  if (options.inputPath) {
    let raw;
    try {
      raw = fs.readFileSync(path.resolve(options.inputPath), "utf8");
    } catch (_) {
      const error = new Error("input file does not exist or cannot be read");
      error.code = "E_AI_INPUT_NOT_FOUND";
      throw error;
    }
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === "string") goal = parsed.trim();
      else if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        goal = String(parsed.goal || parsed.request || parsed.prompt || "").trim();
        if (expected === undefined && typeof parsed.expected_stdout === "string") expected = parsed.expected_stdout;
      } else goal = raw.trim();
    } catch (_) {
      goal = raw.trim();
    }
  }
  if (!goal) {
    const error = new Error("a non-empty Goal is required");
    error.code = "E_AI_BAD_REQUEST";
    throw error;
  }
  return { goal, expectedStdout: expected };
}

function stripAnsi(value) {
  return value.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "");
}

function extractSource(response) {
  const text = stripAnsi(response).trim();
  const blocks = [...text.matchAll(/```(?:fl|freelang)?[\t ]*\r?\n([\s\S]*?)```/gi)];
  if (blocks.length > 1) return null;
  return (blocks.length === 1 ? blocks[0][1] : text).trim();
}

function restrictedSymbol(name) {
  const symbol = String(name).toLowerCase().replace(/_/g, "-");
  const exact = new Set([
    "call", "apply", "func-ref", "eval", "load", "require", "import", "use", "open",
    "defmacro", "macroexpand", "capability-enable", "capability-register", "capability-disable",
    "process-exit", "exit", "quit",
  ]);
  if (exact.has(symbol)) return true;
  return /^(?:process|shell|file|dir|env|http|tcp|udp|ws|db|sql|mysql|mariadb|mongo|redis|server|browser|fetch|storage|aws|gcp|azure|ollama|ai)-/.test(symbol);
}

function collectAstSymbols(node, found, seen) {
  if (!node || typeof node !== "object") return;
  if (seen.has(node)) return;
  seen.add(node);
  if (Array.isArray(node)) {
    for (const child of node) collectAstSymbols(child, found, seen);
    return;
  }
  if (node instanceof Map) {
    for (const [key, value] of node) {
      collectAstSymbols(key, found, seen);
      collectAstSymbols(value, found, seen);
    }
    return;
  }
  if (node.kind === "sexpr" && typeof node.op === "string") found.add(node.op);
  if (node.kind === "literal" && node.type === "symbol" && typeof node.value === "string") found.add(node.value);
  if (node.kind === "block") {
    if (typeof node.type === "string") found.add(node.type);
    if (typeof node.name === "string") found.add(node.name);
  }
  for (const value of Object.values(node)) collectAstSymbols(value, found, seen);
}

function inspectAuthority(ast) {
  const symbols = new Set();
  collectAstSymbols(ast, symbols, new WeakSet());
  const denied = [...symbols].filter(restrictedSymbol).sort();
  return { result: denied.length ? "DENY" : "PASS", denied_symbols: denied, policy: "pure-compute-and-stdout-v1" };
}

function safeRuntimeEnv(runDir) {
  const env = { FL_FILE_BASE: runDir, FL_STRICT: "1" };
  for (const key of ["PATH", "NODE_PATH", "TMPDIR", "LANG", "LC_ALL"]) {
    if (process.env[key]) env[key] = process.env[key];
  }
  return env;
}

function runProcess(command, args, options) {
  const startedAt = isoNow();
  const result = spawnSync(command, args, {
    ...options,
    encoding: "utf8",
    timeout: options.timeout,
    maxBuffer: MAX_OUTPUT_BYTES,
  });
  return {
    command: [command, ...args],
    started_at: startedAt,
    completed_at: isoNow(),
    exit_code: result.status == null ? 1 : result.status,
    signal: result.signal || null,
    timed_out: result.error?.code === "ETIMEDOUT",
    error_code: result.error?.code || null,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  };
}

function runGenerator(goal, expectedStdout, model) {
  const provider = process.env.FL_AI_PROVIDER || "opencode";
  if (provider !== "opencode") {
    const error = new Error("only the configured OpenCode provider is supported");
    error.code = "E_AI_PROVIDER_UNAVAILABLE";
    throw error;
  }
  const executable = process.env.FL_AI_OPENCODE_BIN || "opencode";
  const prompt = [
    "Write one complete FreeLang v11 source program for the user's Goal.",
    "Output only FreeLang source, with no prose or markdown fences.",
    "Use pure computation and stdout only. Do not use file, process, shell, environment, network, database, server, import, load, eval, or dynamic-call operations.",
    expectedStdout === undefined ? "No expected output was supplied; still write the smallest program that addresses the Goal." : `Required stdout, excluding one final newline: ${JSON.stringify(expectedStdout)}`,
    `Goal: ${JSON.stringify(goal)}`,
  ].join("\n");
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "freelang-ai-provider-"));
  let result;
  try {
    result = runProcess(executable, ["run", "--agent", "build", "--model", model, prompt], {
      cwd: scratch,
      env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" },
      timeout: Number(process.env.FL_AI_GENERATION_TIMEOUT_MS) || 90000,
    });
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
  if (result.error_code === "ENOENT") {
    const error = new Error("OpenCode executable is unavailable; set FL_AI_OPENCODE_BIN");
    error.code = "E_AI_PROVIDER_UNAVAILABLE";
    error.provider_result = result;
    throw error;
  }
  if (result.timed_out) {
    const error = new Error("OpenCode generation timed out");
    error.code = "E_AI_GENERATION_TIMEOUT";
    error.provider_result = result;
    throw error;
  }
  if (result.exit_code !== 0) {
    const error = new Error(`OpenCode generation failed with exit ${result.exit_code}`);
    error.code = "E_AI_GENERATION_FAILED";
    error.provider_result = result;
    throw error;
  }
  const source = extractSource(result.stdout);
  if (!source || Buffer.byteLength(source, "utf8") > MAX_SOURCE_BYTES) {
    const error = new Error("provider did not return one bounded FreeLang source program");
    error.code = "E_AI_GENERATION_INVALID";
    error.provider_result = result;
    throw error;
  }
  return { provider, executable, model, prompt, response: result.stdout, source: source.endsWith("\n") ? source : source + "\n", result };
}

function main(argv, runtime) {
  const options = parseArgs(argv);
  const evidenceId = `run-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${process.pid}-${crypto.randomBytes(4).toString("hex")}`;
  const runRoot = path.resolve(process.env.FL_AI_RUN_DIR || path.join(REPO, ".ai-run"));
  let runDir = null;
  let sourcePath = null;
  let sourceHash = null;
  let generationPath = null;
  let executionPath = null;
  let verifierInputPath = null;
  let verifierPath = null;
  let verifierEvidencePath = null;
  let stdout = "";
  let stderr = "";
  let errorCode = "";
  let errorMessage = "";
  let generationResult = "SKIP";
  let executionResult = "SKIP";
  let verifierResult = "SKIP";
  let syntaxResult = "SKIP";
  let authorityResult = "SKIP";
  let executionRecord = null;
  let generationRecord = null;
  let verificationRecord = null;

  try {
    fs.mkdirSync(runRoot, { recursive: true });
    runDir = path.join(runRoot, evidenceId);
    fs.mkdirSync(runDir, { recursive: false, mode: 0o700 });
    generationPath = path.join(runDir, "generation.json");
    executionPath = path.join(runDir, "execution.json");
    verifierInputPath = path.join(runDir, "verifier-input.json");
    verifierEvidencePath = path.join(runDir, "verification.json");
  } catch (error) {
    errorCode = "E_AI_EVIDENCE_STORAGE";
    errorMessage = "could not create a private evidence directory";
    emit("BLOCKED", 1);
  }

  function emit(status, exitCode) {
    const receiptPath = runDir ? path.join(runDir, "receipt.json") : null;
    const evidence = {
      generation: generationPath && fs.existsSync(generationPath) ? generationPath : null,
      execution: executionPath && fs.existsSync(executionPath) ? executionPath : null,
      verifier_input: verifierInputPath && fs.existsSync(verifierInputPath) ? verifierInputPath : null,
      verification: verifierEvidencePath && fs.existsSync(verifierEvidencePath) ? verifierEvidencePath : null,
    };
    const receipt = {
      schema: "freelang-ai-run-receipt-v1",
      evidence_id: evidenceId,
      status,
      exit_code: exitCode,
      completed_at: isoNow(),
      goal_sha256: this.goalHash || null,
      generated_source_path: sourcePath,
      generated_source_sha256: sourceHash,
      generation_result: generationResult,
      execution_result: executionResult,
      execution_exit_code: executionRecord ? executionRecord.exit_code : null,
      verifier_result: verifierResult,
      error_code: errorCode || null,
      error: errorMessage || null,
      verification: { syntax: syntaxResult, authority: authorityResult, runtime: executionResult, verifier: verifierResult },
      evidence,
    };
    if (receiptPath) {
      try { writeJson(receiptPath, receipt); } catch (_) { /* output remains fail-closed */ }
    }
    const result = {
      status,
      exit_code: exitCode,
      stdout,
      stderr,
      evidence_id: evidenceId,
      attempt: 1,
      error_code: errorCode || undefined,
      error: errorMessage || undefined,
      verification: { syntax: syntaxResult, authority: authorityResult, runtime: executionResult, verifier: verifierResult },
      generated_source_path: sourcePath || undefined,
      generated_source_sha256: sourceHash || undefined,
      execution_command: executionRecord?.command,
      execution_exit_code: executionRecord?.exit_code,
      actual_stdout: executionRecord?.stdout,
      verifier_input: verifierInputPath && fs.existsSync(verifierInputPath) ? verifierInputPath : undefined,
      verifier_result: verificationRecord?.result || verifierResult,
      evidence,
      receipt: receiptPath || undefined,
    };
    fs.writeSync(1, JSON.stringify(result) + "\n");
    process.exit(exitCode);
  }

  let input;
  try {
    input = readGoal(options);
  } catch (error) {
    errorCode = error.code || "E_AI_BAD_REQUEST";
    errorMessage = error.message;
    emit("BLOCKED", 1);
  }
  this.goalHash = sha256(input.goal);
  const model = options.model || process.env.FL_AI_MODEL || "opencode/mimo-v2.5-free";

  let generated;
  try {
    generated = runGenerator(input.goal, input.expectedStdout, model);
    sourcePath = path.join(runDir, "program.fl");
    fs.writeFileSync(sourcePath, generated.source, { flag: "wx", mode: 0o600 });
    sourceHash = sha256(fs.readFileSync(sourcePath));
    generationResult = "PASS";
    generationRecord = {
      schema: "freelang-ai-run-generation-v1",
      evidence_id: evidenceId,
      result: "GENERATED",
      provider: generated.provider,
      model: generated.model,
      command: [generated.executable, "run", "--agent", "build", "--model", generated.model],
      exit_code: generated.result.exit_code,
      prompt_sha256: sha256(generated.prompt),
      response_sha256: sha256(generated.response),
      source_path: sourcePath,
      source_sha256: sourceHash,
      created_at: isoNow(),
    };
    writeJson(generationPath, generationRecord);
  } catch (error) {
    generationResult = "FAIL";
    errorCode = error.code || "E_AI_GENERATION_FAILED";
    errorMessage = error.message;
    const providerResult = error.provider_result;
    generationRecord = {
      schema: "freelang-ai-run-generation-v1",
      evidence_id: evidenceId,
      result: "FAIL",
      provider: process.env.FL_AI_PROVIDER || "opencode",
      model,
      exit_code: providerResult ? providerResult.exit_code : null,
      error_code: errorCode,
      stderr_sha256: providerResult ? sha256(providerResult.stderr) : null,
      created_at: isoNow(),
    };
    try { writeJson(generationPath, generationRecord); } catch (_) {}
    emit(errorCode === "E_AI_GENERATION_INVALID" ? "FAILURE" : "BLOCKED", 1);
  }

  let ast;
  try {
    if (!runtime || typeof runtime.lex !== "function" || typeof runtime.parse !== "function") throw new Error("FreeLang parser is unavailable");
    ast = runtime.parse(runtime.lex(generated.source));
    syntaxResult = "PASS";
  } catch (error) {
    syntaxResult = "FAIL";
    errorCode = "E_AI_GENERATED_SYNTAX";
    errorMessage = String(error.message || error).slice(0, 500);
    emit("FAILURE", 1);
  }

  const authority = inspectAuthority(ast);
  authorityResult = authority.result;
  const authorityPath = path.join(runDir, "authority.json");
  writeJson(authorityPath, {
    schema: "freelang-ai-run-authority-v1",
    evidence_id: evidenceId,
    source_path: sourcePath,
    source_sha256: sourceHash,
    policy: authority.policy,
    result: authority.result,
    denied_symbols: authority.denied_symbols,
    checked_at: isoNow(),
  });
  if (authority.result === "DENY") {
    errorCode = "E_AI_AUTHORITY_DENY";
    errorMessage = `source requests an ungranted capability: ${authority.denied_symbols.join(", ")}`;
    emit("BLOCKED", 1);
  }

  if (options.generateOnly) {
    errorCode = "E_AI_EXECUTION_SKIPPED";
    errorMessage = "source was generated and stored, but execution was explicitly skipped";
    emit("BLOCKED", 1);
  }

  const command = process.execPath;
  const commandArgs = [BOOTSTRAP, "run", sourcePath];
  executionRecord = runProcess(command, commandArgs, {
    cwd: runDir,
    env: safeRuntimeEnv(runDir),
    timeout: Number(process.env.FL_AI_RUN_EXEC_TIMEOUT_MS) || 30000,
  });
  executionRecord.source_path = sourcePath;
  executionRecord.source_sha256 = sourceHash;
  executionRecord.cwd = runDir;
  executionRecord.timed_out = executionRecord.timed_out === true;
  executionRecord.stderr = executionRecord.stderr.slice(0, 65536);
  executionRecord.stdout = executionRecord.stdout.slice(0, MAX_OUTPUT_BYTES);
  writeJson(executionPath, executionRecord);
  stdout = executionRecord.stdout;
  stderr = executionRecord.stderr;
  executionResult = executionRecord.exit_code === 0 && !executionRecord.timed_out ? "PASS" : "FAIL";
  if (executionResult !== "PASS") {
    errorCode = executionRecord.timed_out ? "E_AI_EXECUTION_TIMEOUT" : "E_AI_EXECUTION_FAILED";
    errorMessage = `FreeLang runtime exited ${executionRecord.exit_code}`;
    emit("FAILURE", 1);
  }

  const verifierInput = {
    schema: "freelang-ai-run-verifier-input-v1",
    run_dir: runDir,
    source_path: sourcePath,
    generation_evidence_path: generationPath,
    execution_evidence_path: executionPath,
    bootstrap_path: BOOTSTRAP,
    expected_stdout: input.expectedStdout,
    timeout_ms: Number(process.env.FL_AI_RUN_VERIFY_TIMEOUT_MS) || 30000,
  };
  writeJson(verifierInputPath, verifierInput);
  verifierPath = path.resolve(process.env.FL_AI_RUN_VERIFIER || DEFAULT_VERIFIER);
  if (!fs.existsSync(verifierPath)) {
    verifierResult = "BLOCKED";
    errorCode = "E_AI_VERIFIER_UNAVAILABLE";
    errorMessage = "runtime executed, but the independent verifier is unavailable";
    emit("BLOCKED", 1);
  }

  const verifierProcess = runProcess(process.execPath, [verifierPath, verifierInputPath], {
    cwd: runDir,
    env: safeRuntimeEnv(runDir),
    timeout: Number(process.env.FL_AI_RUN_VERIFY_TIMEOUT_MS) || 30000,
  });
  try {
    verificationRecord = JSON.parse(verifierProcess.stdout);
  } catch (_) {
    verificationRecord = null;
  }
  if (verificationRecord) {
    writeJson(verifierEvidencePath, {
      ...verificationRecord,
      verifier_process_exit_code: verifierProcess.exit_code,
      verifier_process_timed_out: verifierProcess.timed_out,
      verifier_stderr_sha256: sha256(verifierProcess.stderr),
    });
  }
  verifierResult = verificationRecord?.result || "BLOCKED";
  if (verifierProcess.timed_out || verifierProcess.error_code || !verificationRecord) {
    verifierResult = "BLOCKED";
    errorCode = "E_AI_VERIFIER_FAILED_TO_RUN";
    errorMessage = "independent verifier did not return structured evidence";
    emit("BLOCKED", 1);
  }
  if (verifierResult !== "PASS" || verifierProcess.exit_code !== 0) {
    errorCode = verificationRecord?.code || "E_AI_VERIFIER_NOT_PASSED";
    errorMessage = verificationRecord?.message || "independent verifier did not pass";
    emit(verifierResult === "FAIL" ? "FAILURE" : "BLOCKED", 1);
  }

  executionResult = "PASS";
  verifierResult = "PASS";
  errorCode = "";
  errorMessage = "";
  emit("SUCCESS", 0);
}

if (require.main === module) main(process.argv.slice(2), null);

module.exports = { main, inspectAuthority, extractSource };
